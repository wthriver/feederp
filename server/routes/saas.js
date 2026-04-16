const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const cache = require('../utils/cache');

router.get('/tenants', authenticate, requirePermission('saas', 'view'), async (req, res) => {
    try {
        const { page = 1, limit = 50, status, search } = req.query;
        const offset = (page - 1) * limit;

        let sql = 'SELECT * FROM tenants WHERE 1=1';
        let countSql = 'SELECT COUNT(*) as total FROM tenants';
        const params = [];

        if (status) {
            sql += ' AND is_active = ?';
            countSql += ' WHERE is_active = ?';
            params.push(status === 'active' ? 1 : 0);
        }
        if (search) {
            sql += ' AND (name LIKE ? OR code LIKE ? OR domain LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ? OR domain LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const tenants = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: tenants,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/tenants/:id', authenticate, requirePermission('saas', 'view'), async (req, res) => {
    try {
        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [req.params.id]);

        if (!tenant) {
            return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
        }

        const stats = {
            users: queryOne('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [req.params.id])?.count || 0,
            factories: queryOne('SELECT COUNT(*) as count FROM factories WHERE tenant_id = ?', [req.params.id])?.count || 0,
            customers: queryOne('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?', [req.params.id])?.count || 0,
            suppliers: queryOne('SELECT COUNT(*) as count FROM suppliers WHERE tenant_id = ?', [req.params.id])?.count || 0,
            orders: queryOne('SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ?', [req.params.id])?.count || 0
        };

        const usage = queryOne(`
            SELECT 
                COALESCE((SELECT SUM(net_amount) FROM sales_invoices WHERE tenant_id = ?), 0) as sales,
                COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE tenant_id = ?), 0) as purchases
        `, [req.params.id, req.params.id]);

        res.json({ success: true, data: { ...tenant, stats, usage } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/tenants', authenticate, requirePermission('saas', 'add'), async (req, res) => {
    try {
        const { name, code, domain, email, plan, max_users, max_factories, features } = req.body;

        if (!name || !code) {
            return res.status(400).json({ success: false, error: { message: 'Name and code are required' } });
        }

        const existing = queryOne('SELECT id FROM tenants WHERE code = ? OR domain = ?', [code, domain]);
        if (existing) {
            return res.status(400).json({ success: false, error: { message: 'Tenant code or domain already exists' } });
        }

        const tenantId = uuidv4();

        run(`INSERT INTO tenants (id, name, code, domain, email, plan, max_users, max_factories, is_active, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [tenantId, name, code, domain, email, plan || 'starter', max_users || 10, max_factories || 5, req.user.id, new Date().toISOString()]);

        if (features) {
            Object.entries(features).forEach(([key, value]) => {
                run('INSERT INTO tenant_settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)',
                    [uuidv4(), tenantId, `feature.${key}`, value]);
            });
        }

        run('INSERT INTO settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)',
            [uuidv4(), tenantId, 'currency', 'INR']);
        run('INSERT INTO settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)',
            [uuidv4(), tenantId, 'timezone', 'Asia/Kolkata']);

        logActivity(tenantId, req.user.id, 'saas', 'tenant_created', tenantId, null, { name, code }, req);

        res.json({ success: true, data: { id: tenantId, name, code }, message: 'Tenant created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/tenants/:id', authenticate, requirePermission('saas', 'edit'), async (req, res) => {
    try {
        const { name, domain, email, plan, status, max_users, max_factories } = req.body;

        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
        if (!tenant) {
            return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
        }

        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name); }
        if (domain) { updates.push('domain = ?'); params.push(domain); }
        if (email) { updates.push('email = ?'); params.push(email); }
        if (plan) { updates.push('plan = ?'); params.push(plan); }
        if (status !== undefined) { updates.push('is_active = ?'); params.push(status ? 1 : 0); }
        if (max_users) { updates.push('max_users = ?'); params.push(max_users); }
        if (max_factories) { updates.push('max_factories = ?'); params.push(max_factories); }

        if (updates.length > 0) {
            params.push(req.params.id);
            run(`UPDATE tenants SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`, [...params, new Date().toISOString()]);
        }

        logActivity(req.tenantId, req.user.id, 'saas', 'tenant_updated', req.params.id, null, req.body, req);

        res.json({ success: true, message: 'Tenant updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/tenants/:id', authenticate, requirePermission('saas', 'delete'), async (req, res) => {
    try {
        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
        if (!tenant) {
            return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
        }

        const hasData = queryOne('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [req.params.id])?.count > 0;
        if (hasData) {
            run('UPDATE tenants SET is_active = 0 WHERE id = ?', [req.params.id]);
            cache.del(`tenant:${req.params.id}:*`);
            return res.json({ success: true, message: 'Tenant deactivated (has existing data)' });
        }

        run('DELETE FROM tenants WHERE id = ?', [req.params.id]);
        logActivity(req.tenantId, req.user.id, 'saas', 'tenant_deleted', req.params.id, null, null, req);

        res.json({ success: true, message: 'Tenant deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/tenants/:id/billing', authenticate, requirePermission('saas', 'view'), async (req, res) => {
    try {
        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
        if (!tenant) {
            return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
        }

        const invoices = query(`
            SELECT * FROM tenant_invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 12
        `, [req.params.id]);

        const subscription = {
            plan: tenant.plan,
            max_users: tenant.max_users,
            max_factories: tenant.max_factories,
            valid_until: tenant.subscription_valid_until,
            auto_renew: tenant.auto_renew
        };

        res.json({ success: true, data: { tenant, subscription, invoices } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/usage', authenticate, requirePermission('saas', 'view'), async (req, res) => {
    try {
        const usage = {
            tenants: queryOne('SELECT COUNT(*) as count FROM tenants WHERE is_active = 1')?.count || 0,
            total_users: queryOne('SELECT COUNT(*) as count FROM users')?.count || 0,
            total_transactions: queryOne('SELECT COUNT(*) as count FROM transactions')?.count || 0,
            storage_used_bytes: 0
        };

        const topTenants = query(`
            SELECT t.name, t.code, 
                   (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as users,
                   (SELECT COALESCE(SUM(net_amount), 0) FROM sales_invoices WHERE tenant_id = t.id) as sales
            FROM tenants t WHERE t.is_active = 1
            ORDER BY sales DESC LIMIT 10
        `);

        res.json({ success: true, data: { usage, top_tenants: topTenants } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;