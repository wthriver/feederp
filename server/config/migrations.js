const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let db = null;

function initMigrations() {
    const dbPath = path.join(__dirname, '../../data/feedmill.db');
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
}

function ensureMigrationsTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

function isMigrationApplied(name) {
    const row = db.prepare('SELECT name FROM migrations WHERE name = ?').get(name);
    return !!row;
}

function markMigrationApplied(name) {
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
}

function runMigrations() {
    initMigrations();
    ensureMigrationsTable();
    
    const migrations = [
        {
            name: '001_add_missing_indexes',
            up: `
                CREATE INDEX IF NOT EXISTS idx_godowns_factory ON godowns(factory_id);
                CREATE INDEX IF NOT EXISTS idx_godowns_type ON godowns(type);
                CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
                CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
                CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
                CREATE INDEX IF NOT EXISTS idx_suppliers_state ON suppliers(state);
                CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
                CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
                CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
                CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
                CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
                CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
            `
        },
        {
            name: '002_add_activity_log_index',
            up: `
                CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON activity_log(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
                CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module);
                CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
            `
        },
        {
            name: '003_add_stock_indexes',
            up: `
                CREATE INDEX IF NOT EXISTS idx_stock_godown ON stock(godown_id);
                CREATE INDEX IF NOT EXISTS idx_stock_item ON stock(item_type, item_id);
                CREATE INDEX IF NOT EXISTS idx_stock_factory ON stock(factory_id);
            `
        }
    ];
    
    let applied = 0;
    let skipped = 0;
    
    for (const migration of migrations) {
        if (isMigrationApplied(migration.name)) {
            skipped++;
            continue;
        }
        
        console.log(`  Applying migration: ${migration.name}`);
        try {
            db.exec(migration.up);
            markMigrationApplied(migration.name);
            applied++;
        } catch (error) {
            console.error(`  Error applying ${migration.name}:`, error.message);
        }
    }
    
    console.log(`  Migrations: ${applied} applied, ${skipped} skipped`);
    
    db.close();
}

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };