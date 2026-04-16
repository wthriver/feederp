const nodemailer = require('nodemailer');
const { logger } = require('./logger');

let transporter = null;

function initTransporter() {
    if (!process.env.SMTP_HOST) {
        console.log('[Email] SMTP not configured - emails will be logged only');
        return createMockTransporter();
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    console.log(`[Email] Configured: ${process.env.SMTP_HOST}`);
    return transporter;
}

function createMockTransporter() {
    return {
        sendMail: async (options) => {
            logger.info('[Mock Email]', { to: options.to, subject: options.subject });
            return { messageId: 'mock-' + Date.now() };
        }
    };
}

async function sendEmail(to, subject, html, text = null) {
    if (!transporter) {
        initTransporter();
    }

    try {
        const result = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        });

        logger.info('Email sent', { to, subject, messageId: result.messageId });
        return { success: true, messageId: result.messageId };
    } catch (error) {
        logger.error('Email failed', { to, subject, error: error.message });
        return { success: false, error: error.message };
    }
}

async function sendTemplatedEmail(to, template, data) {
    const templates = {
        welcome: {
            subject: 'Welcome to FeedMill ERP',
            html: `<h1>Welcome, {{name}}!</h1>
<p>Your account has been created on FeedMill ERP.</p>
<p>Login credentials:</p>
<ul>
    <li>URL: <strong>{{url}}</strong></li>
    <li>Email: <strong>{{email}}</strong></li>
</ul>
<p>Please change your password after first login.</p>`
        },
        passwordReset: {
            subject: 'Reset your FeedMill ERP password',
            html: `<h1>Password Reset Request</h1>
<p>Click the link below to reset your password:</p>
<p><a href="{{resetUrl}}">{{resetUrl}}</a></p>
<p>This link expires in 30 minutes.</p>
<p>If you didn't request this, please ignore this email.</p>`
        },
        approvalRequest: {
            subject: 'Approval Required: {{docType}} #{{docNumber}}',
            html: `<h1>Approval Required</h1>
<p>A {{docType}} requires your approval.</p>
<table>
    <tr><td>Document:</td><td><strong>{{docNumber}}</strong></td></tr>
    <tr><td>Amount:</td><td><strong>{{amount}}</strong></td></tr>
    <tr><td>Requested By:</td><td><strong>{{requestedBy}}</strong></td></tr>
</table>
<p><a href="{{approvalUrl}}">View & Approve</a></p>`
        },
        invoice: {
            subject: 'Invoice #{{invoiceNumber}} from FeedMill ERP',
            html: `<h1>Invoice</h1>
<p>Invoice Number: <strong>{{invoiceNumber}}</strong></p>
<p>Amount Due: <strong>{{amount}}</strong></p>
<p>Due Date: <strong>{{dueDate}}</strong></p>
<p><a href="{{invoiceUrl}}">View Invoice</a></p>`
        },
        orderConfirmation: {
            subject: 'Order Confirmed: {{orderNumber}}',
            html: `<h1>Order Confirmed</h1>
<p>Your order has been confirmed.</p>
<p>Order Number: <strong>{{orderNumber}}</strong></p>
<p>Expected Delivery: <strong>{{deliveryDate}}</strong></p>`
        },
        stockAlert: {
            subject: 'Stock Alert: {{itemName}}',
            html: `<h1>Low Stock Alert</h1>
<p>{{itemName}} is running low.</p>
<p>Current Stock: <strong>{{currentStock}}</strong></p>
<p>Reorder Level: <strong>{{reorderLevel}}</strong></p>
<p><a href="{{stockUrl}}">View Stock</a></p>`
        },
        subscriptionExpiring: {
            subject: 'Subscription Expiring Soon',
            html: `<h1>Subscription Expiring</h1>
<p>Your subscription expires on <strong>{{expiryDate}}</strong>.</p>
<p>Please renew to continue using FeedMill ERP.</p>
<p><a href="{{renewUrl}}">Renew Now</a></p>`
        }
    };

    const tmpl = templates[template];
    if (!tmpl) {
        return { success: false, error: 'Unknown template' };
    }

    let subject = tmpl.subject;
    let html = tmpl.html;

    Object.entries(data).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return sendEmail(to, subject, html);
}

async function sendBatchEmails(recipients, subject, html) {
    const results = await Promise.allSettled(
        recipients.map(to => sendEmail(to, subject, html))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return { total: results.length, successful, failed };
}

function getTransporter() {
    return transporter;
}

module.exports = {
    initTransporter,
    sendEmail,
    sendTemplatedEmail,
    sendBatchEmails,
    getTransporter
};