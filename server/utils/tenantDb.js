/**
 * Automatic Tenant Isolation System for PostgreSQL
 * 
 * This module provides automatic tenant isolation using PostgreSQL schemas.
 * Each tenant gets their own schema: tenant_<uuid_prefix>
 * 
 * Usage:
 *   const { query, queryOne, run } = require('../config/database');
 *   const { executeInTenantSchema } = require('../utils/schemaManager');
 * 
 * For PostgreSQL with schema-per-tenant:
 *   - System tables in 'public' schema
 *   - Tenant tables in 'tenant_<id>' schema
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const SCHEMA_PREFIX = 'tenant_';

// Lazy-load PostgreSQL pool
let _pool = null;

function getPool() {
    if (!_pool) {
        const isProduction = process.env.NODE_ENV === 'production';
        _pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
            max: isProduction ? 20 : 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }
    return _pool;
}

function getTenantSchemaName(tenantId) {
    if (!tenantId) return 'public';
    // Use first 8 chars of UUID, remove dashes
    return `${SCHEMA_PREFIX}${tenantId.substring(0, 8).replace(/-/g, '')}`;
}

// Tables that are NOT tenant-scoped (system tables in public schema)
const SYSTEM_TABLES = new Set([
    'tenants', 'users', 'roles', 'role_permissions', 'user_mfa',
    'used_backup_codes', 'active_sessions', 'api_tokens', 'login_history',
    'migrations', 'database_log', 'api_keys', 'approval_settings'
]);

// All tenant-scoped tables (in tenant schema)
const TENANT_TABLES = new Set([
    'factories', 'godowns', 'units', 'raw_materials', 'products', 'formulas',
    'formula_ingredients', 'suppliers', 'customers', 'routes', 'purchase_orders',
    'po_items', 'goods_inward', 'inward_items', 'purchase_invoices', 'stock_ledger',
    'transfers', 'transfer_items', 'stock_adjustments', 'adjustment_items',
    'production_batches', 'batch_consumption', 'batch_quality', 'machines',
    'qc_parameters', 'qc_results', 'quality_standards', 'sales_orders', 'so_items',
    'sales_invoices', 'invoice_items', 'sales_returns', 'return_items', 'account_groups',
    'accounts', 'transactions', 'payments', 'vehicles', 'drivers', 'delivery_orders',
    'delivery_tracking', 'barcodes', 'iot_devices', 'iot_readings', 'machine_logs',
    'activity_log', 'settings', 'sequences', 'price_lists', 'price_list_items',
    'discount_rules', 'currency_rates', 'credit_notes', 'recurring_orders',
    'advance_payments', 'job_cards', 'quality_checklists', 'webhooks',
    'audit_archive', 'data_exports', 'approval_history',
    'documents', 'regions', 'notifications',
    'retention_policies', 'workflow_definitions', 'workflow_instances',
    'validation_rules', 'dashboard_widgets', 'notification_preferences',
    'tenant_settings', 'tenant_invoices', 'product_prices'
]);

/**
 * Check if a table is system table (not tenant-scoped)
 */
function isSystemTable(tableName) {
    if (!tableName) return true;
    return SYSTEM_TABLES.has(tableName.toLowerCase());
}

/**
 * Check if a table requires tenant isolation
 */
function isTenantScoped(tableName) {
    if (!tableName) return false;
    return TENANT_TABLES.has(tableName.toLowerCase());
}

/**
 * Auto-detect table name from SQL query
 */
function detectTable(sql) {
    if (!sql) return null;
    const sqlLower = sql.toLowerCase();

    const patterns = [
        /from\s+`?(\w+)`?/i,
        /into\s+`?(\w+)`?/i,
        /update\s+`?(\w+)`?/i,
        /delete\s+from\s+`?(\w+)`?/i
    ];

    for (const pattern of patterns) {
        const match = sqlLower.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Get tenant ID from request or throw error
 * Supports: req (with tenantId), or tenantId string directly
 */
function getTenantId(req, params = []) {
    // From request object
    if (req && req.tenantId) return req.tenantId;

    // From direct tenantId string
    if (req && typeof req === 'string') return req;

    // Backward compatible: from params[0] if UUID-like
    if (params && params[0] && typeof params[0] === 'string' && params[0].length === 36) {
        return params[0];
    }

    throw new Error('Tenant ID required. Provide req object with tenantId or pass tenantId as third parameter.');
}

/**
 * Add tenant_id WHERE clause to SQL if needed
 */
function injectTenantFilter(sql, tenantId, params) {
    if (!sql || !tenantId) return { sql, params };

    const sqlLower = sql.toLowerCase();
    const table = detectTable(sql);

    // Skip system tables and if tenant_id already in query
    if (table && (isSystemTable(table) || sqlLower.includes('tenant_id = ?'))) {
        return { sql, params };
    }

    // For tenant-scoped tables, add tenant_id filter
    if (table && isTenantScoped(table)) {
        if (sqlLower.includes(' where ')) {
            const whereIdx = sql.toLowerCase().indexOf(' where ');
            sql = sql.slice(0, whereIdx + 7) + 'tenant_id = ? AND ' + sql.slice(whereIdx + 7);
            params = [tenantId, ...params];
        } else if (sqlLower.startsWith('select ') && sqlLower.includes(' from ')) {
            sql += ' WHERE tenant_id = ?';
            params = [tenantId, ...params];
        }
    }

    return { sql, params };
}

/**
 * Execute query in tenant schema with automatic schema prefix
 */
async function queryInSchema(schemaName, sql, params = []) {
    const pool = getPool();
    // Set search_path to tenant schema for this query
    const client = await pool.connect();
    try {
        await client.query(`SET search_path TO ${schemaName}`);
        const result = await client.query(sql, params);
        return result.rows;
    } finally {
        await client.query('SET search_path TO public');
        client.release();
    }
}

/**
 * Execute one query in tenant schema
 */
async function queryOneInSchema(schemaName, sql, params = []) {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query(`SET search_path TO ${schemaName}`);
        const result = await client.query(sql, params);
        return result.rows[0] || null;
    } finally {
        await client.query('SET search_path TO public');
        client.release();
    }
}

/**
 * Execute run (INSERT/UPDATE/DELETE) in tenant schema
 */
async function runInSchema(schemaName, sql, params = []) {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query(`SET search_path TO ${schemaName}`);
        const result = await client.query(sql, params);
        return { lastInsertRowid: null, changes: result.rowCount, rows: result.rows };
    } finally {
        await client.query('SET search_path TO public');
        client.release();
    }
}

/**
 * Query with automatic tenant isolation (PostgreSQL schema)
 */
async function query(sql, params = [], req) {
    const tenantId = getTenantId(req, params);
    const { sql: safeSql, params: safeParams } = injectTenantFilter(sql, tenantId, params);
    const schemaName = getTenantSchemaName(tenantId);
    return await queryInSchema(schemaName, safeSql, safeParams);
}

/**
 * QueryOne with automatic tenant isolation
 */
async function queryOne(sql, params = [], req) {
    const tenantId = getTenantId(req, params);
    const { sql: safeSql, params: safeParams } = injectTenantFilter(sql, tenantId, params);
    const schemaName = getTenantSchemaName(tenantId);
    return await queryOneInSchema(schemaName, safeSql, safeParams);
}

/**
 * Run INSERT/UPDATE/DELETE with automatic tenant isolation
 */
async function run(sql, params = [], req) {
    const sqlLower = sql.toLowerCase();
    const table = detectTable(sql);

    // Skip for system tables
    if (table && isSystemTable(table)) {
        const pool = getPool();
        const result = await pool.query(sql, params);
        return { lastInsertRowid: null, changes: result.rowCount, rows: result.rows };
    }

    // Get tenant ID for tenant-scoped tables
    const tenantId = getTenantId(req, params);
    const schemaName = getTenantSchemaName(tenantId);

    // For UPDATE/DELETE, add tenant_id to WHERE if needed
    if (table && isTenantScoped(table) && (sqlLower.startsWith('update ') || sqlLower.startsWith('delete '))) {
        if (!sqlLower.includes('tenant_id = ?')) {
            const whereIdx = sqlLower.indexOf(' where ');
            if (whereIdx > -1) {
                sql = sql.slice(0, whereIdx + 7) + 'tenant_id = ? AND ' + sql.slice(whereIdx + 7);
                params = [tenantId, ...params];
            }
        }
    }

    return await runInSchema(schemaName, sql, params);
}

/**
 * Insert with auto-generated tenant_id
 */
async function insert(table, data, req) {
    if (!isTenantScoped(table)) {
        throw new Error(`Table ${table} is not tenant-scoped`);
    }

    const tenantId = getTenantId(req);
    const schemaName = getTenantSchemaName(tenantId);
    const id = data.id || uuidv4();

    const columns = ['id', 'tenant_id', ...Object.keys(data)];
    const values = [id, tenantId, ...Object.values(data)];
    const placeholders = columns.map(() => '?').join(', ');

    return await runInSchema(
        schemaName,
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
    );
}

/**
 * Update by ID with tenant check
 */
async function updateById(table, id, data, req) {
    if (!isTenantScoped(table)) {
        throw new Error(`Table ${table} is not tenant-scoped`);
    }

    const tenantId = getTenantId(req);
    const schemaName = getTenantSchemaName(tenantId);
    const entries = Object.entries(data);
    const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = [...entries.map(([, v]) => v), id, tenantId];

    const result = await runInSchema(
        schemaName,
        `UPDATE ${table} SET ${setClause} WHERE id = ? AND tenant_id = ?`,
        values
    );

    if (result.changes === 0) {
        throw new Error('Record not found or access denied');
    }
    return result;
}

/**
 * Delete by ID with tenant check
 */
async function deleteById(table, id, req) {
    if (!isTenantScoped(table)) {
        throw new Error(`Table ${table} is not tenant-scoped`);
    }

    const tenantId = getTenantId(req);
    const schemaName = getTenantSchemaName(tenantId);

    const result = await runInSchema(
        schemaName,
        `DELETE FROM ${table} WHERE id = ? AND tenant_id = ?`,
        [id, tenantId]
    );

    if (result.changes === 0) {
        throw new Error('Record not found or access denied');
    }
    return result;
}

/**
 * Find by ID with tenant check
 */
async function findById(table, id, req) {
    const tenantId = req?.tenantId;
    const schemaName = tenantId ? getTenantSchemaName(tenantId) : 'public';

    if (isSystemTable(table)) {
        const pool = getPool();
        const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    return await queryOneInSchema(
        schemaName,
        `SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
    );
}

async function closeDb() {
    if (_pool) {
        await _pool.end();
        _pool = null;
    }
}

// For backward compatibility - sync wrappers for non-async contexts
// These will work for simple queries but schema switching requires async
function querySync(sql, params = [], req) {
    // This is a simplified sync version - for complex queries use async versions
    const tenantId = getTenantId(req, params);
    const schemaName = getTenantSchemaName(tenantId);
    return queryInSchema(schemaName, sql, params);
}

function queryOneSync(sql, params = [], req) {
    const tenantId = getTenantId(req, params);
    const schemaName = getTenantSchemaName(tenantId);
    return queryOneInSchema(schemaName, sql, params);
}

function runSync(sql, params = [], req) {
    const tenantId = getTenantId(req, params);
    const schemaName = getTenantSchemaName(tenantId);
    return runInSchema(schemaName, sql, params);
}

module.exports = {
    getTenantSchemaName,
    isSystemTable,
    isTenantScoped,
    TENANT_TABLES,
    SYSTEM_TABLES,
    query: query,
    queryOne: queryOne,
    run: run,
    // Sync versions (for backward compatibility)
    querySync,
    queryOneSync,
    runSync,
    // Advanced
    insert,
    updateById,
    deleteById,
    findById,
    detectTable,
    getTenantId,
    close: closeDb,
    getPool
};