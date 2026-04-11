function arrayToCSV(data, headers = null) {
    if (!data || data.length === 0) return '';
    
    const keys = headers || Object.keys(data[0]);
    const rows = [keys.join(',')];
    
    for (const row of data) {
        const values = keys.map(key => {
            let val = row[key];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') {
                val = val.replace(/"/g, '""');
                if (val.includes(',') || val.includes('\n') || val.includes('"')) {
                    val = `"${val}"`;
                }
            }
            return val;
        });
        rows.push(values.join(','));
    }
    
    return rows.join('\n');
}

function parseExportParams(req) {
    const {
        page = 1,
        limit = 1000,
        sort,
        order,
        search,
        from_date,
        to_date,
        format = 'json'
    } = req.query;
    
    return {
        page: parseInt(page) || 1,
        limit: Math.min(10000, parseInt(limit) || 1000),
        sort: sort || 'created_at',
        order: order === 'asc' ? 'ASC' : 'DESC',
        search: search || '',
        from_date: from_date || null,
        to_date: to_date || null,
        format: format.toLowerCase()
    };
}

function buildFilterConditions(filters, baseParams = []) {
    let conditions = [];
    let params = [...baseParams];
    
    if (filters.search) {
        conditions.push('(name LIKE ? OR code LIKE ? OR name_bn LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.from_date) {
        conditions.push('created_at >= ?');
        params.push(filters.from_date);
    }
    
    if (filters.to_date) {
        conditions.push('created_at <= ?');
        params.push(filters.to_date);
    }
    
    if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
    }
    
    return { conditions, params };
}

module.exports = {
    arrayToCSV,
    parseExportParams,
    buildFilterConditions
};