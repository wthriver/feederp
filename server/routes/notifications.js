const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, is_read, priority } = req.query;
        const offset = (page - 1) * limit;

        let sql = 'SELECT * FROM notifications WHERE tenant_id = ? AND user_id = ?';
        let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE tenant_id = ? AND user_id = ?';
        const params = [req.tenantId, req.user.id];

        if (type) {
            sql += ' AND type = ?';
            countSql += ' AND type = ?';
            params.push(type);
        }
        if (is_read !== undefined) {
            sql += ' AND is_read = ?';
            countSql += ' AND is_read = ?';
            params.push(is_read === 'true' ? 1 : 0);
        }
        if (priority) {
            sql += ' AND priority = ?';
            countSql += ' AND priority = ?';
            params.push(priority);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const notifications = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));
        const unreadCount = queryOne(
            'SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND user_id = ? AND is_read = 0',
            [req.tenantId, req.user.id]
        );

        res.json({
            success: true,
            data: notifications,
            meta: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
                unread: unreadCount?.count || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const result = queryOne(
            'SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND user_id = ? AND is_read = 0',
            [req.tenantId, req.user.id]
        );

        res.json({ success: true, data: { count: result?.count || 0 } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/:id/read', authenticate, async (req, res) => {
    try {
        const notification = queryOne(
            'SELECT id FROM notifications WHERE id = ? AND tenant_id = ? AND user_id = ?',
            [req.params.id, req.tenantId, req.user.id]
        );

        if (!notification) {
            return res.status(404).json({ success: false, error: { message: 'Notification not found' } });
        }

        run('UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?',
            [new Date().toISOString(), req.params.id]);

        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/read-all', authenticate, async (req, res) => {
    try {
        run('UPDATE notifications SET is_read = 1, read_at = ? WHERE tenant_id = ? AND user_id = ? AND is_read = 0',
            [new Date().toISOString(), req.tenantId, req.user.id]);

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        run('DELETE FROM notifications WHERE id = ? AND tenant_id = ? AND user_id = ?',
            [req.params.id, req.tenantId, req.user.id]);

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/clear-all', authenticate, async (req, res) => {
    try {
        run('DELETE FROM notifications WHERE tenant_id = ? AND user_id = ?',
            [req.tenantId, req.user.id]);

        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

function createNotification(tenantId, userId, title, message, type = 'info', priority = 'normal', actionUrl = null, entityType = null, entityId = null) {
    try {
        run(`INSERT INTO notifications (id, tenant_id, user_id, title, message, type, priority, action_url, entity_type, entity_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), tenantId, userId, title, message, type, priority, actionUrl, entityType, entityId]);
    } catch (error) {
        console.error('Create notification error:', error);
    }
}

function notifyAdmins(tenantId, title, message, type = 'warning') {
    const admins = query('SELECT id FROM users WHERE tenant_id = ? AND role_id IN (SELECT id FROM roles WHERE name = ?)',
        [tenantId, 'Admin']);
    
    admins.forEach(admin => {
        createNotification(tenantId, admin.id, title, message, type, 'high');
    });
}

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.notifyAdmins = notifyAdmins;