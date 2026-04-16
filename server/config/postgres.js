require('dotenv').config();

const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: isProduction ? 20 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  idle_in_transaction_session_timeout: 30000
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('📊 SQL Query:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
    console.error('📝 Query:', text.substring(0, 200));
    throw error;
  }
}

async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function run(text, params) {
  const result = await query(text, params);
  return { lastInsertRowid: result.rowsInsertId, changes: result.rowCount, rows: result.rows };
}

async function getClient() {
  return await pool.connect();
}

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  run,
  getClient,
  testConnection
};