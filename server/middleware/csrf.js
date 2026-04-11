const crypto = require('crypto');

// In-memory store for CSRF tokens (use Redis in production)
const csrfTokens = new Map();

// Generate CSRF token
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Store token with expiry (1 hour)
function storeCsrfToken(token, userId) {
    csrfTokens.set(token, {
        userId,
        expires: Date.now() + 3600000
    });
    
    // Cleanup expired tokens
    for (const [key, value] of csrfTokens) {
        if (value.expires < Date.now()) {
            csrfTokens.delete(key);
        }
    }
}

// Validate CSRF token
function validateCsrfToken(token, userId) {
    if (!token || !userId) return false;
    
    const stored = csrfTokens.get(token);
    if (!stored || stored.userId !== userId || stored.expires < Date.now()) {
        return false;
    }
    
    // Delete after valid use (one-time token)
    csrfTokens.delete(token);
    return true;
}

// CSRF middleware factory
function csrfProtection(excludePaths = []) {
    return (req, res, next) => {
        // Skip for certain paths
        if (excludePaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // GET requests don't need CSRF (safe methods)
        if (req.method === 'GET') {
            return next();
        }

        // Check for CSRF token in header
        const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
        
        if (!validateCsrfToken(csrfToken, req.user?.id)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'CSRF_INVALID',
                    message: 'Invalid or expired CSRF token'
                }
            });
        }

        next();
    };
}

// Generate and attach CSRF token to user session
function attachCsrfToken(userId) {
    const token = generateCsrfToken();
    storeCsrfToken(token, userId);
    return token;
}

module.exports = {
    generateCsrfToken,
    storeCsrfToken,
    validateCsrfToken,
    csrfProtection,
    attachCsrfToken
};