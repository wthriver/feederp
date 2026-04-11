const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/parameters', authenticate, async (req, res) => {
    try {
        const params = query('SELECT * FROM qc_parameters WHERE tenant_id = ? AND is_active = 1 ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: params });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/parameters', authenticate, requirePermission('quality', 'add'), async (req, res) => {
    try {
        const { name, name_bn, code, type, min_value, max_value, target_value, unit, is_mandatory } = req.body;
        const id = uuidv4();

        run(`INSERT INTO qc_parameters (id, tenant_id, name, name_bn, code, type, min_value, max_value, target_value, unit, is_mandatory)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, name_bn, code, type, min_value, max_value, target_value, unit, is_mandatory ?? 1]);

        res.json({ success: true, data: { id }, message: 'QC parameter created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/results', authenticate, async (req, res) => {
    try {
        const { reference_type, reference_id, status, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT qr.*, qcp.name as parameter_name, qcp.unit, u.name as tested_by_name
                   FROM qc_results qr
                   LEFT JOIN qc_parameters qcp ON qr.parameter_id = qcp.id
                   LEFT JOIN users u ON qr.tested_by = u.id
                   WHERE qr.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM qc_results WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (reference_type) { sql += ' AND qr.reference_type = ?'; countSql += ' AND reference_type = ?'; params.push(reference_type); }
        if (reference_id) { sql += ' AND qr.reference_id = ?'; countSql += ' AND reference_id = ?'; params.push(reference_id); }
        if (from_date) { sql += ' AND qr.tested_at >= ?'; countSql += ' AND tested_at >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND qr.tested_at <= ?'; countSql += ' AND tested_at <= ?'; params.push(to_date); }

        sql += ` ORDER BY qr.tested_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const results = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: results, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/results', authenticate, requirePermission('quality', 'add'), async (req, res) => {
    try {
        const { reference_type, reference_id, results } = req.body;

        if (!results || results.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one test result is required' } });
        }

        const allPassed = results.every(r => r.is_pass !== false);

        results.forEach(r => {
            const param = queryOne('SELECT min_value, max_value FROM qc_parameters WHERE id = ?', [r.parameter_id]);
            const isPass = param ? (r.value >= (param.min_value || 0) && r.value <= (param.max_value || Infinity)) : true;

            run(`INSERT INTO qc_results (id, tenant_id, reference_type, reference_id, parameter_id, value, is_pass, remarks, tested_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), req.tenantId, reference_type, reference_id, r.parameter_id, r.value, isPass ? 1 : 0, r.remarks, req.user.id]);
        });

        if (reference_type === 'inward_item') {
            run(`UPDATE inward_items SET qc_status = ? WHERE id = ?`, [allPassed ? 'approved' : 'rejected', reference_id]);
        } else if (reference_type === 'batch') {
            run(`UPDATE batch_quality SET status = ? WHERE batch_id = ?`, [allPassed ? 'approved' : 'rejected', reference_id]);
        }

        logActivity(req.tenantId, req.user.id, 'quality', 'qc_completed', reference_id, null, { reference_type, all_passed: allPassed }, req);

        res.json({ success: true, message: 'QC results recorded successfully', data: { all_passed: allPassed } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/standards', authenticate, async (req, res) => {
    try {
        const standards = query(`
            SELECT qs.*, qp.name as parameter_name, qp.unit
            FROM quality_standards qs
            LEFT JOIN qc_parameters qp ON qs.parameter_id = qp.id
            WHERE qs.tenant_id = ? AND qs.is_active = 1
        `, [req.tenantId]);
        res.json({ success: true, data: standards });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/standards', authenticate, requirePermission('quality', 'add'), async (req, res) => {
    try {
        const { product_type, parameter_id, min_value, max_value, target_value } = req.body;
        const id = uuidv4();

        run(`INSERT INTO quality_standards (id, tenant_id, product_type, parameter_id, min_value, max_value, target_value)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, product_type, parameter_id, min_value, max_value, target_value]);

        res.json({ success: true, data: { id }, message: 'Quality standard created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
