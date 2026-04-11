const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/devices', authenticate, async (req, res) => {
    try {
        const devices = query('SELECT * FROM iot_devices WHERE tenant_id = ? ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: devices });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/devices', authenticate, requirePermission('iot', 'add'), async (req, res) => {
    try {
        const { device_code, machine_id, type, name, endpoint, protocol, config } = req.body;
        const id = uuidv4();

        run(`INSERT INTO iot_devices (id, tenant_id, device_code, machine_id, type, name, endpoint, protocol, config, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [id, req.tenantId, device_code, machine_id, type, name, endpoint, protocol, JSON.stringify(config || {})]);

        res.json({ success: true, data: { id }, message: 'IoT device registered successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/devices/:id/readings', authenticate, async (req, res) => {
    try {
        const { from, to, limit = 100 } = req.query;

        let sql = 'SELECT * FROM iot_readings WHERE tenant_id = ? AND device_id = ?';
        const params = [req.tenantId, req.params.id];

        if (from) { sql += ' AND recorded_at >= ?'; params.push(from); }
        if (to) { sql += ' AND recorded_at <= ?'; params.push(to); }

        sql += ' ORDER BY recorded_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const readings = query(sql, params);

        const stats = queryOne(`
            SELECT parameter, AVG(value) as avg_value, MIN(value) as min_value, MAX(value) as max_value
            FROM iot_readings WHERE tenant_id = ? AND device_id = ?
            AND recorded_at >= datetime('now', '-24 hours')
            GROUP BY parameter
        `, [req.tenantId, req.params.id]);

        res.json({ success: true, data: { readings, stats } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/devices/:id/readings', authenticate, async (req, res) => {
    try {
        const { readings } = req.body;
        const deviceId = req.params.id;

        if (!Array.isArray(readings)) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Readings array required' } });
        }

        readings.forEach(r => {
            if (!r.parameter || r.value === undefined) {
                return;
            }
            run(`INSERT INTO iot_readings (id, tenant_id, device_id, parameter, value, unit, recorded_at)
                 VALUES (?, (SELECT tenant_id FROM iot_devices WHERE id = ?), ?, ?, ?, ?, ?)`,
                [uuidv4(), deviceId, deviceId, r.parameter, r.value, r.unit || '', r.recorded_at || new Date().toISOString()]);
        });

        run('UPDATE iot_devices SET last_seen = ? WHERE id = ?', [new Date().toISOString(), deviceId]);

        res.json({ success: true, message: 'Readings recorded' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/machines/:id/status', authenticate, async (req, res) => {
    try {
        const machine = queryOne('SELECT * FROM machines WHERE id = ?', [req.params.id]);
        if (!machine) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Machine not found' } });

        const activeBatch = queryOne(`
            SELECT pb.*, f.name as formula_name FROM production_batches pb
            LEFT JOIN formulas f ON pb.formula_id = f.id
            WHERE pb.machine_id = ? AND pb.status = 'in_progress'
        `, [req.params.id]);

        const recentLogs = query(`
            SELECT * FROM machine_logs WHERE machine_id = ?
            ORDER BY start_time DESC LIMIT 10
        `, [req.params.id]);

        const todayOutput = queryOne(`
            SELECT SUM(output_qty) as total_output, AVG(efficiency) as avg_efficiency
            FROM machine_logs WHERE machine_id = ? AND date(start_time) = date('now')
        `, [req.params.id]);

        const iotDevices = query('SELECT * FROM iot_devices WHERE machine_id = ?', [req.params.id]);

        let liveReadings = [];
        iotDevices.forEach(device => {
            const latest = queryOne('SELECT * FROM iot_readings WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 1', [device.id]);
            if (latest) liveReadings.push({ ...device, latest_reading: latest });
        });

        res.json({
            success: true,
            data: {
                machine,
                active_batch: activeBatch,
                today_output: todayOutput,
                recent_logs: recentLogs,
                live_readings: liveReadings
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/machines/:id/production-log', authenticate, async (req, res) => {
    try {
        const { batch_id, start_time, end_time, runtime_minutes, output_qty, efficiency, energy_consumption } = req.body;

        const logId = uuidv4();

        run(`INSERT INTO machine_logs (id, tenant_id, machine_id, batch_id, start_time, end_time, runtime_minutes, output_qty, efficiency, energy_consumption, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [logId, req.tenantId, req.params.id, batch_id, start_time, end_time, runtime_minutes, output_qty, efficiency, energy_consumption, end_time ? 'completed' : 'running']);

        res.json({ success: true, data: { id: logId }, message: 'Production log recorded' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
