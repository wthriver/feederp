const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Stock Summary
router.get('/stock', authenticate, async (req, res) => {
    try {
        const { type, godown_id, search, page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE sl.tenant_id = ? AND g.factory_id = ?';
        const params = [req.tenantId, req.factoryId];

        if (type) {
            whereClause += ' AND sl.item_type = ?';
            params.push(type);
        }

        if (godown_id) {
            whereClause += ' AND sl.godown_id = ?';
            params.push(godown_id);
        }

        if (search) {
            whereClause += ' AND (rm.name LIKE ? OR p.name LIKE ? OR rm.code LIKE ? OR p.code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT sl.item_id, sl.item_type, sl.godown_id, sl.batch_number,
                   SUM(sl.quantity) as total_qty,
                   SUM(sl.quantity * sl.rate) / NULLIF(SUM(sl.quantity), 0) as avg_rate,
                   g.name as godown_name, g.code as godown_code,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.code ELSE p.code END as item_code
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
            ${whereClause}
            GROUP BY sl.item_id, sl.item_type, sl.godown_id, sl.batch_number
            ORDER BY item_name
        `;

        const stock = query(sql, params);
        
        const total = stock.length;
        const paginatedStock = stock.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            data: paginatedStock,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Stock error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Stock by Item
router.get('/stock/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { godown_id } = req.query;

        let sql = `
            SELECT sl.*, g.name as godown_name, g.code as godown_code
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            WHERE sl.tenant_id = ? AND sl.item_type = ? AND sl.item_id = ?
        `;
        const params = [req.tenantId, type, id];

        if (godown_id) {
            sql += ' AND sl.godown_id = ?';
            params.push(godown_id);
        }

        sql += ' ORDER BY sl.created_at DESC';

        const ledger = query(sql, params);

        const summary = queryOne(`
            SELECT SUM(quantity) as total_qty, SUM(amount) as total_value
            FROM stock_ledger WHERE tenant_id = ? AND item_type = ? AND item_id = ?
        `, [req.tenantId, type, id]);

        const itemInfo = type === 'raw_material'
            ? queryOne('SELECT * FROM raw_materials WHERE id = ?', [id])
            : queryOne('SELECT * FROM products WHERE id = ?', [id]);

        res.json({
            success: true,
            data: {
                item: itemInfo,
                summary,
                ledger
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Stock Alerts
router.get('/stock/alerts', authenticate, async (req, res) => {
    try {
        const alerts = [];

        const rawMaterials = query(`
            SELECT rm.*, u.name as unit_name,
                   COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'raw_material' AND item_id = rm.id), 0) as current_stock
            FROM raw_materials rm
            LEFT JOIN units u ON rm.unit_id = u.id
            WHERE rm.tenant_id = ? AND rm.is_active = 1 AND rm.min_stock > 0
        `, [req.tenantId]);

        rawMaterials.forEach(rm => {
            if (rm.current_stock <= rm.min_stock) {
                alerts.push({
                    type: 'raw_material',
                    id: rm.id,
                    code: rm.code,
                    name: rm.name,
                    current_stock: rm.current_stock,
                    min_stock: rm.min_stock,
                    max_stock: rm.max_stock,
                    unit: rm.unit_name,
                    alert_type: 'low_stock'
                });
            }
        });

        const products = query(`
            SELECT p.*, u.name as unit_name,
                   COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'product' AND item_id = p.id), 0) as current_stock
            FROM products p
            LEFT JOIN units u ON p.unit_id = u.id
            WHERE p.tenant_id = ? AND p.is_active = 1 AND p.min_stock > 0
        `, [req.tenantId]);

        products.forEach(p => {
            if (p.current_stock <= p.min_stock) {
                alerts.push({
                    type: 'product',
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    current_stock: p.current_stock,
                    min_stock: p.min_stock,
                    max_stock: p.max_stock,
                    unit: p.unit_name,
                    alert_type: 'low_stock'
                });
            }
        });

        const expiringItems = query(`
            SELECT sl.*, rm.name, rm.code, g.name as godown_name
            FROM stock_ledger sl
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN godowns g ON sl.godown_id = g.id
            WHERE sl.tenant_id = ? AND sl.expiry_date IS NOT NULL
            AND sl.expiry_date <= date('now', '+30 days')
            AND sl.quantity > 0
        `, [req.tenantId]);

        expiringItems.forEach(item => {
            alerts.push({
                type: item.item_type,
                id: item.item_id,
                code: item.code || item.batch_number,
                name: item.name || item.batch_number,
                batch_number: item.batch_number,
                current_stock: item.quantity,
                expiry_date: item.expiry_date,
                godown: item.godown_name,
                alert_type: 'expiring'
            });
        });

        res.json({ success: true, data: alerts });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Stock Valuation
router.get('/stock/valuation', authenticate, async (req, res) => {
    try {
        const { godown_id, as_on_date } = req.query;
        const date = as_on_date || new Date().toISOString().slice(0, 10);

        let sql = `
            SELECT sl.item_type, sl.item_id,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.code ELSE p.code END as item_code,
                   g.name as godown_name, g.code as godown_code,
                   SUM(sl.quantity) as total_qty,
                   SUM(sl.quantity * sl.rate) / NULLIF(SUM(sl.quantity), 0) as avg_rate,
                   SUM(sl.quantity * sl.rate) as total_value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
            WHERE sl.tenant_id = ?
        `;
        const params = [req.tenantId];

        if (godown_id) {
            sql += ' AND sl.godown_id = ?';
            params.push(godown_id);
        }

        sql += ` GROUP BY sl.item_type, sl.item_id, rm.name, p.name, rm.code, p.code, g.name, g.code
                 ORDER BY item_name`;

        const valuation = query(sql, params);

        const totals = queryOne(`
            SELECT SUM(sl.quantity) as total_qty, SUM(sl.quantity * sl.rate) as total_value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            WHERE sl.tenant_id = ? ${godown_id ? 'AND sl.godown_id = ?' : ''}
        `, godown_id ? [req.tenantId, godown_id] : [req.tenantId]);

        res.json({
            success: true,
            data: {
                valuation,
                summary: {
                    total_items: valuation.length,
                    total_qty: totals?.total_qty || 0,
                    total_value: totals?.total_value || 0
                },
                as_on_date: date
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Stock Transfer
router.get('/transfers', authenticate, async (req, res) => {
    try {
        const { status, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT t.*, fg.name as from_godown, tg.name as to_godown, u.name as created_by_name
                   FROM transfers t
                   LEFT JOIN godowns fg ON t.from_godown_id = fg.id
                   LEFT JOIN godowns tg ON t.to_godown_id = tg.id
                   LEFT JOIN users u ON t.created_by = u.id
                   WHERE t.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM transfers WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) { sql += ' AND t.status = ?'; countSql += ' AND status = ?'; params.push(status); }
        if (from_date) { sql += ' AND t.transfer_date >= ?'; countSql += ' AND transfer_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND t.transfer_date <= ?'; countSql += ' AND transfer_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const transfers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: transfers, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/transfers/:id', authenticate, async (req, res) => {
    try {
        const transfer = queryOne(`
            SELECT t.*, fg.name as from_godown, tg.name as to_godown
            FROM transfers t
            LEFT JOIN godowns fg ON t.from_godown_id = fg.id
            LEFT JOIN godowns tg ON t.to_godown_id = tg.id
            WHERE t.id = ? AND t.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!transfer) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transfer not found' } });
        }

        const items = query('SELECT * FROM transfer_items WHERE transfer_id = ?', [req.params.id]);

        res.json({ success: true, data: { ...transfer, items } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/transfers', authenticate, requirePermission('inventory', 'add'), async (req, res) => {
    try {
        const { from_godown_id, to_godown_id, transfer_date, items, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const transferNumber = formatSequence('TRF', getNextSequence('TRF', req.tenantId));
        const transferId = uuidv4();

        run(`INSERT INTO transfers (id, tenant_id, transfer_number, from_godown_id, to_godown_id, transfer_date, status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [transferId, req.tenantId, transferNumber, from_godown_id, to_godown_id, transfer_date, notes, req.user.id]);

        items.forEach(item => {
            const itemId = uuidv4();
            run(`INSERT INTO transfer_items (id, transfer_id, item_type, item_id, batch_number, quantity, barcode)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [itemId, transferId, item.item_type, item.item_id, item.batch_number, item.quantity, item.barcode]);
        });

        logActivity(req.tenantId, req.user.id, 'inventory', 'transfer_created', transferId, null, { transfer_number: transferNumber }, req);

        res.json({ success: true, data: { id: transferId, transfer_number: transferNumber }, message: 'Transfer created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/transfers/:id/approve', authenticate, requirePermission('inventory', 'approve'), async (req, res) => {
    try {
        const transfer = queryOne('SELECT * FROM transfers WHERE id = ?', [req.params.id]);
        const items = query('SELECT * FROM transfer_items WHERE transfer_id = ?', [req.params.id]);

        if (!transfer) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transfer not found' } });
        }

        items.forEach(item => {
            const fromBalance = queryOne(`
                SELECT balance_qty, balance_amount FROM stock_ledger
                WHERE item_type = ? AND item_id = ? AND godown_id = ? AND batch_number = ?
                ORDER BY created_at DESC LIMIT 1
            `, [item.item_type, item.item_id, transfer.from_godown_id, item.batch_number]);

            if (fromBalance && fromBalance.balance_qty >= item.quantity) {
                const ledgerId = uuidv4();
                const newFromQty = fromBalance.balance_qty - item.quantity;
                const newFromAmt = fromBalance.balance_amount - (item.quantity * (fromBalance.balance_amount / fromBalance.balance_qty));

                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, barcode, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, 'transfer_out', 'transfer', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, item.item_type, item.item_id, item.batch_number, transfer.from_godown_id, transfer.id,
                     -item.quantity, 0, 0, newFromQty, newFromAmt, item.barcode, req.user.id]);

                const toRate = fromBalance.balance_amount / fromBalance.balance_qty;
                const toBalance = queryOne(`
                    SELECT balance_qty, balance_amount FROM stock_ledger
                    WHERE item_type = ? AND item_id = ? AND godown_id = ?
                    ORDER BY created_at DESC LIMIT 1
                `, [item.item_type, item.item_id, transfer.to_godown_id]);

                const newToQty = (toBalance?.balance_qty || 0) + item.quantity;
                const newToAmt = (toBalance?.balance_amount || 0) + (item.quantity * toRate);

                const ledgerId2 = uuidv4();
                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, barcode, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, 'transfer_in', 'transfer', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ledgerId2, req.tenantId, item.item_type, item.item_id, item.batch_number, transfer.to_godown_id, transfer.id,
                     item.quantity, toRate, item.quantity * toRate, newToQty, newToAmt, item.barcode, req.user.id]);
            }
        });

        run('UPDATE transfers SET status = ?, approved_by = ? WHERE id = ?', ['completed', req.user.id, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'inventory', 'transfer_completed', transfer.id, null, { status: 'completed' }, req);

        res.json({ success: true, message: 'Transfer completed successfully' });
    } catch (error) {
        console.error('Transfer approve error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Stock Adjustments
router.get('/adjustments', authenticate, async (req, res) => {
    try {
        const { status, godown_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT sa.*, g.name as godown_name, u.name as created_by_name
                   FROM stock_adjustments sa
                   LEFT JOIN godowns g ON sa.godown_id = g.id
                   LEFT JOIN users u ON sa.created_by = u.id
                   WHERE sa.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM stock_adjustments WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) { sql += ' AND sa.status = ?'; countSql += ' AND status = ?'; params.push(status); }
        if (godown_id) { sql += ' AND sa.godown_id = ?'; countSql += ' AND godown_id = ?'; params.push(godown_id); }
        if (from_date) { sql += ' AND sa.adjustment_date >= ?'; countSql += ' AND adjustment_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND sa.adjustment_date <= ?'; countSql += ' AND adjustment_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const adjustments = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: adjustments, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/adjustments', authenticate, requirePermission('inventory', 'add'), async (req, res) => {
    try {
        const { godown_id, adjustment_date, reason, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const adjNumber = formatSequence('ADJ', getNextSequence('ADJ', req.tenantId));
        const adjId = uuidv4();

        run(`INSERT INTO stock_adjustments (id, tenant_id, adjustment_number, godown_id, adjustment_date, reason, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [adjId, req.tenantId, adjNumber, godown_id, adjustment_date, reason, req.user.id]);

        items.forEach(item => {
            const itemId = uuidv4();
            run(`INSERT INTO adjustment_items (id, adjustment_id, item_type, item_id, batch_number, system_qty, actual_qty, difference, reason)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, adjId, item.item_type, item.item_id, item.batch_number, item.system_qty, item.actual_qty, item.difference, item.reason]);
        });

        logActivity(req.tenantId, req.user.id, 'inventory', 'adjustment_created', adjId, null, { adjustment_number: adjNumber }, req);

        res.json({ success: true, data: { id: adjId, adjustment_number: adjNumber }, message: 'Stock adjustment created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/adjustments/:id/approve', authenticate, requirePermission('inventory', 'approve'), async (req, res) => {
    try {
        const adjustment = queryOne('SELECT * FROM stock_adjustments WHERE id = ?', [req.params.id]);
        const items = query('SELECT * FROM adjustment_items WHERE adjustment_id = ?', [req.params.id]);

        if (!adjustment) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Adjustment not found' } });
        }

        items.forEach(item => {
            if (item.difference !== 0) {
                const prevBalance = queryOne(`
                    SELECT balance_qty, balance_amount FROM stock_ledger
                    WHERE item_type = ? AND item_id = ? AND godown_id = ?
                    ORDER BY created_at DESC LIMIT 1
                `, [item.item_type, item.item_id, adjustment.godown_id]);

                const avgRate = (prevBalance?.balance_qty && prevBalance?.balance_qty > 0) 
                    ? prevBalance.balance_amount / prevBalance.balance_qty 
                    : 0;
                const newBalanceQty = (prevBalance?.balance_qty || 0) + item.difference;
                const newBalanceAmt = (prevBalance?.balance_amount || 0) + (item.difference * avgRate);
                const rate = avgRate;

                const ledgerId = uuidv4();
                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, 'adjustment', 'adjustment', ?, ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, item.item_type, item.item_id, item.batch_number, adjustment.godown_id, req.params.id,
                     item.difference, rate, item.difference * rate, newBalanceQty, newBalanceAmt, req.user.id]);
            }
        });

        run('UPDATE stock_adjustments SET status = ?, approved_by = ? WHERE id = ?', ['completed', req.user.id, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'inventory', 'adjustment_completed', req.params.id, null, { status: 'completed' }, req);

        res.json({ success: true, message: 'Adjustment approved and posted to stock' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
