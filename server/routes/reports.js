const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { generatePDFReport, generateExcelReport } = require('../utils/export');

router.get('/stock-position', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { godown_id, as_on_date } = req.query;
        const date = as_on_date || new Date().toISOString().slice(0, 10);

        let sql = `
            SELECT sl.item_type, sl.item_id, sl.godown_id, sl.batch_number,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.code ELSE p.code END as item_code,
                   g.name as godown_name, g.code as godown_code,
                   SUM(sl.quantity) as qty, SUM(sl.quantity * sl.rate) as value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
            WHERE sl.tenant_id = ? AND sl.created_at <= ?
        `;
        const params = [req.tenantId, date + ' 23:59:59'];

        if (godown_id) { sql += ' AND sl.godown_id = ?'; params.push(godown_id); }

        sql += ` GROUP BY sl.item_type, sl.item_id, sl.godown_id, sl.batch_number, rm.name, p.name, rm.code, p.code, g.name, g.code
                 ORDER BY item_name`;

        const stock = query(sql, params);
        const totals = queryOne(`
            SELECT SUM(sl.quantity) as total_qty, SUM(sl.quantity * sl.rate) as total_value
            FROM stock_ledger sl WHERE sl.tenant_id = ? AND sl.created_at <= ?
            ${godown_id ? 'AND sl.godown_id = ?' : ''}
        `, godown_id ? [req.tenantId, date + ' 23:59:59', godown_id] : [req.tenantId, date + ' 23:59:59']);

        res.json({ success: true, data: { stock, totals, as_on_date: date } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/stock-valuation', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { godown_id } = req.query;

        let rawSql = `
            SELECT 'raw_material' as type, rm.id, rm.name, rm.code, rm.category,
                   COALESCE(SUM(sl.quantity), 0) as qty,
                   COALESCE(SUM(sl.quantity * sl.rate) / NULLIF(SUM(sl.quantity), 0), 0) as avg_rate,
                   COALESCE(SUM(sl.quantity * sl.rate), 0) as value
            FROM raw_materials rm
            LEFT JOIN stock_ledger sl ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            ${godown_id ? 'AND sl.godown_id = ?' : ''}
            WHERE rm.tenant_id = ? AND rm.is_active = 1
            GROUP BY rm.id
            ORDER BY rm.category, rm.name
        `;

        let prodSql = `
            SELECT 'product' as type, p.id, p.name, p.code, p.type as category,
                   COALESCE(SUM(sl.quantity), 0) as qty,
                   COALESCE(SUM(sl.quantity * sl.rate) / NULLIF(SUM(sl.quantity), 0), 0) as avg_rate,
                   COALESCE(SUM(sl.quantity * sl.rate), 0) as value
            FROM products p
            LEFT JOIN stock_ledger sl ON sl.item_type = 'product' AND sl.item_id = p.id
            ${godown_id ? 'AND sl.godown_id = ?' : ''}
            WHERE p.tenant_id = ? AND p.is_active = 1
            GROUP BY p.id
            ORDER BY p.type, p.name
        `;

        const rawParams = godown_id ? [godown_id, req.tenantId] : [req.tenantId];
        const prodParams = godown_id ? [godown_id, req.tenantId] : [req.tenantId];

        const rawMaterials = query(rawSql, rawParams);
        const products = query(prodSql, prodParams);

        const rawTotal = rawMaterials.reduce((acc, r) => ({ qty: acc.qty + r.qty, value: acc.value + r.value }), { qty: 0, value: 0 });
        const prodTotal = products.reduce((acc, r) => ({ qty: acc.qty + r.qty, value: acc.value + r.value }), { qty: 0, value: 0 });

        res.json({
            success: true,
            data: {
                raw_materials: { items: rawMaterials, total: rawTotal },
                products: { items: products, total: prodTotal },
                grand_total: { qty: rawTotal.qty + prodTotal.qty, value: rawTotal.value + prodTotal.value }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/production-summary', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const summary = query(`
            SELECT pb.batch_date as date, f.name as formula, p.name as product,
                   pb.batch_number, pb.planned_qty, pb.actual_qty, pb.loss_percentage, pb.status,
                   u.name as operator
            FROM production_batches pb
            LEFT JOIN formulas f ON pb.formula_id = f.id
            LEFT JOIN products p ON pb.product_id = p.id
            LEFT JOIN users u ON pb.created_by = u.id
            WHERE pb.tenant_id = ? AND pb.factory_id = ? AND pb.batch_date BETWEEN ? AND ?
            ORDER BY pb.batch_date DESC
        `, [req.tenantId, req.factoryId, from, to]);

        const totals = queryOne(`
            SELECT COUNT(*) as total_batches, COALESCE(SUM(planned_qty), 0) as total_planned,
                   COALESCE(SUM(actual_qty), 0) as total_actual, AVG(loss_percentage) as avg_loss
            FROM production_batches WHERE tenant_id = ? AND factory_id = ? AND batch_date BETWEEN ? AND ?
        `, [req.tenantId, req.factoryId, from, to]);

        res.json({ success: true, data: { summary, totals, from_date: from, to_date: to } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/sales-summary', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const invoices = query(`
            SELECT si.invoice_date as date, si.invoice_number, c.name as customer, c.code as customer_code,
                   si.net_amount, si.amount_paid, si.amount_due, si.payment_status,
                   si.notes, u.name as created_by
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            LEFT JOIN users u ON si.created_by = u.id
            WHERE si.tenant_id = ? AND si.factory_id = ? AND si.invoice_date BETWEEN ? AND ?
            ORDER BY si.invoice_date DESC
        `, [req.tenantId, req.factoryId, from, to]);

        const totals = queryOne(`
            SELECT COUNT(*) as total_invoices, COALESCE(SUM(net_amount), 0) as total_sales,
                   COALESCE(SUM(amount_paid), 0) as total_received, COALESCE(SUM(amount_due), 0) as total_outstanding
            FROM sales_invoices WHERE tenant_id = ? AND factory_id = ? AND invoice_date BETWEEN ? AND ?
        `, [req.tenantId, req.factoryId, from, to]);

        res.json({ success: true, data: { invoices, totals, from_date: from, to_date: to } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/profit-analysis', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const sales = query(`
            SELECT si.invoice_date as date, SUM(si.subtotal) as sales_value, SUM(si.tax_amount) as tax, SUM(si.net_amount) as revenue
            FROM sales_invoices si WHERE si.tenant_id = ? AND si.invoice_date BETWEEN ? AND ?
            GROUP BY si.invoice_date
        `, [req.tenantId, from, to]);

        const purchases = query(`
            SELECT gi.inward_date as date, SUM(ii.amount) as purchase_cost
            FROM goods_inward gi
            LEFT JOIN inward_items ii ON gi.id = ii.goods_inward_id
            WHERE gi.tenant_id = ? AND gi.inward_date BETWEEN ? AND ?
            GROUP BY gi.inward_date
        `, [req.tenantId, from, to]);

        const productionCost = query(`
            SELECT pb.batch_date as date, SUM(bc.actual_qty * sl.rate) as material_cost
            FROM production_batches pb
            LEFT JOIN batch_consumption bc ON pb.id = bc.batch_id
            LEFT JOIN stock_ledger sl ON sl.item_type = 'raw_material' AND sl.item_id = bc.raw_material_id
            WHERE pb.tenant_id = ? AND pb.batch_date BETWEEN ? AND ?
            GROUP BY pb.batch_date
        `, [req.tenantId, from, to]);

        res.json({ success: true, data: { sales, purchases, production_cost: productionCost, from_date: from, to_date: to } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/raw-material-usage', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const usage = query(`
            SELECT rm.name, rm.code, rm.category, SUM(bc.actual_qty) as total_qty,
                   SUM(bc.actual_qty * COALESCE((SELECT rate FROM stock_ledger WHERE item_type = 'raw_material' AND item_id = rm.id ORDER BY created_at DESC LIMIT 1), 0)) as total_value
            FROM batch_consumption bc
            LEFT JOIN raw_materials rm ON bc.raw_material_id = rm.id
            LEFT JOIN production_batches pb ON bc.batch_id = pb.id
            WHERE pb.tenant_id = ? AND pb.batch_date BETWEEN ? AND ?
            GROUP BY bc.raw_material_id
            ORDER BY total_qty DESC
        `, [req.tenantId, from, to]);

        res.json({ success: true, data: { usage, from_date: from, to_date: to } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/stock-position/export', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { godown_id, as_on_date, format = 'pdf' } = req.query;
        const date = as_on_date || new Date().toISOString().slice(0, 10);

        let sql = `
            SELECT sl.item_type, sl.item_id, sl.godown_id, sl.batch_number,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.code ELSE p.code END as item_code,
                   g.name as godown_name, ROUND(SUM(sl.quantity), 2) as qty, ROUND(SUM(sl.quantity * sl.rate), 2) as value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
            WHERE sl.tenant_id = ? AND sl.created_at <= ?
        `;
        const params = [req.tenantId, date + ' 23:59:59'];

        if (godown_id) { sql += ' AND sl.godown_id = ?'; params.push(godown_id); }

        sql += ` GROUP BY sl.item_type, sl.item_id, sl.godown_id ORDER BY item_name`;

        const stock = query(sql, params);
        const headers = ['Item Code', 'Item Name', 'Godown', 'Type', 'Qty', 'Value'];
        const formatters = { qty: 'number', value: 'currency' };

        if (format === 'excel') {
            const workbook = await generateExcelReport('Stock Position Report', headers, stock.map(s => ({
                item_code: s.item_code, item_name: s.item_name, godown_name: s.godown_name,
                item_type: s.item_type, qty: s.qty, value: s.value
            })), {
                subtitle: `As on ${new Date(date).toLocaleDateString('en-IN')}`,
                formatters,
                sheetName: 'Stock Position',
                columnWidths: [12, 25, 15, 12, 10, 15],
                addTotals: true
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=stock_position_${date}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else {
            const pdfBuffer = await generatePDFReport('Stock Position Report', headers, stock.map(s => ({
                item_code: s.item_code, item_name: s.item_name, godown_name: s.godown_name,
                item_type: s.item_type, qty: s.qty, value: s.value
            })), {
                subtitle: `As on ${new Date(date).toLocaleDateString('en-IN')}`,
                formatters,
                columnWidths: [60, 150, 80, 60, 50, 80],
                excludeColumns: ['godown_code']
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=stock_position_${date}.pdf`);
            res.send(pdfBuffer);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/sales-summary/export', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date, customer_id, format = 'pdf' } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        let sql = `SELECT si.invoice_number, si.invoice_date, c.name as customer_name, si.total_amount, si.paid_amount, (si.total_amount - si.paid_amount) as balance
            FROM sales_invoices si LEFT JOIN customers c ON si.customer_id = c.id WHERE si.tenant_id = ? AND si.invoice_date BETWEEN ? AND ?`;
        const params = [req.tenantId, from, to];
        if (customer_id) { sql += ' AND si.customer_id = ?'; params.push(customer_id); }
        sql += ' ORDER BY si.invoice_date DESC';

        const invoices = query(sql, params);
        const headers = ['Invoice #', 'Date', 'Customer', 'Amount', 'Paid', 'Balance'];
        const formatters = { invoice_date: 'date', total_amount: 'currency', paid_amount: 'currency', balance: 'currency' };

        if (format === 'excel') {
            const workbook = await generateExcelReport('Sales Summary Report', headers, invoices.map(s => ({
                invoice_number: s.invoice_number, invoice_date: s.invoice_date, customer_name: s.customer_name,
                total_amount: s.total_amount, paid_amount: s.paid_amount, balance: s.balance
            })), {
                subtitle: `${from} to ${to}`,
                formatters,
                sheetName: 'Sales Summary',
                columnWidths: [15, 12, 25, 12, 12, 12],
                addTotals: true
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales_summary_${from}_${to}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else {
            const pdfBuffer = await generatePDFReport('Sales Summary Report', headers, invoices.map(s => ({
                invoice_number: s.invoice_number, invoice_date: s.invoice_date, customer_name: s.customer_name,
                total_amount: s.total_amount, paid_amount: s.paid_amount, balance: s.balance
            })), {
                subtitle: `${from} to ${to}`,
                formatters,
                columnWidths: [70, 60, 120, 60, 60, 60]
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales_summary_${from}_${to}.pdf`);
            res.send(pdfBuffer);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/production-summary/export', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date, format = 'pdf' } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const batches = query(`
            SELECT pb.batch_number, pb.batch_date, pr.name as product_name, pb.planned_qty, pb.actual_qty, pb.loss_percentage, pb.status
            FROM production_batches pb LEFT JOIN products pr ON pb.product_id = pr.id
            WHERE pb.tenant_id = ? AND pb.batch_date BETWEEN ? AND ?
            ORDER BY pb.batch_date DESC
        `, [req.tenantId, from, to]);

        const headers = ['Batch #', 'Date', 'Product', 'Planned Qty', 'Actual Qty', 'Loss %', 'Status'];
        const formatters = { batch_date: 'date', planned_qty: 'number', actual_qty: 'number', loss_percentage: 'percentage' };

        if (format === 'excel') {
            const workbook = await generateExcelReport('Production Summary Report', headers, batches.map(b => ({
                batch_number: b.batch_number, batch_date: b.batch_date, product_name: b.product_name,
                planned_qty: b.planned_qty, actual_qty: b.actual_qty, loss_percentage: b.loss_percentage, status: b.status
            })), {
                subtitle: `${from} to ${to}`,
                formatters,
                sheetName: 'Production Summary',
                columnWidths: [15, 12, 25, 12, 12, 10, 12],
                addTotals: true
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=production_summary_${from}_${to}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else {
            const pdfBuffer = await generatePDFReport('Production Summary Report', headers, batches.map(b => ({
                batch_number: b.batch_number, batch_date: b.batch_date, product_name: b.product_name,
                planned_qty: b.planned_qty, actual_qty: b.actual_qty, loss_percentage: b.loss_percentage, status: b.status
            })), {
                subtitle: `${from} to ${to}`,
                formatters,
                columnWidths: [60, 60, 100, 60, 60, 50, 60]
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=production_summary_${from}_${to}.pdf`);
            res.send(pdfBuffer);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Audit Trail Report
router.get('/audit-log', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date, user_id, module, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT al.*, u.name as user_name FROM activity_log al
                  LEFT JOIN users u ON al.user_id = u.id
                  WHERE al.tenant_id = ?`;
        let params = [req.tenantId];

        if (from_date) { sql += ' AND al.created_at >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND al.created_at <= ?'; params.push(to_date + ' 23:59:59'); }
        if (user_id) { sql += ' AND al.user_id = ?'; params.push(user_id); }
        if (module) { sql += ' AND al.module = ?'; params.push(module); }

        sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const logs = query(sql, params);
        const { total } = queryOne(`SELECT COUNT(*) as total FROM activity_log WHERE tenant_id = ?`, [req.tenantId]);

        res.json({ success: true, data: logs, meta: { page: parseInt(page), limit: parseInt(limit), total } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Inventory Aging Report
router.get('/inventory-aging', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { godown_id, aging_days = 30 } = req.query;

        let sql = `
            SELECT sl.item_type, sl.item_id, sl.batch_number, sl.godown_id,
                   sl.mfg_date, sl.expiry_date, sl.created_at,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   g.name as godown_name,
                   JULIANDAY('now') - JULIANDAY(sl.created_at) as age_days,
                   sl.quantity as qty, sl.rate, sl.amount
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
            WHERE sl.tenant_id = ? AND sl.quantity > 0
        `;
        const params = [req.tenantId];

        if (godown_id) { sql += ' AND sl.godown_id = ?'; params.push(godown_id); }

        sql += ' ORDER BY age_days DESC';

        const agingData = query(sql, params);

        const bucket = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        const items = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };

        agingData.forEach(row => {
            const days = Math.floor(row.age_days);
            let key = '90+';
            if (days <= 30) key = '0-30';
            else if (days <= 60) key = '31-60';
            else if (days <= 90) key = '61-90';
            
            bucket[key] += row.amount || 0;
            items[key].push(row);
        });

        res.json({ success: true, data: { aging: items, buckets: bucket } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Production Cost Report
router.get('/production-cost', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date, batch_id } = req.query;

        let sql = `
            SELECT pb.batch_number, pb.batch_date, pb.planned_qty, pb.actual_qty, pb.loss_percentage,
                   f.name as formula_name, p.name as product_name,
                   pb.total_cost, pb.cost_per_kg,
                   bc.material_cost, bc.processing_cost, bc.overhead_cost
            FROM production_batches pb
            LEFT JOIN formulas f ON pb.formula_id = f.id
            LEFT JOIN products p ON pb.product_id = p.id
            LEFT JOIN batch_consumption bc ON pb.id = bc.batch_id
            WHERE pb.tenant_id = ? AND pb.status = 'completed'
        `;
        const params = [req.tenantId];

        if (from_date) { sql += ' AND pb.batch_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND pb.batch_date <= ?'; params.push(to_date); }
        if (batch_id) { sql += ' AND pb.id = ?'; params.push(batch_id); }

        sql += ' ORDER BY pb.batch_date DESC';

        const costData = query(sql, params);
        const totals = queryOne(`
            SELECT SUM(pb.actual_qty) as total_qty, SUM(pb.total_cost) as total_cost, 
                   AVG(pb.cost_per_kg) as avg_cost_per_kg
            FROM production_batches pb
            WHERE pb.tenant_id = ? AND pb.status = 'completed'
            ${from_date ? 'AND pb.batch_date >= ?' : ''}
            ${to_date ? 'AND pb.batch_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : to_date ? [req.tenantId, to_date] : [req.tenantId]);

        res.json({ success: true, data: { batches: costData, totals } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Customer Statement
router.get('/customer-statement', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { customer_id, from_date, to_date } = req.query;

        if (!customer_id) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Customer ID required' } });
        }

        const customer = queryOne('SELECT * FROM customers WHERE id = ?', [customer_id]);
        if (!customer) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        }

        let sql = `
            (SELECT si.invoice_number as ref_no, si.invoice_date as date, 'Invoice' as type, 
                    si.net_amount as debit, 0 as credit, si.amount_due as balance
             FROM sales_invoices si WHERE si.customer_id = ? AND si.tenant_id = ?)
            UNION ALL
            (SELECT sp.payment_number as ref_no, sp.payment_date as date, 'Payment' as type,
                    0 as debit, sp.amount as credit, 0 as balance
             FROM payments sp WHERE sp.customer_id = ? AND sp.tenant_id = ?)
            UNION ALL
            (SELECT sr.return_number as ref_no, sr.return_date as date, 'Return' as type,
                    0 as debit, sr.total_amount as credit, 0 as balance
             FROM sales_returns sr WHERE sr.customer_id = ? AND sr.tenant_id = ? AND sr.status = 'approved')
            ORDER BY date DESC
        `;
        const params = [customer_id, req.tenantId, customer_id, req.tenantId, customer_id, req.tenantId];

        const transactions = query(sql, params);
        let runningBalance = 0;
        transactions.forEach(t => {
            runningBalance += (t.debit || 0) - (t.credit || 0);
            t.balance = runningBalance;
        });

        res.json({ success: true, data: { customer, transactions, balance: runningBalance } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Supplier Statement
router.get('/supplier-statement', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { supplier_id, from_date, to_date } = req.query;

        if (!supplier_id) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Supplier ID required' } });
        }

        const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);

        let sql = `
            (SELECT pi.invoice_number as ref_no, pi.invoice_date as date, 'Invoice' as type,
                    pi.total_amount as debit, 0 as credit
             FROM purchase_invoices pi WHERE pi.supplier_id = ? AND pi.tenant_id = ?)
            UNION ALL
            (SELECT pp.payment_number as ref_no, pp.payment_date as date, 'Payment' as type,
                    0 as debit, pp.amount as credit
             FROM payments pp WHERE pp.supplier_id = ? AND pp.tenant_id = ?)
            ORDER BY date DESC
        `;
        const params = [supplier_id, req.tenantId, supplier_id, req.tenantId];

        const transactions = query(sql, params);
        let runningBalance = 0;
        transactions.forEach(t => {
            runningBalance += (t.debit || 0) - (t.credit || 0);
            t.balance = runningBalance;
        });

        res.json({ success: true, data: { supplier, transactions, balance: runningBalance } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Account Ledger Report
router.get('/account-ledger', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { account_id, from_date, to_date } = req.query;

        if (!account_id) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Account ID required' } });
        }

        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [account_id]);

        let sql = `
            SELECT t.transaction_number as ref_no, t.transaction_date as date, t.description,
                   t.debit, t.credit, t.opposite_account_id
            FROM transactions t
            WHERE (t.account_id = ? OR t.opposite_account_id = ?) AND t.tenant_id = ?
        `;
        const params = [account_id, account_id, req.tenantId];

        if (from_date) { sql += ' AND t.transaction_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND t.transaction_date <= ?'; params.push(to_date); }

        sql += ' ORDER BY t.transaction_date DESC';

        const transactions = query(sql, params);
        let runningBalance = account.opening_balance || 0;
        transactions.forEach(t => {
            runningBalance += (t.account_id === account_id ? t.credit : t.debit) - (t.account_id === account_id ? t.debit : t.credit);
            t.balance = runningBalance;
        });

        res.json({ success: true, data: { account, transactions, balance: runningBalance } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Discount Calculation
function calculateDiscount(itemType, itemId, customerType, quantity, baseRate) {
    const rules = query(`
        SELECT * FROM discount_rules 
        WHERE is_active = 1 
        AND (item_type IS NULL OR item_type = ?)
        AND (item_id IS NULL OR item_id = ?)
        AND (customer_type IS NULL OR customer_type = ?)
        AND (min_qty IS NULL OR min_qty <= ?)
        AND (max_qty IS NULL OR max_qty >= ?)
        AND (valid_from IS NULL OR valid_from <= date('now'))
        AND (valid_to IS NULL OR valid_to >= date('now'))
        ORDER BY priority DESC
    `, [itemType, itemId, customerType, quantity, quantity]);

    if (!rules.length) return { discount: 0, rate: baseRate };

    const best = rules[0];
    const discountAmount = best.discount_amount || 0;
    const discountPercent = best.discount_percent || 0;
    const finalDiscount = discountPercent > 0 ? baseRate * (discountPercent / 100) : discountAmount;

    return {
        discount: finalDiscount,
        rate: baseRate - finalDiscount,
        rule: best.name
    };
}

// Price List Lookup
function getPriceFromList(itemType, itemId, priceListId) {
    if (!priceListId) return null;

    const priceItem = queryOne(`
        SELECT * FROM price_list_items 
        WHERE price_list_id = ? AND item_type = ? AND item_id = ?
        AND (valid_from IS NULL OR valid_from <= date('now'))
        AND (valid_to IS NULL OR valid_to >= date('now'))
    `, [priceListId, itemType, itemId]);

    return priceItem;
}

// Profit & Loss Statement
router.get('/profit-loss', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date, region_id } = req.query;
        
        // Direct Income - Sales
        const salesIncome = queryOne(`
            SELECT COALESCE(SUM(net_amount), 0) as total
            FROM sales_invoices
            WHERE tenant_id = ? AND status != 'cancelled'
            ${from_date ? 'AND invoice_date >= ?' : ''}
            ${to_date ? 'AND invoice_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        // Direct Expenses - Cost of Goods Sold
        const cogs = queryOne(`
            SELECT COALESCE(SUM(material_cost + processing_cost + overhead_cost), 0) as total
            FROM batch_consumption bc
            JOIN production_batches pb ON bc.batch_id = pb.id
            WHERE pb.tenant_id = ? AND pb.status = 'completed'
            ${from_date ? 'AND pb.batch_date >= ?' : ''}
            ${to_date ? 'AND pb.batch_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        // Gross Profit
        const grossProfit = salesIncome.total - cogs.total;

        // Indirect Income
        const otherIncome = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE tenant_id = ? AND transaction_type = 'credit' AND transaction_category = 'income'
            ${from_date ? 'AND transaction_date >= ?' : ''}
            ${to_date ? 'AND transaction_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        // Direct Expenses
        const directExpenses = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE tenant_id = ? AND transaction_category = 'direct_expense'
            ${from_date ? 'AND transaction_date >= ?' : ''}
            ${to_date ? 'AND transaction_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        // Indirect Expenses
        const indirectExpenses = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE tenant_id = ? AND transaction_category = 'indirect_expense'
            ${from_date ? 'AND transaction_date >= ?' : ''}
            ${to_date ? 'AND transaction_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        // Net Profit
        const netProfit = grossProfit + otherIncome.total - directExpenses.total - indirectExpenses.total;

        res.json({
            success: true,
            data: {
                period: { from_date, to_date },
                income: { sales: salesIncome.total, other: otherIncome.total },
                expenses: { cogs: cogs.total, direct: directExpenses.total, indirect: indirectExpenses.total },
                profit: { gross: grossProfit, net: netProfit },
                margin: salesIncome.total > 0 ? (netProfit / salesIncome.total * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Balance Sheet
router.get('/balance-sheet', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { as_on_date } = req.query;
        const date = as_on_date || new Date().toISOString().slice(0, 10);

        // Assets
        const fixedAssets = queryOne(`
            SELECT COALESCE(SUM(opening_balance), 0) as total
            FROM accounts WHERE tenant_id = ? AND group_id IN (SELECT id FROM account_groups WHERE type = 'asset')
        `, [req.tenantId]);

        const currentAssets = queryOne(`
            SELECT COALESCE(SUM(balance_qty * balance_amount), 0) as total
            FROM stock_ledger sl
            JOIN godowns g ON sl.godown_id = g.id
            WHERE sl.tenant_id = ?
        `, [req.tenantId]);

        const receivables = queryOne(`
            SELECT COALESCE(SUM(amount_due), 0) as total
            FROM sales_invoices WHERE tenant_id = ?
        `, [req.tenantId]);

        const cashBank = queryOne(`
            SELECT COALESCE(SUM(current_balance), 0) as total
            FROM accounts WHERE party_type = 'bank'
        `, [req.tenantId]);

        // Liabilities
        const longTermLiabilities = queryOne(`
            SELECT COALESCE(SUM(opening_balance), 0) as total
            FROM accounts WHERE group_id IN (SELECT id FROM account_groups WHERE type = 'liability')
        `, [req.tenantId]);

        const payables = queryOne(`
            SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) as total
            FROM purchase_invoices WHERE tenant_id = ?
        `, [req.tenantId]);

        // Equity
        const equity = queryOne(`
            SELECT COALESCE(SUM(opening_balance), 0) as total
            FROM accounts WHERE group_id IN (SELECT id FROM account_groups WHERE type = 'capital')
        `, [req.tenantId]);

        const retainedEarnings = queryOne(`
            SELECT COALESCE(SUM(net_amount), 0) as total
            FROM sales_invoices WHERE tenant_id = ?
        `, [req.tenantId]);

        res.json({
            success: true,
            data: {
                as_on_date: date,
                assets: {
                    fixed: fixedAssets.total,
                    current: currentAssets.total + receivables.total + cashBank.total,
                    total: fixedAssets.total + currentAssets.total + receivables.total + cashBank.total
                },
                liabilities: {
                    long_term: longTermLiabilities.total,
                    current: payables.total,
                    total: longTermLiabilities.total + payables.total
                },
                equity: {
                    capital: equity.total,
                    retained: retainedEarnings.total,
                    total: equity.total + retainedEarnings.total
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Cash Flow Statement
router.get('/cash-flow', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date } = req.query;

        // Operating Activities
        const receipts = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments WHERE tenant_id = ? AND payment_type = 'receipt'
            ${from_date ? 'AND payment_date >= ?' : ''}
            ${to_date ? 'AND payment_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        const payments = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments WHERE tenant_id = ? AND payment_type = 'payment'
            ${from_date ? 'AND payment_date >= ?' : ''}
            ${to_date ? 'AND payment_date <= ?' : ''}
        `, from_date && to_date ? [req.tenantId, from_date, to_date] : from_date ? [req.tenantId, from_date] : [req.tenantId]);

        // Opening Cash
        const openingCash = queryOne(`
            SELECT COALESCE(SUM(current_balance), 0) as total
            FROM accounts WHERE tenant_id = ? AND party_type = 'bank'
        `, [req.tenantId]);

        // Closing Cash
        const closingCash = openingCash.total + receipts.total - payments.total;

        res.json({
            success: true,
            data: {
                period: { from_date, to_date },
                operating: { receipts: receipts.total, payments: payments.total, net: receipts.total - payments.total },
                investing: { flows: 0 },
                financing: { flows: 0 },
                net_change: closingCash - openingCash.total,
                opening_cash: openingCash.total,
                closing_cash: closingCash
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Customer Self-Service Portal - Now requires authentication

router.get('/portal/customers/:customerId/orders', authenticate, async (req, res) => {
    try {
        const { customerId } = req.params;

        // Validate customer belongs to this tenant
        const customer = queryOne('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [customerId, req.tenantId]);
        if (!customer) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        }

        const orders = query(`
            SELECT order_number, order_date, net_amount, status
            FROM sales_orders WHERE customer_id = ? AND tenant_id = ?
            ORDER BY created_at DESC LIMIT 20
        `, [customerId, req.tenantId]);

        res.json({ success: true, data: { customer: { name: customer.name, code: customer.code }, orders } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/portal/customers/:customerId/invoices', authenticate, async (req, res) => {
    try {
        const { customerId } = req.params;

        // Validate customer belongs to this tenant
        const customer = queryOne('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [customerId, req.tenantId]);
        if (!customer) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        }

        const invoices = query(`
            SELECT invoice_number, invoice_date, net_amount, amount_due, payment_status
            FROM sales_invoices WHERE customer_id = ? AND tenant_id = ?
            ORDER BY created_at DESC LIMIT 20
        `, [customerId, req.tenantId]);

        res.json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/portal/customers/:customerId/orders/:orderId/confirm', authenticate, async (req, res) => {
    try {
        const { customerId, orderId } = req.params;

        // Validate order belongs to this tenant's customer
        const order = queryOne('SELECT * FROM sales_orders WHERE id = ? AND customer_id = ? AND tenant_id = ?', [orderId, customerId, req.tenantId]);
        if (!order) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Order already processed' } });
        }

        run('UPDATE sales_orders SET status = ? WHERE id = ? AND tenant_id = ?', ['confirmed', orderId, req.tenantId]);

        res.json({ success: true, message: 'Order confirmed', data: { order_number: order.order_number } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Webhook triggers
async function triggerWebhook(tenantId, event, data) {
    const webhooks = query(`
        SELECT * FROM webhooks 
        WHERE tenant_id = ? AND is_active = 1 
        AND events LIKE ?
    `, [tenantId, `%${event}%`]);

    for (const webhook of webhooks) {
        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': webhook.secret_key,
                    'X-Event': event
                },
                body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
            });

            if (!response.ok) {
                run('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?', [webhook.id]);
            } else {
                run('UPDATE webhooks SET last_triggered = ?, failure_count = 0 WHERE id = ?', 
                    [new Date().toISOString(), webhook.id]);
            }
        } catch (error) {
            run('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?', [webhook.id]);
        }
    }
}

// Tenant API Key Management
router.get('/api-keys', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const keys = query('SELECT id, name, rate_limit, last_used, expires_at, is_active, created_at FROM api_keys WHERE tenant_id = ?', [req.tenantId]);
        keys.forEach(k => { delete k.key_hash; });
        res.json({ success: true, data: keys });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/api-keys', authenticate, requirePermission('admin', 'add'), async (req, res) => {
    try {
        const { name, rate_limit, ip_whitelist, permissions, expires_at } = req.body;
        const key = `fk_${Math.random().toString(36).substr(2, 32)}_${Date.now()}`;
        const keyHash = require('crypto').createHash('sha256').update(key).digest('hex');

        run(`INSERT INTO api_keys (id, tenant_id, name, key_hash, rate_limit, ip_whitelist, permissions, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.tenantId, name, keyHash, rate_limit || 1000, ip_whitelist, permissions, expires_at]);

        res.json({ success: true, data: { key, name }, message: 'API key created. Copy it now - you won\'t see it again.' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/api-keys/:id', authenticate, requirePermission('admin', 'delete'), async (req, res) => {
    try {
        run('UPDATE api_keys SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'API key revoked' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Webhook Management
router.get('/webhooks', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const webhooks = query('SELECT * FROM webhooks WHERE tenant_id = ?', [req.tenantId]);
        res.json({ success: true, data: webhooks });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/webhooks', authenticate, requirePermission('admin', 'add'), async (req, res) => {
    try {
        const { name, url, events, secret_key } = req.body;
        
        if (!name || !url || !events) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, URL and events required' } });
        }

        run(`INSERT INTO webhooks (id, tenant_id, name, url, events, secret_key)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.tenantId, name, url, events.join(','), secret_key]);

        res.json({ success: true, message: 'Webhook created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/webhooks/:id', authenticate, requirePermission('admin', 'delete'), async (req, res) => {
    try {
        run('UPDATE webhooks SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Webhook deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
