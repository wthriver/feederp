const { logError, logSecurityEvent } = require('../utils/logger');

function errorHandler(err, req, res, next) {
    logError(err, {
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        tenantId: req.tenantId,
        body: req.body,
        query: req.query
    });

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: err.message,
                details: err.details || []
            }
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token'
            }
        });
    }

    if (err.code === 'SQLITE_CANTOPEN' || err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Database connection failed'
            }
        });
    }

    if (err.statusCode === 429) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
            ip: req.ip,
            path: req.path,
            userId: req.user?.id
        });
    }

    const statusCode = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'An internal error occurred' 
        : err.message;

    res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || 'SERVER_ERROR',
            message,
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        }
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
}

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};