const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate, JWT_SECRET, JWT_OPTIONS } = require('../middleware/auth');
const { loadUserPermissions } = require('../middleware/permissions');
const { validate, schemas } = require('../middleware/validate');

router.post('/login', validate(schemas.login), async (req, res) => {
    try {
        const { username, password, tenant } = req.body;

        const tenantCondition = tenant ? 'AND t.code = ?' : 'AND t.code = ?';
        const tenantParams = tenant ? [username, tenant] : [username, 'DEFAULT'];

        const user = queryOne(`
            SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.code as tenant_code, t.plan, t.max_users
            FROM users u
            JOIN tenants t ON u.tenant_id = t.id
            WHERE u.username = ? ${tenantCondition}
        `, tenantParams);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: { code: 'ACCOUNT_DISABLED', message: 'Your account has been disabled' }
            });
        }

        const passwordMatch = bcrypt.compareSync(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
            });
        }

        const permissions = loadUserPermissions(user.tenant_id, user.role_id);

        const defaultFactory = queryOne(
            'SELECT id, name, code FROM factories WHERE tenant_id = ? AND is_active = 1 LIMIT 1',
            [user.tenant_id]
        );

        const tokenPayload = {
            id: user.id,
            tenantId: user.tenant_id,
            username: user.username,
            roleId: user.role_id,
            factoryId: user.factory_id || (defaultFactory ? defaultFactory.id : null),
            permissions
        };

        const accessToken = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

        run('UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?',
            [new Date().toISOString(), user.id]);

        logActivity(user.tenant_id, user.id, 'auth', 'login', user.id, null, { username }, req);

        res.json({
            success: true,
            data: {
                accessToken,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    roleId: user.role_id,
                    roleName: user.role_name,
                    tenantId: user.tenant_id,
                    tenantName: user.tenant_name,
                    factoryId: tokenPayload.factoryId,
                    factoryName: defaultFactory?.name
                },
                permissions,
                settings: {
                    companyName: 'FeedMill ERP',
                    currency: 'INR'
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Login failed' }
        });
    }
});

router.post('/logout', authenticate, async (req, res) => {
    try {
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

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = queryOne(`
            SELECT u.id, u.username, u.name, u.name_bn, u.email, u.phone, u.role_id, u.factory_id,
                   u.department, u.designation, u.is_active, r.name as role_name, t.name as tenant_name
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

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 6 characters' }
            });
        }

        const user = queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);

        if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }
            });
        }

        const newHash = bcrypt.hashSync(newPassword, 10);
        run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
            [newHash, new Date().toISOString(), req.user.id]);

        logActivity(req.tenantId, req.user.id, 'auth', 'password_changed', req.user.id, null, null, req);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to change password' }
        });
    }
});

router.post('/refresh-token', authenticate, async (req, res) => {
    try {
        const user = queryOne(`
            SELECT u.*, t.id as tenant_id, t.code as tenant_code
            FROM users u
            JOIN tenants t ON u.tenant_id = t.id
            WHERE u.id = ? AND u.is_active = 1
        `, [req.user.id]);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'User not found' }
            });
        }

        const permissions = loadUserPermissions(user.tenant_id, user.role_id);

        const tokenPayload = {
            id: user.id,
            tenantId: user.tenant_id,
            username: user.username,
            roleId: user.role_id,
            factoryId: user.factory_id,
            permissions
        };

        const accessToken = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

        res.json({
            success: true,
            data: { accessToken }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to refresh token' }
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

module.exports = router;
