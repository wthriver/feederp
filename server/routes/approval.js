const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

function validateApprovalRequest(req, res, next) {
    const { action, comment } = req.body;
    
    if (!action || !['approve', 'reject', 'request_changes'].includes(action)) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Must be: approve, reject, or request_changes' }
        });
    }
    
    if (action === 'reject' && !comment) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Comment required when rejecting' }
        });
    }
    
    next();
}

function getApprovableDocuments(tenantId) {
    const documents = query(`
        SELECT 'purchase_order' as doc_type, id, po_number as doc_number, supplier_id, total_amount, created_by, created_at, 'pending' as approval_status
        FROM purchase_orders WHERE tenant_id = ? AND approval_status = 'pending'
        UNION ALL
        SELECT 'sales_order' as doc_type, id, order_number as doc_number, customer_id, net_amount, created_by, created_at, 'pending' as approval_status
        FROM sales_orders WHERE tenant_id = ? AND approval_status = 'pending'
        UNION ALL
        SELECT 'production_batch' as doc_type, id, batch_number as doc_number, formula_id, planned_qty, created_by, created_at, 'pending' as approval_status
        FROM production_batches WHERE tenant_id = ? AND approval_status = 'pending'
        UNION ALL
        SELECT 'stock_adjustment' as doc_type, id, adjustment_number as doc_number, godown_id, NULL, created_by, created_at, 'pending' as approval_status
        FROM stock_adjustments WHERE tenant_id = ? AND approval_status = 'pending'
        ORDER BY created_at DESC
    `, [tenantId, tenantId, tenantId, tenantId]);
    
    return documents;
}

router.get('/pending', authenticate, requirePermission('approval', 'view'), async (req, res) => {
    try {
        const documents = getApprovableDocuments(req.tenantId);
        
        const enrichedDocs = documents.map(doc => {
            let additionalInfo = {};
            
            if (doc.doc_type === 'purchase_order') {
                const supplier = queryOne('SELECT name FROM suppliers WHERE id = ?', [doc.supplier_id]);
                additionalInfo = { party_name: supplier?.name };
            } else if (doc.doc_type === 'sales_order') {
                const customer = queryOne('SELECT name FROM customers WHERE id = ?', [doc.customer_id]);
                additionalInfo = { party_name: customer?.name };
            }
            
            return { ...doc, ...additionalInfo };
        });
        
        res.json({
            success: true,
            data: enrichedDocs,
            meta: { total: enrichedDocs.length }
        });
    } catch (error) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/history', authenticate, async (req, res) => {
    try {
        const { doc_type, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        let sql = `
            SELECT ah.*, 
                   u.name as approver_name,
                   CASE 
                       WHEN ah.document_type = 'purchase_order' THEN (SELECT po_number FROM purchase_orders WHERE id = ah.document_id)
                       WHEN ah.document_type = 'sales_order' THEN (SELECT order_number FROM sales_orders WHERE id = ah.document_id)
                       WHEN ah.document_type = 'production_batch' THEN (SELECT batch_number FROM production_batches WHERE id = ah.document_id)
                       WHEN ah.document_type = 'stock_adjustment' THEN (SELECT adjustment_number FROM stock_adjustments WHERE id = ah.document_id)
                   END as document_number
            FROM approval_history ah
            LEFT JOIN users u ON ah.approver_id = u.id
            WHERE ah.tenant_id = ?
        `;
        let countSql = 'SELECT COUNT(*) as total FROM approval_history WHERE tenant_id = ?';
        const params = [req.tenantId];
        
        if (doc_type) {
            sql += ' AND ah.document_type = ?';
            countSql += ' AND document_type = ?';
            params.push(doc_type);
        }
        
        sql += ' ORDER BY ah.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const history = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));
        
        res.json({
            success: true,
            data: history,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/:docType/:docId/approve', authenticate, requirePermission('approval', 'approve'), validateApprovalRequest, async (req, res) => {
    try {
        const { docType, docId } = req.params;
        const { action, comment } = req.body;
        
        let tableName, idColumn, numberColumn, statusColumn;
        
        switch (docType) {
            case 'purchase_order':
                tableName = 'purchase_orders';
                idColumn = 'id';
                numberColumn = 'po_number';
                statusColumn = 'approval_status';
                break;
            case 'sales_order':
                tableName = 'sales_orders';
                idColumn = 'id';
                numberColumn = 'order_number';
                statusColumn = 'approval_status';
                break;
            case 'production_batch':
                tableName = 'production_batches';
                idColumn = 'id';
                numberColumn = 'batch_number';
                statusColumn = 'approval_status';
                break;
            case 'stock_adjustment':
                tableName = 'stock_adjustments';
                idColumn = 'id';
                numberColumn = 'adjustment_number';
                statusColumn = 'approval_status';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_TYPE', message: 'Invalid document type' }
                });
        }
        
        const doc = queryOne(`SELECT * FROM ${tableName} WHERE ${idColumn} = ? AND tenant_id = ?`, [docId, req.tenantId]);
        
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Document not found' }
            });
        }
        
        if (doc[statusColumn] !== 'pending') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_STATUS', message: 'Document is not pending approval' }
            });
        }
        
        const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes_requested';
        
        run(`UPDATE ${tableName} SET ${statusColumn} = ?, approved_by = ?, approved_at = ? WHERE ${idColumn} = ?`,
            [newStatus, req.user.id, new Date().toISOString(), docId]);
        
        run(`INSERT INTO approval_history (id, tenant_id, document_type, document_id, document_number, action, comment, approver_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.tenantId, docType, docId, doc[numberColumn], action, comment || null, req.user.id]);
        
        logActivity(req.tenantId, req.user.id, 'approval', action, docId, null, {
            document_type: docType,
            document_number: doc[numberColumn],
            action,
            comment
        }, req);
        
        res.json({
            success: true,
            message: `Document ${newStatus} successfully`,
            data: {
                document_id: docId,
                document_number: doc[numberColumn],
                status: newStatus
            }
        });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/settings', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { enable_approvals, approval_levels, auto_approve_small_amounts, small_amount_threshold } = req.body;
        
        const settings = {
            'approval.enabled': enable_approvals ? 'true' : 'false',
            'approval.levels': JSON.stringify(approval_levels || []),
            'approval.auto_approve_small': auto_approve_small_amounts ? 'true' : 'false',
            'approval.small_amount_threshold': small_amount_threshold || '10000'
        };
        
        Object.entries(settings).forEach(([key, value]) => {
            run(`INSERT INTO settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                [uuidv4(), req.tenantId, key, value]);
        });
        
        res.json({ success: true, message: 'Approval settings updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/settings', authenticate, async (req, res) => {
    try {
        const settings = {};
        query(`SELECT key, value FROM settings WHERE tenant_id = ? AND key LIKE 'approval.%'`, [req.tenantId])
            .forEach(s => {
                if (s.key === 'approval.levels') {
                    try {
                        settings[s.key] = JSON.parse(s.value);
                    } catch {
                        settings[s.key] = [];
                    }
                } else if (s.key === 'approval.enabled' || s.key === 'approval.auto_approve_small') {
                    settings[s.key] = s.value === 'true';
                } else {
                    settings[s.key] = s.value;
                }
            });
        
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;