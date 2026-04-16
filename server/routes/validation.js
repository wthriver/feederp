const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const VALIDATION_TYPES = ['required', 'unique', 'pattern', 'range', 'custom', 'dependent', 'duplication'];
const VALIDATION_ENTITIES = ['customers', 'suppliers', 'products', 'raw_materials', 'users', 'accounts', 'formulas'];

router.get('/rules', authenticate, requirePermission('admin', 'view'), async (req, res) => {
    try {
        const { entity_type, is_active } = req.query;
        
        let sql = 'SELECT * FROM validation_rules WHERE tenant_id = ?';
        let params = [req.tenantId];
        
        if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
        if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active === 'true' ? 1 : 0); }
        
        sql += ' ORDER BY priority DESC, created_at DESC';
        
        const rules = query(sql, params);
        rules.forEach(r => {
            r.config = JSON.parse(r.config_json || '{}');
        });
        
        res.json({ success: true, data: rules });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/rules', authenticate, requirePermission('admin', 'add'), async (req, res) => {
    try {
        const { name, entity_type, field, validation_type, config, priority = 0, error_message, is_active = true } = req.body;
        
        if (!name || !entity_type || !field || !validation_type) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'VALIDATION_ERROR', message: 'Name, entity type, field, and validation type are required' } 
            });
        }
        
        if (!VALIDATION_TYPES.includes(validation_type)) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'INVALID_TYPE', message: `Validation type must be one of: ${VALIDATION_TYPES.join(', ')}` } 
            });
        }
        
        if (!VALIDATION_ENTITIES.includes(entity_type)) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 'INVALID_ENTITY', message: `Entity must be one of: ${VALIDATION_ENTITIES.join(', ')}` } 
            });
        }
        
        const id = uuidv4();
        run(`INSERT INTO validation_rules (id, tenant_id, name, entity_type, field, validation_type, config_json, priority, error_message, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, entity_type, field, validation_type, JSON.stringify(config || {}), priority, error_message, is_active ? 1 : 0]);
        
        logActivity(req.tenantId, req.user.id, 'admin', 'validation_rule_created', id, { name, entity_type, field }, req);
        
        res.json({ success: true, data: { id }, message: 'Validation rule created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/rules/:id', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { name, field, validation_type, config, priority, error_message, is_active } = req.body;
        
        const existing = queryOne('SELECT * FROM validation_rules WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Validation rule not found' } });
        }
        
        run(`UPDATE validation_rules SET 
             name = ?, field = ?, validation_type = ?, config_json = ?, priority = ?, error_message = ?, is_active = ?
             WHERE id = ?`,
            [name, field, validation_type, JSON.stringify(config || {}), priority, error_message, is_active ? 1 : 0, req.params.id]);
        
        logActivity(req.tenantId, req.user.id, 'admin', 'validation_rule_updated', req.params.id, { name }, req);
        
        res.json({ success: true, message: 'Validation rule updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/rules/:id', authenticate, requirePermission('admin', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT * FROM validation_rules WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Validation rule not found' } });
        }
        
        run('DELETE FROM validation_rules WHERE id = ?', [req.params.id]);
        
        logActivity(req.tenantId, req.user.id, 'admin', 'validation_rule_deleted', req.params.id, { name: existing.name }, req);
        
        res.json({ success: true, message: 'Validation rule deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/validate', authenticate, async (req, res) => {
    try {
        const { entity_type, data, exclude_id } = req.body;
        
        if (!entity_type || !data) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Entity type and data are required' } });
        }
        
        const rules = query(
            'SELECT * FROM validation_rules WHERE entity_type = ? AND tenant_id = ? AND is_active = 1 ORDER BY priority DESC',
            [entity_type, req.tenantId]
        );
        
        const errors = [];
        
        for (const rule of rules) {
            const config = JSON.parse(rule.config_json || '{}');
            const value = data[rule.field];
            
            switch (rule.validation_type) {
                case 'required':
                    if (!value && value !== 0) {
                        errors.push({ field: rule.field, message: rule.error_message || `${rule.field} is required`, rule_id: rule.id });
                    }
                    break;
                    
                case 'unique':
                    const existing = queryOne(
                        `SELECT id FROM ${entity_type} WHERE ${rule.field} = ? AND tenant_id = ? ${exclude_id ? 'AND id != ?' : ''} LIMIT 1`,
                        exclude_id ? [value, req.tenantId, exclude_id] : [value, req.tenantId]
                    );
                    if (existing) {
                        errors.push({ field: rule.field, message: rule.error_message || `${rule.field} must be unique`, rule_id: rule.id });
                    }
                    break;
                    
                case 'pattern':
                    if (value && config.pattern) {
                        const regex = new RegExp(config.pattern);
                        if (!regex.test(value)) {
                            errors.push({ field: rule.field, message: rule.error_message || `${rule.field} format is invalid`, rule_id: rule.id });
                        }
                    }
                    break;
                    
                case 'range':
                    if (value !== undefined && value !== null && value !== '') {
                        const numValue = parseFloat(value);
                        if (config.min !== undefined && numValue < config.min) {
                            errors.push({ field: rule.field, message: rule.error_message || `${rule.field} must be at least ${config.min}`, rule_id: rule.id });
                        }
                        if (config.max !== undefined && numValue > config.max) {
                            errors.push({ field: rule.field, message: rule.error_message || `${rule.field} must be at most ${config.max}`, rule_id: rule.id });
                        }
                    }
                    break;
                    
                case 'duplication':
                    if (value && config.check_fields) {
                        const duplicateCheck = queryOne(
                            `SELECT id FROM ${entity_type} WHERE ${rule.field} = ? AND ${config.check_fields[0]} = ? AND tenant_id = ? ${exclude_id ? 'AND id != ?' : ''}`,
                            exclude_id ? [value, data[config.check_fields[0]], req.tenantId, exclude_id] : [value, data[config.check_fields[0]], req.tenantId]
                        );
                        if (duplicateCheck) {
                            errors.push({ 
                                field: rule.field, 
                                message: rule.error_message || `Duplicate ${rule.field} found for this ${config.check_fields[0]}`, 
                                rule_id: rule.id 
                            });
                        }
                    }
                    break;
                    
                case 'dependent':
                    if (config.required_when && config.required_when.field) {
                        const dependentValue = data[config.required_when.field];
                        const matchesCondition = config.required_when.value === dependentValue ||
                                               (Array.isArray(config.required_when.value) && config.required_when.value.includes(dependentValue));
                        
                        if (matchesCondition && !value) {
                            errors.push({ field: rule.field, message: rule.error_message || `${rule.field} is required when ${config.required_when.field} is ${config.required_when.value}`, rule_id: rule.id });
                        }
                    }
                    break;
            }
        }
        
        res.json({ 
            success: true, 
            data: { 
                valid: errors.length === 0,
                errors,
                validated_fields: Object.keys(data)
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/rules/test', authenticate, async (req, res) => {
    try {
        const { validation_type, config, test_values } = req.body;
        
        if (!validation_type || !test_values) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation type and test values are required' } });
        }
        
        const results = test_values.map(val => {
            let passed = true;
            let message = 'Valid';
            
            switch (validation_type) {
                case 'pattern':
                    if (config.pattern) {
                        const regex = new RegExp(config.pattern);
                        passed = regex.test(val);
                        message = passed ? 'Valid' : 'Invalid pattern';
                    }
                    break;
                    
                case 'range':
                    const numVal = parseFloat(val);
                    if (config.min !== undefined && numVal < config.min) {
                        passed = false;
                        message = `Value ${val} is below minimum ${config.min}`;
                    } else if (config.max !== undefined && numVal > config.max) {
                        passed = false;
                        message = `Value ${val} is above maximum ${config.max}`;
                    }
                    break;
                    
                case 'required':
                    passed = !!(val && val.trim());
                    message = passed ? 'Valid' : 'Value is required';
                    break;
            }
            
            return { value: val, passed, message };
        });
        
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
