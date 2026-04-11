const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/generate', authenticate, async (req, res) => {
    try {
        const { item_type, item_id, batch_number, quantity, godown_id } = req.query;

        if (!item_type || !item_id) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'item_type and item_id are required' } });
        }

        const codes = [];
        const qty = parseInt(quantity) || 1;

        for (let i = 0; i < qty; i++) {
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const barcodeValue = `${item_type.substring(0, 2).toUpperCase()}${item_id.substring(0, 6).toUpperCase()}${timestamp}${String(i + 1).padStart(4, '0')}`;
            
            const qrData = JSON.stringify({
                type: item_type,
                id: item_id,
                batch: batch_number,
                code: barcodeValue
            });

            const barcodeId = uuidv4();
            run(`INSERT INTO barcodes (id, tenant_id, barcode, qr_code, item_type, item_id, batch_number, godown_id, manufactured_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [barcodeId, req.tenantId, barcodeValue, qrData, item_type, item_id, batch_number, godown_id, new Date().toISOString().slice(0, 10)]);

            codes.push({
                id: barcodeId,
                barcode: barcodeValue,
                qr_data: qrData,
                item_type,
                item_id,
                batch_number
            });
        }

        res.json({ success: true, data: codes });
    } catch (error) {
        console.error('Barcode generation error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/scan', authenticate, async (req, res) => {
    try {
        const { barcode, qr_data } = req.body;

        let lookupCode = barcode;

        if (qr_data) {
            try {
                const parsed = JSON.parse(qr_data);
                lookupCode = parsed.code || barcode;
            } catch (e) {
                lookupCode = qr_data;
            }
        }

        const barcodeRecord = queryOne('SELECT * FROM barcodes WHERE barcode = ? OR qr_code = ?', [lookupCode, lookupCode]);

        if (barcodeRecord) {
            let itemInfo = null;

            if (barcodeRecord.item_type === 'raw_material') {
                itemInfo = queryOne('SELECT * FROM raw_materials WHERE id = ?', [barcodeRecord.item_id]);
            } else if (barcodeRecord.item_type === 'product') {
                itemInfo = queryOne('SELECT * FROM products WHERE id = ?', [barcodeRecord.item_id]);
            } else if (barcodeRecord.item_type === 'batch') {
                itemInfo = queryOne('SELECT pb.*, f.name as formula_name, p.name as product_name FROM production_batches pb LEFT JOIN formulas f ON pb.formula_id = f.id LEFT JOIN products p ON pb.product_id = p.id WHERE pb.batch_number = ?', [barcodeRecord.batch_number]);
            }

            const stock = queryOne(`
                SELECT SUM(quantity) as qty, godown_id FROM stock_ledger
                WHERE item_type = ? AND item_id = ? AND batch_number = ?
                GROUP BY godown_id
            `, [barcodeRecord.item_type, barcodeRecord.item_id, barcodeRecord.batch_number]);

            res.json({
                success: true,
                data: {
                    barcode: barcodeRecord,
                    item: itemInfo,
                    current_stock: stock?.qty || 0,
                    godown_id: stock?.godown_id
                }
            });
        } else {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Barcode not found in system' } });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/:barcode/info', authenticate, async (req, res) => {
    try {
        const barcodeRecord = queryOne('SELECT * FROM barcodes WHERE barcode = ?', [req.params.barcode]);

        if (!barcodeRecord) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Barcode not found' } });
        }

        let itemInfo = null;
        if (barcodeRecord.item_type === 'raw_material') {
            itemInfo = queryOne('SELECT name, code FROM raw_materials WHERE id = ?', [barcodeRecord.item_id]);
        } else if (barcodeRecord.item_type === 'product') {
            itemInfo = queryOne('SELECT name, code FROM products WHERE id = ?', [barcodeRecord.item_id]);
        }

        res.json({ success: true, data: { ...barcodeRecord, item: itemInfo } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
