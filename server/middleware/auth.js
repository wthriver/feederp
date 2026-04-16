const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, queryOne, run } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required');
    process.exit(1);
}

const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY = '7d';
const TOKEN_VERSION = 1;

function generateTokenId() {
    return crypto.randomBytes(16).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function getDb() {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    const dbPath = path.join(__dirname, '../../data/feedmill.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    return new Database(dbPath);
}

function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Access token required'
                }
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            if (decoded.version !== TOKEN_VERSION) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'TOKEN_VERSION_INVALID',
                        message: 'Please re-authenticate with updated security'
                    }
                });
            }

            if (decoded.tokenId) {
                const db = getDb();
                try {
                    const session = db.prepare(`
                        SELECT is_active, expires_at FROM active_sessions 
                        WHERE id = ? AND user_id = ? AND token_hash = ?
                    `).get(decoded.tokenId, decoded.id, hashToken(token));

                    if (!session) {
                        return res.status(401).json({
                            success: false,
                            error: {
                                code: 'SESSION_NOT_FOUND',
                                message: 'Session not found or revoked'
                            }
                        });
                    }

                    if (!session.is_active) {
                        return res.status(401).json({
                            success: false,
                            error: {
                                code: 'SESSION_REVOKED',
                                message: 'Session has been revoked'
                            }
                        });
                    }

                    if (new Date(session.expires_at) < new Date()) {
                        db.prepare('UPDATE active_sessions SET is_active = 0 WHERE id = ?').run(decoded.tokenId);
                        return res.status(401).json({
                            success: false,
                            error: {
                                code: 'SESSION_EXPIRED',
                                message: 'Session has expired'
                            }
                        });
                    }

                    db.prepare('UPDATE active_sessions SET last_activity = ? WHERE id = ?')
                        .run(new Date().toISOString(), decoded.tokenId);
                } finally {
                    db.close();
                }
            }

            req.user = {
                id: decoded.id,
                tenantId: decoded.tenantId,
                username: decoded.username,
                roleId: decoded.roleId,
                factoryId: decoded.factoryId,
                tokenId: decoded.tokenId
            };

            req.tenantId = decoded.tenantId;

            if (req.query.factory_id) {
                req.factoryId = req.query.factory_id;
            } else {
                req.factoryId = decoded.factoryId;
            }

            next();
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'TOKEN_EXPIRED',
                        message: 'Access token expired',
                        expiredAt: jwtError.expiredAt
                    }
                });
            }

            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid access token'
                }
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication error'
            }
        });
    }
}

function createSession(tokenId, user, accessToken, req) {
    const db = getDb();
    try {
        const tokenHash = hashToken(accessToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        db.prepare(`
            INSERT INTO active_sessions (id, user_id, tenant_id, token_hash, ip_address, user_agent, device_info, last_activity, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            tokenId,
            user.id,
            user.tenantId,
            tokenHash,
            req?.ip || req?.connection?.remoteAddress || 'unknown',
            req?.headers?.['user-agent'] || 'unknown',
            req?.headers?.['x-device-info'] || null,
            new Date().toISOString(),
            expiresAt.toISOString()
        );

        db.prepare('DELETE FROM active_sessions WHERE expires_at < ? OR is_active = 0').run(new Date().toISOString());
        db.prepare('DELETE FROM active_sessions WHERE user_id = ? AND is_active = 1 AND created_at < datetime("now", "-7 days")').run(user.id);

        return tokenId;
    } finally {
        db.close();
    }
}

function generateTokens(user, req = {}) {
    const tokenId = generateTokenId();
    const accessToken = jwt.sign({
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        roleId: user.roleId,
        factoryId: user.factoryId,
        tokenId,
        version: TOKEN_VERSION,
        type: 'access'
    }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    const refreshToken = jwt.sign({
        id: user.id,
        tokenId,
        type: 'refresh'
    }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    if (user.tenantId) {
        createSession(tokenId, user, accessToken, req);
    }

    return { accessToken, refreshToken, tokenId };
}

function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        return null;
    }
}

function revokeToken(tokenId) {
    const db = getDb();
    try {
        db.prepare('UPDATE active_sessions SET is_active = 0 WHERE id = ?').run(tokenId);
    } finally {
        db.close();
    }
}

function revokeAllUserTokens(userId) {
    const db = getDb();
    try {
        db.prepare('UPDATE active_sessions SET is_active = 0 WHERE user_id = ?').run(userId);
    } finally {
        db.close();
    }
}

function getActiveSessions(userId) {
    const db = getDb();
    try {
        return db.prepare(`
            SELECT id, ip_address, user_agent, device_info, last_activity, expires_at, created_at
            FROM active_sessions WHERE user_id = ? AND is_active = 1
            ORDER BY last_activity DESC
        `).all(userId);
    } finally {
        db.close();
    }
}

function revokeSession(sessionId, userId) {
    const db = getDb();
    try {
        const result = db.prepare('UPDATE active_sessions SET is_active = 0 WHERE id = ? AND user_id = ?').run(sessionId, userId);
        return result.changes > 0;
    } finally {
        db.close();
    }
}

function authorize(...modules) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }

        if (modules.length === 0) {
            return next();
        }

        const userPermissions = req.user.permissions || {};

        const hasPermission = modules.some(module => {
            const modulePerms = userPermissions[module];
            return modulePerms && modulePerms.length > 0;
        });

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this module'
                }
            });
        }

        next();
    };
}

function checkPermission(module, permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }

        const userPermissions = req.user.permissions || {};
        const modulePerms = userPermissions[module] || [];

        if (!modulePerms.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Permission '${permission}' required for module '${module}'`
                }
            });
        }

        next();
    };
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            tenantId: decoded.tenantId,
            username: decoded.username,
            roleId: decoded.roleId,
            factoryId: decoded.factoryId
        };
        req.tenantId = decoded.tenantId;
        req.factoryId = decoded.factoryId;
    } catch (error) {
        // Token invalid, continue without auth
    }

    next();
}

const JWT_OPTIONS = {
    expiresIn: ACCESS_TOKEN_EXPIRY
};

module.exports = {
    authenticate,
    authorize,
    checkPermission,
    optionalAuth,
    generateTokens,
    verifyRefreshToken,
    revokeToken,
    revokeAllUserTokens,
    getActiveSessions,
    revokeSession,
    hashToken,
    JWT_SECRET,
    JWT_OPTIONS,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY
};
