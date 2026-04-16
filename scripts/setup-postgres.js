require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createPublicTables() {
  console.log('📦 Creating public schema tables...');
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      logo_url TEXT,
      is_active BOOLEAN DEFAULT true,
      plan TEXT DEFAULT 'standard',
      max_users INTEGER DEFAULT 10,
      max_factories INTEGER DEFAULT 5,
      subscription_valid_until TIMESTAMP,
      auto_renew BOOLEAN DEFAULT true,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT false,
      permissions JSONB,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      name_bn TEXT,
      email TEXT,
      phone TEXT,
      role_id UUID REFERENCES roles(id),
      factory_id UUID,
      department TEXT,
      designation TEXT,
      is_active BOOLEAN DEFAULT true,
      email_verified BOOLEAN DEFAULT false,
      last_login TIMESTAMP,
      login_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS user_mfa (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      secret TEXT,
      backup_codes_encrypted TEXT,
      method TEXT DEFAULT 'totp',
      is_active BOOLEAN DEFAULT false,
      failed_attempts INTEGER DEFAULT 0,
      last_verified TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS used_backup_codes (
      id UUID PRIMARY KEY,
      mfa_id UUID,
      code TEXT,
      used_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS active_sessions (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_value TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      expires_at TIMESTAMP,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS login_history (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      user_id UUID,
      username TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN,
      failure_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS migrations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )`
  ];

  for (const sql of tables) {
    try {
      await pool.query(sql);
    } catch (error) {
      console.error('❌ Error creating table:', error.message);
    }
  }
  
  console.log('✅ Public schema tables created');
}

async function createDefaultData() {
  console.log('👤 Creating default tenant and admin user...');
  
  // Check if admin already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    ['admin']
  );
  
  if (existingUser.rows.length > 0) {
    console.log('✅ Admin user already exists');
    return;
  }
  
  const tenantId = uuidv4();
  const roleId = uuidv4();
  const userId = uuidv4();
  const factoryId = uuidv4();
  const passwordHash = bcrypt.hashSync('admin123', 12);
  
  // Create tenant
  await pool.query(
    `INSERT INTO tenants (id, code, name, is_active, plan, max_users, max_factories, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [tenantId, 'DEFAULT', 'Default Organization', true, 'enterprise', 1000, 10, new Date()]
  );
  
  // Create role
  await pool.query(
    `INSERT INTO roles (id, tenant_id, name, description, is_system, permissions, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [roleId, tenantId, 'Administrator', 'Full system access', true, 
     JSON.stringify({ 
       dashboard: ['view'], master: ['add', 'edit', 'delete', 'view'], 
       purchase: ['add', 'edit', 'delete', 'view'], sales: ['add', 'edit', 'delete', 'view'],
       inventory: ['add', 'edit', 'delete', 'view'], production: ['add', 'edit', 'delete', 'view'],
       finance: ['add', 'edit', 'delete', 'view'], transport: ['add', 'edit', 'delete', 'view'],
       reports: ['view'], admin: ['add', 'edit', 'delete', 'view']
     }), true, new Date()]
  );
  
  // Create admin user
  await pool.query(
    `INSERT INTO users (id, tenant_id, username, password_hash, name, email, role_id, factory_id, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [userId, tenantId, 'admin', passwordHash, 'System Admin', 'admin@feedmill.com', roleId, factoryId, true, new Date()]
  );
  
  console.log('✅ Default tenant and admin user created');
  console.log('   Username: admin');
  console.log('   Password: admin123');
}

async function runSetup() {
  try {
    console.log('🔄 Setting up PostgreSQL database...\n');
    
    // Test connection
    const result = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Connected to PostgreSQL:', result.rows[0].version.split(' ')[0]);
    
    // Create tables
    await createPublicTables();
    
    // Create default data
    await createDefaultData();
    
    console.log('\n✅ Database setup complete!');
    console.log('   You can now start the server.');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSetup();
}

module.exports = { createPublicTables, createDefaultData };