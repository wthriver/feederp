const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { arrayToCSV, parseExportParams } = require('../config/export');

router.get('/export/:entity', authenticate, async (req, res) => {
    try {
        const { entity } = req.params;
        const params = parseExportParams(req);
        
        let whereClause = 'WHERE tenant_id = ?';
        let queryParams = [req.tenantId];
        
        if (params.search) {
            whereClause += ' AND (name LIKE ? OR code LIKE ?)';
            const searchTerm = `%${params.search}%`;
            queryParams.push(searchTerm, searchTerm);
        }
        
        const allowedEntities = {
            'raw-materials': 'raw_materials',
            'products': 'products',
            'suppliers': 'suppliers',
            'customers': 'customers',
            'formulas': 'formulas'
        };
        
        const tableName = allowedEntities[entity];
        if (!tableName) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid export entity' } });
        }
        
        const sql = `SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at DESC LIMIT ${params.limit}`;
        const data = query(sql, queryParams);
        
        if (params.format === 'csv') {
            const csv = arrayToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${entity}-export.csv`);
            return res.send(csv);
        }
        
        res.json({ success: true, data });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/import/:entity', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { entity } = req.params;
        const { items, mode = 'create' } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No items to import' } });
        }
        
        const allowedEntities = {
            'raw-materials': { table: 'raw_materials', id: 'id', required: ['code', 'name'] },
            'products': { table: 'products', id: 'id', required: ['code', 'name'] }
        };
        
        const config = allowedEntities[entity];
        if (!config) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid import entity' } });
        }
        
        const results = { imported: 0, errors: [], skipped: 0 };
        
        for (const item of items) {
            try {
                const missing = config.required.filter(f => !item[f]);
                if (missing.length > 0) {
                    results.skipped++;
                    results.errors.push({ item, error: `Missing required fields: ${missing.join(', ')}` });
                    continue;
                }
                
                const existing = mode === 'update' 
                    ? queryOne(`SELECT id FROM ${config.table} WHERE code = ? AND tenant_id = ?`, [item.code, req.tenantId])
                    : null;
                
                if (existing && mode === 'create') {
                    results.skipped++;
                    continue;
                }
                
                const id = existing?.id || uuidv4();
                const fields = Object.keys(item);
                const values = fields.map(f => item[f]);
                
                const sql = existing
                    ? `UPDATE ${config.table} SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`
                    : `INSERT INTO ${config.table} (id, tenant_id, ${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
                
                const params = existing ? [...values, id] : [id, req.tenantId, ...values];
                run(sql, params);
                
                results.imported++;
            } catch (err) {
                results.errors.push({ item, error: err.message });
            }
        }
        
        logActivity(req.tenantId, req.user.id, 'master', `${entity}_imported`, null, null, { 
            imported: results.imported, 
            skipped: results.skipped 
        }, req);
        
        res.json({ 
            success: true, 
            data: results,
            message: `Imported ${results.imported} items, ${results.skipped} skipped`
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/bulk/:entity', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { entity } = req.params;
        const { ids, action } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No IDs provided' } });
        }
        
        const allowedActions = ['delete', 'activate', 'deactivate'];
        if (!allowedActions.includes(action)) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } });
        }
        
        const allowedEntities = {
            'raw-materials': 'raw_materials',
            'products': 'products',
            'suppliers': 'suppliers',
            'customers': 'customers'
        };
        
        const tableName = allowedEntities[entity];
        if (!tableName) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid entity' } });
        }
        
        let updateField;
        switch (action) {
            case 'delete':
            case 'deactivate':
                updateField = 'is_active = 0';
                break;
            case 'activate':
                updateField = 'is_active = 1';
                break;
        }
        
        const placeholders = ids.map(() => '?').join(', ');
        const sql = `UPDATE ${tableName} SET ${updateField} WHERE id IN (${placeholders}) AND tenant_id = ?`;
        const result = run(sql, [...ids, req.tenantId]);
        
        logActivity(req.tenantId, req.user.id, 'master', `${entity}_${action}d`, null, { ids, count: ids.length }, req);
        
        res.json({ 
            success: true, 
            data: { affected: result?.changes || ids.length },
            message: `${action === 'delete' ? 'Deleted' : action === 'activate' ? 'Activated' : 'Deactivated'} ${ids.length} items`
        });
    } catch (error) {
        console.error('Bulk operation error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;