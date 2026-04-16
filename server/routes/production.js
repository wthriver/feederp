const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Formulas
router.get('/formulas', authenticate, async (req, res) => {
    try {
        const { product_id, status, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT f.*, p.name as product_name, p.code as product_code, u.name as created_by_name
                   FROM formulas f
                   LEFT JOIN products p ON f.product_id = p.id
                   LEFT JOIN users u ON f.created_by = u.id
                   WHERE f.tenant_id = ? AND f.is_active = 1`;
        let countSql = 'SELECT COUNT(*) as total FROM formulas WHERE tenant_id = ? AND is_active = 1';
        const params = [req.tenantId];

        if (product_id) { sql += ' AND f.product_id = ?'; countSql += ' AND product_id = ?'; params.push(product_id); }
        if (status) { sql += ' AND f.status = ?'; countSql += ' AND status = ?'; params.push(status); }
        if (search) { sql += ' AND (f.name LIKE ? OR f.code LIKE ?)'; countSql += ' AND (name LIKE ? OR code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        sql += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const formulas = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: formulas, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/formulas/:id', authenticate, async (req, res) => {
    try {
        const formula = queryOne(`
            SELECT f.*, p.name as product_name, p.code as product_code
            FROM formulas f
            LEFT JOIN products p ON f.product_id = p.id
            WHERE f.id = ? AND f.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!formula) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Formula not found' } });
        }

        const ingredients = query(`
            SELECT fi.*, rm.name as material_name, rm.code as material_code, u.name as unit_name
            FROM formula_ingredients fi
            LEFT JOIN raw_materials rm ON fi.raw_material_id = rm.id
            LEFT JOIN units u ON rm.unit_id = u.id
            WHERE fi.formula_id = ?
        `, [req.params.id]);

        res.json({ success: true, data: { ...formula, ingredients } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/formulas', authenticate, requirePermission('production', 'add'), async (req, res) => {
    try {
        const { code, name, product_id, target_protein, target_moisture, target_fiber, target_fat, target_ash, target_energy, ingredients } = req.body;

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one ingredient is required' } });
        }

        const formulaId = uuidv4();

        run(`INSERT INTO formulas (id, tenant_id, code, name, product_id, target_protein, target_moisture, target_fiber, target_fat, target_ash, target_energy, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [formulaId, req.tenantId, code, name, product_id, target_protein, target_moisture, target_fiber, target_fat, target_ash, target_energy, req.user.id]);

        ingredients.forEach(ing => {
            run(`INSERT INTO formula_ingredients (id, formula_id, raw_material_id, percentage, min_percentage, max_percentage, is_mandatory)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), formulaId, ing.raw_material_id, ing.percentage, ing.min_percentage, ing.max_percentage, ing.is_mandatory ?? 1]);
        });

        logActivity(req.tenantId, req.user.id, 'production', 'formula_created', formulaId, null, { code, name }, req);

        res.json({ success: true, data: { id: formulaId }, message: 'Formula created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/formulas/:id', authenticate, requirePermission('production', 'edit'), async (req, res) => {
    try {
        const { name, product_id, target_protein, target_moisture, target_fiber, target_fat, target_ash, target_energy, ingredients } = req.body;

        const formula = queryOne('SELECT status FROM formulas WHERE id = ?', [req.params.id]);
        if (formula?.status === 'approved') {
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Cannot edit approved formula. Create a new version.' } });
        }

        run(`UPDATE formulas SET name = ?, product_id = ?, target_protein = ?, target_moisture = ?, target_fiber = ?, target_fat = ?, target_ash = ?, target_energy = ?, updated_at = ?
             WHERE id = ?`,
            [name, product_id, target_protein, target_moisture, target_fiber, target_fat, target_ash, target_energy, new Date().toISOString(), req.params.id]);

        if (ingredients) {
            run('DELETE FROM formula_ingredients WHERE formula_id = ?', [req.params.id]);
            ingredients.forEach(ing => {
                run(`INSERT INTO formula_ingredients (id, formula_id, raw_material_id, percentage, min_percentage, max_percentage, is_mandatory)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), req.params.id, ing.raw_material_id, ing.percentage, ing.min_percentage, ing.max_percentage, ing.is_mandatory ?? 1]);
            });
        }

        logActivity(req.tenantId, req.user.id, 'production', 'formula_updated', req.params.id, null, req.body, req);

        res.json({ success: true, message: 'Formula updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/formulas/:id/approve', authenticate, requirePermission('production', 'approve'), async (req, res) => {
    try {
        run(`UPDATE formulas SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?`,
            [req.user.id, new Date().toISOString(), req.params.id]);

        logActivity(req.tenantId, req.user.id, 'production', 'formula_approved', req.params.id, null, { status: 'approved' }, req);

        res.json({ success: true, message: 'Formula approved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Formula Optimization - Advanced (combines both cost calculation and ratio optimization)
router.post('/formulas/:id/optimize', authenticate, requirePermission('production', 'edit'), async (req, res) => {
    try {
        const { target_qty = 1000, constraints } = req.body;
        
        const formula = queryOne(`
            SELECT f.*, p.name as product_name
            FROM formulas f
            LEFT JOIN products p ON f.product_id = p.id
            WHERE f.id = ? AND f.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!formula) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Formula not found' } });
        }

        const items = query(`
            SELECT fi.*, rm.name as material_name, rm.code as material_code, rm.opening_rate as price,
                   rm.protein, rm.moisture, rm.fiber, rm.fat, rm.ash
            FROM formula_ingredients fi
            LEFT JOIN raw_materials rm ON fi.raw_material_id = rm.id
            WHERE fi.formula_id = ?
        `, [req.params.id]);

        const optimizedItems = items.map(item => {
            const price = item.price || 0;
            const percentage = item.percentage || 0;
            const optimizedQty = (percentage / 100) * target_qty;
            const cost = optimizedQty * price;
            
            return {
                raw_material_id: item.raw_material_id,
                material_name: item.material_name,
                material_code: item.material_code,
                original_percentage: percentage,
                optimized_qty: Math.round(optimizedQty * 100) / 100,
                price: price,
                cost: Math.round(cost * 100) / 100,
                protein: item.protein,
                moisture: item.moisture,
                fiber: item.fiber,
                fat: item.fat,
                ash: item.ash
            };
        });

        const totalCost = optimizedItems.reduce((sum, i) => sum + i.cost, 0);
        const totalQty = optimizedItems.reduce((sum, i) => sum + i.optimized_qty, 0);

        res.json({
            success: true,
            data: {
                original_formula: { ...formula, items },
                optimized_formula: {
                    formula_id: formula.id,
                    formula_name: formula.name,
                    target_qty,
                    items: optimizedItems,
                    total_cost: Math.round(totalCost * 100) / 100,
                    total_qty: Math.round(totalQty * 100) / 100,
                    cost_per_kg: Math.round((totalCost / target_qty) * 100) / 100,
                    target_protein: formula.target_protein,
                    target_moisture: formula.target_moisture,
                    target_fiber: formula.target_fiber
                }
            }
        });
    } catch (error) {
        console.error('Formula optimization error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/formulas/:id/nutrients', authenticate, async (req, res) => {
    try {
        const items = query(`
            SELECT fi.percentage, rm.protein, rm.moisture, rm.fiber, rm.fat, rm.ash
            FROM formula_ingredients fi
            LEFT JOIN raw_materials rm ON fi.raw_material_id = rm.id
            WHERE fi.formula_id = ?
        `, [req.params.id]);

        const totalQty = items.reduce((sum, i) => sum + i.percentage, 0);
        
        if (totalQty === 0) {
            return res.json({
                success: true,
                data: {
                    total_qty: 0,
                    nutrients: {
                        protein: 0,
                        moisture: 0,
                        fiber: 0,
                        fat: 0,
                        ash: 0
                    }
                }
            });
        }
        
        const nutrients = {
            protein: 0,
            moisture: 0,
            fiber: 0,
            fat: 0,
            ash: 0
        };

        items.forEach(item => {
            const ratio = (item.percentage || 0) / totalQty;
            nutrients.protein += (item.protein || 0) * ratio;
            nutrients.moisture += (item.moisture || 0) * ratio;
            nutrients.fiber += (item.fiber || 0) * ratio;
            nutrients.fat += (item.fat || 0) * ratio;
            nutrients.ash += (item.ash || 0) * ratio;
        });

        res.json({
            success: true,
            data: {
                total_qty: totalQty,
                nutrients: {
                    protein: Math.round(nutrients.protein * 100) / 100,
                    moisture: Math.round(nutrients.moisture * 100) / 100,
                    fiber: Math.round(nutrients.fiber * 100) / 100,
                    fat: Math.round(nutrients.fat * 100) / 100,
                    ash: Math.round(nutrients.ash * 100) / 100
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/batches', authenticate, async (req, res) => {
    try {
        const { status, formula_id, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT pb.*, f.name as formula_name, p.name as product_name, g.name as godown_name, m.name as machine_name,
                   u.name as created_by_name
                   FROM production_batches pb
                   LEFT JOIN formulas f ON pb.formula_id = f.id
                   LEFT JOIN products p ON pb.product_id = p.id
                   LEFT JOIN godowns g ON pb.godown_id = g.id
                   LEFT JOIN machines m ON pb.machine_id = m.id
                   LEFT JOIN users u ON pb.created_by = u.id
                   WHERE pb.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM production_batches WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (status) { sql += ' AND pb.status = ?'; countSql += ' AND status = ?'; params.push(status); }
        if (formula_id) { sql += ' AND pb.formula_id = ?'; countSql += ' AND formula_id = ?'; params.push(formula_id); }
        if (from_date) { sql += ' AND pb.batch_date >= ?'; countSql += ' AND batch_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND pb.batch_date <= ?'; countSql += ' AND batch_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY pb.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const batches = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: batches, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/batches/:id', authenticate, async (req, res) => {
    try {
        const batch = queryOne(`
            SELECT pb.*, f.name as formula_name, f.code as formula_code, p.name as product_name, p.code as product_code,
                   g.name as godown_name, m.name as machine_name, u.name as created_by_name
            FROM production_batches pb
            LEFT JOIN formulas f ON pb.formula_id = f.id
            LEFT JOIN products p ON pb.product_id = p.id
            LEFT JOIN godowns g ON pb.godown_id = g.id
            LEFT JOIN machines m ON pb.machine_id = m.id
            LEFT JOIN users u ON pb.created_by = u.id
            WHERE pb.id = ? AND pb.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!batch) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found' } });
        }

        const consumption = query(`
            SELECT bc.*, rm.name as material_name, rm.code as material_code
            FROM batch_consumption bc
            LEFT JOIN raw_materials rm ON bc.raw_material_id = rm.id
            WHERE bc.batch_id = ?
        `, [req.params.id]);

        const quality = queryOne('SELECT * FROM batch_quality WHERE batch_id = ?', [req.params.id]);

        res.json({ success: true, data: { ...batch, consumption, quality } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/batches', authenticate, requirePermission('production', 'add'), async (req, res) => {
    try {
        const { formula_id, product_id, factory_id, godown_id, batch_date, planned_qty, machine_id, shift, notes } = req.body;

        const batchNumber = formatSequence('BATCH', getNextSequence('BATCH', req.tenantId));
        const batchId = uuidv4();

        run(`INSERT INTO production_batches (id, tenant_id, batch_number, formula_id, product_id, factory_id, godown_id, batch_date, planned_qty, machine_id, shift, status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)`,
            [batchId, req.tenantId, batchNumber, formula_id, product_id, factory_id || req.factoryId, godown_id, batch_date, planned_qty, machine_id, shift, notes, req.user.id]);

        if (formula_id) {
            const ingredients = query('SELECT * FROM formula_ingredients WHERE formula_id = ?', [formula_id]);
            ingredients.forEach(ing => {
                const expectedQty = (ing.percentage / 100) * planned_qty;
                run(`INSERT INTO batch_consumption (id, batch_id, raw_material_id, formula_qty, godown_id)
                     VALUES (?, ?, ?, ?, ?)`,
                    [uuidv4(), batchId, ing.raw_material_id, expectedQty, godown_id]);
            });
        }

        logActivity(req.tenantId, req.user.id, 'production', 'batch_created', batchId, null, { batch_number: batchNumber }, req);

        res.json({ success: true, data: { id: batchId, batch_number: batchNumber }, message: 'Production batch created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/batches/:id/start', authenticate, requirePermission('production', 'edit'), async (req, res) => {
    try {
        run(`UPDATE production_batches SET status = 'in_progress', started_at = ? WHERE id = ? AND status = 'planned'`,
            [new Date().toISOString(), req.params.id]);

        logActivity(req.tenantId, req.user.id, 'production', 'batch_started', req.params.id, null, { status: 'in_progress' }, req);

        res.json({ success: true, message: 'Batch production started' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/batches/:id/complete', authenticate, requirePermission('production', 'edit'), async (req, res) => {
    try {
        const { actual_qty, loss_percentage, consumption, quality, notes } = req.body;

        const batch = queryOne('SELECT * FROM production_batches WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!batch) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found' } });
        }

        const loss = loss_percentage || ((batch.planned_qty - actual_qty) / batch.planned_qty) * 100;
        const lossQty = batch.planned_qty - actual_qty;

        run(`UPDATE production_batches SET status = 'completed', actual_qty = ?, loss_percentage = ?, loss_qty = ?, completed_at = ?, notes = ?
             WHERE id = ?`,
            [actual_qty, loss, lossQty, new Date().toISOString(), notes, req.params.id]);

        if (consumption && consumption.length > 0) {
            const itemKeys = consumption.map(c => `('raw_material', '${c.raw_material_id}', '${c.godown_id}')`).join(',');
            const stockBalances = itemKeys ? query(`
                SELECT item_id, godown_id, balance_qty, balance_amount FROM (
                    SELECT item_id, godown_id, balance_qty, balance_amount,
                           ROW_NUMBER() OVER (PARTITION BY item_id, godown_id ORDER BY created_at DESC) as rn
                    FROM stock_ledger
                    WHERE tenant_id = ? AND item_type = 'raw_material'
                ) ranked
                WHERE rn = 1
            `, [req.tenantId]) : [];
            const balanceMap = new Map();
            stockBalances.forEach(b => balanceMap.set(`${b.item_id}|${b.godown_id}`, b));

            run('DELETE FROM batch_consumption WHERE batch_id = ?', [req.params.id]);
            consumption.forEach(c => {
                run(`INSERT INTO batch_consumption (id, batch_id, raw_material_id, formula_qty, actual_qty, variance, godown_id, batch_number)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), req.params.id, c.raw_material_id, c.formula_qty, c.actual_qty, c.actual_qty - c.formula_qty, c.godown_id, c.batch_number]);

                const prevBalance = balanceMap.get(`${c.raw_material_id}|${c.godown_id}`);

                const avgRate = (prevBalance?.balance_qty && prevBalance.balance_qty > 0)
                    ? prevBalance.balance_amount / prevBalance.balance_qty
                    : 0;
                const newBalanceQty = (prevBalance?.balance_qty || 0) - c.actual_qty;
                const newBalanceAmt = (prevBalance?.balance_amount || 0) - (c.actual_qty * avgRate);
                const rate = avgRate;

                const ledgerId = uuidv4();
                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, created_by)
                     VALUES (?, ?, 'raw_material', ?, ?, 'production', 'batch', ?, ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, c.raw_material_id, c.godown_id, req.params.id, -c.actual_qty, rate, -c.actual_qty * rate, newBalanceQty, newBalanceAmt, req.user.id]);
            });
        }

        const productGodown = queryOne('SELECT id FROM godowns WHERE factory_id = ? AND type = ? LIMIT 1',
            [batch.factory_id, 'finished_goods']);
        if (productGodown && actual_qty > 0) {
            const productRate = queryOne('SELECT opening_rate FROM products WHERE id = ? AND tenant_id = ?', [batch.product_id, req.tenantId]);

            const prevBalance = queryOne(`
                SELECT balance_qty, balance_amount FROM stock_ledger
                WHERE tenant_id = ? AND item_type = 'product' AND item_id = ? AND godown_id = ?
                ORDER BY created_at DESC LIMIT 1
            `, [req.tenantId, batch.product_id, productGodown.id]);

            const newBalanceQty = (prevBalance?.balance_qty || 0) + actual_qty;
            const newBalanceAmt = (prevBalance?.balance_amount || 0) + (actual_qty * (productRate?.opening_rate || 0));
            const rate = productRate?.opening_rate || 0;

            const ledgerId = uuidv4();
            run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_type, reference_id, quantity, rate, amount, balance_qty, balance_amount, created_by)
                 VALUES (?, ?, 'product', ?, ?, ?, 'production', 'batch', ?, ?, ?, ?, ?, ?, ?)`,
                [ledgerId, req.tenantId, batch.product_id, batch.batch_number, productGodown.id, req.params.id,
                 actual_qty, rate, actual_qty * rate, newBalanceQty, newBalanceAmt, req.user.id]);
        }

        if (quality) {
            const qcId = uuidv4();
            run(`INSERT INTO batch_quality (id, batch_id, test_date, protein, moisture, fiber, fat, ash, energy, status, remarks, tested_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [qcId, req.params.id, new Date().toISOString(), quality.protein, quality.moisture, quality.fiber, quality.fat, quality.ash, quality.energy, 'pending', quality.remarks, req.user.id]);
        }

        logActivity(req.tenantId, req.user.id, 'production', 'batch_completed', req.params.id, null, { status: 'completed', actual_qty }, req);

        res.json({ success: true, message: 'Batch production completed' });
    } catch (error) {
        console.error('Batch complete error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/batches/:id/cancel', authenticate, requirePermission('production', 'delete'), async (req, res) => {
    try {
        run(`UPDATE production_batches SET status = 'cancelled' WHERE id = ? AND status IN ('planned', 'in_progress')`,
            [req.params.id]);

        logActivity(req.tenantId, req.user.id, 'production', 'batch_cancelled', req.params.id, null, { status: 'cancelled' }, req);

        res.json({ success: true, message: 'Batch cancelled' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Machines
router.get('/machines', authenticate, async (req, res) => {
    try {
        const machines = query(
            'SELECT m.*, f.name as factory_name FROM machines m LEFT JOIN factories f ON m.factory_id = f.id WHERE m.tenant_id = ? AND m.is_active = 1 ORDER BY m.name',
            [req.tenantId]
        );
        res.json({ success: true, data: machines });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/machines', authenticate, requirePermission('production', 'add'), async (req, res) => {
    try {
        const { code, name, type, brand, model, capacity, unit, factory_id } = req.body;
        const id = uuidv4();

        run(`INSERT INTO machines (id, tenant_id, factory_id, code, name, type, brand, model, capacity, unit, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
            [id, req.tenantId, factory_id || req.factoryId, code, name, type, brand, model, capacity, unit]);

        res.json({ success: true, data: { id }, message: 'Machine created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/machines/:id', authenticate, requirePermission('production', 'edit'), async (req, res) => {
    try {
        const { name, type, brand, model, capacity, unit, factory_id, status, last_maintenance, next_maintenance, is_active } = req.body;
        
        const existing = queryOne('SELECT * FROM machines WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Machine not found' } });
        }

        run(`UPDATE machines SET name = ?, type = ?, brand = ?, model = ?, capacity = ?, unit = ?, factory_id = ?, status = ?, last_maintenance = ?, next_maintenance = ?, is_active = ?
             WHERE id = ? AND tenant_id = ?`,
            [name, type, brand, model, capacity, unit, factory_id || req.factoryId, status || existing.status, 
             last_maintenance, next_maintenance, is_active ?? 1, req.params.id, req.tenantId]);

        res.json({ success: true, message: 'Machine updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/machines/:id', authenticate, requirePermission('production', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM machines WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Machine not found' } });
        }

        const inUse = queryOne('SELECT id FROM production_batches WHERE machine_id = ? AND tenant_id = ? AND status IN (?)', 
            [req.params.id, req.tenantId, 'in_progress,planned']);
        if (inUse) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Machine has active batches' } });
        }

        run('UPDATE machines SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        res.json({ success: true, message: 'Machine deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete machine' } });
    }
});

module.exports = router;
