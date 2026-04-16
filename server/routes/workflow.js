const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const WORKFLOW_ENTITIES = [
    'purchase_order', 'sales_order', 'invoice', 'payment', 
    'production_batch', 'expense', 'adjustment',
    'goods_inward', 'purchase_invoice', 'sales_return'
];
const WORKFLOW_ACTIONS = ['submit', 'approve', 'reject', 'revert'];
const WORKFLOW_STEPS = ['pending', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled'];

router.get('/definitions', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const definitions = query('SELECT * FROM workflow_definitions WHERE tenant_id = ? AND is_active = 1 ORDER BY priority DESC', [req.tenantId]);
        res.json({ success: true, data: definitions });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/definitions', authenticate, requirePermission('admin', 'add'), async (req, res) => {
    try {
        const { name, entity_type, steps, approvers, conditions, priority = 0 } = req.body;

        if (!name || !entity_type || !steps || !approvers) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'VALIDATION_ERROR', message: 'Name, entity type, steps, and approvers are required' } 
            });
        }

        if (!WORKFLOW_ENTITIES.includes(entity_type)) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'INVALID_ENTITY', message: `Entity must be one of: ${WORKFLOW_ENTITIES.join(', ')}` } 
            });
        }

        const id = uuidv4();
        run(`INSERT INTO workflow_definitions (id, tenant_id, name, entity_type, steps_json, approvers_json, conditions_json, priority, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [id, req.tenantId, name, entity_type, 
             JSON.stringify(steps), JSON.stringify(approvers), JSON.stringify(conditions || {}), priority]);

        logActivity(req.tenantId, req.user.id, 'admin', 'workflow_definition_created', id, { name, entity_type }, req);

        res.json({ success: true, data: { id }, message: 'Workflow definition created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/instances', authenticate, async (req, res) => {
    try {
        const { entity_type, status, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT wi.*, wd.name as workflow_name, u.name as created_by_name,
                   (SELECT name FROM users WHERE id = wi.current_approver_id) as current_approver_name
                   FROM workflow_instances wi
                   LEFT JOIN workflow_definitions wd ON wi.definition_id = wd.id
                   LEFT JOIN users u ON wi.created_by = u.id
                   WHERE wi.tenant_id = ?`;
        let params = [req.tenantId];

        if (entity_type) { sql += ' AND wi.entity_type = ?'; params.push(entity_type); }
        if (status) { sql += ' AND wi.status = ?'; params.push(status); }
        
        sql += ' ORDER BY wi.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const instances = query(sql, params);
        const { total } = queryOne('SELECT COUNT(*) as total FROM workflow_instances WHERE tenant_id = ?', [req.tenantId]);

        instances.forEach(inst => {
            inst.steps = JSON.parse(inst.steps_json || '[]');
            inst.history = JSON.parse(inst.history_json || '[]');
        });

        res.json({ 
            success: true, 
            data: instances,
            meta: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/instances/:id', authenticate, async (req, res) => {
    try {
        const instance = queryOne(`
            SELECT wi.*, wd.name as workflow_name
            FROM workflow_instances wi
            LEFT JOIN workflow_definitions wd ON wi.definition_id = wd.id
            WHERE wi.id = ? AND wi.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!instance) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workflow instance not found' } });
        }

        instance.steps = JSON.parse(instance.steps_json || '[]');
        instance.history = JSON.parse(instance.history_json || '[]');

        res.json({ success: true, data: instance });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/instances', authenticate, async (req, res) => {
    try {
        const { entity_type, entity_id, definition_id, initial_data } = req.body;

        if (!entity_type || !entity_id) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'VALIDATION_ERROR', message: 'Entity type and entity ID are required' } 
            });
        }

        let definition = null;
        if (definition_id) {
            definition = queryOne('SELECT * FROM workflow_definitions WHERE id = ? AND tenant_id = ?', [definition_id, req.tenantId]);
        } else {
            definition = queryOne(
                'SELECT * FROM workflow_definitions WHERE entity_type = ? AND tenant_id = ? AND is_active = 1 ORDER BY priority DESC LIMIT 1',
                [entity_type, req.tenantId]
            );
        }

        if (!definition) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'NO_WORKFLOW', message: 'No workflow defined for this entity type' } 
            });
        }

        const steps = JSON.parse(definition.steps_json || '[]');
        const approvers = JSON.parse(definition.approvers_json || '[]');

        if (steps.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'INVALID_WORKFLOW', message: 'Workflow has no steps defined' } 
            });
        }

        const currentStep = steps[0];
        const firstApprover = approvers.find(a => a.step === currentStep.step) || approvers[0];

        const id = uuidv4();
        const stepsWithStatus = steps.map((step, idx) => ({
            ...step,
            status: idx === 0 ? 'pending' : 'waiting',
            approver_id: approvers[idx]?.user_id || null,
            approver_name: approvers[idx]?.user_name || null
        }));

        const historyEntry = {
            action: 'created',
            user_id: req.user.id,
            user_name: req.user.username,
            step: currentStep.step,
            timestamp: new Date().toISOString(),
            comment: 'Workflow initiated'
        };

        run(`INSERT INTO workflow_instances 
             (id, tenant_id, definition_id, entity_type, entity_id, status, current_step, current_approver_id, 
              steps_json, history_json, created_by)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
            [id, req.tenantId, definition.id, entity_type, entity_id, 
             currentStep.step, firstApprover?.user_id || null,
             JSON.stringify(stepsWithStatus), JSON.stringify([historyEntry]), req.user.id]);

        logActivity(req.tenantId, req.user.id, 'workflow', 'workflow_created', id, { entity_type, entity_id }, req);

        res.json({ success: true, data: { id, status: 'pending' }, message: 'Workflow created and pending approval' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/instances/:id/action', authenticate, async (req, res) => {
    try {
        const { action, comment, approver_id } = req.body;
        const instanceId = req.params.id;

        if (!WORKFLOW_ACTIONS.includes(action)) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'INVALID_ACTION', message: `Action must be one of: ${WORKFLOW_ACTIONS.join(', ')}` } 
            });
        }

        const instance = queryOne('SELECT * FROM workflow_instances WHERE id = ? AND tenant_id = ?', [instanceId, req.tenantId]);
        if (!instance) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workflow instance not found' } });
        }

        const steps = JSON.parse(instance.steps_json || '[]');
        const history = JSON.parse(instance.history_json || '[]');
        const currentStepIdx = steps.findIndex(s => s.step === instance.current_step);

        if (action === 'submit') {
            if (instance.status !== 'pending') {
                return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Can only submit pending workflows' } });
            }

            steps[currentStepIdx].status = 'submitted';
            const nextApprover = steps[currentStepIdx + 1]?.approver_id;

            run('UPDATE workflow_instances SET status = ?, current_step = ?, current_approver_id = ?, steps_json = ? WHERE id = ?',
                ['in_review', steps[currentStepIdx + 1]?.step || steps[currentStepIdx].step, nextApprover, JSON.stringify(steps), instanceId]);

            history.push({ action: 'submit', user_id: req.user.id, user_name: req.user.username, step: instance.current_step, timestamp: new Date().toISOString(), comment });
            run('UPDATE workflow_instances SET history_json = ? WHERE id = ?', [JSON.stringify(history), instanceId]);

        } else if (action === 'approve') {
            if (!approver_id && instance.current_approver_id !== req.user.id) {
                return res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'You are not authorized to approve this step' } });
            }

            steps[currentStepIdx].status = 'approved';

            const isLastStep = currentStepIdx === steps.length - 1;
            if (isLastStep) {
                run('UPDATE workflow_instances SET status = ?, steps_json = ? WHERE id = ?',
                    ['approved', JSON.stringify(steps), instanceId]);

                await updateEntityStatus(instance.entity_type, instance.entity_id, 'approved');
            } else {
                const nextStep = steps[currentStepIdx + 1];
                run('UPDATE workflow_instances SET status = ?, current_step = ?, current_approver_id = ?, steps_json = ? WHERE id = ?',
                    ['in_review', nextStep.step, nextStep.approver_id, JSON.stringify(steps), instanceId]);
            }

            history.push({ action: 'approve', user_id: req.user.id, user_name: req.user.username, step: instance.current_step, timestamp: new Date().toISOString(), comment });
            run('UPDATE workflow_instances SET history_json = ? WHERE id = ?', [JSON.stringify(history), instanceId]);

            logActivity(req.tenantId, req.user.id, 'workflow', 'workflow_approved', instanceId, { step: instance.current_step }, req);

        } else if (action === 'reject') {
            steps[currentStepIdx].status = 'rejected';

            run('UPDATE workflow_instances SET status = ?, steps_json = ? WHERE id = ?',
                ['rejected', JSON.stringify(steps), instanceId]);

            await updateEntityStatus(instance.entity_type, instance.entity_id, 'rejected');

            history.push({ action: 'reject', user_id: req.user.id, user_name: req.user.username, step: instance.current_step, timestamp: new Date().toISOString(), comment });
            run('UPDATE workflow_instances SET history_json = ? WHERE id = ?', [JSON.stringify(history), instanceId]);

            logActivity(req.tenantId, req.user.id, 'workflow', 'workflow_rejected', instanceId, { step: instance.current_step, comment }, req);

        } else if (action === 'revert') {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Only admins can revert workflows' } });
            }

            steps.forEach(s => s.status = 'waiting');
            steps[0].status = 'pending';

            run('UPDATE workflow_instances SET status = ?, current_step = ?, current_approver_id = ?, steps_json = ? WHERE id = ?',
                ['pending', steps[0].step, steps[0].approver_id, JSON.stringify(steps), instanceId]);

            history.push({ action: 'revert', user_id: req.user.id, user_name: req.user.username, step: instance.current_step, timestamp: new Date().toISOString(), comment: comment || 'Workflow reverted to initial state' });
            run('UPDATE workflow_instances SET history_json = ? WHERE id = ?', [JSON.stringify(history), instanceId]);

            await updateEntityStatus(instance.entity_type, instance.entity_id, 'pending');
        }

        res.json({ success: true, message: `Action '${action}' completed successfully` });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/my-pending', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const instances = query(`
            SELECT wi.*, wd.name as workflow_name,
                   (SELECT code FROM users WHERE id = wi.created_by) as created_by_code
            FROM workflow_instances wi
            LEFT JOIN workflow_definitions wd ON wi.definition_id = wd.id
            WHERE wi.current_approver_id = ? AND wi.tenant_id = ? AND wi.status IN ('pending', 'in_review')
            ORDER BY wi.created_at DESC
            LIMIT ? OFFSET ?
        `, [req.user.id, req.tenantId, parseInt(limit), offset]);

        instances.forEach(inst => {
            inst.steps = JSON.parse(inst.steps_json || '[]');
        });

        const { total } = queryOne(
            'SELECT COUNT(*) as total FROM workflow_instances WHERE current_approver_id = ? AND tenant_id = ? AND status IN (?, ?)',
            [req.user.id, req.tenantId, 'pending', 'in_review']
        );

        res.json({ success: true, data: instances, meta: { page: parseInt(page), limit: parseInt(limit), total } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

async function updateEntityStatus(entityType, entityId, status) {
    const tableMap = {
        'purchase_order': { table: 'purchase_orders', statusField: 'approval_status' },
        'sales_order': { table: 'sales_orders', statusField: 'approval_status' },
        'invoice': { table: 'sales_invoices', statusField: 'approval_status' },
        'payment': { table: 'payments', statusField: 'status' },
        'production_batch': { table: 'production_batches', statusField: 'approval_status' },
        'expense': { table: 'transactions', statusField: 'status' },
        'adjustment': { table: 'stock_adjustments', statusField: 'approval_status' }
    };

    const config = tableMap[entityType];
    if (config) {
        run(`UPDATE ${config.table} SET ${config.statusField} = ? WHERE id = ?`, [status, entityId]);
    }
}

module.exports = router;
