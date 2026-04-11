function paginate(query, countQuery, params, options = {}) {
    const {
        page = 1,
        limit = 50,
        defaultLimit = 50,
        maxLimit = 1000
    } = options;
    
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || defaultLimit));
    const offset = (safePage - 1) * safeLimit;
    
    const queryParams = [...params, safeLimit, offset];
    
    return { safePage, safeLimit, offset, queryParams };
}

function formatPaginationResponse(data, page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    
    return {
        data,
        meta: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total),
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

function getOffset(page, limit) {
    return (Math.max(1, page) - 1) * limit;
}

module.exports = {
    paginate,
    formatPaginationResponse,
    getOffset
};