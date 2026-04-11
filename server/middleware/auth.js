const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'feedmill-erp-dev-secret-change-in-production';

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

            req.user = {
                id: decoded.id,
                tenantId: decoded.tenantId,
                username: decoded.username,
                roleId: decoded.roleId,
                factoryId: decoded.factoryId
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
                        message: 'Access token expired'
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
    expiresIn: '8h'
};

module.exports = {
    authenticate,
    authorize,
    checkPermission,
    optionalAuth,
    JWT_SECRET,
    JWT_OPTIONS
};
