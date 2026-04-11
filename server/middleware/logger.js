const fs = require('fs');
const path = require('path');

function createErrorHandler(logger) {
    return (error, req, res, next) => {
        // Log the actual error
        logger.error('API Error:', {
            path: req.path,
            method: req.method,
            userId: req.user?.id,
            error: error.stack || error.message
        });

        // Determine if we should expose details
        const isProduction = process.env.NODE_ENV === 'production';
        const isValidationError = error.isValidation;

        // Build response based on environment
        const response = {
            success: false,
            error: {
                code: error.code || 'SERVER_ERROR',
                message: isProduction && !isValidationError 
                    ? 'An internal error occurred' 
                    : error.message
            }
        };

        // Add validation error details in development
        if (isValidationError && error.details) {
            response.error.details = error.details;
        }

        res.status(error.status || 500).json(response);
    };
}

function createRequestLogger() {
    const logDir = path.join(__dirname, '../../logs');
    
    return (req, res, next) => {
        const start = Date.now();
        
        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - start;
            const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
            
            if (res.statusCode >= 400) {
                fs.appendFileSync(
                    path.join(logDir, 'requests.log'),
                    logEntry + '\n',
                    { flag: 'a' }
                );
            }
        });

        next();
    };
}

function logActivity(tenantId, userId, module, action, recordId, oldData, newData, req) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        tenantId,
        userId,
        module,
        action,
        recordId,
        oldData,
        newData,
        ip: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.get('User-Agent')
    };
    
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(
        path.join(logDir, 'activity.log'),
        JSON.stringify(logEntry) + '\n',
        { flag: 'a' }
    );
}

module.exports = {
    createErrorHandler,
    createRequestLogger,
    logActivity
};