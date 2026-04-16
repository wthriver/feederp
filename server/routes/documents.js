const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '10485760');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(path.join(UPLOAD_DIR, 'attachments'))) {
    fs.mkdirSync(path.join(UPLOAD_DIR, 'attachments'), { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subDir = req.body.entity_type || 'general';
        const targetDir = path.join(UPLOAD_DIR, 'attachments', subDir);
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv', 'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter
});

router.post('/upload', authenticate, requirePermission('documents', 'add'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_FILE', message: 'No file uploaded' }
            });
        }

        const { entity_type, entity_id, description, category } = req.body;

        if (!entity_type || !entity_id) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Entity type and ID are required' }
            });
        }

        const docId = uuidv4();
        
        run(`INSERT INTO documents (id, tenant_id, entity_type, entity_id, file_name, file_path, file_type, file_size, mime_type, description, category, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [docId, req.tenantId, entity_type, entity_id, req.file.originalname, req.file.path, path.extname(req.file.originalname).toLowerCase(), req.file.size, req.file.mimetype, description || null, category || 'general', req.user.id]);

        logActivity(req.tenantId, req.user.id, 'documents', 'uploaded', docId, null, {
            file_name: req.file.originalname,
            entity_type,
            entity_id
        }, req);

        res.json({
            success: true,
            data: {
                id: docId,
                file_name: req.file.originalname,
                file_path: `/uploads/attachments/${entity_type}/${req.file.filename}`,
                file_size: req.file.size,
                mime_type: req.file.mimetype
            },
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/entity/:entityType/:entityId', authenticate, async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        
        const documents = query(`
            SELECT d.*, u.name as uploaded_by_name
            FROM documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.tenant_id = ? AND d.entity_type = ? AND d.entity_id = ?
            ORDER BY d.created_at DESC
        `, [req.tenantId, entityType, entityId]);

        res.json({ success: true, data: documents });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const doc = queryOne(`
            SELECT d.*, u.name as uploaded_by_name
            FROM documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.id = ? AND d.tenant_id = ?
        `, [req.params.id, req.tenantId]);

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Document not found' }
            });
        }

        res.json({ success: true, data: doc });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/:id/download', authenticate, async (req, res) => {
    try {
        const doc = queryOne('SELECT * FROM documents WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);

        if (!doc || !doc.file_path) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'File not found' }
            });
        }

        if (!fs.existsSync(doc.file_path)) {
            return res.status(404).json({
                success: false,
                error: { code: 'FILE_MISSING', message: 'File no longer exists on server' }
            });
        }

        res.download(doc.file_path, doc.file_name);
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/:id', authenticate, requirePermission('documents', 'delete'), async (req, res) => {
    try {
        const doc = queryOne('SELECT * FROM documents WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Document not found' }
            });
        }

        if (doc.file_path && fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
        }

        run('DELETE FROM documents WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);

        logActivity(req.tenantId, req.user.id, 'documents', 'deleted', req.params.id, null, {
            file_name: doc.file_name
        }, req);

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/:id', authenticate, requirePermission('documents', 'edit'), async (req, res) => {
    try {
        const { description, category } = req.body;
        
        const doc = queryOne('SELECT id FROM documents WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
        
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Document not found' }
            });
        }

        run('UPDATE documents SET description = ?, category = ?, updated_at = ? WHERE id = ?',
            [description, category, new Date().toISOString(), req.params.id]);

        res.json({ success: true, message: 'Document updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;