const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

function getTaxRate(tenantId) {
    const setting = queryOne('SELECT value FROM settings WHERE tenant_id = ? AND key = ?', [tenantId, 'tax_rate']);
    return setting ? parseFloat(setting.value) / 100 : 0.05; // Default 5%
}

// Customers - Read-only reference (use /master/customers for full CRUD)
router.get('/customers', authenticate, async (req, res) => {
    try {
        const { search, type, page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        let sql = 'SELECT * FROM customers WHERE tenant_id = ? AND is_active = 1';
        let countSql = 'SELECT COUNT(*) as total FROM customers WHERE tenant_id = ? AND is_active = 1';
        const params = [req.tenantId];

        if (search) { sql += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)'; countSql += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        if (type) { sql += ' AND type = ?'; countSql += ' AND type = ?'; params.push(type); }

        sql += ` ORDER BY name LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const customers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: customers, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/customers/:id', authenticate, async (req, res) => {
    try {
        const customer = queryOne('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!customer) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });

        const orders = query('SELECT * FROM sales_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
        const invoices = query('SELECT * FROM sales_invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);

        res.json({ success: true, data: { ...customer, orders, invoices } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Sales Orders
router.get('/orders', authenticate, async (req, res) => {
    try {
        const { status, customer_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT so.*, c.name as customer_name, c.code as customer_code, u.name as created_by_name
                   FROM sales_orders so
                   LEFT JOIN customers c ON so.customer_id = c.id
                   LEFT JOIN users u ON so.created_by = u.id
                   WHERE so.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) { sql += ' AND so.status = ?'; countSql += ' AND status = ?'; params.push(status); }
        if (customer_id) { sql += ' AND so.customer_id = ?'; countSql += ' AND customer_id = ?'; params.push(customer_id); }
        if (from_date) { sql += ' AND so.order_date >= ?'; countSql += ' AND order_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND so.order_date <= ?'; countSql += ' AND order_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY so.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const orders = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: orders, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/orders/:id', authenticate, async (req, res) => {
    try {
        const order = queryOne(`
            SELECT so.*, c.name as customer_name, c.code as customer_code, c.phone as customer_phone, c.address as customer_address
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE so.id = ? AND so.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });

        const items = query(`
            SELECT si.*, p.name as product_name, p.code as product_code, u.name as unit_name
            FROM so_items si
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN units u ON si.unit_id = u.id
            WHERE si.so_id = ?
        `, [req.params.id]);

        res.json({ success: true, data: { ...order, items } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/orders', authenticate, requirePermission('sales', 'add'), async (req, res) => {
    try {
        const { customer_id, factory_id, order_date, delivery_date, items, notes, discount_amount } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const orderNumber = formatSequence('SO', getNextSequence('SO', req.tenantId));
        const orderId = uuidv4();

        let subtotal = 0;
        items.forEach(item => { subtotal += (item.quantity || 0) * (item.rate || 0); });
        const discount = discount_amount || 0;
        const taxRate = getTaxRate(req.tenantId);
        const tax = (subtotal - discount) * taxRate;
        const net = subtotal - discount + tax;

        run(`INSERT INTO sales_orders (id, tenant_id, order_number, customer_id, factory_id, order_date, delivery_date, status, subtotal, discount_amount, tax_amount, net_amount, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
            [orderId, req.tenantId, orderNumber, customer_id, factory_id || req.factoryId, order_date, delivery_date, subtotal, discount, tax, net, notes, req.user.id]);

        items.forEach(item => {
            const itemId = uuidv4();
            const amount = (item.quantity || 0) * (item.rate || 0);
            run(`INSERT INTO so_items (id, so_id, product_id, batch_number, quantity, unit_id, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, orderId, item.product_id, item.batch_number, item.quantity, item.unit_id, item.rate, amount]);
        });

        logActivity(req.tenantId, req.user.id, 'sales', 'order_created', orderId, null, { order_number: orderNumber }, req);

        res.json({ success: true, data: { id: orderId, order_number: orderNumber }, message: 'Sales order created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/orders/:id/confirm', authenticate, requirePermission('sales', 'approve'), async (req, res) => {
    try {
        run(`UPDATE sales_orders SET status = 'confirmed' WHERE id = ? AND status = 'pending'`, [req.params.id]);
        logActivity(req.tenantId, req.user.id, 'sales', 'order_confirmed', req.params.id, null, { status: 'confirmed' }, req);
        res.json({ success: true, message: 'Order confirmed' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/orders/:id/cancel', authenticate, requirePermission('sales', 'delete'), async (req, res) => {
    try {
        run(`UPDATE sales_orders SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'confirmed')`, [req.params.id]);
        logActivity(req.tenantId, req.user.id, 'sales', 'order_cancelled', req.params.id, null, { status: 'cancelled' }, req);
        res.json({ success: true, message: 'Order cancelled' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Sales Invoices
router.get('/invoices', authenticate, async (req, res) => {
    try {
        const { status, customer_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT si.*, c.name as customer_name, c.code as customer_code, so.order_number, u.name as created_by_name
                   FROM sales_invoices si
                   LEFT JOIN customers c ON si.customer_id = c.id
                   LEFT JOIN sales_orders so ON si.so_id = so.id
                   LEFT JOIN users u ON si.created_by = u.id
                   WHERE si.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM sales_invoices WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) { sql += ' AND si.payment_status = ?'; countSql += ' AND payment_status = ?'; params.push(status); }
        if (customer_id) { sql += ' AND si.customer_id = ?'; countSql += ' AND customer_id = ?'; params.push(customer_id); }
        if (from_date) { sql += ' AND si.invoice_date >= ?'; countSql += ' AND invoice_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND si.invoice_date <= ?'; countSql += ' AND invoice_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY si.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const invoices = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: invoices, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/invoices/:id', authenticate, async (req, res) => {
    try {
        const invoice = queryOne(`
            SELECT si.*, c.name as customer_name, c.code as customer_code, c.address as customer_address, c.gstin as customer_gstin,
                   so.order_number, f.name as factory_name, f.address as factory_address, f.phone as factory_phone
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            LEFT JOIN sales_orders so ON si.so_id = so.id
            LEFT JOIN factories f ON si.factory_id = f.id
            WHERE si.id = ? AND si.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!invoice) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });

        const items = query(`
            SELECT ii.*, p.name as product_name, p.code as product_code, p.pack_size
            FROM invoice_items ii
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = ?
        `, [req.params.id]);

        res.json({ success: true, data: { ...invoice, items } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/invoices', authenticate, requirePermission('sales', 'add'), async (req, res) => {
    try {
        const { so_id, customer_id, factory_id, invoice_date, items, notes, due_date } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const invoiceNumber = formatSequence('INV', getNextSequence('INV', req.tenantId));
        const invoiceId = uuidv4();

        let subtotal = 0;
        items.forEach(item => { subtotal += (item.quantity || 0) * (item.rate || 0); });
        const taxRate = getTaxRate(req.tenantId);
        const tax = subtotal * taxRate;
        const net = subtotal + tax;

        run(`INSERT INTO sales_invoices (id, tenant_id, invoice_number, so_id, customer_id, factory_id, invoice_date, subtotal, tax_amount, net_amount, amount_due, payment_status, due_date, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [invoiceId, req.tenantId, invoiceNumber, so_id, customer_id, factory_id || req.factoryId, invoice_date, subtotal, tax, net, net, due_date, notes, req.user.id]);

        items.forEach(item => {
            const itemId = uuidv4();
            const amount = (item.quantity || 0) * (item.rate || 0);

            run(`INSERT INTO invoice_items (id, invoice_id, product_id, batch_number, quantity, rate, amount, godown_id, barcode)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, invoiceId, item.product_id, item.batch_number, item.quantity, item.rate, amount, item.godown_id, item.barcode]);

            const stockBalance = queryOne(`
                SELECT balance_qty, balance_amount FROM stock_ledger
                WHERE item_type = 'product' AND item_id = ? AND godown_id = ?
                ORDER BY created_at DESC LIMIT 1
            `, [item.product_id, item.godown_id]);

            if (stockBalance && stockBalance.balance_qty > 0 && stockBalance.balance_qty >= item.quantity) {
                const avgRate = stockBalance.balance_amount / stockBalance.balance_qty;
                const newBalanceQty = stockBalance.balance_qty - item.quantity;
                const newBalanceAmt = stockBalance.balance_amount - (item.quantity * avgRate);
                const rate = avgRate;

                const ledgerId = uuidv4();
                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, barcode, created_by)
                     VALUES (?, ?, 'product', ?, ?, ?, 'sale', 'invoice', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, item.product_id, item.batch_number, item.godown_id, invoiceId, -item.quantity, rate, -item.quantity * rate, newBalanceQty, newBalanceAmt, item.barcode, req.user.id]);
            }
        });

        if (so_id) {
            run(`UPDATE sales_orders SET status = 'dispatched' WHERE id = ?`, [so_id]);
            items.forEach(item => {
                run('UPDATE so_items SET delivered_qty = delivered_qty + ? WHERE so_id = ? AND product_id = ?',
                    [item.quantity, so_id, item.product_id]);
            });
        }

        run('UPDATE customers SET outstanding = outstanding + ? WHERE id = ?', [net, customer_id]);

        logActivity(req.tenantId, req.user.id, 'sales', 'invoice_created', invoiceId, null, { invoice_number: invoiceNumber }, req);

        res.json({ success: true, data: { id: invoiceId, invoice_number: invoiceNumber }, message: 'Invoice created successfully' });
    } catch (error) {
        console.error('Invoice creation error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/invoices/:id/payment', authenticate, requirePermission('finance', 'add'), async (req, res) => {
    try {
        const { amount, payment_mode, reference_number, notes } = req.body;

        const invoice = queryOne('SELECT * FROM sales_invoices WHERE id = ?', [req.params.id]);
        if (!invoice) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });

        const paymentAmount = Math.min(amount, invoice.amount_due);

        run(`UPDATE sales_invoices SET amount_paid = amount_paid + ?, amount_due = amount_due - ?, payment_status = CASE WHEN amount_due - ? <= 0 THEN 'paid' ELSE 'partial' END
             WHERE id = ?`,
            [paymentAmount, paymentAmount, paymentAmount, req.params.id]);

        run('UPDATE customers SET outstanding = outstanding - ? WHERE id = ?', [paymentAmount, invoice.customer_id]);

        const paymentId = uuidv4();
        const paymentNumber = formatSequence('PAY', getNextSequence('PAY', req.tenantId));

        run(`INSERT INTO payments (id, tenant_id, payment_number, payment_date, party_type, party_id, amount, payment_mode, reference_number, notes, created_by)
             VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?, ?, ?)`,
            [paymentId, req.tenantId, paymentNumber, new Date().toISOString().slice(0, 10), invoice.customer_id, paymentAmount, payment_mode, reference_number, notes, req.user.id]);

        logActivity(req.tenantId, req.user.id, 'sales', 'payment_received', req.params.id, null, { amount: paymentAmount }, req);

        res.json({ success: true, message: 'Payment recorded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Sales Returns
router.get('/returns', authenticate, async (req, res) => {
    try {
        const returns = query(`
            SELECT sr.*, c.name as customer_name, si.invoice_number
            FROM sales_returns sr
            LEFT JOIN customers c ON sr.customer_id = c.id
            LEFT JOIN sales_invoices si ON sr.invoice_id = si.id
            WHERE sr.tenant_id = ? ORDER BY sr.created_at DESC
        `, [req.tenantId]);
        res.json({ success: true, data: returns });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/returns', authenticate, requirePermission('sales', 'add'), async (req, res) => {
    try {
        const { invoice_id, customer_id, return_date, reason, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } });
        }

        const returnNumber = formatSequence('RET', getNextSequence('RET', req.tenantId));
        const returnId = uuidv4();

        let totalAmount = 0;
        items.forEach(item => { totalAmount += (item.quantity || 0) * (item.rate || 0); });

        run(`INSERT INTO sales_returns (id, tenant_id, return_number, invoice_id, customer_id, return_date, reason, total_amount, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [returnId, req.tenantId, returnNumber, invoice_id, customer_id, return_date, reason, totalAmount, req.user.id]);

        items.forEach(item => {
            run(`INSERT INTO return_items (id, return_id, product_id, batch_number, quantity, rate, amount, condition)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), returnId, item.product_id, item.batch_number, item.quantity, item.rate, item.quantity * item.rate, item.condition]);
        });

        logActivity(req.tenantId, req.user.id, 'sales', 'return_created', returnId, null, { return_number: returnNumber }, req);

        res.json({ success: true, data: { id: returnId, return_number: returnNumber }, message: 'Return created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/returns/:id/approve', authenticate, requirePermission('sales', 'approve'), async (req, res) => {
    try {
        const returnRecord = queryOne('SELECT * FROM sales_returns WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!returnRecord) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } });
        }
        if (returnRecord.status !== 'pending') {
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Only pending returns can be approved' } });
        }

        const returnItems = query('SELECT * FROM return_items WHERE return_id = ?', [req.params.id]);

        for (const item of returnItems) {
            if (item.condition === 'resalable' || item.condition === 'damaged') {
                const productGodown = queryOne('SELECT id FROM godowns WHERE factory_id = ? AND type = ? LIMIT 1',
                    [req.factoryId, 'finished_goods']);
                
                if (productGodown) {
                    const prevBalance = queryOne(`
                        SELECT balance_qty, balance_amount FROM stock_ledger
                        WHERE item_type = 'product' AND item_id = ? AND godown_id = ?
                        ORDER BY created_at DESC LIMIT 1
                    `, [item.product_id, productGodown.id]);

                    const avgRate = prevBalance && prevBalance.balance_qty > 0 
                        ? prevBalance.balance_amount / prevBalance.balance_qty 
                        : 0;
                    const newBalanceQty = (prevBalance?.balance_qty || 0) + item.quantity;
                    const newBalanceAmt = (prevBalance?.balance_amount || 0) + (item.quantity * avgRate);

                    const ledgerId = uuidv4();
                    run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, created_by)
                         VALUES (?, ?, 'product', ?, ?, ?, 'return', 'sales_return', ?, ?, ?, ?, ?, ?, ?)`,
                        [ledgerId, req.tenantId, item.product_id, item.batch_number, productGodown.id, req.params.id,
                         item.quantity, avgRate, item.quantity * avgRate, newBalanceQty, newBalanceAmt, req.user.id]);
                }
            }
        }

        run(`UPDATE sales_returns SET status = 'approved' WHERE id = ?`, [req.params.id]);

        if (returnRecord.invoice_id) {
            run(`UPDATE sales_invoices SET amount_due = amount_due + ?, amount_paid = amount_paid - ? WHERE id = ?`,
                [returnRecord.total_amount, returnRecord.total_amount, returnRecord.invoice_id]);
        }

        if (returnRecord.customer_id) {
            run('UPDATE customers SET outstanding = outstanding - ? WHERE id = ?',
                [returnRecord.total_amount, returnRecord.customer_id]);
        }

        logActivity(req.tenantId, req.user.id, 'sales', 'return_approved', req.params.id, null, { status: 'approved', amount: returnRecord.total_amount }, req);

        res.json({ success: true, message: 'Return approved and stock credited successfully' });
    } catch (error) {
        console.error('Return approval error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/returns/:id/reject', authenticate, requirePermission('sales', 'approve'), async (req, res) => {
    try {
        const { reason } = req.body;
        
        const returnRecord = queryOne('SELECT * FROM sales_returns WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!returnRecord) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } });
        }
        if (returnRecord.status !== 'pending') {
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Only pending returns can be rejected' } });
        }

        run(`UPDATE sales_returns SET status = 'rejected', reason = COALESCE(reason || '. ', '') || ? WHERE id = ?`, 
            [reason || 'Rejected by system', req.params.id]);

        logActivity(req.tenantId, req.user.id, 'sales', 'return_rejected', req.params.id, null, { status: 'rejected' }, req);

        res.json({ success: true, message: 'Return rejected' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
