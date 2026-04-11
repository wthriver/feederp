const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Suppliers - Read-only reference (use /master/suppliers for full CRUD)
router.get('/suppliers', authenticate, async (req, res) => {
    try {
        const { search, page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        let sql = 'SELECT * FROM suppliers WHERE tenant_id = ? AND is_active = 1';
        let countSql = 'SELECT COUNT(*) as total FROM suppliers WHERE tenant_id = ? AND is_active = 1';
        const params = [req.tenantId];

        if (search) {
            sql += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY name LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const suppliers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: suppliers,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/suppliers/:id', authenticate, async (req, res) => {
    try {
        const supplier = queryOne(
            'SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );

        if (!supplier) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
        }

        const purchases = query(`
            SELECT po.*, SUM(pi.amount) as total
            FROM purchase_orders po
            LEFT JOIN po_items pi ON po.id = pi.po_id
            WHERE po.supplier_id = ?
            GROUP BY po.id
            ORDER BY po.created_at DESC LIMIT 10
        `, [req.params.id]);

        res.json({ success: true, data: { ...supplier, recent_purchases: purchases } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Purchase Orders
router.get('/purchase-orders', authenticate, async (req, res) => {
    try {
        const { search, status, supplier_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT po.*, s.name as supplier_name FROM purchase_orders po
                   LEFT JOIN suppliers s ON po.supplier_id = s.id
                   WHERE po.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM purchase_orders WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) {
            sql += ' AND po.status = ?';
            countSql += ' AND status = ?';
            params.push(status);
        }

        if (supplier_id) {
            sql += ' AND po.supplier_id = ?';
            countSql += ' AND supplier_id = ?';
            params.push(supplier_id);
        }

        if (from_date) {
            sql += ' AND po.po_date >= ?';
            countSql += ' AND po_date >= ?';
            params.push(from_date);
        }

        if (to_date) {
            sql += ' AND po.po_date <= ?';
            countSql += ' AND po_date <= ?';
            params.push(to_date);
        }

        sql += ` ORDER BY po.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const orders = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: orders,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/purchase-orders/:id', authenticate, async (req, res) => {
    try {
        const po = queryOne(`
            SELECT po.*, s.name as supplier_name, s.code as supplier_code, s.phone as supplier_phone
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.id = ? AND po.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!po) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
        }

        const items = query(`
            SELECT pi.*, rm.name as material_name, rm.code as material_code, u.name as unit_name
            FROM po_items pi
            LEFT JOIN raw_materials rm ON pi.raw_material_id = rm.id
            LEFT JOIN units u ON pi.unit_id = u.id
            WHERE pi.po_id = ?
        `, [req.params.id]);

        res.json({ success: true, data: { ...po, items } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/purchase-orders', authenticate, requirePermission('purchase', 'add'), async (req, res) => {
    try {
        const { supplier_id, factory_id, po_date, expected_date, items, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const poNumber = formatSequence('PO', getNextSequence('PO', req.tenantId));
        const poId = uuidv4();

        let subtotal = 0;
        items.forEach(item => {
            subtotal += (item.quantity || 0) * (item.rate || 0);
        });

        run(`INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_id, factory_id, po_date, expected_date, status, subtotal, total_amount, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
            [poId, req.tenantId, poNumber, supplier_id, factory_id || req.factoryId, po_date, expected_date, subtotal, subtotal, notes, req.user.id]);

        const itemStmt = `INSERT INTO po_items (id, po_id, raw_material_id, description, quantity, unit_id, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        items.forEach(item => {
            const itemId = uuidv4();
            const amount = (item.quantity || 0) * (item.rate || 0);
            run(itemStmt, [itemId, poId, item.raw_material_id, item.description, item.quantity, item.unit_id, item.rate, amount]);
        });

        logActivity(req.tenantId, req.user.id, 'purchase', 'po_created', poId, null, { po_number: poNumber }, req);

        res.json({ success: true, data: { id: poId, po_number: poNumber }, message: 'Purchase order created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/purchase-orders/:id', authenticate, requirePermission('purchase', 'edit'), async (req, res) => {
    try {
        const { supplier_id, po_date, expected_date, items, notes } = req.body;

        const old = queryOne('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
        if (old.status !== 'draft') {
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Only draft orders can be edited' } });
        }

        let subtotal = 0;
        items.forEach(item => {
            subtotal += (item.quantity || 0) * (item.rate || 0);
        });

        run(`UPDATE purchase_orders SET supplier_id = ?, po_date = ?, expected_date = ?, subtotal = ?, total_amount = ?, notes = ?
             WHERE id = ?`,
            [supplier_id, po_date, expected_date, subtotal, subtotal, notes, req.params.id]);

        run('DELETE FROM po_items WHERE po_id = ?', [req.params.id]);

        items.forEach(item => {
            const itemId = uuidv4();
            const amount = (item.quantity || 0) * (item.rate || 0);
            run(`INSERT INTO po_items (id, po_id, raw_material_id, description, quantity, unit_id, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, req.params.id, item.raw_material_id, item.description, item.quantity, item.unit_id, item.rate, amount]);
        });

        logActivity(req.tenantId, req.user.id, 'purchase', 'po_updated', req.params.id, old, req.body, req);

        res.json({ success: true, message: 'Purchase order updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/purchase-orders/:id/approve', authenticate, requirePermission('purchase', 'approve'), async (req, res) => {
    try {
        run(`UPDATE purchase_orders SET status = 'sent', approved_by = ? WHERE id = ? AND status = 'draft'`,
            [req.user.id, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'purchase', 'po_approved', req.params.id, null, { status: 'sent' }, req);

        res.json({ success: true, message: 'Purchase order approved' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/purchase-orders/:id/cancel', authenticate, requirePermission('purchase', 'delete'), async (req, res) => {
    try {
        run(`UPDATE purchase_orders SET status = 'cancelled' WHERE id = ? AND status IN ('draft', 'sent')`,
            [req.params.id]);

        logActivity(req.tenantId, req.user.id, 'purchase', 'po_cancelled', req.params.id, null, { status: 'cancelled' }, req);

        res.json({ success: true, message: 'Purchase order cancelled' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Goods Inward
router.get('/goods-inward', authenticate, async (req, res) => {
    try {
        const { status, supplier_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT gi.*, s.name as supplier_name, po.po_number, g.name as godown_name
                   FROM goods_inward gi
                   LEFT JOIN suppliers s ON gi.supplier_id = s.id
                   LEFT JOIN purchase_orders po ON gi.po_id = po.id
                   LEFT JOIN godowns g ON gi.godown_id = g.id
                   WHERE gi.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM goods_inward WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) {
            sql += ' AND gi.status = ?';
            countSql += ' AND status = ?';
            params.push(status);
        }

        if (supplier_id) {
            sql += ' AND gi.supplier_id = ?';
            countSql += ' AND supplier_id = ?';
            params.push(supplier_id);
        }

        if (from_date) {
            sql += ' AND gi.inward_date >= ?';
            countSql += ' AND inward_date >= ?';
            params.push(from_date);
        }

        if (to_date) {
            sql += ' AND gi.inward_date <= ?';
            countSql += ' AND inward_date <= ?';
            params.push(to_date);
        }

        sql += ` ORDER BY gi.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const inward = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: inward,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/goods-inward/:id', authenticate, async (req, res) => {
    try {
        const inward = queryOne(`
            SELECT gi.*, s.name as supplier_name, s.code as supplier_code, po.po_number, g.name as godown_name
            FROM goods_inward gi
            LEFT JOIN suppliers s ON gi.supplier_id = s.id
            LEFT JOIN purchase_orders po ON gi.po_id = po.id
            LEFT JOIN godowns g ON gi.godown_id = g.id
            WHERE gi.id = ? AND gi.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!inward) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Goods inward not found' } });
        }

        const items = query(`
            SELECT ii.*, rm.name as material_name, rm.code as material_code
            FROM inward_items ii
            LEFT JOIN raw_materials rm ON ii.raw_material_id = rm.id
            WHERE ii.goods_inward_id = ?
        `, [req.params.id]);

        res.json({ success: true, data: { ...inward, items } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/goods-inward', authenticate, requirePermission('purchase', 'add'), async (req, res) => {
    try {
        const {
            po_id, supplier_id, factory_id, godown_id, inward_date, challan_number, challan_date,
            vehicle_number, driver_name, driver_phone, items, notes
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const grnNumber = formatSequence('GRN', getNextSequence('GRN', req.tenantId));
        const inwardId = uuidv4();

        let totalQty = 0;
        let acceptedQty = 0;
        let rejectedQty = 0;

        items.forEach(item => {
            totalQty += item.quantity || 0;
            acceptedQty += item.accepted_qty || item.quantity || 0;
            rejectedQty += item.rejected_qty || 0;
        });

        run(`INSERT INTO goods_inward (id, tenant_id, grn_number, po_id, supplier_id, factory_id, godown_id,
            inward_date, challan_number, challan_date, vehicle_number, driver_name, driver_phone,
            status, total_qty, accepted_qty, rejected_qty, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
            [inwardId, req.tenantId, grnNumber, po_id, supplier_id, factory_id || req.factoryId, godown_id,
             inward_date, challan_number, challan_date, vehicle_number, driver_name, driver_phone,
             totalQty, acceptedQty, rejectedQty, notes, req.user.id]);

        items.forEach((item, index) => {
            const itemId = uuidv4();
            const batchNumber = `${item.raw_material_id?.substring(0, 4).toUpperCase() || 'MAT'}${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(index + 1).padStart(3, '0')}`;
            const accepted = item.accepted_qty || item.quantity || 0;
            const amount = accepted * (item.rate || 0);

            run(`INSERT INTO inward_items (id, goods_inward_id, po_item_id, raw_material_id, batch_number, description,
                quantity, accepted_qty, rejected_qty, rate, amount, mfg_date, expiry_date, barcode, qc_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [itemId, inwardId, item.po_item_id, item.raw_material_id, batchNumber, item.description,
                 item.quantity, accepted, item.rejected_qty || 0, item.rate, amount, item.mfg_date, item.expiry_date, item.barcode]);

            if (accepted > 0) {
                const ledgerId = uuidv4();
                const prevBalance = queryOne(`SELECT balance_qty, balance_amount FROM stock_ledger
                    WHERE item_type = 'raw_material' AND item_id = ? AND godown_id = ?
                    ORDER BY created_at DESC LIMIT 1`,
                    [item.raw_material_id, godown_id]);

                const newBalanceQty = (prevBalance?.balance_qty || 0) + accepted;
                const newBalanceAmt = (prevBalance?.balance_amount || 0) + amount;

                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id,
                    transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount,
                    mfg_date, expiry_date, barcode, created_by)
                    VALUES (?, ?, 'raw_material', ?, ?, ?, 'purchase', 'goods_inward', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, item.raw_material_id, batchNumber, godown_id, inwardId,
                     accepted, item.rate, amount, newBalanceQty, newBalanceAmt, item.mfg_date, item.expiry_date, item.barcode, req.user.id]);
            }
        });

        if (po_id) {
            items.forEach(item => {
                if (item.po_item_id) {
                    const poItem = queryOne('SELECT delivered_qty FROM po_items WHERE id = ?', [item.po_item_id]);
                    if (poItem) {
                        run('UPDATE po_items SET delivered_qty = delivered_qty + ? WHERE id = ?',
                            [item.accepted_qty || item.quantity, item.po_item_id]);
                    }
                }
            });

            const allDelivered = queryOne(`SELECT COUNT(*) as pending FROM po_items WHERE po_id = ? AND delivered_qty < quantity`,
                [po_id]);
            if (allDelivered?.pending === 0) {
                run(`UPDATE purchase_orders SET status = 'received' WHERE id = ?`, [po_id]);
            } else {
                run(`UPDATE purchase_orders SET status = 'partial' WHERE id = ?`, [po_id]);
            }
        }

        logActivity(req.tenantId, req.user.id, 'purchase', 'goods_inward_created', inwardId, null, { grn_number: grnNumber }, req);

        res.json({ success: true, data: { id: inwardId, grn_number: grnNumber }, message: 'Goods inward recorded successfully' });
    } catch (error) {
        console.error('Goods inward error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/goods-inward/:id', authenticate, requirePermission('purchase', 'edit'), async (req, res) => {
    try {
        const { godown_id, inward_date, challan_number, challan_date, vehicle_number, driver_name, driver_phone, notes, status } = req.body;
        
        const inward = queryOne('SELECT * FROM goods_inward WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!inward) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Goods inward not found' } });
        }

        if (inward.status === 'completed' && status) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Cannot update completed inward. Create a new one.' } });
        }

        run(`UPDATE goods_inward SET godown_id = ?, inward_date = ?, challan_number = ?, challan_date = ?, vehicle_number = ?, driver_name = ?, driver_phone = ?, notes = ?, status = COALESCE(?, status)
             WHERE id = ?`,
            [godown_id, inward_date, challan_number, challan_date, vehicle_number, driver_name, driver_phone, notes, status, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'purchase', 'goods_inward_updated', req.params.id, null, req.body, req);

        res.json({ success: true, message: 'Goods inward updated successfully' });
    } catch (error) {
        console.error('Goods inward update error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Purchase Invoices
router.get('/purchase-invoices', authenticate, async (req, res) => {
    try {
        const { supplier_id, status, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT pi.*, s.name as supplier_name, gi.grn_number
                   FROM purchase_invoices pi
                   LEFT JOIN suppliers s ON pi.supplier_id = s.id
                   LEFT JOIN goods_inward gi ON pi.goods_inward_id = gi.id
                   WHERE pi.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM purchase_invoices WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (supplier_id) { sql += ' AND pi.supplier_id = ?'; countSql += ' AND supplier_id = ?'; params.push(supplier_id); }
        if (status) { sql += ' AND pi.payment_status = ?'; countSql += ' AND payment_status = ?'; params.push(status); }
        if (from_date) { sql += ' AND pi.invoice_date >= ?'; countSql += ' AND invoice_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND pi.invoice_date <= ?'; countSql += ' AND invoice_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY pi.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const invoices = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: invoices, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/purchase-invoices', authenticate, requirePermission('purchase', 'add'), async (req, res) => {
    try {
        const { goods_inward_id, supplier_id, invoice_number, invoice_date, invoice_amount, tax_amount, total_amount, due_date, notes } = req.body;

        if (!invoice_amount || !total_amount) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invoice amount and total amount are required' } });
        }

        const piNumber = formatSequence('PI', getNextSequence('PI', req.tenantId));
        const invoiceId = uuidv4();

        run(`INSERT INTO purchase_invoices (id, tenant_id, invoice_number, supplier_id, goods_inward_id, invoice_date,
            invoice_amount, tax_amount, total_amount, payment_status, due_date, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [invoiceId, req.tenantId, invoice_number || piNumber, supplier_id, goods_inward_id, invoice_date,
             invoice_amount, tax_amount || 0, total_amount, due_date, notes, req.user.id]);

        logActivity(req.tenantId, req.user.id, 'purchase', 'purchase_invoice_created', invoiceId, null, { invoice_number }, req);

        res.json({ success: true, data: { id: invoiceId, invoice_number: invoice_number || piNumber }, message: 'Purchase invoice created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/purchase-invoices/:id', authenticate, requirePermission('purchase', 'edit'), async (req, res) => {
    try {
        const { invoice_date, invoice_amount, tax_amount, total_amount, due_date, notes, payment_status } = req.body;
        
        const invoice = queryOne('SELECT * FROM purchase_invoices WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!invoice) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase invoice not found' } });
        }

        run(`UPDATE purchase_invoices SET invoice_date = ?, invoice_amount = ?, tax_amount = ?, total_amount = ?, due_date = ?, notes = ?, payment_status = ?
             WHERE id = ?`,
            [invoice_date, invoice_amount, tax_amount, total_amount, due_date, notes, payment_status || invoice.payment_status, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'purchase', 'purchase_invoice_updated', req.params.id, null, req.body, req);

        res.json({ success: true, message: 'Purchase invoice updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/purchase-invoices/:id/pay', authenticate, requirePermission('finance', 'add'), async (req, res) => {
    try {
        const { amount, payment_mode, reference_number, notes } = req.body;
        
        const invoice = queryOne('SELECT * FROM purchase_invoices WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!invoice) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase invoice not found' } });
        }

        const paymentAmount = Math.min(amount, invoice.total_amount - (invoice.amount_paid || 0));

        run(`UPDATE purchase_invoices SET amount_paid = amount_paid + ?, payment_status = CASE WHEN total_amount - amount_paid - ? <= 0 THEN 'paid' ELSE 'partial' END
             WHERE id = ?`,
            [paymentAmount, paymentAmount, req.params.id]);

        const paymentId = uuidv4();
        const paymentNumber = formatSequence('PAY', getNextSequence('PAY', req.tenantId));

        run(`INSERT INTO payments (id, tenant_id, payment_number, payment_date, party_type, party_id, account_id, amount, payment_mode, reference_number, notes, created_by)
             VALUES (?, ?, ?, ?, 'supplier', ?, ?, ?, ?, ?, ?, ?)`,
            [paymentId, req.tenantId, paymentNumber, new Date().toISOString().slice(0, 10), invoice.supplier_id, invoice.amount_paid, paymentAmount, payment_mode, reference_number, notes, req.user.id]);

        logActivity(req.tenantId, req.user.id, 'finance', 'purchase_payment_made', req.params.id, null, { amount: paymentAmount }, req);

        res.json({ success: true, data: { id: paymentId, payment_number: paymentNumber }, message: 'Payment recorded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
