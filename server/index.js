require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const { query, queryOne, run, initDatabase } = require('./config/database');
const { runMigrations } = require('./config/migrations');
const authRoutes = require('./routes/auth');
const bulkRoutes = require('./routes/bulk');
const masterRoutes = require('./routes/master');
const purchaseRoutes = require('./routes/purchase');
const inventoryRoutes = require('./routes/inventory');
const productionRoutes = require('./routes/production');
const qualityRoutes = require('./routes/quality');
const salesRoutes = require('./routes/sales');
const financeRoutes = require('./routes/finance');
const transportRoutes = require('./routes/transport');
const barcodeRoutes = require('./routes/barcode');
const iotRoutes = require('./routes/iot');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const approvalRoutes = require('./routes/approval');
const documentRoutes = require('./routes/documents');
const apiRoutes = require('./routes/api');
const securityRoutes = require('./routes/security');
const notificationRoutes = require('./routes/notifications');
const contactRoutes = require('./routes/contact');
const saasRoutes = require('./routes/saas');
const metricsRoutes = require('./routes/metrics');
const billingRoutes = require('./routes/billing');
const workflowRoutes = require('./routes/workflow');
const validationRoutes = require('./routes/validation');
const { logger, createRequestLogger } = require('./utils/logger');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');
const cache = require('./utils/cache');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:3000', 'http://localhost:3006', 'http://localhost:3007'];

const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST']
    }
});

const rateLimitHandler = (req, res) => {
    const sanitizedReq = {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: {
            'user-agent': req.get('user-agent'),
            'content-type': req.get('content-type')
        }
    };
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[RATE LIMIT] ${req.path}`, sanitizedReq);
    }
    res.status(429).json({ 
        success: false, 
        error: { 
            code: 'RATE_LIMIT', 
            message: 'Too many requests, please try again later' 
        } 
    });
};

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => req.path !== '/login'
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});
console.log('ENV PORT:', process.env.PORT);
const PORT = process.env.PORT || 3005;

const connectedUsers = new Map();
const activeConnections = new Set();

io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    activeConnections.add(socket.id);

    socket.on('authenticate', ({ tenantId, userId }) => {
        const key = `${tenantId}:${userId}`;
        connectedUsers.set(key, socket.id);
        socket.tenantId = tenantId;
        socket.userId = userId;
        socket.join(`tenant:${tenantId}`);
        console.log(`[WS] User authenticated: ${userId} (Tenant: ${tenantId})`);
        socket.emit('authenticated', { success: true });
    });

    socket.on('subscribe', (channel) => {
        socket.join(channel);
        console.log(`[WS] Socket ${socket.id} subscribed to ${channel}`);
    });

    socket.on('unsubscribe', (channel) => {
        socket.leave(channel);
    });

    socket.on('disconnect', () => {
        activeConnections.delete(socket.id);
        if (socket.tenantId && socket.userId) {
            connectedUsers.delete(`${socket.tenantId}:${socket.userId}`);
        }
        console.log(`[WS] Client disconnected: ${socket.id}`);
    });
});

app.set('io', io);
app.set('connectedUsers', connectedUsers);

function emitToTenant(tenantId, event, data) {
    io.to(`tenant:${tenantId}`).emit(event, data);
}

function emitToUser(tenantId, userId, event, data) {
    const key = `${tenantId}:${userId}`;
    const socketId = connectedUsers.get(key);
    if (socketId) {
        io.to(socketId).emit(event, data);
    }
}

app.set('emitToTenant', emitToTenant);
app.set('emitToUser', emitToUser);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(limiter);
app.use(express.json({ limit: '1mb', strict: false }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Debug middleware - only for login (after body-parser)
app.use((req, res, next) => {
    if (req.path.includes('/auth/login')) {
        console.log('>>> LOGIN REQUEST:', req.method, req.path, req.body);
    }
    next();
});

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; connect-src 'self' http://localhost:* ws://localhost:*");
    next();
});

// Input sanitization
const DANGEROUS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /<link/gi,
    /<meta/gi,
    /<import/gi
];

const sanitizeValue = (val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
        let sanitized = val.replace(/[<>'"]/g, '');
        return sanitized.trim();
    }
    return val;
};

const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        
        const value = obj[key];
        
        if (Array.isArray(value)) {
            obj[key] = value.map(item => {
                if (typeof item === 'object') {
                    return sanitizeObject(item);
                }
                return sanitizeValue(item);
            });
        } else if (typeof value === 'object' && value !== null) {
            obj[key] = sanitizeObject(value);
        } else {
            obj[key] = sanitizeValue(value);
        }
    }
    
    return obj;
};

const logSuspiciousInput = (req, pattern) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        path: req.path,
        method: req.method,
        suspiciousPattern: pattern,
        userAgent: req.get('user-agent')
    };
    
    if (process.env.NODE_ENV !== 'production') {
        console.log('[SECURITY] Suspicious input detected:', logEntry);
    }
    
    logger?.warn('Suspicious input detected', {
        event: 'suspicious_input',
        ...logEntry
    });
};

const checkSuspiciousInput = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string') {
            for (const pattern of DANGEROUS_PATTERNS) {
                if (pattern.test(value)) {
                    return { key: currentPath, pattern: pattern.toString() };
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            const result = checkSuspiciousInput(value, currentPath);
            if (result) return result;
        }
    }
    
    return null;
};

app.use((req, res, next) => {
    if (req.body && Object.keys(req.body).length > 0) {
        const suspicious = checkSuspiciousInput(req.body);
        if (suspicious) {
            logSuspiciousInput(req, suspicious.pattern);
        }
        sanitizeObject(req.body);
    }
    if (req.query && Object.keys(req.query).length > 0) {
        sanitizeObject(req.query);
    }
    if (req.params) {
        sanitizeObject(req.params);
    }
    next();
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'FeedMill ERP API is running',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/docs', (req, res) => {
    res.json({
        openapi: '3.0.0',
        info: {
            title: 'FeedMill ERP API',
            version: '2.0.0',
            description: 'Cattle Feed Manufacturing ERP System'
        },
        server: `${req.protocol}://${req.get('host')}/api`
    });
});

app.get('/api/openapi.json', (req, res) => {
    res.sendFile(path.join(__dirname, '../openapi.json'));
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/bulk', strictLimiter, bulkRoutes);
app.use('/api/master', strictLimiter, masterRoutes);
app.use('/api/purchase', strictLimiter, purchaseRoutes);
app.use('/api/inventory', strictLimiter, inventoryRoutes);
app.use('/api/production', strictLimiter, productionRoutes);
app.use('/api/quality', strictLimiter, qualityRoutes);
app.use('/api/sales', strictLimiter, salesRoutes);
app.use('/api/finance', paymentLimiter, financeRoutes);
app.use('/api/transport', strictLimiter, transportRoutes);
app.use('/api/barcode', strictLimiter, barcodeRoutes);
app.use('/api/iot', strictLimiter, iotRoutes);
app.use('/api/dashboard', strictLimiter, dashboardRoutes);
app.use('/api/reports', strictLimiter, reportsRoutes);
app.use('/api/admin', strictLimiter, adminRoutes);
app.use('/api/approval', strictLimiter, approvalRoutes);
app.use('/api/documents', strictLimiter, documentRoutes);
app.use('/api/v1', strictLimiter, apiRoutes);
app.use('/api/security', strictLimiter, securityRoutes);
app.use('/api/notifications', strictLimiter, notificationRoutes);
app.use('/api/contact', contactLimiter, contactRoutes);
app.use('/api/saas', strictLimiter, saasRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/workflow', strictLimiter, workflowRoutes);
app.use('/api/validation', strictLimiter, validationRoutes);

app.use(createRequestLogger());

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval'");
    res.setHeader('X-API-Version', '2.0.0');
    next();
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

async function startServer() {
    try {
        await initDatabase();
        console.log('✓ Database initialized');

        // Create default admin user if not exists
        const { getDb } = require('./config/database');
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        const db = getDb();
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (!existingUser) {
            const tenantId = uuidv4();
            const factoryId = uuidv4();
            const roleId = uuidv4();
            const adminPassword = bcrypt.hashSync('admin123', 10);
            db.prepare(`INSERT INTO tenants (id, code, name, is_active, plan, max_users, created_at) VALUES (?, ?, ?, 1, 'enterprise', 1000, ?)`).run(tenantId, 'DEFAULT', 'Default Organization', new Date().toISOString());
            db.prepare(`INSERT INTO factories (id, tenant_id, name, code, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)`).run(factoryId, tenantId, 'Main Factory', 'FAC001', new Date().toISOString());
            db.prepare(`INSERT INTO roles (id, tenant_id, name, description, is_system, created_at) VALUES (?, ?, ?, ?, 1, ?)`).run(roleId, tenantId, 'Administrator', 'Full system access', new Date().toISOString());
            db.prepare(`INSERT INTO users (id, tenant_id, username, password_hash, name, role_id, factory_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(uuidv4(), tenantId, 'admin', adminPassword, 'System Admin', roleId, factoryId, new Date().toISOString());
            console.log('✓ Default admin user created');
        }

        runMigrations();
        
        await cache.initRedis();
        console.log('✓ Cache initialized');

        if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
            fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
        }

        if (!fs.existsSync(path.join(__dirname, '../logs'))) {
            fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
        }

        console.log('Starting server on PORT:', PORT);
        server.listen(PORT, () => {
            console.log(`\n🚀 FeedMill ERP Server running on port ${PORT}`);
            console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   API Base: http://localhost:${PORT}/api`);
            console.log(`   WebSocket: ws://localhost:${PORT}`);
            console.log(`   Active Connections: ${activeConnections.size}\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    const logMsg = `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`;
    if (fs.existsSync(path.join(__dirname, '../logs'))) {
        fs.appendFileSync(path.join(__dirname, '../logs/error.log'), logMsg, { flag: 'a' });
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    const logMsg = `[${new Date().toISOString()}] Uncaught Exception: ${error.message}\n${error.stack}\n`;
    if (fs.existsSync(path.join(__dirname, '../logs'))) {
        fs.appendFileSync(path.join(__dirname, '../logs/error.log'), logMsg, { flag: 'a' });
    }
    process.exit(1);
});

module.exports = app;
