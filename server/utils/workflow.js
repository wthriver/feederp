const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');

async function triggerWorkflow(tenantId, userId, entityType, entityId, req) {
    try {
        const definition = queryOne(
            'SELECT * FROM workflow_definitions WHERE entity_type = ? AND tenant_id = ? AND is_active = 1 ORDER BY priority DESC LIMIT 1',
            [entityType, tenantId]
        );

        if (!definition) {
            return { triggered: false, reason: 'no_workflow' };
        }

        const steps = JSON.parse(definition.steps_json || '[]');
        const approvers = JSON.parse(definition.approvers_json || '[]');

        if (steps.length === 0) {
            return { triggered: false, reason: 'no_steps' };
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
            user_id: userId,
            user_name: req.user?.username || 'system',
            step: currentStep.step,
            timestamp: new Date().toISOString(),
            comment: 'Workflow initiated automatically'
        };

        run(`INSERT INTO workflow_instances 
             (id, tenant_id, definition_id, entity_type, entity_id, status, current_step, current_approver_id, 
              steps_json, history_json, created_by)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
            [id, tenantId, definition.id, entityType, entityId, 
             currentStep.step, firstApprover?.user_id || null,
             JSON.stringify(stepsWithStatus), JSON.stringify([historyEntry]), userId]);

        logActivity(tenantId, userId, 'workflow', 'workflow_triggered', id, { entityType, entityId }, req);

        return { triggered: true, workflowId: id, status: 'pending' };
    } catch (error) {
        console.error('Workflow trigger error:', error);
        return { triggered: false, reason: 'error', error: error.message };
    }
}

async function checkWorkflowRequired(tenantId, entityType) {
    const definition = queryOne(
        'SELECT id FROM workflow_definitions WHERE entity_type = ? AND tenant_id = ? AND is_active = 1 LIMIT 1',
        [entityType, tenantId]
    );
    return !!definition;
}

async function getWorkflowStatus(tenantId, entityType, entityId) {
    const instance = queryOne(
        'SELECT id, status, current_step FROM workflow_instances WHERE entity_type = ? AND entity_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1',
        [entityType, entityId, tenantId]
    );
    return instance;
}

module.exports = {
    triggerWorkflow,
    checkWorkflowRequired,
    getWorkflowStatus
};
