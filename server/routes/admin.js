const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission, loadUserPermissions } = require('../middleware/permissions');

// Users
router.get('/users', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const users = query(`
            SELECT u.id, u.username, u.name, u.name_bn, u.email, u.phone, u.role_id, u.department, u.designation,
                   u.is_active, u.last_login, u.login_count, r.name as role_name, f.name as factory_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN factories f ON u.factory_id = f.id
            WHERE u.tenant_id = ?
            ORDER BY u.name
        `, [req.tenantId]);

        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/users/:id', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const user = queryOne(`
            SELECT u.*, r.name as role_name, f.name as factory_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN factories f ON u.factory_id = f.id
            WHERE u.id = ? AND u.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

        const permissions = loadUserPermissions(req.tenantId, user.role_id);

        res.json({ success: true, data: { ...user, permissions } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/users', authenticate, requirePermission('admin', 'add'), async (req, res) => {
    try {
        const { username, password, name, name_bn, email, phone, role_id, factory_id, department, designation } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' } });
        }

        const existing = queryOne('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ success: false, error: { code: 'DUPLICATE', message: 'Username already exists' } });
        }

        const id = uuidv4();
        const passwordHash = bcrypt.hashSync(password, 10);

        run(`INSERT INTO users (id, tenant_id, username, password_hash, name, name_bn, email, phone, role_id, factory_id, department, designation, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, username, passwordHash, name, name_bn, email, phone, role_id, factory_id, department, designation, req.user.id]);

        logActivity(req.tenantId, req.user.id, 'admin', 'user_created', id, null, { name, username }, req);

        res.json({ success: true, data: { id }, message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/users/:id', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { name, name_bn, email, phone, role_id, factory_id, department, designation, is_active } = req.body;

        run(`UPDATE users SET name = ?, name_bn = ?, email = ?, phone = ?, role_id = ?, factory_id = ?, department = ?, designation = ?, is_active = ?
             WHERE id = ? AND tenant_id = ?`,
            [name, name_bn, email, phone, role_id, factory_id, department, designation, is_active ?? 1, req.params.id, req.tenantId]);

        logActivity(req.tenantId, req.user.id, 'admin', 'user_updated', req.params.id, null, req.body, req);

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/users/:id/reset-password', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' } });
        }

        const passwordHash = bcrypt.hashSync(new_password, 10);
        run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'admin', 'password_reset', req.params.id, null, null, req);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/users/:id', authenticate, requirePermission('admin', 'delete'), async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_OPERATION', message: 'Cannot delete your own account' } });
        }

        run('UPDATE users SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        logActivity(req.tenantId, req.user.id, 'admin', 'user_deleted', req.params.id, null, null, req);

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = queryOne(`
            SELECT u.id, u.username, u.name, u.name_bn, u.email, u.phone, u.role_id, u.department, u.designation,
                   u.factory_id, u.last_login, u.login_count, r.name as role_name, f.name as factory_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN factories f ON u.factory_id = f.id
            WHERE u.id = ? AND u.tenant_id = ?
        `, [req.user.id, req.tenantId]);

        if (!user) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, name_bn, email, phone } = req.body;

        run(`UPDATE users SET name = ?, name_bn = ?, email = ?, phone = ?
             WHERE id = ? AND tenant_id = ?`,
            [name, name_bn, email, phone, req.user.id, req.tenantId]);

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password || new_password.length < 6) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' } });
        }

        const user = queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        const isValid = bcrypt.compareSync(current_password, user.password_hash);
        if (!isValid) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
        }

        const passwordHash = bcrypt.hashSync(new_password, 10);
        run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);

        logActivity(req.tenantId, req.user.id, 'admin', 'password_changed', req.user.id, null, null, req);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Roles
router.get('/roles', authenticate, async (req, res) => {
    try {
        const roles = query('SELECT * FROM roles WHERE tenant_id = ? OR is_system = 1 ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: roles });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/roles', authenticate, requirePermission('admin', 'add'), async (req, res) => {
    try {
        const { name, name_bn, description, permissions } = req.body;
        const id = uuidv4();

        run(`INSERT INTO roles (id, tenant_id, name, name_bn, description) VALUES (?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, name_bn, description]);

        if (permissions) {
            permissions.forEach(p => {
                run(`INSERT INTO role_permissions (id, role_id, module, permission, granted) VALUES (?, ?, ?, ?, 1)`,
                    [uuidv4(), id, p.module, p.permission]);
            });
        }

        res.json({ success: true, data: { id }, message: 'Role created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/roles/:id/permissions', authenticate, async (req, res) => {
    try {
        const permissions = query('SELECT * FROM role_permissions WHERE role_id = ?', [req.params.id]);

        const permMap = {};
        permissions.forEach(p => {
            if (!permMap[p.module]) permMap[p.module] = [];
            permMap[p.module].push(p.permission);
        });

        res.json({ success: true, data: permMap });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/roles/:id/permissions', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { permissions } = req.body;

        run('DELETE FROM role_permissions WHERE role_id = ?', [req.params.id]);

        if (permissions) {
            permissions.forEach(p => {
                run(`INSERT INTO role_permissions (id, role_id, module, permission, granted) VALUES (?, ?, ?, ?, 1)`,
                    [uuidv4(), req.params.id, p.module, p.permission]);
            });
        }

        res.json({ success: true, message: 'Permissions updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Activity Log
router.get('/activity-log', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const { module, user_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT al.*, u.name as user_name FROM activity_log al
                   LEFT JOIN users u ON al.user_id = u.id
                   WHERE al.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM activity_log WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (module) { sql += ' AND al.module = ?'; countSql += ' AND module = ?'; params.push(module); }
        if (user_id) { sql += ' AND al.user_id = ?'; countSql += ' AND user_id = ?'; params.push(user_id); }
        if (from_date) { sql += ' AND al.created_at >= ?'; countSql += ' AND created_at >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND al.created_at <= ?'; countSql += ' AND created_at <= ?'; params.push(to_date); }

        sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const logs = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: logs, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Modules
router.get('/modules', authenticate, async (req, res) => {
    const modules = [
        { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
        { id: 'master', name: 'Master Data', icon: 'database' },
        { id: 'purchase', name: 'Purchase', icon: 'shopping-cart' },
        { id: 'inventory', name: 'Inventory', icon: 'boxes' },
        { id: 'production', name: 'Production', icon: 'factory' },
        { id: 'quality', name: 'Quality Control', icon: 'check-circle' },
        { id: 'sales', name: 'Sales', icon: 'dollar-sign' },
        { id: 'finance', name: 'Finance', icon: 'wallet' },
        { id: 'transport', name: 'Transport', icon: 'truck' },
        { id: 'barcode', name: 'Barcode', icon: 'barcode' },
        { id: 'iot', name: 'IoT Devices', icon: 'cpu' },
        { id: 'reports', name: 'Reports', icon: 'file-text' },
        { id: 'admin', name: 'Admin', icon: 'settings' }
    ];

    const permissionTypes = ['view', 'add', 'edit', 'delete', 'approve', 'export', 'import'];

    res.json({ success: true, data: { modules, permission_types: permissionTypes } });
});

module.exports = router;
