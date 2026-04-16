const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run, logActivity } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { sendTemplatedEmail } = require('../utils/email');
const cache = require('../utils/cache');

const PLANS = {
    starter: { name: 'Starter', price: 499, max_users: 5, max_factories: 2, features: ['Basic Features', 'Email Support'] },
    professional: { name: 'Professional', price: 1499, max_users: 20, max_factories: 5, features: ['Advanced Reports', 'Priority Support', 'API Access'] },
    enterprise: { name: 'Enterprise', price: 4999, max_users: 100, max_factories: 999, features: ['Custom Integrations', 'Dedicated Support', 'SLA', 'Custom Domain'] }
};

router.get('/plans', (req, res) => {
    res.json({ success: true, data: PLANS });
});

router.post('/subscribe', async (req, res) => {
    try {
        const { tenant_id, plan, payment_method_id, payment_token } = req.body;

        if (!PLANS[plan]) {
            return res.status(400).json({ success: false, error: { message: 'Invalid plan' } });
        }

        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [tenant_id]);
        if (!tenant) {
            return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
        }

        const selectedPlan = PLANS[plan];
        const invoiceId = uuidv4();
        
        run(`INSERT INTO tenant_invoices (id, tenant_id, invoice_number, amount, currency, status, plan, description, due_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoiceId, tenant_id, `INV-${Date.now()}`, selectedPlan.price, 'BDT', 'pending', plan, `${plan} plan subscription`, new Date(Date.now() + 30 * 86400000).toISOString()]);

        res.json({
            success: true,
            data: {
                invoice_id: invoiceId,
                amount: selectedPlan.price,
                plan: plan,
                status: 'pending'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});

router.post('/webhook/stripe', async (req, res) => {
    try {
        const event = req.body;
        
        if (event.type === 'payment_intent.succeeded') {
            const payment = event.data.object;
            const invoiceId = payment.metadata?.invoice_id;
            
            if (invoiceId) {
                run('UPDATE tenant_invoices SET status = ?, payment_id = ?, paid_at = ? WHERE id = ?',
                    ['paid', payment.id, new Date().toISOString(), invoiceId]);

                const invoice = queryOne('SELECT * FROM tenant_invoices WHERE id = ?', [invoiceId]);
                if (invoice) {
                    const planDetails = PLANS[invoice.plan];
                    run('UPDATE tenants SET plan = ?, max_users = ?, max_factories = ?, subscription_valid_until = ?, auto_renew = ? WHERE id = ?',
                        [invoice.plan, planDetails.max_users, planDetails.max_factories, new Date(Date.now() + 365 * 86400000).toISOString(), true, invoice.tenant_id]);

                    const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [invoice.tenant_id]);
                    if (tenant?.email) {
                        await sendTemplatedEmail(tenant.email, 'subscriptionExpiring', {
                            expiryDate: new Date(Date.now() + 365 * 86400000).toLocaleDateString(),
                            renewUrl: `${process.env.APP_URL}/settings/billing`
                        });
                    }
                }
            }
        }

        if (event.type === 'invoice.payment_failed') {
            const payment = event.data.object;
            const invoiceId = payment.metadata?.invoice_id;
            
            if (invoiceId) {
                run('UPDATE tenant_invoices SET status = ?, payment_failure_reason = ? WHERE id = ?',
                    ['failed', payment.last_payment_error?.message, invoiceId]);

                const invoice = queryOne('SELECT * FROM tenant_invoices WHERE id = ?', [invoiceId]);
                if (invoice) {
                    const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [invoice.tenant_id]);
                    if (tenant?.email) {
                        await sendTemplatedEmail(tenant.email, 'subscriptionExpiring', {
                            expiryDate: new Date().toLocaleDateString(),
                            renewUrl: `${process.env.APP_URL}/settings/billing`
                        });
                    }
                }
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/webhook/bkash', async (req, res) => {
    try {
        const { status, payment_id, invoice_id, amount } = req.body;

        if (status === 'Success') {
            run('UPDATE tenant_invoices SET status = ?, payment_id = ?, paid_at = ? WHERE id = ?',
                ['paid', payment_id, new Date().toISOString(), invoice_id]);

            const invoice = queryOne('SELECT * FROM tenant_invoices WHERE id = ?', [invoice_id]);
            if (invoice) {
                const planDetails = PLANS[invoice.plan];
                run('UPDATE tenants SET plan = ?, max_users = ?, max_factories = ?, subscription_valid_until = ?, auto_renew = ? WHERE id = ?',
                    [invoice.plan, planDetails.max_users, planDetails.max_factories, new Date(Date.now() + 365 * 86400000).toISOString(), true, invoice.tenant_id]);
            }
        }

        res.json({ success: true, status });
    } catch (error) {
        console.error('Bkash webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/renew', authenticate, async (req, res) => {
    try {
        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);
        
        if (!tenant) {
            return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
        }

        if (!PLANS[tenant.plan]) {
            return res.status(400).json({ success: false, error: { message: 'Invalid plan' } });
        }

        const selectedPlan = PLANS[tenant.plan];
        
        run('UPDATE tenants SET auto_renew = ? WHERE id = ?', [req.body.enable ? 1 : 0, req.tenantId]);

        res.json({ success: true, message: `Auto-renew ${req.body.enable ? 'enabled' : 'disabled'}` });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});

router.get('/subscription', authenticate, async (req, res) => {
    try {
        const tenant = queryOne('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);
        const invoices = query('SELECT * FROM tenant_invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 12', [req.tenantId]);

        const currentPlan = PLANS[tenant.plan] || PLANS.starter;

        res.json({
            success: true,
            data: {
                plan: tenant.plan,
                plan_details: currentPlan,
                max_users: tenant.max_users,
                max_factories: tenant.max_factories,
                valid_until: tenant.subscription_valid_until,
                auto_renew: tenant.auto_renew,
                invoices
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});

module.exports = router;
module.exports.PLANS = PLANS;