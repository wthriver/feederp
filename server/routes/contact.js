const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { run, logActivity } = require('../config/database');

router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        const errors = [];
        if (!name || name.trim().length < 2) {
            errors.push('Name must be at least 2 characters');
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Valid email is required');
        }
        if (!subject || subject.trim().length < 3) {
            errors.push('Subject must be at least 3 characters');
        }
        if (!message || message.trim().length < 10) {
            errors.push('Message must be at least 10 characters');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Please fix the following errors',
                    fields: errors
                }
            });
        }

        const sanitizedData = {
            name: name.trim().substring(0, 200),
            email: email.trim().toLowerCase().substring(0, 200),
            phone: phone ? phone.trim().substring(0, 20) : null,
            subject: subject.trim().substring(0, 500),
            message: message.trim().substring(0, 5000)
        };

        run(`INSERT INTO contact_submissions (id, name, email, phone, subject, message, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                sanitizedData.name,
                sanitizedData.email,
                sanitizedData.phone,
                sanitizedData.subject,
                sanitizedData.message,
                'new',
                new Date().toISOString()
            ]);

        console.log(`[CONTACT] New submission from ${sanitizedData.email}: ${sanitizedData.subject}`);

        res.json({
            success: true,
            message: 'Thank you for your message! We will get back to you within 24 hours.',
            data: {
                referenceId: uuidv4().substring(0, 8).toUpperCase()
            }
        });
    } catch (error) {
        console.error('Contact submission error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Failed to submit contact form. Please try again.' }
        });
    }
});

router.get('/', async (req, res) => {
    res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'GET method not supported' }
    });
});

module.exports = router;
