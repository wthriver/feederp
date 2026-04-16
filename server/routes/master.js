const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, schemas } = require('../middleware/validate');

// Units
router.get('/units', authenticate, async (req, res) => {
    try {
        const units = query(
            'SELECT * FROM units WHERE tenant_id = ? AND is_active = 1 ORDER BY name',
            [req.tenantId]
        );

        res.json({ success: true, data: units });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/units', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { code, name, type, decimal_places } = req.body;
        const id = uuidv4();

        run(`INSERT INTO units (id, tenant_id, code, name, type, decimal_places, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [id, req.tenantId, code, name, type || 'general', decimal_places || 2]);

        logActivity(req.tenantId, req.user.id, 'master', 'unit_created', id, null, { code, name }, req);

        res.json({ success: true, data: { id }, message: 'Unit created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/units/:id', authenticate, requirePermission('master', 'edit'), async (req, res) => {
    try {
        const { code, name, type, decimal_places, is_active } = req.body;
        
        const existing = queryOne('SELECT id FROM units WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } });
        }

        run(`UPDATE units SET code = ?, name = ?, type = ?, decimal_places = ?, is_active = ? WHERE id = ? AND tenant_id = ?`,
            [code, name, type, decimal_places, is_active ?? 1, req.params.id, req.tenantId]);

        res.json({ success: true, message: 'Unit updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/units/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM units WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } });
        }

        const inUse = queryOne(`
            SELECT id FROM raw_materials WHERE unit_id = ? AND tenant_id = ? 
            UNION SELECT id FROM products WHERE unit_id = ? AND tenant_id = ?
        `, [req.params.id, req.tenantId, req.params.id, req.tenantId]);
        
        if (inUse) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Unit is in use by materials or products' } });
        }

        run('UPDATE units SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        res.json({ success: true, message: 'Unit deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Factories
router.get('/factories', authenticate, async (req, res) => {
    try {
        const factories = query(
            'SELECT * FROM factories WHERE tenant_id = ? AND is_active = 1 ORDER BY name',
            [req.tenantId]
        );

        res.json({ success: true, data: factories });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/factories/:id', authenticate, async (req, res) => {
    try {
        const factory = queryOne(
            'SELECT * FROM factories WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );

        if (!factory) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Factory not found' } });
        }

        res.json({ success: true, data: factory });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/factories', authenticate, requirePermission('master', 'add'), validate(schemas.factory), async (req, res) => {
    try {
        const { name, code, address, phone, email } = req.body;
        const id = uuidv4();

        run(`INSERT INTO factories (id, tenant_id, name, code, address, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, code, address, phone, email]);

        logActivity(req.tenantId, req.user.id, 'master', 'factory_created', id, null, { name, code }, req);

        res.json({ success: true, data: { id }, message: 'Factory created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/factories/:id', authenticate, requirePermission('master', 'edit'), validate(schemas.factory), async (req, res) => {
    try {
        const { name, code, address, phone, email, is_active } = req.body;
        const old = queryOne('SELECT * FROM factories WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!old) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Factory not found' } });
        }

        run(`UPDATE factories SET name = ?, code = ?, address = ?, phone = ?, email = ?, is_active = ? WHERE id = ? AND tenant_id = ?`,
            [name, code, address, phone, email, is_active ?? 1, req.params.id, req.tenantId]);

        logActivity(req.tenantId, req.user.id, 'master', 'factory_updated', req.params.id, old, req.body, req);

        res.json({ success: true, message: 'Factory updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/factories/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const old = queryOne('SELECT * FROM factories WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!old) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Factory not found' } });
        }

        const hasGodowns = queryOne('SELECT id FROM godowns WHERE factory_id = ? AND is_active = 1', [req.params.id]);
        if (hasGodowns) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Cannot delete factory with active godowns' } });
        }

        run('UPDATE factories SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        logActivity(req.tenantId, req.user.id, 'master', 'factory_deleted', req.params.id, old, null, req);
        res.json({ success: true, message: 'Factory deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Godowns
router.get('/godowns', authenticate, async (req, res) => {
    try {
        const factoryId = req.query.factory_id || req.factoryId;

        let sql = `SELECT g.*, f.name as factory_name FROM godowns g
                   LEFT JOIN factories f ON g.factory_id = f.id
                   WHERE g.factory_id = ? AND g.is_active = 1 ORDER BY g.name`;
        const params = [factoryId];

        if (req.query.all === 'true') {
            sql = `SELECT g.*, f.name as factory_name FROM godowns g
                   LEFT JOIN factories f ON g.factory_id = f.id
                   WHERE g.is_active = 1 ORDER BY f.name, g.name`;
            params.length = 0;
        }

        const godowns = query(sql, params);

        res.json({ success: true, data: godowns });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/godowns', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { name, code, type, location, factory_id } = req.body;
        const id = uuidv4();

        run(`INSERT INTO godowns (id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, factory_id || req.factoryId, name, code, type || 'general', location]);

        logActivity(req.tenantId, req.user.id, 'master', 'godown_created', id, null, { name, code }, req);

        res.json({ success: true, data: { id }, message: 'Godown created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/godowns/:id', authenticate, requirePermission('master', 'edit'), async (req, res) => {
    try {
        const { name, code, type, location, is_active } = req.body;

        const existing = queryOne('SELECT id FROM godowns WHERE id = ? AND factory_id IN (SELECT id FROM factories WHERE tenant_id = ?)', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Godown not found' } });
        }

        run(`UPDATE godowns SET name = ?, code = ?, type = ?, location = ?, is_active = ? WHERE id = ?`,
            [name, code, type, location, is_active ?? 1, req.params.id]);

        logActivity(req.tenantId, req.user.id, 'master', 'godown_updated', req.params.id, null, req.body, req);

        res.json({ success: true, message: 'Godown updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/godowns/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM godowns WHERE id = ? AND factory_id IN (SELECT id FROM factories WHERE tenant_id = ?)', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Godown not found' } });
        }
        run('UPDATE godowns SET is_active = 0 WHERE id = ?', [req.params.id]);
        logActivity(req.tenantId, req.user.id, 'master', 'godown_deleted', req.params.id, null, null, req);
        res.json({ success: true, message: 'Godown deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Raw Materials
router.get('/raw-materials', authenticate, async (req, res) => {
    try {
        const { search, category, page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT rm.*, u.name as unit_name FROM raw_materials rm
                   LEFT JOIN units u ON rm.unit_id = u.id
                   WHERE rm.tenant_id = ? AND rm.is_active = 1`;
        let countSql = 'SELECT COUNT(*) as total FROM raw_materials WHERE tenant_id = ? AND is_active = 1';
        const params = [req.tenantId];

        if (search) {
            sql += ' AND (rm.name LIKE ? OR rm.code LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            sql += ' AND rm.category = ?';
            countSql += ' AND category = ?';
            params.push(category);
        }

        sql += ` ORDER BY rm.name LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const materials = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: materials,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/raw-materials/:id', authenticate, async (req, res) => {
    try {
        const material = queryOne(`
            SELECT rm.*, u.name as unit_name FROM raw_materials rm
            LEFT JOIN units u ON rm.unit_id = u.id
            WHERE rm.id = ? AND rm.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!material) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } });
        }

        res.json({ success: true, data: material });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/raw-materials', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { code, name, name_bn, category, unit_id, hsn_code, min_stock, max_stock, opening_stock, opening_rate } = req.body;
        const id = uuidv4();

        run(`INSERT INTO raw_materials (id, tenant_id, code, name, name_bn, category, unit_id, hsn_code, min_stock, max_stock, opening_stock, opening_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, code, name, name_bn, category, unit_id, hsn_code, min_stock || 0, max_stock, opening_stock || 0, opening_rate || 0]);

        if (opening_stock > 0) {
            const godown = queryOne('SELECT id FROM godowns WHERE factory_id = ? AND type = ? LIMIT 1',
                [req.factoryId, 'raw_material']);
            if (godown) {
                const ledgerId = uuidv4();
                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, godown_id, transaction_type, quantity, rate, amount, balance_qty, balance_amount, created_by)
                     VALUES (?, ?, 'raw_material', ?, ?, 'opening', ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, id, godown.id, opening_stock, opening_rate, opening_stock * opening_rate, opening_stock, opening_stock * opening_rate, req.user.id]);
            }
        }

        logActivity(req.tenantId, req.user.id, 'master', 'raw_material_created', id, null, { code, name }, req);

        res.json({ success: true, data: { id }, message: 'Raw material created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/raw-materials/:id', authenticate, requirePermission('master', 'edit'), async (req, res) => {
    try {
        const old = queryOne('SELECT * FROM raw_materials WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!old) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } });
        }
        const { code, name, name_bn, category, unit_id, hsn_code, min_stock, max_stock, is_active } = req.body;

        run(`UPDATE raw_materials SET code = ?, name = ?, name_bn = ?, category = ?, unit_id = ?, hsn_code = ?, min_stock = ?, max_stock = ?, is_active = ?
             WHERE id = ? AND tenant_id = ?`,
            [code, name, name_bn, category, unit_id, hsn_code, min_stock, max_stock, is_active ?? 1, req.params.id, req.tenantId]);

        logActivity(req.tenantId, req.user.id, 'master', 'raw_material_updated', req.params.id, old, req.body, req);

        res.json({ success: true, message: 'Raw material updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/raw-materials/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM raw_materials WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } });
        }
        run('UPDATE raw_materials SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        logActivity(req.tenantId, req.user.id, 'master', 'raw_material_deleted', req.params.id, null, null, req);
        res.json({ success: true, message: 'Raw material deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Products
router.get('/products', authenticate, async (req, res) => {
    try {
        const { search, type, page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT p.*, u.name as unit_name FROM products p
                   LEFT JOIN units u ON p.unit_id = u.id
                   WHERE p.tenant_id = ? AND p.is_active = 1`;
        let countSql = 'SELECT COUNT(*) as total FROM products WHERE tenant_id = ? AND is_active = 1';
        const params = [req.tenantId];

        if (search) {
            sql += ' AND (p.name LIKE ? OR p.code LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (type) {
            sql += ' AND p.type = ?';
            countSql += ' AND type = ?';
            params.push(type);
        }

        sql += ` ORDER BY p.name LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const products = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: products,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/products/:id', authenticate, async (req, res) => {
    try {
        const product = queryOne(`
            SELECT p.*, u.name as unit_name FROM products p
            LEFT JOIN units u ON p.unit_id = u.id
            WHERE p.id = ? AND p.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!product) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
        }

        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/products', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { code, name, name_bn, type, category, pack_size, unit_id, mrp, min_stock, opening_stock, opening_rate } = req.body;
        const id = uuidv4();

        run(`INSERT INTO products (id, tenant_id, code, name, name_bn, type, category, pack_size, unit_id, mrp, min_stock, opening_stock, opening_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, code, name, name_bn, type, category, pack_size || 50, unit_id, mrp, min_stock || 0, opening_stock || 0, opening_rate || 0]);

        if (opening_stock > 0) {
            const godown = queryOne('SELECT id FROM godowns WHERE factory_id = ? AND type = ? LIMIT 1',
                [req.factoryId, 'finished_goods']);
            if (godown) {
                const ledgerId = uuidv4();
                run(`INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, godown_id, transaction_type, quantity, rate, amount, balance_qty, balance_amount, created_by)
                     VALUES (?, ?, 'product', ?, ?, 'opening', ?, ?, ?, ?, ?, ?)`,
                    [ledgerId, req.tenantId, id, godown.id, opening_stock, opening_rate, opening_stock * opening_rate, opening_stock, opening_stock * opening_rate, req.user.id]);
            }
        }

        logActivity(req.tenantId, req.user.id, 'master', 'product_created', id, null, { code, name }, req);

        res.json({ success: true, data: { id }, message: 'Product created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/products/:id', authenticate, requirePermission('master', 'edit'), async (req, res) => {
    try {
        const old = queryOne('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!old) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
        }
        const { code, name, name_bn, type, category, pack_size, unit_id, mrp, min_stock, is_active } = req.body;

        run(`UPDATE products SET code = ?, name = ?, name_bn = ?, type = ?, category = ?, pack_size = ?, unit_id = ?, mrp = ?, min_stock = ?, is_active = ?
             WHERE id = ? AND tenant_id = ?`,
            [code, name, name_bn, type, category, pack_size, unit_id, mrp, min_stock, is_active ?? 1, req.params.id, req.tenantId]);

        logActivity(req.tenantId, req.user.id, 'master', 'product_updated', req.params.id, old, req.body, req);

        res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/products/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM products WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
        }
        run('UPDATE products SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        logActivity(req.tenantId, req.user.id, 'master', 'product_deleted', req.params.id, null, null, req);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Routes
router.get('/routes', authenticate, async (req, res) => {
    try {
        const routes = query(
            'SELECT * FROM routes WHERE tenant_id = ? AND is_active = 1 ORDER BY name',
            [req.tenantId]
        );
        res.json({ success: true, data: routes });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/routes', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { name, name_bn, description, factory_id } = req.body;
        const id = uuidv4();

        run(`INSERT INTO routes (id, tenant_id, factory_id, name, name_bn, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, factory_id || req.factoryId, name, name_bn, description]);

        logActivity(req.tenantId, req.user.id, 'master', 'route_created', id, null, { name }, req);

        res.json({ success: true, data: { id }, message: 'Route created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/routes/:id', authenticate, requirePermission('master', 'edit'), async (req, res) => {
    try {
        const { name, name_bn, description, factory_id, is_active } = req.body;
        
        const existing = queryOne('SELECT id FROM routes WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
        }

        run(`UPDATE routes SET name = ?, name_bn = ?, description = ?, factory_id = ?, is_active = ? WHERE id = ? AND tenant_id = ?`,
            [name, name_bn, description, factory_id, is_active ?? 1, req.params.id, req.tenantId]);

        res.json({ success: true, message: 'Route updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/routes/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM routes WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
        }

        const inUse = queryOne('SELECT id FROM customers WHERE route_id = ? AND tenant_id = ? AND is_active = 1', [req.params.id, req.tenantId]);
        if (inUse) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Route is assigned to customers' } });
        }

        run('UPDATE routes SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        res.json({ success: true, message: 'Route deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Suppliers (mirror of /purchase/suppliers for consistency)
router.get('/suppliers', authenticate, async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM suppliers WHERE tenant_id = ? AND is_active = 1';
        let countSql = 'SELECT COUNT(*) as total FROM suppliers WHERE tenant_id = ? AND is_active = 1';
        let params = [req.tenantId];

        if (search) {
            sql += ' AND (name LIKE ? OR code LIKE ? OR mobile LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ? OR mobile LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY name LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const suppliers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: suppliers,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/suppliers/:id', authenticate, async (req, res) => {
    try {
        const supplier = queryOne(
            'SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );

        if (!supplier) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
        }

        res.json({ success: true, data: supplier });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/suppliers', authenticate, requirePermission('master', 'add'), validate(schemas.supplier), async (req, res) => {
    try {
        const { code, name, name_bn, contact_person, phone, mobile, email, address, city, state, gstin, pan, credit_limit, payment_terms, is_active } = req.body;
        const id = uuidv4();

        run(`INSERT INTO suppliers (id, tenant_id, code, name, name_bn, contact_person, phone, mobile, email, address, city, state, gstin, pan, credit_limit, payment_terms, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, code, name, name_bn, contact_person, phone, mobile, email, address, city, state, gstin, pan, credit_limit || 0, payment_terms || 'NET30', is_active !== false ? 1 : 0]);

        logActivity(req.tenantId, req.user.id, 'master', 'supplier_created', id, null, { name, code }, req);

        res.json({ success: true, data: { id }, message: 'Supplier created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/suppliers/:id', authenticate, requirePermission('master', 'edit'), validate(schemas.supplier), async (req, res) => {
    try {
        const { name, name_bn, contact_person, phone, mobile, email, address, city, state, gstin, pan, credit_limit, payment_terms, is_active } = req.body;

        const existing = queryOne('SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
        }

        run(`UPDATE suppliers SET name = ?, name_bn = ?, contact_person = ?, phone = ?, mobile = ?, email = ?, address = ?, city = ?, state = ?, gstin = ?, pan = ?, credit_limit = ?, payment_terms = ?, is_active = ?, updated_at = ? WHERE id = ?`,
            [name, name_bn, contact_person, phone, mobile, email, address, city, state, gstin, pan, credit_limit, payment_terms, is_active !== false ? 1 : 0, new Date().toISOString(), req.params.id]);

        logActivity(req.tenantId, req.user.id, 'master', 'supplier_updated', req.params.id, null, { name }, req);

        res.json({ success: true, message: 'Supplier updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/suppliers/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
        }

        run('UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), req.params.id]);

        logActivity(req.tenantId, req.user.id, 'master', 'supplier_deleted', req.params.id, null, {}, req);

        res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Customers (mirror of /sales/customers for consistency)
router.get('/customers', authenticate, async (req, res) => {
    try {
        const { search, type, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM customers WHERE tenant_id = ? AND is_active = 1';
        let countSql = 'SELECT COUNT(*) as total FROM customers WHERE tenant_id = ? AND is_active = 1';
        let params = [req.tenantId];

        if (search) {
            sql += ' AND (name LIKE ? OR code LIKE ? OR mobile LIKE ? OR phone LIKE ?)';
            countSql += ' AND (name LIKE ? OR code LIKE ? OR mobile LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (type) {
            sql += ' AND type = ?';
            countSql += ' AND type = ?';
            params.push(type);
        }

        sql += ' ORDER BY name LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const customers = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({
            success: true,
            data: customers,
            meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/customers/:id', authenticate, async (req, res) => {
    try {
        const customer = queryOne(
            'SELECT * FROM customers WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );

        if (!customer) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        }

        res.json({ success: true, data: customer });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/customers', authenticate, requirePermission('master', 'add'), validate(schemas.customer), async (req, res) => {
    try {
        const { code, name, name_bn, type, contact_person, phone, mobile, email, address, city, state, gstin, credit_limit, price_list, is_active } = req.body;
        const id = uuidv4();

        run(`INSERT INTO customers (id, tenant_id, code, name, name_bn, type, contact_person, phone, mobile, email, address, city, state, gstin, credit_limit, price_list, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, code, name, name_bn, type || 'retail', contact_person, phone, mobile, email, address, city, state, gstin, credit_limit || 0, price_list || 'standard', is_active !== false ? 1 : 0]);

        logActivity(req.tenantId, req.user.id, 'master', 'customer_created', id, null, { name, code }, req);

        res.json({ success: true, data: { id }, message: 'Customer created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/customers/:id', authenticate, requirePermission('master', 'edit'), validate(schemas.customer), async (req, res) => {
    try {
        const { name, name_bn, type, contact_person, phone, mobile, email, address, city, state, gstin, credit_limit, price_list, is_active } = req.body;

        const existing = queryOne('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        }

        run(`UPDATE customers SET name = ?, name_bn = ?, type = ?, contact_person = ?, phone = ?, mobile = ?, email = ?, address = ?, city = ?, state = ?, gstin = ?, credit_limit = ?, price_list = ?, is_active = ?, updated_at = ? WHERE id = ?`,
            [name, name_bn, type, contact_person, phone, mobile, email, address, city, state, gstin, credit_limit, price_list, is_active !== false ? 1 : 0, new Date().toISOString(), req.params.id]);

        logActivity(req.tenantId, req.user.id, 'master', 'customer_updated', req.params.id, null, { name }, req);

        res.json({ success: true, message: 'Customer updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/customers/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        }

        run('UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), req.params.id]);

        logActivity(req.tenantId, req.user.id, 'master', 'customer_deleted', req.params.id, null, {}, req);

        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Settings
router.get('/settings', authenticate, async (req, res) => {
    try {
        const settings = {};
        query('SELECT key, value FROM settings WHERE tenant_id = ?', [req.tenantId])
            .forEach(s => { settings[s.key] = s.value; });
        
        // Add defaults if not exist
        if (!settings.currency) settings.currency = 'INR';
        if (!settings.tax_rate) settings.tax_rate = '5';
        if (!settings.date_format) settings.date_format = 'DD/MM/YYYY';
        
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Settings error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/settings', authenticate, requirePermission('admin', 'edit'), async (req, res) => {
    try {
        const { key, value } = req.body;

        const existing = queryOne('SELECT id FROM settings WHERE tenant_id = ? AND key = ?', [req.tenantId, key]);
        
        if (existing) {
            run('UPDATE settings SET value = ?, updated_at = ? WHERE tenant_id = ? AND key = ?',
                [value, new Date().toISOString(), req.tenantId, key]);
        } else {
            run('INSERT INTO settings (id, tenant_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), req.tenantId, key, value, new Date().toISOString()]);
        }

        res.json({ success: true, message: 'Setting updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Price Lists
router.get('/price-lists', authenticate, async (req, res) => {
    try {
        const lists = query('SELECT * FROM price_lists WHERE tenant_id = ? AND is_active = 1 ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: lists });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/price-lists', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { name, code, currency, valid_from, valid_to, is_default } = req.body;
        const id = uuidv4();

        if (is_default) {
            run('UPDATE price_lists SET is_default = 0 WHERE tenant_id = ?', [req.tenantId]);
        }

        run(`INSERT INTO price_lists (id, tenant_id, name, code, currency, is_default, valid_from, valid_to, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, code, currency || 'INR', is_default ? 1 : 0, valid_from, valid_to, req.user.id]);

        res.json({ success: true, data: { id }, message: 'Price list created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/price-lists/:id/items', authenticate, async (req, res) => {
    try {
        // Verify price list belongs to this tenant
        const priceList = queryOne('SELECT id FROM price_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!priceList) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Price list not found' } });
        }

        const items = query(`
            SELECT pli.*, rm.name as material_name, p.name as product_name
            FROM price_list_items pli
            LEFT JOIN raw_materials rm ON pli.item_type = 'raw_material' AND pli.item_id = rm.id AND rm.tenant_id = ?
            LEFT JOIN products p ON pli.item_type = 'product' AND pli.item_id = p.id AND p.tenant_id = ?
            WHERE pli.price_list_id = ?
        `, [req.tenantId, req.tenantId, req.params.id]);
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/price-lists/:id/items', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        // Verify price list belongs to this tenant
        const priceList = queryOne('SELECT id FROM price_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!priceList) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Price list not found' } });
        }

        const { items } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No items' } });
        }

        items.forEach(item => {
            run(`INSERT INTO price_list_items (id, price_list_id, item_type, item_id, rate, discount_percent, unit_id, valid_from, valid_to)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), req.params.id, item.item_type, item.item_id, item.rate, item.discount_percent || 0, item.unit_id, item.valid_from, item.valid_to]);
        });

        res.json({ success: true, message: 'Price items added' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/price-lists/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        run('UPDATE price_lists SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Price list deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Discount Rules
router.get('/discount-rules', authenticate, async (req, res) => {
    try {
        const rules = query('SELECT * FROM discount_rules WHERE tenant_id = ? AND is_active = 1 ORDER BY priority DESC', [req.tenantId]);
        res.json({ success: true, data: rules });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/discount-rules', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { name, item_type, item_id, customer_type, min_qty, max_qty, discount_percent, discount_amount, priority, valid_from, valid_to } = req.body;
        const id = uuidv4();
        const fields = 'id, tenant_id, name, item_type, item_id, customer_type, min_qty, max_qty, discount_percent, discount_amount, priority, valid_from, valid_to, is_active';
        const values = [id, req.tenantId, name, item_type, item_id, customer_type, min_qty, max_qty, discount_percent || 0, discount_amount || 0, priority || 0, valid_from, valid_to, 1];
        run(`INSERT INTO discount_rules (${fields}) VALUES (${fields.split(', ').map(() => '?').join(', ')})`, values);

        res.json({ success: true, data: { id }, message: 'Discount rule created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/discount-rules/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        run('UPDATE discount_rules SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Discount rule deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Credit/Debit Notes
router.get('/credit-notes', authenticate, async (req, res) => {
    try {
        const { note_type, status, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT cn.*, c.name as customer_name FROM credit_notes cn
                  LEFT JOIN customers c ON cn.customer_id = c.id
                  WHERE cn.tenant_id = ?`;
        const params = [req.tenantId];

        if (note_type) { sql += ' AND cn.note_type = ?'; params.push(note_type); }
        if (status) { sql += ' AND cn.status = ?'; params.push(status); }

        sql += ` ORDER BY cn.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const notes = query(sql, params);
        const { total } = queryOne('SELECT COUNT(*) as total FROM credit_notes WHERE tenant_id = ?', [req.tenantId]);

        res.json({ success: true, data: notes, meta: { page: parseInt(page), limit: parseInt(limit), total } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/credit-notes', authenticate, requirePermission('finance', 'add'), async (req, res) => {
    try {
        const { note_type, reference_id, customer_id, invoice_id, amount, reason, invoice_number, reference_type } = req.body;
        
        if (!customer_id || !amount) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Customer and amount required' } });
        }

        const prefix = note_type === 'credit' ? 'CN' : 'DN';
        const noteNumber = formatSequence(prefix, getNextSequence(prefix, req.tenantId));
        const id = uuidv4();

        run(`INSERT INTO credit_notes (id, tenant_id, note_number, note_type, reference_type, reference_id, customer_id, invoice_id, amount, reason, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, noteNumber, note_type || 'credit', reference_type || 'invoice', reference_id || invoice_number || null, customer_id, invoice_id || invoice_number, amount, reason || null, req.user.id]);

        res.json({ success: true, data: { id, note_number: noteNumber }, message: 'Note created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/credit-notes/:id/approve', authenticate, requirePermission('finance', 'approve'), async (req, res) => {
    try {
        const note = queryOne('SELECT * FROM credit_notes WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!note) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } });
        }

        run('UPDATE credit_notes SET status = ? WHERE id = ? AND tenant_id = ?', ['approved', req.params.id, req.tenantId]);

        if (note.note_type === 'credit') {
            run('UPDATE customers SET outstanding = outstanding + ? WHERE id = ? AND tenant_id = ?', [note.amount, note.customer_id, req.tenantId]);
        } else {
            run('UPDATE customers SET outstanding = outstanding - ? WHERE id = ? AND tenant_id = ?', [note.amount, note.customer_id, req.tenantId]);
        }

        res.json({ success: true, message: 'Note approved' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Recurring Orders
router.get('/recurring-orders', authenticate, async (req, res) => {
    try {
        const orders = query(`
            SELECT ro.*, c.name as customer_name
            FROM recurring_orders ro
            LEFT JOIN customers c ON ro.customer_id = c.id
            WHERE ro.tenant_id = ? AND ro.is_active = 1
            ORDER BY ro.next_date
        `, [req.tenantId]);
        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/recurring-orders', authenticate, requirePermission('sales', 'add'), async (req, res) => {
    try {
        const { customer_id, order_type, items, frequency, next_date } = req.body;
        
        if (!customer_id || !items) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Customer and items required' } });
        }

        const refNumber = formatSequence('REC', getNextSequence('REC', req.tenantId));
        const id = uuidv4();

        run(`INSERT INTO recurring_orders (id, tenant_id, reference_number, customer_id, order_type, items, frequency, next_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, refNumber, customer_id, order_type, JSON.stringify(items), frequency, next_date, req.user.id]);

        res.json({ success: true, data: { id, reference_number: refNumber }, message: 'Recurring order created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/recurring-orders/:id', authenticate, requirePermission('sales', 'delete'), async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM recurring_orders WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recurring order not found' } });
        }
        run('UPDATE recurring_orders SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        res.json({ success: true, message: 'Recurring order deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Job Cards
router.get('/job-cards', authenticate, async (req, res) => {
    try {
        const { batch_id, status } = req.query;
        let sql = `SELECT jc.*, pb.batch_number FROM job_cards jc
                  LEFT JOIN production_batches pb ON jc.batch_id = pb.id
                  WHERE jc.tenant_id = ?`;
        const params = [req.tenantId];

        if (batch_id) { sql += ' AND jc.batch_id = ?'; params.push(batch_id); }
        if (status) { sql += ' AND jc.status = ?'; params.push(status); }

        sql += ' ORDER BY jc.created_at DESC';

        const cards = query(sql, params);
        res.json({ success: true, data: cards });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/job-cards', authenticate, requirePermission('production', 'add'), async (req, res) => {
    try {
        const { batch_id, operation_name, assigned_to } = req.body;
        
        if (!batch_id || !operation_name) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Batch and operation required' } });
        }

        const jobNumber = formatSequence('JOB', getNextSequence('JOB', req.tenantId));
        const id = uuidv4();

        run(`INSERT INTO job_cards (id, tenant_id, job_number, batch_id, operation_name, assigned_to, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [id, req.tenantId, jobNumber, batch_id, operation_name, assigned_to]);

        res.json({ success: true, data: { id, job_number: jobNumber }, message: 'Job card created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/job-cards/:id/start', authenticate, async (req, res) => {
    try {
        run('UPDATE job_cards SET start_time = ?, status = ? WHERE id = ?',
            [new Date().toISOString(), 'in_progress', req.params.id]);
        res.json({ success: true, message: 'Job started' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/job-cards/:id/complete', authenticate, async (req, res) => {
    try {
        const { notes } = req.body;
        run('UPDATE job_cards SET end_time = ?, status = ?, notes = ? WHERE id = ?',
            [new Date().toISOString(), 'completed', notes, req.params.id]);
        res.json({ success: true, message: 'Job completed' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Quality Checklists
router.get('/quality-checklists', authenticate, async (req, res) => {
    try {
        const checklists = query('SELECT * FROM quality_checklists WHERE tenant_id = ? AND is_active = 1', [req.tenantId]);
        checklists.forEach(c => c.items = c.items ? JSON.parse(c.items) : []);
        res.json({ success: true, data: checklists });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/quality-checklists', authenticate, requirePermission('quality', 'add'), async (req, res) => {
    try {
        const { name, checklist_type, items } = req.body;
        
        if (!name || !items) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and items required' } });
        }

        const id = uuidv4();

        run(`INSERT INTO quality_checklists (id, tenant_id, name, checklist_type, items)
             VALUES (?, ?, ?, ?, ?)`,
            [id, req.tenantId, name, checklist_type, JSON.stringify(items)]);

        res.json({ success: true, data: { id }, message: 'Checklist created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/quality-checklists/:id', authenticate, requirePermission('quality', 'delete'), async (req, res) => {
    try {
        run('UPDATE quality_checklists SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        res.json({ success: true, message: 'Checklist deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Currency Rates
router.get('/currencies', authenticate, async (req, res) => {
    try {
        const currencies = query('SELECT * FROM currency_rates WHERE tenant_id = ? AND is_active = 1', [req.tenantId]);
        res.json({ success: true, data: currencies });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/currencies', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { code, name, symbol, rate, is_base } = req.body;
        
        if (is_base) {
            run('UPDATE currency_rates SET is_base = 0 WHERE tenant_id = ?', [req.tenantId]);
        }

        run(`INSERT INTO currency_rates (id, tenant_id, code, name, symbol, rate, is_base)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.tenantId, code, name, symbol, rate || 1, is_base ? 1 : 0]);

        res.json({ success: true, message: 'Currency added' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

// Regions for distributed operations
router.get('/regions', authenticate, async (req, res) => {
    try {
        const regions = query('SELECT * FROM regions WHERE tenant_id = ? AND is_active = 1 ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: regions });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/regions', authenticate, requirePermission('master', 'add'), async (req, res) => {
    try {
        const { name, code, timezone, currency } = req.body;
        
        if (!name || !code) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and code required' } });
        }

        const existing = queryOne('SELECT id FROM regions WHERE tenant_id = ? AND code = ?', [req.tenantId, code]);
        if (existing) {
            return res.status(400).json({ success: false, error: { code: 'DUPLICATE', message: 'Region code already exists' } });
        }

        run(`INSERT INTO regions (id, tenant_id, name, code, timezone, currency)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.tenantId, name, code, timezone || 'Asia/Kolkata', currency || 'INR']);

        res.json({ success: true, message: 'Region created' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/regions/:id', authenticate, requirePermission('master', 'edit'), async (req, res) => {
    try {
        const { name, timezone, currency, is_active } = req.body;

        run(`UPDATE regions SET name = ?, timezone = ?, currency = ?, is_active = ?
             WHERE id = ? AND tenant_id = ?`,
            [name, timezone, currency, is_active ?? 1, req.params.id, req.tenantId]);

        res.json({ success: true, message: 'Region updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/regions/:id', authenticate, requirePermission('master', 'delete'), async (req, res) => {
    try {
        run('UPDATE regions SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Region deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
