const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate, generateTokens, verifyRefreshToken, revokeToken, revokeAllUserTokens, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } = require('../middleware/auth');
const { loadUserPermissions } = require('../middleware/permissions');

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const loginAttempts = new Map();

function isAccountLocked(username) {
    const attempts = loginAttempts.get(username);
    if (!attempts) return false;
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        if (Date.now() - attempts.lastAttempt < LOCKOUT_DURATION) {
            return true;
        }
        loginAttempts.delete(username);
        return false;
    }
    return false;
}

function recordFailedLogin(username) {
    let attempts = loginAttempts.get(username) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(username, attempts);
}

function clearFailedLogins(username) {
    loginAttempts.delete(username);
}

function generateMFASecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        const code = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                    Math.random().toString(36).substring(2, 6).toUpperCase();
        codes.push(code);
    }
    return codes;
}

function verifyTOTP(secret, token) {
    const { authenticator } = require('otplib');
    return authenticator.verify({ token, secret });
}

function validatePasswordComplexity(password) {
    const errors = [];
    if (password.length < PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (!PASSWORD_REGEX.test(password)) {
        errors.push('Password must contain uppercase, lowercase, number, and special character');
    }
    return errors;
}

router.post('/login', async (req, res) => {
    let body = req.body;
    if (!body || typeof body !== 'object') {
        try {
            body = JSON.parse(req.rawBody || '{}');
        } catch(e) {
            body = {};
        }
    }
    
    const { username, password } = body || {};
    console.log('LOGIN ATTEMPT:', username);
    
    if (!username || !password) {
        return res.status(400).json({ success: false, error: { message: 'Username and password required' } });
    }

    if (isAccountLocked(username)) {
        const attempts = loginAttempts.get(username);
        const remainingTime = Math.ceil((LOCKOUT_DURATION - (Date.now() - attempts.lastAttempt)) / 1000);
        return res.status(429).json({ 
            success: false, 
            error: { 
                code: 'ACCOUNT_LOCKED',
                message: `Too many failed attempts. Try again in ${remainingTime} seconds`,
                retryAfter: remainingTime
            } 
        });
    }
    
    const user = queryOne(`SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.code as tenant_code 
        FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.username = ?`, [username]);
    
    if (!user) {
        recordFailedLogin(username);
        return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }
    
    if (!user.is_active) {
        return res.status(401).json({ success: false, error: { message: 'Account disabled' } });
    }
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
        recordFailedLogin(username);
        return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    clearFailedLogins(username);

    const mfa = queryOne('SELECT is_active FROM user_mfa WHERE user_id = ?', [user.id]);
    
    if (mfa?.is_active) {
        return res.json({
            success: true,
            data: {
                mfaRequired: true,
                username: user.username
            }
        });
    }

    run('UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?', 
        [new Date().toISOString(), user.id]);

    const userData = {
        id: user.id,
        tenantId: user.tenant_id,
        username: user.username,
        roleId: user.role_id,
        factoryId: user.factory_id
    };

    const tokens = generateTokens(userData);

    const permissions = loadUserPermissions(user.tenant_id, user.role_id);

    logActivity(user.tenant_id, user.id, 'auth', 'login', user.id, null, null, req);

    res.json({
        success: true,
        data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 1800,
            tokenType: 'Bearer',
            user: { id: user.id, username: user.username, name: user.name },
            permissions
        }
    });
});

router.post('/logout', authenticate, async (req, res) => {
    try {
        if (req.user.tokenId) {
            revokeToken(req.user.tokenId);
        }

        logActivity(req.tenantId, req.user.id, 'auth', 'logout', req.user.id, null, null, req);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Logout failed' }
        });
    }
});

router.post('/logout-all', authenticate, async (req, res) => {
    try {
        revokeAllUserTokens(req.user.id);
        logActivity(req.tenantId, req.user.id, 'auth', 'logout_all', req.user.id, null, null, req);
        res.json({
            success: true,
            message: 'Logged out from all devices'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to logout all devices' }
        });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, error: { message: 'Refresh token required' } });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ success: false, error: { message: 'Invalid refresh token' } });
        }

        const user = queryOne(`
            SELECT u.*, t.id as tenant_id, t.code as tenant_code
            FROM users u
            JOIN tenants t ON u.tenant_id = t.id
            WHERE u.id = ? AND u.is_active = 1
        `, [decoded.id]);

        if (!user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
        }

        const userData = {
            id: user.id,
            tenantId: user.tenant_id,
            username: user.username,
            roleId: user.role_id,
            factoryId: user.factory_id
        };

        const tokens = generateTokens(userData);

        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: 1800,
                tokenType: 'Bearer'
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to refresh token' }
        });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = queryOne(`
            SELECT u.id, u.username, u.name, u.name_bn, u.email, u.phone, u.role_id, u.factory_id,
                   u.department, u.designation, u.is_active, u.last_login, u.login_count, r.name as role_name, t.name as tenant_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            JOIN tenants t ON u.tenant_id = t.id
            WHERE u.id = ? AND u.tenant_id = ?
        `, [req.user.id, req.tenantId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        const permissions = loadUserPermissions(req.tenantId, user.role_id);

        const factories = query(
            'SELECT id, name, code FROM factories WHERE tenant_id = ? AND is_active = 1',
            [req.tenantId]
        );

        const settings = {};
        query(`SELECT key, value FROM settings WHERE tenant_id = ?`, [req.tenantId]).forEach(s => {
            settings[s.key] = s.value;
        });

        res.json({
            success: true,
            data: {
                user: {
                    ...user,
                    tenantId: req.tenantId
                },
                permissions,
                factories,
                settings
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to get profile' }
        });
    }
});

router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Current and new password required' }
            });
        }

        const passwordErrors = validatePasswordComplexity(newPassword);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'WEAK_PASSWORD', message: passwordErrors.join('. ') }
            });
        }

        const user = queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);

        if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }
            });
        }

        const newHash = bcrypt.hashSync(newPassword, 12);
        run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
            [newHash, new Date().toISOString(), req.user.id]);

        revokeAllUserTokens(req.user.id);

        logActivity(req.tenantId, req.user.id, 'auth', 'password_changed', req.user.id, null, null, req);

        res.json({
            success: true,
            message: 'Password changed successfully. Please login again on other devices.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to change password' }
        });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { username, resetToken, newPassword } = req.body;

        if (!username || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Username, reset token, and new password required' }
            });
        }

        const passwordErrors = validatePasswordComplexity(newPassword);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'WEAK_PASSWORD', message: passwordErrors.join('. ') }
            });
        }

        const user = queryOne('SELECT id, tenant_id FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        const newHash = bcrypt.hashSync(newPassword, 12);
        run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
            [newHash, new Date().toISOString(), user.id]);

        revokeAllUserTokens(user.id);

        logActivity(user.tenant_id, user.id, 'auth', 'password_reset', user.id, null, null, req);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to reset password' }
        });
    }
});

const verificationTokens = new Map();
const resetTokens = new Map();

router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Verification token is required' }
            });
        }

        const tokenData = verificationTokens.get(token);

        if (!tokenData) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' }
            });
        }

        if (Date.now() > tokenData.expiresAt) {
            verificationTokens.delete(token);
            return res.status(400).json({
                success: false,
                error: { code: 'TOKEN_EXPIRED', message: 'Verification token has expired' }
            });
        }

        run('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?',
            [new Date().toISOString(), tokenData.userId]);

        verificationTokens.delete(token);

        logActivity(tokenData.tenantId, tokenData.userId, 'auth', 'email_verified', tokenData.userId, null, null, req);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to verify email' }
        });
    }
});

router.post('/resend-verification', authenticate, async (req, res) => {
    try {
        const user = queryOne('SELECT id, email, tenant_id FROM users WHERE id = ?', [req.user.id]);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        if (user.email_verified) {
            return res.json({
                success: true,
                message: 'Email already verified'
            });
        }

        const verifyToken = uuidv4();
        const tokenExpiry = Date.now() + 60 * 60 * 1000;

        verificationTokens.set(verifyToken, {
            userId: user.id,
            tenantId: user.tenant_id,
            email: user.email,
            expiresAt: tokenExpiry
        });

        console.log(`[EMAIL VERIFY] Verification token for ${user.email}: ${verifyToken}`);

        res.json({
            success: true,
            message: 'Verification email sent',
            data: {
                verifyToken,
                expiresIn: 3600
            }
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to resend verification' }
        });
    }
});

router.get('/verification-status', authenticate, async (req, res) => {
    try {
        const user = queryOne('SELECT email_verified FROM users WHERE id = ?', [req.user.id]);

        res.json({
            success: true,
            data: {
                emailVerified: !!user?.email_verified
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to get verification status' }
        });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email is required' }
            });
        }

        const user = queryOne('SELECT id, username, tenant_id FROM users WHERE email = ? AND is_active = 1', [email]);

        if (!user) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive password reset instructions.'
            });
        }

        const resetToken = uuidv4();
        const tokenExpiry = Date.now() + 60 * 60 * 1000;

        resetTokens.set(resetToken, {
            userId: user.id,
            tenantId: user.tenant_id,
            username: user.username,
            email,
            expiresAt: tokenExpiry
        });

        console.log(`[PASSWORD RESET] Token generated for ${email}: ${resetToken}`);

        logActivity(user.tenant_id, user.id, 'auth', 'password_reset_requested', user.id, null, { email }, req);

        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive password reset instructions.',
            data: {
                resetToken,
                expiresIn: 3600,
                instructions: 'Use the token to reset your password via POST /auth/reset-password'
            }
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to process request' }
        });
    }
});

router.post('/verify-reset-token', async (req, res) => {
    try {
        const { resetToken } = req.body;

        if (!resetToken) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Reset token is required' }
            });
        }

        const tokenData = resetTokens.get(resetToken);

        if (!tokenData) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' }
            });
        }

        if (Date.now() > tokenData.expiresAt) {
            resetTokens.delete(resetToken);
            return res.status(400).json({
                success: false,
                error: { code: 'TOKEN_EXPIRED', message: 'Reset token has expired' }
            });
        }

        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                username: tokenData.username
            }
        });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to verify token' }
        });
    }
});

router.get('/tenants', async (req, res) => {
    try {
        const tenants = query(
            'SELECT id, code, name, plan FROM tenants WHERE is_active = 1'
        );

        res.json({
            success: true,
            data: tenants
        });
    } catch (error) {
        console.error('Get tenants error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to get tenants' }
        });
    }
});

router.post('/signup', async (req, res) => {
    let body = req.body;
    if (!body || typeof body !== 'object') {
        try {
            body = JSON.parse(req.rawBody || '{}');
        } catch(e) {
            body = {};
        }
    }
    
    const { companyName, userName, email, password, phone, plan } = body || {};
    
    if (!companyName || !userName || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: { message: 'Company name, username, email, and password are required' } 
        });
    }
    
    console.log('SIGNUP ATTEMPT:', { companyName, userName, email });
    
    try {
        const tenantCode = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) + Math.floor(Math.random() * 1000);
        
        const existingUser = queryOne('SELECT id FROM users WHERE username = ?', [userName]);
        if (existingUser) {
            return res.status(400).json({ success: false, error: { message: 'Username already exists' } });
        }
        
        const existingEmail = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(400).json({ success: false, error: { message: 'Email already exists' } });
        }
        
        const tenantId = uuidv4();
        const userId = uuidv4();
        const passwordHash = bcrypt.hashSync(password, 10);
        
        const selectedPlan = plan || 'starter';
        const planLimits = {
            starter: { max_users: 5, max_factories: 2 },
            professional: { max_users: 20, max_factories: 5 },
            enterprise: { max_users: 999, max_factories: 999 }
        };
        
        run(`INSERT INTO tenants (id, name, code, email, plan, max_users, max_factories, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, companyName, tenantCode, email, selectedPlan, planLimits[selectedPlan].max_users, planLimits[selectedPlan].max_factories, 1, new Date().toISOString(), new Date().toISOString()]);
        
        run('INSERT INTO settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)',
            [uuidv4(), tenantId, 'currency', 'INR']);
        run('INSERT INTO settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)',
            [uuidv4(), tenantId, 'timezone', 'Asia/Kolkata']);
        
        const roleId = queryOne('SELECT id FROM roles WHERE tenant_id = ? AND is_system = 1', [tenantId])?.id || 'admin';
        
        run(`INSERT INTO users (id, tenant_id, username, name, email, password_hash, role_id, phone, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, tenantId, userName, userName, email, passwordHash, roleId, phone || null, 1, new Date().toISOString()]);
        
        run('INSERT INTO factories (id, tenant_id, name, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), tenantId, 'Main Factory', 'MAIN', 1, new Date().toISOString()]);
        
        const units = [
            { name: 'Kilogram', code: 'KG', type: 'weight' },
            { name: 'Metric Ton', code: 'MT', type: 'weight' },
            { name: 'Piece', code: 'PC', type: 'quantity' },
            { name: 'Liter', code: 'L', type: 'volume' },
            { name: 'Quintal', code: 'Q', type: 'weight' }
        ];
        units.forEach(unit => {
            run('INSERT INTO units (id, tenant_id, name, code, type, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), tenantId, unit.name, unit.code, unit.type, 1, new Date().toISOString()]);
        });
        
        const currencies = [
            { name: 'Indian Rupee', code: 'INR', symbol: '₹' },
            { name: 'US Dollar', code: 'USD', symbol: '$' },
            { name: 'Bangladeshi Taka', code: 'BDT', symbol: '৳' }
        ];
        currencies.forEach(curr => {
            run('INSERT INTO currencies (id, tenant_id, name, code, symbol, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), tenantId, curr.name, curr.code, curr.symbol, 1, new Date().toISOString()]);
        });
        
        logActivity(tenantId, userId, 'auth', 'signup', userId, null, { companyName, userName, email }, req);
        
        const userData = {
            id: userId,
            tenantId: tenantId,
            username: userName,
            roleId: roleId,
            factoryId: null
        };
        
        const tokens = generateTokens(userData);
        
        console.log('SIGNUP SUCCESS:', { tenantId, userId, tenantCode });
        
        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: 1800,
                tokenType: 'Bearer',
                user: { id: userId, username: userName, name: userName, email },
                tenant: { id: tenantId, name: companyName, code: tenantCode, plan: selectedPlan }
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to create account' }
        });
    }
});

router.post('/mfa/setup', authenticate, async (req, res) => {
    try {
        const existing = queryOne('SELECT * FROM user_mfa WHERE user_id = ?', [req.user.id]);
        
        if (existing?.is_active) {
            return res.status(400).json({
                success: false,
                error: { code: 'MFA_ALREADY_ENABLED', message: 'MFA is already enabled' }
            });
        }
        
        const secret = generateMFASecret();
        const backupCodes = generateBackupCodes();
        const encryptedBackupCodes = bcrypt.hashSync(backupCodes.join(','), 10);
        
        if (existing) {
            run(`UPDATE user_mfa SET secret = ?, backup_codes_encrypted = ?, is_active = 1, failed_attempts = 0 WHERE user_id = ?`,
                [secret, encryptedBackupCodes, req.user.id]);
        } else {
            run(`INSERT INTO user_mfa (id, user_id, secret, backup_codes_encrypted, method, is_active, failed_attempts)
                 VALUES (?, ?, ?, ?, 'totp', 1, 0)`,
                [uuidv4(), req.user.id, secret, encryptedBackupCodes]);
        }
        
        logActivity(req.tenantId, req.user.id, 'auth', 'mfa_enabled', req.user.id, null, null, req);
        
        const otpauthUrl = `otpauth://totp/FeedMillERP:${req.user.username}?secret=${secret}&issuer=FeedMillERP`;
        
        res.json({
            success: true,
            message: 'MFA enabled successfully',
            data: {
                secret,
                backupCodes,
                otpauthUrl
            }
        });
    } catch (error) {
        console.error('MFA setup error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to setup MFA' }
        });
    }
});

router.post('/mfa/verify', async (req, res) => {
    try {
        const { username, token, backupCode } = req.body;
        
        if (!token && !backupCode) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Token or backup code required' }
            });
        }
        
        const user = queryOne('SELECT id, tenant_id FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'User not found' }
            });
        }
        
        const mfa = queryOne('SELECT * FROM user_mfa WHERE user_id = ? AND is_active = 1', [user.id]);
        
        if (!mfa) {
            return res.status(400).json({
                success: false,
                error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled for this user' }
            });
        }
        
        if (backupCode) {
            const storedCodes = query('SELECT code FROM used_backup_codes WHERE mfa_id = ?', [mfa.id]);
            if (storedCodes.some(s => bcrypt.compareSync(backupCode, bcrypt.hashSync(s.code, 10)))) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BACKUP_CODE_USED', message: 'Backup code already used' }
                });
            }
            
            if (bcrypt.compareSync(backupCode, mfa.backup_codes_encrypted)) {
                run('INSERT INTO used_backup_codes (id, mfa_id, code) VALUES (?, ?, ?)',
                    [uuidv4(), mfa.id, bcrypt.hashSync(backupCode, 10)]);
                
                const tokens = generateTokens({
                    id: user.id,
                    tenantId: user.tenant_id,
                    username,
                    roleId: null,
                    factoryId: null
                });
                
                return res.json({
                    success: true,
                    data: {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        expiresIn: 1800,
                        tokenType: 'Bearer',
                        mfaVerified: true
                    }
                });
            }
        }
        
        try {
            const { authenticator } = require('otplib');
            const isValid = authenticator.verify({ token, secret: mfa.secret });
            
            if (!isValid) {
                run('UPDATE user_mfa SET failed_attempts = failed_attempts + 1 WHERE id = ?', [mfa.id]);
                return res.status(401).json({
                    success: false,
                    error: { code: 'INVALID_TOKEN', message: 'Invalid MFA token' }
                });
            }
            
            const tokens = generateTokens({
                id: user.id,
                tenantId: user.tenant_id,
                username,
                roleId: null,
                factoryId: null
            });
            
            res.json({
                success: true,
                data: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresIn: 1800,
                    tokenType: 'Bearer',
                    mfaVerified: true
                }
            });
        } catch (e) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Invalid MFA token' }
            });
        }
    } catch (error) {
        console.error('MFA verify error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to verify MFA' }
        });
    }
});

router.post('/mfa/disable', authenticate, async (req, res) => {
    try {
        const { password, token } = req.body;
        
        const user = queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_PASSWORD', message: 'Invalid password' }
            });
        }
        
        const mfa = queryOne('SELECT * FROM user_mfa WHERE user_id = ?', [req.user.id]);
        
        if (!mfa) {
            return res.status(400).json({
                success: false,
                error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled' }
            });
        }
        
        try {
            const { authenticator } = require('otplib');
            if (!authenticator.verify({ token, secret: mfa.secret })) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'INVALID_TOKEN', message: 'Invalid MFA token' }
                });
            }
        } catch (e) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Invalid MFA token' }
            });
        }
        
        run('UPDATE user_mfa SET is_active = 0 WHERE user_id = ?', [req.user.id]);
        run('DELETE FROM used_backup_codes WHERE mfa_id = ?', [mfa.id]);
        
        logActivity(req.tenantId, req.user.id, 'auth', 'mfa_disabled', req.user.id, null, null, req);
        
        res.json({
            success: true,
            message: 'MFA disabled successfully'
        });
    } catch (error) {
        console.error('MFA disable error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to disable MFA' }
        });
    }
});

router.get('/mfa/status', authenticate, async (req, res) => {
    try {
        const mfa = queryOne('SELECT is_active, method, failed_attempts, last_verified FROM user_mfa WHERE user_id = ?', [req.user.id]);
        
        res.json({
            success: true,
            data: {
                enabled: !!mfa?.is_active,
                method: mfa?.method || null,
                backupCodesRemaining: mfa?.is_active 
                    ? 10 - queryOne('SELECT COUNT(*) as cnt FROM used_backup_codes WHERE mfa_id = ?', [mfa.id])?.cnt || 0 
                    : 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to get MFA status' }
        });
    }
});

router.post('/mfa/backup-codes', authenticate, async (req, res) => {
    try {
        const mfa = queryOne('SELECT * FROM user_mfa WHERE user_id = ? AND is_active = 1', [req.user.id]);
        
        if (!mfa) {
            return res.status(400).json({
                success: false,
                error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled' }
            });
        }
        
        run('DELETE FROM used_backup_codes WHERE mfa_id = ?', [mfa.id]);
        
        const backupCodes = generateBackupCodes();
        const encryptedBackupCodes = bcrypt.hashSync(backupCodes.join(','), 10);
        
        run('UPDATE user_mfa SET backup_codes_encrypted = ? WHERE id = ?', [encryptedBackupCodes, mfa.id]);
        
        logActivity(req.tenantId, req.user.id, 'auth', 'mfa_backup_codes_reset', req.user.id, null, null, req);
        
        res.json({
            success: true,
            message: 'Backup codes regenerated',
            data: { backupCodes }
        });
    } catch (error) {
        console.error('Backup codes error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to regenerate backup codes' }
        });
    }
});

module.exports = router;