const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity, getNextSequence, formatSequence } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/accounts', authenticate, async (req, res) => {
    try {
        const accounts = query('SELECT * FROM accounts WHERE tenant_id = ? AND is_active = 1 ORDER BY name', [req.tenantId]);
        res.json({ success: true, data: accounts });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/accounts', authenticate, requirePermission('finance', 'add'), async (req, res) => {
    try {
        const { code, name, name_bn, group_id, type, party_type, party_id, opening_balance } = req.body;
        const id = uuidv4();

        run(`INSERT INTO accounts (id, tenant_id, code, name, name_bn, group_id, type, party_type, party_id, opening_balance, current_balance)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.tenantId, code, name, name_bn, group_id, type, party_type, party_id, opening_balance || 0, opening_balance || 0]);

        res.json({ success: true, data: { id }, message: 'Account created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.put('/accounts/:id', authenticate, requirePermission('finance', 'edit'), async (req, res) => {
    try {
        const { name, name_bn, group_id, type, party_type, party_id, is_active } = req.body;
        
        const existing = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } });
        }

        run(`UPDATE accounts SET name = ?, name_bn = ?, group_id = ?, type = ?, party_type = ?, party_id = ?, is_active = ?
             WHERE id = ?`,
            [name, name_bn, group_id, type, party_type, party_id, is_active ?? 1, req.params.id]);

        res.json({ success: true, message: 'Account updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.delete('/accounts/:id', authenticate, requirePermission('finance', 'delete'), async (req, res) => {
    try {
        const hasTxn = queryOne('SELECT id FROM transactions WHERE account_id = ? OR opposite_account_id = ? LIMIT 1', 
            [req.params.id, req.params.id]);
        if (hasTxn) {
            return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE', message: 'Account has transactions' } });
        }

        run('UPDATE accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/accounts/:id/ledger', authenticate, async (req, res) => {
    try {
        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
        if (!account) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } });

        const transactions = query(`
            SELECT * FROM transactions WHERE account_id = ? OR opposite_account_id = ?
            ORDER BY date DESC, created_at DESC LIMIT 100
        `, [req.params.id, req.params.id]);

        res.json({ success: true, data: { account, transactions } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/transactions', authenticate, async (req, res) => {
    try {
        const { voucher_type, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT t.*, a.name as account_name, oa.name as opposite_account_name, u.name as created_by_name
                   FROM transactions t
                   LEFT JOIN accounts a ON t.account_id = a.id
                   LEFT JOIN accounts oa ON t.opposite_account_id = oa.id
                   LEFT JOIN users u ON t.created_by = u.id
                   WHERE t.tenant_id = ? AND t.is_cancelled = 0`;
        let countSql = 'SELECT COUNT(*) as total FROM transactions WHERE tenant_id = ? AND is_cancelled = 0';
        const params = [req.tenantId];

        if (voucher_type) { sql += ' AND t.voucher_type = ?'; countSql += ' AND voucher_type = ?'; params.push(voucher_type); }
        if (from_date) { sql += ' AND t.date >= ?'; countSql += ' AND date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND t.date <= ?'; countSql += ' AND date <= ?'; params.push(to_date); }

        sql += ` ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const transactions = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: transactions, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/transactions', authenticate, requirePermission('finance', 'add'), async (req, res) => {
    try {
        const { voucher_type, date, account_id, opposite_account_id, debit, credit, narration, reference_type, reference_id } = req.body;

        const voucherNumber = formatSequence('VCH', getNextSequence('VCH', req.tenantId));
        const txnId = uuidv4();

        run(`INSERT INTO transactions (id, tenant_id, voucher_number, voucher_type, date, account_id, opposite_account_id, debit, credit, narration, reference_type, reference_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [txnId, req.tenantId, voucherNumber, voucher_type, date, account_id, opposite_account_id, debit || 0, credit || 0, narration, reference_type, reference_id, req.user.id]);

        if (account_id && debit > 0) {
            run('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?', [debit, account_id]);
        }
        if (account_id && credit > 0) {
            run('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?', [credit, account_id]);
        }
        if (opposite_account_id && debit > 0) {
            run('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?', [debit, opposite_account_id]);
        }
        if (opposite_account_id && credit > 0) {
            run('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?', [credit, opposite_account_id]);
        }

        logActivity(req.tenantId, req.user.id, 'finance', 'transaction_created', txnId, null, { voucher_number: voucherNumber }, req);

        res.json({ success: true, data: { id: txnId, voucher_number: voucherNumber }, message: 'Transaction recorded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.get('/payments', authenticate, async (req, res) => {
    try {
        const { party_type, from_date, to_date, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `SELECT p.*, a.name as party_name FROM payments p LEFT JOIN accounts a ON p.party_id = a.id WHERE p.tenant_id = ?`;
        let countSql = 'SELECT COUNT(*) as total FROM payments WHERE tenant_id = ?';
        const params = [req.tenantId];

        if (party_type) { sql += ' AND p.party_type = ?'; countSql += ' AND party_type = ?'; params.push(party_type); }
        if (from_date) { sql += ' AND p.payment_date >= ?'; countSql += ' AND payment_date >= ?'; params.push(from_date); }
        if (to_date) { sql += ' AND p.payment_date <= ?'; countSql += ' AND payment_date <= ?'; params.push(to_date); }

        sql += ` ORDER BY p.payment_date DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const payments = query(sql, params);
        const { total } = queryOne(countSql, params.slice(0, -2));

        res.json({ success: true, data: payments, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

router.post('/payments', authenticate, requirePermission('finance', 'add'), async (req, res) => {
    try {
        const { payment_date, party_type, party_id, account_id, amount, payment_mode, reference_number, bank_id, cheque_number, cheque_date, notes } = req.body;

        const paymentNumber = formatSequence('PAY', getNextSequence('PAY', req.tenantId));
        const paymentId = uuidv4();

        run(`INSERT INTO payments (id, tenant_id, payment_number, payment_date, party_type, party_id, account_id, amount, payment_mode, reference_number, bank_id, cheque_number, cheque_date, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [paymentId, req.tenantId, paymentNumber, payment_date, party_type, party_id, account_id, amount, payment_mode, reference_number, bank_id, cheque_number, cheque_date, notes, req.user.id]);

        if (party_type === 'supplier') {
            const inv = queryOne('SELECT id, amount_due FROM purchase_invoices WHERE supplier_id = ? AND payment_status != ? ORDER BY invoice_date LIMIT 1', [party_id, 'paid']);
            if (inv && inv.amount_due > 0) {
                const adjust = Math.min(amount, inv.amount_due);
                run('UPDATE purchase_invoices SET amount_paid = amount_paid + ?, amount_due = amount_due - ?, payment_status = CASE WHEN amount_due - ? <= 0 THEN ? ELSE ? END WHERE id = ?',
                    [adjust, adjust, adjust, 'paid', 'partial', inv.id]);
            }
        } else if (party_type === 'customer') {
            run('UPDATE customers SET outstanding = outstanding - ? WHERE id = ?', [amount, party_id]);
        }

        logActivity(req.tenantId, req.user.id, 'finance', 'payment_made', paymentId, null, { payment_number: paymentNumber, amount }, req);

        res.json({ success: true, data: { id: paymentId, payment_number: paymentNumber }, message: 'Payment recorded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});

module.exports = router;
