const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'feedmill-erp' },
    transports: [
        new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'error.log'), 
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'combined.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'security.log'),
            level: 'warn',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10
        }),
        new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'api.log'),
            level: 'info',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

function logApiRequest(req, res, duration) {
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, 'API Request', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
        tenantId: req.tenantId
    });
}

function logSecurityEvent(event, details) {
    logger.warn('Security Event', {
        event,
        ...details,
        timestamp: new Date().toISOString()
    });
}

function logError(error, context = {}) {
    logger.error('Application Error', {
        message: error.message,
        stack: error.stack,
        ...context,
        timestamp: new Date().toISOString()
    });
}

function logBusinessOperation(operation, details) {
    logger.info('Business Operation', {
        operation,
        ...details,
        timestamp: new Date().toISOString()
    });
}

function createRequestLogger() {
    return (req, res, next) => {
        const startTime = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            logApiRequest(req, res, duration);
        });
        
        next();
    };
}

module.exports = {
    logger,
    logApiRequest,
    logSecurityEvent,
    logError,
    logBusinessOperation,
    createRequestLogger
};