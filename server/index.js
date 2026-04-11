require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./config/database');
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

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5173', 'http://localhost:3000'];

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

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many login attempts, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health'
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many payment requests, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please slow down' } },
    standardHeaders: true,
    legacyHeaders: false,
});
const PORT = process.env.PORT || 3000;

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

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    next();
});

// Input sanitization
const sanitize = (val) => {
    if (typeof val !== 'string') return val;
    return val.replace(/[<>]/g, '').trim();
};

app.use((req, res, next) => {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitize(req.body[key]);
            }
        }
    }
    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitize(req.query[key]);
            }
        }
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
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
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

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval'");
    next();
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Express Error:', err.message);
    fs.appendFileSync(
        path.join(__dirname, '../logs/error.log'),
        `[${new Date().toISOString()}] ${err.message}\n${err.stack}\n`,
        { flag: 'a' }
    );
    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'SERVER_ERROR',
            message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : err.message
        }
    });
});

async function startServer() {
    try {
        await initDatabase();
        console.log('✓ Database initialized');

        runMigrations();

        if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
            fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
        }

        if (!fs.existsSync(path.join(__dirname, '../logs'))) {
            fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
        }

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
