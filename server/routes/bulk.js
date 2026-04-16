const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { arrayToCSV, parseExportParams } = require('../config/export');
const { generateExcelReport } = require('../utils/export');

const ENTITY_CONFIG = {
    'raw-materials': { 
        table: 'raw_materials', 
        required: ['code', 'name'],
        columns: ['code', 'name', 'category', 'unit_id', 'min_stock', 'max_stock', 'opening_stock', 'opening_rate', 'hsn_code', 'is_active']
    },
    'products': { 
        table: 'products', 
        required: ['code', 'name'],
        columns: ['code', 'name', 'type', 'category', 'pack_size', 'unit_id', 'mrp', 'min_stock', 'hsn_code', 'gst_rate', 'is_active']
    },
    'suppliers': { 
        table: 'suppliers', 
        required: ['code', 'name'],
        columns: ['code', 'name', 'contact_person', 'phone', 'email', 'address', 'city', 'gstin', 'payment_terms', 'is_active']
    },
    'customers': { 
        table: 'customers', 
        required: ['code', 'name'],
        columns: ['code', 'name', 'type', 'contact_person', 'phone', 'email', 'address', 'city', 'gstin', 'credit_limit', 'is_active']
    },
    'formulas': { 
        table: 'formulas', 
        required: ['code', 'name'],
        columns: ['code', 'name', 'product_id', 'target_protein', 'target_moisture', 'target_fiber', 'target_fat', 'status', 'is_active']
    },
    'units': {
        table: 'units',
        required: ['code', 'name'],
        columns: ['code', 'name', 'symbol', 'type', 'decimal_places', 'is_active']
    },
    'godowns': {
        table: 'godowns',
        required: ['code', 'name'],
        columns: ['code', 'name', 'type', 'factory_id', 'location', 'is_active']
    },
    'machines': {
        table: 'machines',
        required: ['code', 'name'],
        columns: ['code', 'name', 'type', 'brand', 'model', 'capacity', 'unit', 'factory_id', 'status', 'is_active']
    }
};

router.get('/export/:entity', authenticate, async (req, res) => {
    try {
        const { entity } = req.params;
        const params = parseExportParams(req);
        
        const config = ENTITY_CONFIG[entity];
        if (!config) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid export entity' } });
        }
        
        let whereClause = 'WHERE tenant_id = ?';
        let queryParams = [req.tenantId];
        
        if (params.search) {
            whereClause += ' AND (name LIKE ? OR code LIKE ?)';
            const searchTerm = `%${params.search}%`;
            queryParams.push(searchTerm, searchTerm);
        }
        
        if (params.status !== undefined) {
            whereClause += ' AND is_active = ?';
            queryParams.push(params.status === 'true' ? 1 : 0);
        }
        
        const sql = `SELECT * FROM ${config.table} ${whereClause} ORDER BY created_at DESC LIMIT ${params.limit}`;
        const data = query(sql, queryParams);
        
        if (params.format === 'csv') {
            const csv = arrayToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${entity}-export-${Date.now()}.csv`);
            return res.send(csv);
        }
        
        if (params.format === 'excel') {
            const headers = config.columns.map(col => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
            const workbook = await generateExcelReport(
                `${entity.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Export`,
                headers,
                data.map(row => {
                    const obj = {};
                    config.columns.forEach(col => { obj[col] = row[col]; });
                    return obj;
                }),
                { subtitle: `Exported on ${new Date().toLocaleDateString()}`, sheetName: entity }
            );
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${entity}-export-${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }
        
        res.json({ success: true, data, meta: { count: data.length } });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/import/:entity/template', authenticate, async (req, res) => {
    try {
        const { entity } = req.params;
        const config = ENTITY_CONFIG[entity];
        
        if (!config) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid import entity' } });
        }
        
        const sampleData = config.columns.map(col => {
            if (col === 'is_active') return 1;
            if (col === 'decimal_places') return 2;
            if (col.includes('_id')) return null;
            return '';
        });
        
        const headers = config.columns;
        const sampleRow = sampleData;
        
        const csv = [headers.join(','), sampleRow.join(',')].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${entity}-import-template.csv`);
        res.send(csv);
    } catch (error) {
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
        
        const config = ENTITY_CONFIG[entity];
        if (!config) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid import entity' } });
        }
        
        const results = { imported: 0, updated: 0, errors: [], skipped: 0, total: items.length };
        const validatedItems = [];
        
        for (const item of items) {
            const rowErrors = [];
            
            const missing = config.required.filter(f => !item[f]);
            if (missing.length > 0) {
                results.skipped++;
                results.errors.push({ row: item, error: `Missing required: ${missing.join(', ')}` });
                continue;
            }
            
            if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
                rowErrors.push('Invalid email format');
            }
            
            if (item.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(item.gstin.toUpperCase())) {
                rowErrors.push('Invalid GSTIN format');
            }
            
            if (rowErrors.length > 0) {
                results.skipped++;
                results.errors.push({ row: item, error: rowErrors.join(', ') });
                continue;
            }
            
            validatedItems.push(item);
        }
        
        for (const item of validatedItems) {
            try {
                const existing = queryOne(
                    `SELECT id FROM ${config.table} WHERE code = ? AND tenant_id = ?`,
                    [item.code, req.tenantId]
                );
                
                if (existing) {
                    if (mode === 'skip') {
                        results.skipped++;
                        continue;
                    }
                    
                    const fields = Object.keys(item).filter(k => config.columns.includes(k));
                    const values = fields.map(f => item[f]);
                    
                    run(`UPDATE ${config.table} SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
                        [...values, new Date().toISOString(), existing.id]);
                    
                    results.updated++;
                } else {
                    const id = uuidv4();
                    const fields = Object.keys(item).filter(k => config.columns.includes(k));
                    const values = fields.map(f => item[f]);
                    
                    run(`INSERT INTO ${config.table} (id, tenant_id, ${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
                        [id, req.tenantId, ...values]);
                    
                    results.imported++;
                }
            } catch (err) {
                results.errors.push({ item, error: err.message });
            }
        }
        
        logActivity(req.tenantId, req.user.id, 'master', `${entity}_imported`, null, null, { 
            imported: results.imported,
            updated: results.updated,
            skipped: results.skipped,
            total: results.total
        }, req);
        
        res.json({
            success: true,
            data: results,
            message: `Import complete: ${results.imported} created, ${results.updated} updated, ${results.skipped} skipped`
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/bulk/:entity', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { entity } = req.params;
        const { ids, action, data } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No IDs provided' } });
        }
        
        const allowedActions = ['delete', 'activate', 'deactivate', 'update'];
        if (!allowedActions.includes(action)) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } });
        }
        
        const config = ENTITY_CONFIG[entity];
        if (!config) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: 'Invalid entity' } });
        }
        
        const placeholders = ids.map(() => '?').join(', ');
        let result;
        
        switch (action) {
            case 'delete':
                run(`DELETE FROM ${config.table} WHERE id IN (${placeholders}) AND tenant_id = ?`, [...ids, req.tenantId]);
                result = { affected: ids.length };
                break;
                
            case 'deactivate':
                run(`UPDATE ${config.table} SET is_active = 0 WHERE id IN (${placeholders}) AND tenant_id = ?`, [...ids, req.tenantId]);
                result = { affected: ids.length };
                break;
                
            case 'activate':
                run(`UPDATE ${config.table} SET is_active = 1 WHERE id IN (${placeholders}) AND tenant_id = ?`, [...ids, req.tenantId]);
                result = { affected: ids.length };
                break;
                
            case 'update':
                if (!data || typeof data !== 'object') {
                    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Update data required' } });
                }
                
                const allowedFields = config.columns.filter(c => !['id', 'tenant_id', 'code'].includes(c));
                const updateFields = Object.keys(data).filter(k => allowedFields.includes(k));
                
                if (updateFields.length === 0) {
                    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } });
                }
                
                const updateClause = updateFields.map(f => `${f} = ?`).join(', ');
                const updateValues = updateFields.map(f => data[f]);
                
                run(`UPDATE ${config.table} SET ${updateClause}, updated_at = ? WHERE id IN (${placeholders}) AND tenant_id = ?`,
                    [...updateValues, new Date().toISOString(), ...ids, req.tenantId]);
                
                result = { affected: ids.length, fields: updateFields };
                break;
        }
        
        logActivity(req.tenantId, req.user.id, 'master', `bulk_${action}`, entity, { ids, count: ids.length }, req);
        
        const actionLabels = { delete: 'Deleted', activate: 'Activated', deactivate: 'Deactivated', update: 'Updated' };
        
        res.json({
            success: true,
            data: result,
            message: `${actionLabels[action]} ${ids.length} ${entity}`
        });
    } catch (error) {
        console.error('Bulk operation error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/sales/export', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { from_date, to_date, format = 'csv', customer_id } = req.query;
        
        let sql = `
            SELECT si.invoice_number, si.invoice_date, si.subtotal, si.tax_amount, si.net_amount,
                   si.amount_paid, si.amount_due, si.payment_status,
                   c.name as customer_name, c.code as customer_code,
                   u.name as created_by
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            LEFT JOIN users u ON si.created_by = u.id
            WHERE si.tenant_id = ?
        `;
        const params = [req.tenantId];
        
        if (from_date) { sql += ' AND si.invoice_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND si.invoice_date <= ?'; params.push(to_date); }
        if (customer_id) { sql += ' AND si.customer_id = ?'; params.push(customer_id); }
        
        sql += ' ORDER BY si.invoice_date DESC';
        
        const data = query(sql, params);
        
        if (format === 'excel') {
            const workbook = await generateExcelReport(
                'Sales Export',
                ['Invoice #', 'Date', 'Customer', 'Subtotal', 'Tax', 'Total', 'Paid', 'Due', 'Status'],
                data.map(row => ({
                    invoice_number: row.invoice_number,
                    invoice_date: row.invoice_date,
                    customer: row.customer_name,
                    subtotal: row.subtotal,
                    tax: row.tax_amount,
                    net_amount: row.net_amount,
                    paid: row.amount_paid,
                    due: row.amount_due,
                    status: row.payment_status
                })),
                { subtitle: `${from_date || 'All'} to ${to_date || 'Present'}`, sheetName: 'Sales' }
            );
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-export-${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }
        
        const headers = ['Invoice #', 'Date', 'Customer', 'Subtotal', 'Tax', 'Total', 'Paid', 'Due', 'Status'];
        const csv = arrayToCSV(data, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sales-export-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/inventory/export', authenticate, requirePermission('reports', 'view'), async (req, res) => {
    try {
        const { godown_id, format = 'csv', as_on_date } = req.query;
        const date = as_on_date || new Date().toISOString().split('T')[0];
        
        let sql = `
            SELECT sl.item_type, sl.batch_number, sl.expiry_date,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.name ELSE p.name END as item_name,
                   CASE WHEN sl.item_type = 'raw_material' THEN rm.code ELSE p.code END as item_code,
                   g.name as godown_name,
                   SUM(sl.quantity) as qty, AVG(sl.rate) as avg_rate, SUM(sl.quantity * sl.rate) as value
            FROM stock_ledger sl
            LEFT JOIN godowns g ON sl.godown_id = g.id
            LEFT JOIN raw_materials rm ON sl.item_type = 'raw_material' AND sl.item_id = rm.id
            LEFT JOIN products p ON sl.item_type = 'product' AND sl.item_id = p.id
            WHERE sl.tenant_id = ? AND sl.created_at <= ?
        `;
        const params = [req.tenantId, date + ' 23:59:59'];
        
        if (godown_id) { sql += ' AND sl.godown_id = ?'; params.push(godown_id); }
        
        sql += ' GROUP BY sl.item_type, sl.item_id, sl.batch_number, g.name, rm.name, rm.code, p.name, p.code';
        
        const data = query(sql, params);
        
        if (format === 'excel') {
            const workbook = await generateExcelReport(
                'Stock Position Export',
                ['Item Code', 'Item Name', 'Godown', 'Batch', 'Qty', 'Avg Rate', 'Value'],
                data.map(row => ({
                    item_code: row.item_code,
                    item_name: row.item_name,
                    godown: row.godown_name,
                    batch: row.batch_number || '-',
                    qty: row.qty,
                    avg_rate: row.avg_rate,
                    value: row.value
                })),
                { subtitle: `As on ${date}`, sheetName: 'Stock' }
            );
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=stock-export-${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }
        
        const headers = ['Item Code', 'Item Name', 'Type', 'Godown', 'Batch', 'Qty', 'Value'];
        const csv = arrayToCSV(data, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=stock-export-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;