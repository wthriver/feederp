const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

function generateSecretCode() {
    return crypto.randomBytes(20).toString('hex');
}

function encryptBackupCodes(codes, secret) {
    const cipher = crypto.createCipher('aes-256-cbc', secret);
    let encrypted = cipher.update(JSON.stringify(codes), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptBackupCodes(encrypted, secret) {
    try {
        const decipher = crypto.createDecipher('aes-256-cbc', secret);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (e) {
        return null;
    }
}

router.get('/settings', authenticate, requirePermission('security', 'view'), async (req, res) => {
    try {
        const settings = {};
        query(`SELECT key, value FROM settings WHERE tenant_id = ? AND key LIKE 'security.%'`, [req.tenantId])
            .forEach(s => {
                const key = s.key.replace('security.', '');
                if (key === 'ip_whitelist') {
                    settings[key] = s.value ? s.value.split(',').filter(Boolean) : [];
                } else if (key === 'mfa_enabled' || key === 'session_timeout' || key === 'password_expiry') {
                    settings[key] = parseInt(s.value) || 0;
                } else {
                    settings[key] = s.value;
                }
            });
        
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/settings', authenticate, requirePermission('security', 'edit'), async (req, res) => {
    try {
        const { mfa_enabled, session_timeout, password_expiry_days, ip_whitelist, max_login_attempts, lockout_duration } = req.body;
        
        const settings = {
            'security.mfa_enabled': mfa_enabled ? '1' : '0',
            'security.session_timeout': session_timeout || '30',
            'security.password_expiry_days': password_expiry_days || '90',
            'security.ip_whitelist': Array.isArray(ip_whitelist) ? ip_whitelist.join(',') : '',
            'security.max_login_attempts': max_login_attempts || '5',
            'security.lockout_duration': lockout_duration || '15'
        };
        
        Object.entries(settings).forEach(([key, value]) => {
            run(`INSERT INTO settings (id, tenant_id, key, value) VALUES (?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                [uuidv4(), req.tenantId, key, value]);
        });
        
        logActivity(req.tenantId, req.user.id, 'security', 'settings_updated', req.user.id, null, null, req);
        
        res.json({ success: true, message: 'Security settings updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/mfa/enable', authenticate, async (req, res) => {
    try {
        const existing = queryOne('SELECT id FROM user_mfa WHERE user_id = ?', [req.user.id]);
        
        if (existing) {
            return res.status(400).json({ success: false, error: { message: 'MFA already enabled' } });
        }
        
        const secret = generateSecretCode();
        const backupCodes = Array.from({ length: 10 }, () => 
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );
        
        const encryptedBackup = encryptBackupCodes(backupCodes, secret);
        
        run(`INSERT INTO user_mfa (id, user_id, secret, backup_codes_encrypted, method, is_active, created_at)
             VALUES (?, ?, ?, ?, 'totp', 1, ?)`,
            [uuidv4(), req.user.id, secret, encryptedBackup, new Date().toISOString()]);
        
        logActivity(req.tenantId, req.user.id, 'security', 'mfa_enabled', req.user.id, null, null, req);
        
        res.json({
            success: true,
            data: {
                secret,
                backupCodes,
                qrCodeUrl: `otpauth://totp/FeedMillERP:${req.user.username}?secret=${secret}&issuer=FeedMillERP`
            },
            message: 'MFA enabled. Save your backup codes in a safe place.'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/mfa/disable', authenticate, async (req, res) => {
    try {
        const { password } = req.body;
        
        const user = queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        const bcrypt = require('bcryptjs');
        
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(400).json({ success: false, error: { message: 'Invalid password' } });
        }
        
        run('DELETE FROM user_mfa WHERE user_id = ?', [req.user.id]);
        
        logActivity(req.tenantId, req.user.id, 'security', 'mfa_disabled', req.user.id, null, null, req);
        
        res.json({ success: true, message: 'MFA disabled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/mfa/verify', async (req, res) => {
    try {
        const { user_id, code } = req.body;
        
        if (!user_id || !code) {
            return res.status(400).json({ success: false, error: { message: 'User ID and code required' } });
        }
        
        const mfa = queryOne('SELECT * FROM user_mfa WHERE user_id = ? AND is_active = 1', [user_id]);
        
        if (!mfa) {
            return res.status(400).json({ success: false, error: { message: 'MFA not configured' } });
        }
        
        if (code.length === 8 && code.match(/^[A-F0-9]+$/)) {
            const backupCodes = decryptBackupCodes(mfa.backup_codes_encrypted, mfa.secret);
            const usedCode = queryOne('SELECT id FROM used_backup_codes WHERE mfa_id = ? AND code = ?', [mfa.id, code]);
            
            if (backupCodes && backupCodes.includes(code) && !usedCode) {
                run('INSERT INTO used_backup_codes (id, mfa_id, code, used_at) VALUES (?, ?, ?, ?)',
                    [uuidv4(), mfa.id, code, new Date().toISOString()]);
                
                return res.json({ success: true, message: 'Authenticated with backup code' });
            }
        }
        
        const speakeasy = require('speakeasy');
        const verified = speakeasy.totp.verify({
            secret: mfa.secret,
            encoding: 'hex',
            token: code,
            window: 1
        });
        
        if (!verified) {
            run('UPDATE user_mfa SET failed_attempts = failed_attempts + 1 WHERE id = ?', [mfa.id]);
            return res.status(401).json({ success: false, error: { message: 'Invalid code' } });
        }
        
        run('UPDATE user_mfa SET failed_attempts = 0, last_verified = ? WHERE id = ?', [new Date().toISOString(), mfa.id]);
        
        res.json({ success: true, message: 'MFA verified successfully' });
    } catch (error) {
        console.error('MFA verify error:', error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/sessions', authenticate, async (req, res) => {
    try {
        const sessions = query(`
            SELECT s.*, u.name as user_name
            FROM active_sessions s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.user_id = ? AND s.tenant_id = ?
            ORDER BY s.created_at DESC
        `, [req.user.id, req.tenantId]);
        
        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/sessions/:id', authenticate, async (req, res) => {
    try {
        const session = queryOne('SELECT * FROM active_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        
        if (!session) {
            return res.status(404).json({ success: false, error: { message: 'Session not found' } });
        }
        
        run('DELETE FROM active_sessions WHERE id = ?', [req.params.id]);
        
        logActivity(req.tenantId, req.user.id, 'security', 'session_revoked', req.params.id, null, null, req);
        
        res.json({ success: true, message: 'Session revoked' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/sessions', authenticate, async (req, res) => {
    try {
        run('DELETE FROM active_sessions WHERE user_id = ? AND tenant_id = ? AND id != ?', 
            [req.user.id, req.tenantId, req.query.except]);
        
        logActivity(req.tenantId, req.user.id, 'security', 'all_sessions_revoked', null, null, null, req);
        
        res.json({ success: true, message: 'All other sessions revoked' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/login-history', authenticate, requirePermission('security', 'view'), async (req, res) => {
    try {
        const { page = 1, limit = 50, user_id } = req.query;
        const offset = (page - 1) * limit;
        
        let sql = `
            SELECT lh.*, u.name as user_name, u.username
            FROM login_history lh
            LEFT JOIN users u ON lh.user_id = u.id
            WHERE lh.tenant_id = ?
        `;
        let countSql = 'SELECT COUNT(*) as total FROM login_history WHERE tenant_id = ?';
        const params = [req.tenantId];
        
        if (user_id) {
            sql += ' AND lh.user_id = ?';
            countSql += ' AND user_id = ?';
            params.push(user_id);
        }
        
        sql += ' ORDER BY lh.created_at DESC LIMIT ? OFFSET ?';
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

module.exports = router;