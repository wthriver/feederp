const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/summary', authenticate, async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const todayProduction = queryOne(`
            SELECT COUNT(*) as batches, COALESCE(SUM(actual_qty), 0) as qty
            FROM production_batches WHERE tenant_id = ? AND factory_id = ? AND batch_date = ?
        `, [req.tenantId, req.factoryId, today]);

        const todaySales = queryOne(`
            SELECT COUNT(*) as invoices, COALESCE(SUM(net_amount), 0) as amount
            FROM sales_invoices WHERE tenant_id = ? AND factory_id = ? AND invoice_date = ?
        `, [req.tenantId, req.factoryId, today]);

        const todayPurchase = queryOne(`
            SELECT COUNT(*) as grns, COALESCE(SUM(total_qty), 0) as qty
            FROM goods_inward WHERE tenant_id = ? AND factory_id = ? AND inward_date = ?
        `, [req.tenantId, req.factoryId, today]);

        const rawMaterialStock = queryOne(`
            SELECT COALESCE(SUM(quantity), 0) as qty, COALESCE(SUM(amount), 0) as value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            WHERE sl.tenant_id = ? AND g.factory_id = ? AND sl.item_type = 'raw_material'
        `, [req.tenantId, req.factoryId]);

        const finishedGoodsStock = queryOne(`
            SELECT COALESCE(SUM(quantity), 0) as qty, COALESCE(SUM(amount), 0) as value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            WHERE sl.tenant_id = ? AND g.factory_id = ? AND sl.item_type = 'product'
        `, [req.tenantId, req.factoryId]);

        const pendingOrders = queryOne(`
            SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as amount
            FROM sales_orders WHERE tenant_id = ? AND factory_id = ? AND status IN ('pending', 'confirmed')
        `, [req.tenantId, req.factoryId]);

        const pendingDeliveries = queryOne(`
            SELECT COUNT(*) as count FROM delivery_orders WHERE tenant_id = ? AND status IN ('pending', 'assigned', 'in_transit')
        `, [req.tenantId]);

        const lowStockAlerts = queryOne(`
            SELECT COUNT(*) as count FROM (
                SELECT rm.id FROM raw_materials rm
                WHERE rm.tenant_id = ? AND rm.is_active = 1 AND rm.min_stock > 0
                AND COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'raw_material' AND item_id = rm.id), 0) <= rm.min_stock
                UNION ALL
                SELECT p.id FROM products p
                WHERE p.tenant_id = ? AND p.is_active = 1 AND p.min_stock > 0
                AND COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'product' AND item_id = p.id), 0) <= p.min_stock
            )
        `, [req.tenantId, req.tenantId]);

        const lowStockItems = query(`
            SELECT rm.id, rm.name, rm.code, 'raw_material' as item_type, 
                   COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'raw_material' AND item_id = rm.id), 0) as current_stock,
                   rm.min_stock
            FROM raw_materials rm
            WHERE rm.tenant_id = ? AND rm.is_active = 1 AND rm.min_stock > 0
            AND COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'raw_material' AND item_id = rm.id), 0) <= rm.min_stock
            UNION ALL
            SELECT p.id, p.name, p.code, 'product' as item_type,
                   COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'product' AND item_id = p.id), 0) as current_stock,
                   p.min_stock
            FROM products p
            WHERE p.tenant_id = ? AND p.is_active = 1 AND p.min_stock > 0
            AND COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'product' AND item_id = p.id), 0) <= p.min_stock
            ORDER BY current_stock ASC LIMIT 10
        `, [req.tenantId, req.tenantId]);

        const monthlyProduction = query(`
            SELECT strftime('%Y-%m', batch_date) as month, COUNT(*) as batches, COALESCE(SUM(actual_qty), 0) as qty
            FROM production_batches WHERE tenant_id = ? AND factory_id = ? AND batch_date >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', batch_date) ORDER BY month
        `, [req.tenantId, req.factoryId]);

        const monthlySales = query(`
            SELECT strftime('%Y-%m', invoice_date) as month, COUNT(*) as invoices, COALESCE(SUM(net_amount), 0) as amount
            FROM sales_invoices WHERE tenant_id = ? AND factory_id = ? AND invoice_date >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', invoice_date) ORDER BY month
        `, [req.tenantId, req.factoryId]);

        const recentActivity = query(`
            SELECT al.*, u.name as user_name FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.tenant_id = ?
            ORDER BY al.created_at DESC LIMIT 10
        `, [req.tenantId]);

        res.json({
            success: true,
            data: {
                today: {
                    production: todayProduction,
                    sales: todaySales,
                    purchase: todayPurchase
                },
                stock: {
                    raw_materials: rawMaterialStock,
                    finished_goods: finishedGoodsStock
                },
                pending: {
                    orders: pendingOrders,
                    deliveries: pendingDeliveries
                },
                alerts: {
                    low_stock: lowStockAlerts?.count || 0,
                    low_stock_items: lowStockItems
                },
                charts: {
                    monthly_production: monthlyProduction,
                    monthly_sales: monthlySales
                },
                recent_activity: recentActivity
            }
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/production', authenticate, async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const dailyProduction = query(`
            SELECT batch_date as date, COUNT(*) as batches, COALESCE(SUM(planned_qty), 0) as planned,
                   COALESCE(SUM(actual_qty), 0) as actual, COALESCE(SUM(loss_qty), 0) as loss
            FROM production_batches WHERE tenant_id = ? AND factory_id = ? AND batch_date BETWEEN ? AND ?
            GROUP BY batch_date ORDER BY batch_date
        `, [req.tenantId, req.factoryId, from, to]);

        const statusBreakdown = query(`
            SELECT status, COUNT(*) as count, COALESCE(SUM(planned_qty), 0) as qty
            FROM production_batches WHERE tenant_id = ? AND factory_id = ? AND batch_date BETWEEN ? AND ?
            GROUP BY status
        `, [req.tenantId, req.factoryId, from, to]);

        const productWise = query(`
            SELECT p.name, COUNT(*) as batches, COALESCE(SUM(pb.actual_qty), 0) as qty
            FROM production_batches pb
            LEFT JOIN products p ON pb.product_id = p.id
            WHERE pb.tenant_id = ? AND pb.factory_id = ? AND pb.batch_date BETWEEN ? AND ?
            GROUP BY pb.product_id ORDER BY qty DESC
        `, [req.tenantId, req.factoryId, from, to]);

        res.json({ success: true, data: { daily: dailyProduction, status: statusBreakdown, by_product: productWise } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/sales', authenticate, async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        const dailySales = query(`
            SELECT invoice_date as date, COUNT(*) as invoices, COALESCE(SUM(net_amount), 0) as amount,
                   COALESCE(SUM(amount_paid), 0) as received, COALESCE(SUM(amount_due), 0) as outstanding
            FROM sales_invoices WHERE tenant_id = ? AND factory_id = ? AND invoice_date BETWEEN ? AND ?
            GROUP BY invoice_date ORDER BY invoice_date
        `, [req.tenantId, req.factoryId, from, to]);

        const customerWise = query(`
            SELECT c.name, COUNT(*) as orders, COALESCE(SUM(si.net_amount), 0) as amount
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE si.tenant_id = ? AND si.factory_id = ? AND si.invoice_date BETWEEN ? AND ?
            GROUP BY si.customer_id ORDER BY amount DESC LIMIT 10
        `, [req.tenantId, req.factoryId, from, to]);

        const productWise = query(`
            SELECT p.name, SUM(ii.quantity) as qty, SUM(ii.amount) as amount
            FROM invoice_items ii
            LEFT JOIN products p ON ii.product_id = p.id
            LEFT JOIN sales_invoices si ON ii.invoice_id = si.id
            WHERE si.tenant_id = ? AND si.factory_id = ? AND si.invoice_date BETWEEN ? AND ?
            GROUP BY ii.product_id ORDER BY amount DESC
        `, [req.tenantId, req.factoryId, from, to]);

        res.json({ success: true, data: { daily: dailySales, by_customer: customerWise, by_product: productWise } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/stock-alerts', authenticate, async (req, res) => {
    try {
        const lowStockRaw = query(`
            SELECT rm.*, COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'raw_material' AND item_id = rm.id), 0) as current_stock
            FROM raw_materials rm WHERE rm.tenant_id = ? AND rm.is_active = 1 AND rm.min_stock > 0
            HAVING current_stock <= rm.min_stock
        `, [req.tenantId]);

        const lowStockProducts = query(`
            SELECT p.*, COALESCE((SELECT SUM(quantity) FROM stock_ledger WHERE item_type = 'product' AND item_id = p.id), 0) as current_stock
            FROM products p WHERE p.tenant_id = ? AND p.is_active = 1 AND p.min_stock > 0
            HAVING current_stock <= p.min_stock
        `, [req.tenantId]);

        const expiring = query(`
            SELECT sl.*, rm.name, rm.code FROM stock_ledger sl
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            WHERE sl.tenant_id = ? AND sl.expiry_date IS NOT NULL AND sl.quantity > 0
            AND sl.expiry_date <= date('now', '+30 days')
        `, [req.tenantId]);

        res.json({ success: true, data: { low_stock_raw: lowStockRaw, low_stock_products: lowStockProducts, expiring } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/recent-activity', authenticate, async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const activities = query(`
            SELECT al.*, u.name as user_name FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.tenant_id = ?
            ORDER BY al.created_at DESC LIMIT ?
        `, [req.tenantId, parseInt(limit)]);

        res.json({ success: true, data: activities });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
