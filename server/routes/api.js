const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const API_VERSION = 'v1';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function paginateResponse(data, page, limit, total) {
    return {
        data,
        meta: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
        }
    };
}

router.get('/', (req, res) => {
    res.json({
        name: 'FeedMill ERP API',
        version: API_VERSION,
        documentation: '/api/docs',
        endpoints: {
            auth: '/api/v1/auth',
            customers: '/api/v1/customers',
            suppliers: '/api/v1/suppliers',
            products: '/api/v1/products',
            orders: '/api/v1/orders',
            inventory: '/api/v1/inventory'
        }
    });
});

router.post('/auth/token', async (req, res) => {
    try {
        const { client_id, client_secret, grant_type } = req.body;
        
        if (!client_id || !client_secret) {
            return res.status(400).json({ error: 'client_id and client_secret required' });
        }

        // Validate that the API key belongs to the tenant specified in client_id
        const apiKey = queryOne('SELECT * FROM api_keys WHERE id = ? AND tenant_id = ? AND key_value = ? AND is_active = 1', 
            [client_id, client_id, client_secret]);
        
        if (!apiKey) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            return res.status(401).json({ error: 'API key expired' });
        }

        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 3600000);

        run('INSERT INTO api_tokens (id, api_key_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), apiKey.id, token, expiresAt.toISOString(), new Date().toISOString()]);

        res.json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600
        });
    } catch (error) {
        console.error('API token error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/auth/revoke', authenticate, async (req, res) => {
    try {
        const { token } = req.body;
        if (token) {
            run('DELETE FROM api_tokens WHERE token = ?', [token]);
        }
        res.json({ message: 'Token revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/customers', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = DEFAULT_LIMIT, search, type } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let sql = 'SELECT id, code, name, name_bn, type, phone, email, address, city, state, gstin, credit_limit, outstanding, is_active, created_at FROM customers WHERE tenant_id = ?';
        let countSql = 'SELECT COUNT(*) as total FROM customers WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (search) {
            sql += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (type) {
            sql += ' AND type = ?';
            countSql += ' AND type = ?';
            params.push(type);
        }

        sql += ' ORDER BY name LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const customers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json(paginateResponse(customers, pageNum, limitNum, total));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/customers/:id', authenticate, async (req, res) => {
    try {
        const customer = queryOne('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const orders = query('SELECT id, order_number, order_date, net_amount, status FROM sales_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
        const invoices = query('SELECT id, invoice_number, invoice_date, net_amount, payment_status FROM sales_invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);

        res.json({
            ...customer,
            recent_orders: orders,
            recent_invoices: invoices
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/suppliers', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = DEFAULT_LIMIT, search } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let sql = 'SELECT id, code, name, name_bn, phone, email, address, city, state, gstin, credit_limit, is_active FROM suppliers WHERE tenant_id = ?';
        let countSql = 'SELECT COUNT(*) as total FROM suppliers WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (search) {
            sql += ' AND (name LIKE ? OR code LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY name LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const suppliers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json(paginateResponse(suppliers, pageNum, limitNum, total));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/suppliers/:id', authenticate, async (req, res) => {
    try {
        const supplier = queryOne('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        const purchaseOrders = query('SELECT id, po_number, po_date, total_amount, status FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);

        res.json({ ...supplier, purchase_orders: purchaseOrders });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/products', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = DEFAULT_LIMIT, search, product_type, category } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let sql = `SELECT p.id, p.code, p.name, p.name_bn, p.product_type, p.category, p.mrp, p.sale_rate, p.pack_size, u.name as unit_name
                   FROM products p LEFT JOIN units u ON p.unit_id = u.id
                   WHERE p.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM products WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (search) {
            sql += ' AND (p.name LIKE ? OR p.code LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (product_type) {
            sql += ' AND p.product_type = ?';
            countSql += ' AND product_type = ?';
            params.push(product_type);
        }
        if (category) {
            sql += ' AND p.category = ?';
            countSql += ' AND category = ?';
            params.push(category);
        }

        sql += ' ORDER BY p.name LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const products = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json(paginateResponse(products, pageNum, limitNum, total));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/orders', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = DEFAULT_LIMIT, status, customer_id, from_date, to_date } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let sql = `SELECT so.id, so.order_number, so.order_date, so.delivery_date, so.status, so.subtotal, so.discount_amount, so.tax_amount, so.net_amount, c.name as customer_name
                   FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id
                   WHERE so.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) {
            sql += ' AND so.status = ?';
            countSql += ' AND status = ?';
            params.push(status);
        }
        if (customer_id) {
            sql += ' AND so.customer_id = ?';
            countSql += ' AND customer_id = ?';
            params.push(customer_id);
        }
        if (from_date) {
            sql += ' AND so.order_date >= ?';
            countSql += ' AND order_date >= ?';
            params.push(from_date);
        }
        if (to_date) {
            sql += ' AND so.order_date <= ?';
            countSql += ' AND order_date <= ?';
            params.push(to_date);
        }

        sql += ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const orders = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json(paginateResponse(orders, pageNum, limitNum, total));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/inventory/stock', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = DEFAULT_LIMIT, item_type, godown_id } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let sql = `SELECT sl.item_id, sl.item_type, sl.godown_id, g.name as godown_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.code ELSE p.code END as item_code,
                   SUM(sl.quantity) as quantity
                   FROM stock_ledger sl
                   LEFT JOIN godowns g ON sl.godown_id = g.id
                   LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
                   LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
                   WHERE sl.tenant_id = ?`;
        let countSql = 'SELECT COUNT(DISTINCT item_id, item_type) as total FROM stock_ledger WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (item_type) {
            sql += ' AND sl.item_type = ?';
            countSql += ' AND item_type = ?';
            params.push(item_type);
        }
        if (godown_id) {
            sql += ' AND sl.godown_id = ?';
            countSql += ' AND godown_id = ?';
            params.push(godown_id);
        }

        sql += ' GROUP BY sl.item_id, sl.item_type, sl.godown_id ORDER BY item_name LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const stock = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json(paginateResponse(stock, pageNum, limitNum, total));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/webhook/register', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { url, events, secret } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const webhookId = uuidv4();
        
        run(`INSERT INTO webhooks (id, tenant_id, url, events, secret, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [webhookId, req.tenantId, url, JSON.stringify(events || []), secret || uuidv4(), req.user.id]);

        res.json({
            success: true,
            data: { id: webhookId, url, events: events || [] },
            message: 'Webhook registered successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/webhooks', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const webhooks = query('SELECT id, url, events, is_active, created_at FROM webhooks WHERE tenant_id = ?', [req.tenantId]);
        
        const parsed = webhooks.map(w => ({
            ...w,
            events: JSON.parse(w.events || '[]')
        }));
        
        res.json({ success: true, data: parsed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;