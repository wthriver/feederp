const validateQuantity = (value, fieldName = 'quantity') => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
        return { valid: false, error: `${fieldName} must be a positive number` };
    }
    if (num > 999999999) {
        return { valid: false, error: `${fieldName} exceeds maximum allowed value` };
    }
    return { valid: true, value: num };
};

const validatePositiveNumber = (value, fieldName = 'value') => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
        return { valid: false, error: `${fieldName} must be a non-negative number` };
    }
    return { valid: true, value: num };
};

const validateDate = (value, fieldName = 'date', allowFuture = true) => {
    if (!value) {
        return { valid: false, error: `${fieldName} is required` };
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        return { valid: false, error: `${fieldName} is not a valid date` };
    }
    if (!allowFuture && date > new Date()) {
        return { valid: false, error: `${fieldName} cannot be in the future` };
    }
    return { valid: true, value: value };
};

const validateDateRange = (fromDate, toDate) => {
    if (!fromDate || !toDate) {
        return { valid: true };
    }
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) {
        return { valid: false, error: 'From date cannot be after To date' };
    }
    return { valid: true };
};

const validateUUID = (value, fieldName = 'id') => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
        return { valid: false, error: `${fieldName} must be a valid UUID` };
    }
    return { valid: true };
};

const validateStringLength = (value, fieldName = 'field', min = 1, max = 255) => {
    if (!value || typeof value !== 'string') {
        return { valid: false, error: `${fieldName} is required` };
    }
    const trimmed = value.trim();
    if (trimmed.length < min) {
        return { valid: false, error: `${fieldName} must be at least ${min} characters` };
    }
    if (trimmed.length > max) {
        return { valid: false, error: `${fieldName} must not exceed ${max} characters` };
    }
    return { valid: true, value: trimmed };
};

const validateEmail = (value, fieldName = 'email') => {
    if (!value) {
        return { valid: true };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        return { valid: false, error: `${fieldName} is not a valid email address` };
    }
    return { valid: true };
};

const validatePhone = (value, fieldName = 'phone') => {
    if (!value) {
        return { valid: true };
    }
    const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
    if (!phoneRegex.test(value)) {
        return { valid: false, error: `${fieldName} is not a valid phone number` };
    }
    return { valid: true };
};

const validateDecimal = (value, fieldName = 'value', min = 0, max = null, decimalPlaces = 2) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
        return { valid: false, error: `${fieldName} must be a valid number` };
    }
    if (num < min) {
        return { valid: false, error: `${fieldName} must be at least ${min}` };
    }
    if (max !== null && num > max) {
        return { valid: false, error: `${fieldName} must not exceed ${max}` };
    }
    const factor = Math.pow(10, decimalPlaces);
    return { valid: true, value: Math.round(num * factor) / factor };
};

const validateRequired = (value, fieldName = 'field') => {
    if (value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0)) {
        return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
};

const validateArray = (value, fieldName = 'array', minLength = 0, maxLength = 1000) => {
    if (!Array.isArray(value)) {
        return { valid: false, error: `${fieldName} must be an array` };
    }
    if (value.length < minLength) {
        return { valid: false, error: `${fieldName} must have at least ${minLength} item(s)` };
    }
    if (value.length > maxLength) {
        return { valid: false, error: `${fieldName} must not exceed ${maxLength} items` };
    }
    return { valid: true };
};

const validateEnum = (value, fieldName = 'field', allowedValues = []) => {
    if (!allowedValues.includes(value)) {
        return { valid: false, error: `${fieldName} must be one of: ${allowedValues.join(', ')}` };
    }
    return { valid: true };
};

const sanitizeString = (value) => {
    if (typeof value !== 'string') return value;
    return value.replace(/[<>'"]/g, '').trim();
};

const validatePagination = (page, limit) => {
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 50;
    
    if (p < 1) {
        return { valid: false, error: 'Page must be at least 1' };
    }
    if (l < 1 || l > 1000) {
        return { valid: false, error: 'Limit must be between 1 and 1000' };
    }
    return { valid: true, page: p, limit: l };
};

module.exports = {
    validateQuantity,
    validatePositiveNumber,
    validateDate,
    validateDateRange,
    validateUUID,
    validateStringLength,
    validateEmail,
    validatePhone,
    validateDecimal,
    validateRequired,
    validateArray,
    validateEnum,
    sanitizeString,
    validatePagination
};