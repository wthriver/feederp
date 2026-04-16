const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/vehicles', authenticate, async (req, res) => {
    try {
        const vehicles = query('SELECT v.*, d.name as driver_name FROM vehicles v LEFT JOIN drivers d ON v.driver_id = d.id WHERE v.tenant_id = ? AND v.is_active = 1 ORDER BY v.vehicle_number', [req.tenantId]);
        res.json({ success: true, data: vehicles });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/vehicles', authenticate, requirePermission('transport', 'add'), async (req, res) => {
    try {
        const { vehicle_number, type, capacity, owner_name, driver_id } = req.body;
        const id = uuidv4();
        run(`INSERT INTO vehicles (id, tenant_id, vehicle_number, type, capacity, owner_name, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, vehicle_number, type, capacity, owner_name, driver_id]);
        res.json({ success: true, data: { id }, message: 'Vehicle created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/vehicles/:id', authenticate, requirePermission('transport', 'edit'), async (req, res) => {
    try {
        const { vehicle_number, type, capacity, owner_name, driver_id, status, is_active } = req.body;

        const existing = queryOne('SELECT * FROM vehicles WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
        }

        run(`UPDATE vehicles SET vehicle_number = ?, type = ?, capacity = ?, owner_name = ?, driver_id = ?, status = ?, is_active = ?
             WHERE id = ?`,
            [vehicle_number, type, capacity, owner_name, driver_id, status || existing.status, is_active ?? 1, req.params.id]);

        res.json({ success: true, message: 'Vehicle updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/vehicles/:id', authenticate, requirePermission('transport', 'delete'), async (req, res) => {
    try {
        const vehicle = queryOne('SELECT * FROM vehicles WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
        }

        const activeDeliveries = queryOne('SELECT id FROM delivery_orders WHERE vehicle_id = ? AND status IN (?, ?, ?)', 
            [req.params.id, 'pending', 'assigned', 'in_transit']);
        if (activeDeliveries) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Vehicle has active deliveries' } });
        }

        run('UPDATE vehicles SET is_active = 0 WHERE id = ?', [req.params.id]);
        logActivity(req.tenantId, req.user.id, 'transport', 'vehicle_deleted', req.params.id, null, { vehicle_number: vehicle.vehicle_number }, req);

        res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/drivers', authenticate, async (req, res) => {
    try {
        const drivers = query('SELECT * FROM drivers WHERE tenant_id = ? AND is_active = 1 ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: drivers });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/drivers', authenticate, requirePermission('transport', 'add'), async (req, res) => {
    try {
        const { name, phone, license_number, address } = req.body;
        const id = uuidv4();
        run(`INSERT INTO drivers (id, tenant_id, name, phone, license_number, address) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, phone, license_number, address]);
        res.json({ success: true, data: { id }, message: 'Driver created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/drivers/:id', authenticate, requirePermission('transport', 'edit'), async (req, res) => {
    try {
        const { name, phone, license_number, address, is_active } = req.body;

        const existing = queryOne('SELECT * FROM drivers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Driver not found' } });
        }

        run(`UPDATE drivers SET name = ?, phone = ?, license_number = ?, address = ?, is_active = ?
             WHERE id = ?`,
            [name, phone, license_number, address, is_active ?? 1, req.params.id]);

        res.json({ success: true, message: 'Driver updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/drivers/:id', authenticate, requirePermission('transport', 'delete'), async (req, res) => {
    try {
        const driver = queryOne('SELECT * FROM drivers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!driver) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Driver not found' } });
        }

        const activeDeliveries = queryOne('SELECT id FROM delivery_orders WHERE driver_id = ? AND status IN (?, ?, ?)', 
            [req.params.id, 'pending', 'assigned', 'in_transit']);
        if (activeDeliveries) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Driver has active deliveries' } });
        }

        run('UPDATE drivers SET is_active = 0 WHERE id = ?', [req.params.id]);
        logActivity(req.tenantId, req.user.id, 'transport', 'driver_deleted', req.params.id, null, { name: driver.name }, req);

        res.json({ success: true, message: 'Driver deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/delivery-orders', authenticate, async (req, res) => {
    try {
        const { status, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT do.*, c.name as customer_name, si.invoice_number, v.vehicle_number, d.name as driver_name
                   FROM delivery_orders do
                   LEFT JOIN customers c ON do.customer_id = c.id
                   LEFT JOIN sales_invoices si ON do.invoice_id = si.id
                   LEFT JOIN vehicles v ON do.vehicle_id = v.id
                   LEFT JOIN drivers d ON do.driver_id = d.id
                   WHERE do.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM delivery_orders WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) { sql += ' AND do.status = ?'; countSql += ' AND status = ?'; params.push(status); }
        if (from_date) { sql += ' AND do.scheduled_date >= ?'; countSql += ' AND scheduled_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND do.scheduled_date <= ?'; countSql += ' AND scheduled_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY do.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const orders = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: orders, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/delivery-orders/:id', authenticate, async (req, res) => {
    try {
        const order = queryOne(`
            SELECT do.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone,
                   si.invoice_number, si.net_amount, v.vehicle_number, d.name as driver_name, d.phone as driver_phone
            FROM delivery_orders do
            LEFT JOIN customers c ON do.customer_id = c.id
            LEFT JOIN sales_invoices si ON do.invoice_id = si.id
            LEFT JOIN vehicles v ON do.vehicle_id = v.id
            LEFT JOIN drivers d ON do.driver_id = d.id
            WHERE do.id = ? AND do.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Delivery order not found' } });

        const tracking = query('SELECT * FROM delivery_tracking WHERE delivery_order_id = ? ORDER BY tracked_at DESC', [req.params.id]);

        res.json({ success: true, data: { ...order, tracking } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/delivery-orders', authenticate, requirePermission('transport', 'add'), async (req, res) => {
    try {
        const { invoice_id, customer_id, factory_id, vehicle_id, driver_id, scheduled_date, route_id, from_location, to_location, distance, notes } = req.body;

        const doNumber = formatSequence('DO', getNextSequence('DO', req.tenantId));
        const doId = uuidv4();

        run(`INSERT INTO delivery_orders (id, tenant_id, do_number, invoice_id, customer_id, factory_id, vehicle_id, driver_id, scheduled_date, route_id, from_location, to_location, distance, status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [doId, req.tenantId, doNumber, invoice_id, customer_id, factory_id || req.factoryId, vehicle_id, driver_id, scheduled_date, route_id, from_location, to_location, distance, notes, req.user.id]);

        if (vehicle_id) run('UPDATE vehicles SET status = ? WHERE id = ?', ['in_transit', vehicle_id]);

        res.json({ success: true, data: { id: doId, do_number: doNumber }, message: 'Delivery order created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/delivery-orders/:id/dispatch', authenticate, requirePermission('transport', 'edit'), async (req, res) => {
    try {
        run(`UPDATE delivery_orders SET status = 'in_transit', actual_dispatch_date = ? WHERE id = ?`, [new Date().toISOString(), req.params.id]);
        res.json({ success: true, message: 'Delivery dispatched' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/delivery-orders/:id/delivered', authenticate, requirePermission('transport', 'edit'), async (req, res) => {
    try {
        const order = queryOne('SELECT vehicle_id, invoice_id FROM delivery_orders WHERE id = ?', [req.params.id]);

        run(`UPDATE delivery_orders SET status = 'delivered', actual_delivery_date = ? WHERE id = ?`, [new Date().toISOString(), req.params.id]);

        if (order?.vehicle_id) run('UPDATE vehicles SET status = ? WHERE id = ?', ['available', order.vehicle_id]);
        if (order?.invoice_id) run(`UPDATE sales_orders SET status = 'delivered' WHERE id = (SELECT so_id FROM sales_invoices WHERE id = ?)`, [order.invoice_id]);

        res.json({ success: true, message: 'Delivery completed' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/delivery-orders/:id/track', authenticate, requirePermission('transport', 'edit'), async (req, res) => {
    try {
        const { location, latitude, longitude, status, remarks } = req.body;

        run(`INSERT INTO delivery_tracking (id, delivery_order_id, location, latitude, longitude, status, remarks, tracked_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.params.id, location, latitude, longitude, status, remarks, new Date().toISOString()]);

        res.json({ success: true, message: 'Tracking updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
