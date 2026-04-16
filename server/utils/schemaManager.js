const { Pool } = require('pg');

const SCHEMA_PREFIX = 'tenant_';

let pool = null;

function getPool() {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: isProduction ? 20 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

function getTenantSchemaName(tenantId) {
  if (!tenantId) return 'public';
  return `${SCHEMA_PREFIX}${tenantId.substring(0, 8).replace(/-/g, '')}`;
}

async function ensureTenantSchema(tenantId) {
  const schemaName = getTenantSchemaName(tenantId);
  const client = getPool();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    console.log(`✅ Schema "${schemaName}" ready`);
    return schemaName;
  } catch (error) {
    console.error(`❌ Failed to create schema ${schemaName}:`, error.message);
    throw error;
  }
}

async function schemaExists(schemaName) {
  const result = await getPool().query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
    [schemaName]
  );
  return result.rows.length > 0;
}

async function listTenantSchemas() {
  const result = await getPool().query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1`,
    [`${SCHEMA_PREFIX}%`]
  );
  return result.rows.map(r => r.schema_name);
}

async function executeInSchema(schemaName, callback) {
  const client = await getPool().connect();
  try {
    await client.query(`SET search_path TO ${schemaName}`);
    const result = await callback(client);
    return result;
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
}

async function createAllTablesInSchema(schemaName) {
  const client = await getPool().connect();
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS ${schemaName}.factories (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      address TEXT,
      phone VARCHAR(20),
      email VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.godowns (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      factory_id UUID,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      type VARCHAR(50),
      location TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.units (
      id UUID PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50),
      decimal_places INTEGER DEFAULT 2,
      is_active BOOLEAN DEFAULT true
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.raw_materials (
      id UUID PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      name_bn VARCHAR(255),
      category VARCHAR(100),
      unit_id UUID REFERENCES ${schemaName}.units(id),
      hsn_code VARCHAR(20),
      min_stock_level DECIMAL(15,2) DEFAULT 0,
      max_stock_level DECIMAL(15,2),
      opening_qty DECIMAL(15,2) DEFAULT 0,
      opening_rate DECIMAL(15,4) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.products (
      id UUID PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      name_bn VARCHAR(255),
      product_type VARCHAR(50),
      category VARCHAR(100),
      pack_size DECIMAL(10,2) DEFAULT 50,
      unit_id UUID REFERENCES ${schemaName}.units(id),
      mrp DECIMAL(15,2),
      sale_rate DECIMAL(15,2) DEFAULT 0,
      min_stock_level DECIMAL(15,2) DEFAULT 0,
      opening_qty DECIMAL(15,2) DEFAULT 0,
      opening_rate DECIMAL(15,4) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.formulas (
      id UUID PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      product_id UUID,
      version INTEGER DEFAULT 1,
      target_protein DECIMAL(5,2),
      target_moisture DECIMAL(5,2),
      target_fiber DECIMAL(5,2),
      target_fat DECIMAL(5,2),
      target_ash DECIMAL(5,2),
      target_energy DECIMAL(5,2),
      status VARCHAR(20) DEFAULT 'draft',
      is_active BOOLEAN DEFAULT true,
      created_by UUID,
      approved_by UUID,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.formula_ingredients (
      id UUID PRIMARY KEY,
      formula_id UUID REFERENCES ${schemaName}.formulas(id) ON DELETE CASCADE,
      raw_material_id UUID,
      percentage DECIMAL(5,2) NOT NULL,
      min_percentage DECIMAL(5,2),
      max_percentage DECIMAL(5,2),
      is_mandatory BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.suppliers (
      id UUID PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      name_bn VARCHAR(255),
      contact_person VARCHAR(100),
      phone VARCHAR(20),
      mobile VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      address_bn TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      gstin VARCHAR(50),
      pan VARCHAR(20),
      bank_name VARCHAR(255),
      bank_account VARCHAR(50),
      credit_limit DECIMAL(15,2) DEFAULT 0,
      opening_balance DECIMAL(15,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.customers (
      id UUID PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      name_bn VARCHAR(255),
      type VARCHAR(50),
      contact_person VARCHAR(100),
      phone VARCHAR(20),
      mobile VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      address_bn TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      gstin VARCHAR(50),
      credit_limit DECIMAL(15,2) DEFAULT 0,
      outstanding DECIMAL(15,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.purchase_orders (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      po_number VARCHAR(50) NOT NULL,
      supplier_id UUID,
      factory_id UUID,
      po_date DATE,
      expected_date DATE,
      status VARCHAR(20) DEFAULT 'draft',
      subtotal DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      workflow_id UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.po_items (
      id UUID PRIMARY KEY,
      po_id UUID REFERENCES ${schemaName}.purchase_orders(id) ON DELETE CASCADE,
      raw_material_id UUID,
      description TEXT,
      quantity DECIMAL(15,2),
      unit_id UUID,
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.goods_inward (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      inward_number VARCHAR(50) NOT NULL,
      po_id UUID,
      supplier_id UUID,
      factory_id UUID,
      inward_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      total_qty DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.inward_items (
      id UUID PRIMARY KEY,
      inward_id UUID REFERENCES ${schemaName}.goods_inward(id) ON DELETE CASCADE,
      raw_material_id UUID,
      po_item_id UUID,
      batch_number VARCHAR(50),
      quantity DECIMAL(15,2),
      unit_id UUID,
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      mfg_date DATE,
      expiry_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.stock_ledger (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      item_type VARCHAR(50) NOT NULL,
      item_id UUID NOT NULL,
      godown_id UUID,
      batch_number VARCHAR(50),
      quantity DECIMAL(15,2) NOT NULL,
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      transaction_type VARCHAR(50),
      transaction_id UUID,
      reference_number VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.transfers (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      transfer_number VARCHAR(50) NOT NULL,
      from_godown_id UUID,
      to_godown_id UUID,
      transfer_date DATE,
      status VARCHAR(20) DEFAULT 'draft',
      total_qty DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.transfer_items (
      id UUID PRIMARY KEY,
      transfer_id UUID REFERENCES ${schemaName}.transfers(id) ON DELETE CASCADE,
      item_type VARCHAR(50),
      item_id UUID,
      quantity DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.stock_adjustments (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      adjustment_number VARCHAR(50) NOT NULL,
      godown_id UUID,
      adjustment_date DATE,
      type VARCHAR(20),
      status VARCHAR(20) DEFAULT 'draft',
      total_qty DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.adjustment_items (
      id UUID PRIMARY KEY,
      adjustment_id UUID REFERENCES ${schemaName}.stock_adjustments(id) ON DELETE CASCADE,
      item_type VARCHAR(50),
      item_id UUID,
      batch_number VARCHAR(50),
      quantity DECIMAL(15,2),
      variance_qty DECIMAL(15,2),
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.production_batches (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      batch_number VARCHAR(50) NOT NULL,
      formula_id UUID,
      product_id UUID,
      factory_id UUID,
      godown_id UUID,
      batch_date DATE,
      status VARCHAR(20) DEFAULT 'planned',
      planned_qty DECIMAL(15,2),
      produced_qty DECIMAL(15,2),
      total_cost DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.batch_consumption (
      id UUID PRIMARY KEY,
      batch_id UUID REFERENCES ${schemaName}.production_batches(id) ON DELETE CASCADE,
      raw_material_id UUID,
      quantity DECIMAL(15,2),
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.machines (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      type VARCHAR(100),
      capacity DECIMAL(15,2),
      status VARCHAR(20) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.qc_parameters (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      type VARCHAR(50),
      unit VARCHAR(50),
      min_value DECIMAL(10,4),
      max_value DECIMAL(10,4),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.qc_results (
      id UUID PRIMARY KEY,
      batch_id UUID,
      parameter_id UUID,
      value DECIMAL(10,4),
      status VARCHAR(20),
      tested_by UUID,
      tested_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.sales_orders (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      order_number VARCHAR(50) NOT NULL,
      customer_id UUID,
      factory_id UUID,
      order_date DATE,
      delivery_date DATE,
      status VARCHAR(20) DEFAULT 'draft',
      subtotal DECIMAL(15,2) DEFAULT 0,
      discount_amount DECIMAL(15,2) DEFAULT 0,
      tax_amount DECIMAL(15,2) DEFAULT 0,
      net_amount DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      workflow_id UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.so_items (
      id UUID PRIMARY KEY,
      so_id UUID REFERENCES ${schemaName}.sales_orders(id) ON DELETE CASCADE,
      product_id UUID,
      quantity DECIMAL(15,2),
      unit_id UUID,
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.sales_invoices (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      invoice_number VARCHAR(50) NOT NULL,
      order_id UUID,
      customer_id UUID,
      factory_id UUID,
      invoice_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      subtotal DECIMAL(15,2) DEFAULT 0,
      discount_amount DECIMAL(15,2) DEFAULT 0,
      tax_amount DECIMAL(15,2) DEFAULT 0,
      net_amount DECIMAL(15,2) DEFAULT 0,
      paid_amount DECIMAL(15,2) DEFAULT 0,
      payment_status VARCHAR(20) DEFAULT 'unpaid',
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.invoice_items (
      id UUID PRIMARY KEY,
      invoice_id UUID REFERENCES ${schemaName}.sales_invoices(id) ON DELETE CASCADE,
      product_id UUID,
      quantity DECIMAL(15,2),
      unit_id UUID,
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.sales_returns (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      return_number VARCHAR(50) NOT NULL,
      invoice_id UUID,
      customer_id UUID,
      return_date DATE,
      status VARCHAR(20) DEFAULT 'draft',
      total_amount DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.return_items (
      id UUID PRIMARY KEY,
      return_id UUID REFERENCES ${schemaName}.sales_returns(id) ON DELETE CASCADE,
      product_id UUID,
      quantity DECIMAL(15,2),
      rate DECIMAL(15,4),
      amount DECIMAL(15,2),
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.account_groups (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      parent_id UUID,
      nature VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.accounts (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      group_id UUID,
      opening_balance DECIMAL(15,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.transactions (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      voucher_number VARCHAR(50) NOT NULL,
      voucher_type VARCHAR(50),
      date DATE,
      account_id UUID,
      debit DECIMAL(15,2) DEFAULT 0,
      credit DECIMAL(15,2) DEFAULT 0,
      narration TEXT,
      reference_id UUID,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.payments (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      payment_number VARCHAR(50) NOT NULL,
      payment_type VARCHAR(20),
      party_type VARCHAR(20),
      party_id UUID,
      account_id UUID,
      amount DECIMAL(15,2) NOT NULL,
      payment_date DATE,
      reference_number VARCHAR(50),
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.vehicles (
      id UUID PRIMARY KEY,
      registration_number VARCHAR(50) NOT NULL,
      vehicle_type VARCHAR(50),
      capacity DECIMAL(15,2),
      owner_name VARCHAR(255),
      phone VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.drivers (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      license_number VARCHAR(50),
      phone VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.delivery_orders (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      order_number VARCHAR(50) NOT NULL,
      invoice_id UUID,
      vehicle_id UUID,
      driver_id UUID,
      delivery_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.activity_log (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      user_id UUID,
      module VARCHAR(100),
      action VARCHAR(100),
      entity_id UUID,
      old_value JSONB,
      new_value JSONB,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.settings (
      id UUID PRIMARY KEY,
      key VARCHAR(100) NOT NULL,
      value TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(key)
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.sequences (
      id UUID PRIMARY KEY,
      prefix VARCHAR(20) NOT NULL,
      current_value INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(prefix)
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.notifications (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      user_id UUID,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      type VARCHAR(50),
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.documents (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      entity_type VARCHAR(50),
      entity_id UUID,
      document_type VARCHAR(50),
      file_name VARCHAR(255),
      file_path TEXT,
      file_size INTEGER,
      uploaded_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.regions (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.routes (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      region_id UUID,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.price_lists (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      valid_from DATE,
      valid_to DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.price_list_items (
      id UUID PRIMARY KEY,
      price_list_id UUID,
      product_id UUID,
      min_qty DECIMAL(15,2),
      rate DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.discount_rules (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      rule_type VARCHAR(50),
      condition JSONB,
      discount_percent DECIMAL(5,2),
      discount_amount DECIMAL(15,2),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.currencies (
      id UUID PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(10) NOT NULL,
      symbol VARCHAR(10),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.credit_notes (
      id UUID PRIMARY KEY,
      note_number VARCHAR(50) NOT NULL,
      customer_id UUID,
      amount DECIMAL(15,2) NOT NULL,
      note_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.recurring_orders (
      id UUID PRIMARY KEY,
      tenant_id UUID,
      customer_id UUID,
      product_id UUID,
      quantity DECIMAL(15,2),
      frequency VARCHAR(20),
      next_date DATE,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.job_cards (
      id UUID PRIMARY KEY,
      card_number VARCHAR(50) NOT NULL,
      batch_id UUID,
      machine_id UUID,
      operator_id UUID,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      status VARCHAR(20) DEFAULT 'pending',
      output_qty DECIMAL(15,2),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`
  ];

  try {
    for (const sql of tables) {
      await client.query(sql);
    }
    console.log(`✅ All tables created in schema ${schemaName}`);
  } catch (error) {
    console.error(`❌ Error creating tables in ${schemaName}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function dropTenantSchema(tenantId) {
  const schemaName = getTenantSchemaName(tenantId);
  try {
    await getPool().query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    console.log(`✅ Schema ${schemaName} dropped`);
  } catch (error) {
    console.error(`❌ Failed to drop schema:`, error.message);
    throw error;
  }
}

function closePool() {
  if (pool) {
    pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  getTenantSchemaName,
  ensureTenantSchema,
  schemaExists,
  listTenantSchemas,
  executeInSchema,
  createAllTablesInSchema,
  dropTenantSchema,
  closePool
};