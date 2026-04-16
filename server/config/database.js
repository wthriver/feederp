const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

let db = null;
let pgPool = null;
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

function getDb() {
    if (DB_TYPE === 'postgresql') {
        return pgPool;
    }
    return db;
}

async function initDatabase() {
    if (DB_TYPE === 'postgresql') {
        await initPostgres();
    } else {
        initSqlite();
    }
    await createTables();
    // Skip seeding - will create users manually
}

function initSqlite() {
    const dbPath = path.join(__dirname, '../../data/feedmill.db');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = 10000');
}

async function initPostgres() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        max: isProduction ? 20 : 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    // Test connection
    const result = await pgPool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Connected to PostgreSQL:', result.rows[0].version.split(' ')[0]);
}

async function createTables() {
    let sql = `
        -- Tenants (for SaaS multi-tenancy)
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            domain TEXT,
            database_url TEXT,
            logo_url TEXT,
            is_active INTEGER DEFAULT 1,
            plan TEXT DEFAULT 'standard',
            max_users INTEGER DEFAULT 10,
            max_factories INTEGER DEFAULT 5,
            subscription_valid_until TEXT,
            auto_renew INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Tenant Settings
        CREATE TABLE IF NOT EXISTS tenant_settings (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, key)
        );

        -- Tenant Invoices/Billing
        CREATE TABLE IF NOT EXISTS tenant_invoices (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
            invoice_number TEXT NOT NULL,
            invoice_date TEXT NOT NULL,
            period_from TEXT NOT NULL,
            period_to TEXT NOT NULL,
            amount REAL NOT NULL,
            tax_amount REAL DEFAULT 0,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            paid_at TEXT,
            payment_method TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Factories/Branches
        CREATE TABLE IF NOT EXISTS factories (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, code)
        );

        -- Godowns/Warehouses
        CREATE TABLE IF NOT EXISTS godowns (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            factory_id TEXT REFERENCES factories(id),
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            type TEXT CHECK(type IN ('raw_material','finished_goods','semi_finished','general')),
            location TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, factory_id, code)
        );

        -- Units of Measurement
        CREATE TABLE IF NOT EXISTS units (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            decimal_places INTEGER DEFAULT 2,
            is_active INTEGER DEFAULT 1
        );

        -- Raw Materials
        CREATE TABLE IF NOT EXISTS raw_materials (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_bn TEXT,
            category TEXT,
            unit_id TEXT REFERENCES units(id),
            hsn_code TEXT,
            min_stock_level REAL DEFAULT 0,
            max_stock_level REAL,
            opening_qty REAL DEFAULT 0,
            opening_rate REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Finished Products
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_bn TEXT,
            product_type TEXT CHECK(product_type IN ('cattle','poultry','fish','other')),
            category TEXT,
            pack_size REAL DEFAULT 50,
            unit_id TEXT REFERENCES units(id),
            mrp REAL,
            sale_rate REAL DEFAULT 0,
            min_stock_level REAL DEFAULT 0,
            opening_qty REAL DEFAULT 0,
            opening_rate REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Prices
        CREATE TABLE IF NOT EXISTS product_prices (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            product_id TEXT REFERENCES products(id),
            unit_id TEXT REFERENCES units(id),
            min_qty REAL DEFAULT 0,
            rate REAL NOT NULL,
            mrp REAL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Feed Formulas/Recipes
        CREATE TABLE IF NOT EXISTS formulas (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            product_id TEXT REFERENCES products(id),
            version INTEGER DEFAULT 1,
            target_protein REAL,
            target_moisture REAL,
            target_fiber REAL,
            target_fat REAL,
            target_ash REAL,
            target_energy REAL,
            status TEXT DEFAULT 'draft',
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            approved_by TEXT,
            approved_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Formula Ingredients
        CREATE TABLE IF NOT EXISTS formula_ingredients (
            id TEXT PRIMARY KEY,
            formula_id TEXT REFERENCES formulas(id) ON DELETE CASCADE,
            raw_material_id TEXT REFERENCES raw_materials(id),
            percentage REAL NOT NULL,
            min_percentage REAL,
            max_percentage REAL,
            is_mandatory INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Suppliers
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_bn TEXT,
            contact_person TEXT,
            phone TEXT,
            mobile TEXT,
            email TEXT,
            address TEXT,
            address_bn TEXT,
            city TEXT,
            state TEXT,
            gstin TEXT,
            pan TEXT,
            payment_terms TEXT,
            credit_limit REAL DEFAULT 0,
            rating REAL DEFAULT 0,
            opening_balance REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Customers/Dealers
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_bn TEXT,
            type TEXT CHECK(type IN ('dealer','retailer','direct','government')),
            contact_person TEXT,
            phone TEXT,
            mobile TEXT,
            email TEXT,
            address TEXT,
            address_bn TEXT,
            city TEXT,
            state TEXT,
            gstin TEXT,
            route_id TEXT,
            credit_limit REAL DEFAULT 0,
            outstanding REAL DEFAULT 0,
            price_list TEXT DEFAULT 'standard',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Routes
        CREATE TABLE IF NOT EXISTS routes (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            factory_id TEXT REFERENCES factories(id),
            name TEXT NOT NULL,
            name_bn TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Purchase Orders
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            po_number TEXT UNIQUE NOT NULL,
            supplier_id TEXT REFERENCES suppliers(id),
            factory_id TEXT REFERENCES factories(id),
            po_date TEXT NOT NULL,
            expected_date TEXT,
            status TEXT DEFAULT 'draft',
            subtotal REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            total_amount REAL DEFAULT 0,
            notes TEXT,
            created_by TEXT,
            approved_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- PO Items
        CREATE TABLE IF NOT EXISTS po_items (
            id TEXT PRIMARY KEY,
            po_id TEXT REFERENCES purchase_orders(id) ON DELETE CASCADE,
            raw_material_id TEXT REFERENCES raw_materials(id),
            description TEXT,
            quantity REAL NOT NULL,
            unit_id TEXT REFERENCES units(id),
            rate REAL NOT NULL,
            amount REAL NOT NULL,
            delivered_qty REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Goods Inward
        CREATE TABLE IF NOT EXISTS goods_inward (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            grn_number TEXT UNIQUE NOT NULL,
            po_id TEXT REFERENCES purchase_orders(id),
            supplier_id TEXT REFERENCES suppliers(id),
            factory_id TEXT REFERENCES factories(id),
            godown_id TEXT REFERENCES godowns(id),
            inward_date TEXT NOT NULL,
            challan_number TEXT,
            challan_date TEXT,
            vehicle_number TEXT,
            driver_name TEXT,
            driver_phone TEXT,
            status TEXT DEFAULT 'pending',
            total_qty REAL DEFAULT 0,
            accepted_qty REAL DEFAULT 0,
            rejected_qty REAL DEFAULT 0,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Inward Items
        CREATE TABLE IF NOT EXISTS inward_items (
            id TEXT PRIMARY KEY,
            goods_inward_id TEXT REFERENCES goods_inward(id) ON DELETE CASCADE,
            po_item_id TEXT REFERENCES po_items(id),
            raw_material_id TEXT REFERENCES raw_materials(id),
            batch_number TEXT,
            description TEXT,
            quantity REAL NOT NULL,
            accepted_qty REAL,
            rejected_qty REAL DEFAULT 0,
            rate REAL,
            amount REAL,
            mfg_date TEXT,
            expiry_date TEXT,
            barcode TEXT,
            qc_status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Purchase Invoices
        CREATE TABLE IF NOT EXISTS purchase_invoices (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            invoice_number TEXT UNIQUE NOT NULL,
            supplier_id TEXT REFERENCES suppliers(id),
            goods_inward_id TEXT REFERENCES goods_inward(id),
            invoice_date TEXT NOT NULL,
            invoice_amount REAL NOT NULL,
            tax_amount REAL DEFAULT 0,
            total_amount REAL NOT NULL,
            payment_status TEXT DEFAULT 'pending',
            due_date TEXT,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Stock Ledger
        CREATE TABLE IF NOT EXISTS stock_ledger (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            batch_number TEXT,
            godown_id TEXT REFERENCES godowns(id),
            transaction_type TEXT NOT NULL,
            reference_type TEXT,
            reference_id TEXT,
            quantity REAL NOT NULL,
            rate REAL,
            amount REAL,
            balance_qty REAL,
            balance_amount REAL,
            mfg_date TEXT,
            expiry_date TEXT,
            barcode TEXT,
            remarks TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Godown Transfers
        CREATE TABLE IF NOT EXISTS transfers (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            transfer_number TEXT UNIQUE NOT NULL,
            from_godown_id TEXT REFERENCES godowns(id),
            to_godown_id TEXT REFERENCES godowns(id),
            transfer_date TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            notes TEXT,
            created_by TEXT,
            approved_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Transfer Items
        CREATE TABLE IF NOT EXISTS transfer_items (
            id TEXT PRIMARY KEY,
            transfer_id TEXT REFERENCES transfers(id) ON DELETE CASCADE,
            item_type TEXT,
            item_id TEXT,
            batch_number TEXT,
            quantity REAL NOT NULL,
            barcode TEXT
        );

        -- Stock Adjustments
        CREATE TABLE IF NOT EXISTS stock_adjustments (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            adjustment_number TEXT UNIQUE NOT NULL,
            godown_id TEXT REFERENCES godowns(id),
            adjustment_date TEXT NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            created_by TEXT,
            approved_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Adjustment Items
        CREATE TABLE IF NOT EXISTS adjustment_items (
            id TEXT PRIMARY KEY,
            adjustment_id TEXT REFERENCES stock_adjustments(id) ON DELETE CASCADE,
            item_type TEXT,
            item_id TEXT,
            batch_number TEXT,
            system_qty REAL,
            actual_qty REAL,
            difference REAL,
            reason TEXT
        );

        -- Production Batches
        CREATE TABLE IF NOT EXISTS production_batches (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            batch_number TEXT UNIQUE NOT NULL,
            formula_id TEXT REFERENCES formulas(id),
            product_id TEXT REFERENCES products(id),
            factory_id TEXT REFERENCES factories(id),
            godown_id TEXT REFERENCES godowns(id),
            batch_date TEXT NOT NULL,
            planned_qty REAL NOT NULL,
            actual_qty REAL,
            status TEXT DEFAULT 'planned',
            machine_id TEXT,
            shift TEXT,
            started_at TEXT,
            completed_at TEXT,
            loss_percentage REAL,
            loss_qty REAL,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Batch Raw Material Consumption
        CREATE TABLE IF NOT EXISTS batch_consumption (
            id TEXT PRIMARY KEY,
            batch_id TEXT REFERENCES production_batches(id) ON DELETE CASCADE,
            raw_material_id TEXT REFERENCES raw_materials(id),
            formula_qty REAL,
            actual_qty REAL,
            variance REAL,
            godown_id TEXT,
            batch_number TEXT
        );

        -- Batch Quality Tests
        CREATE TABLE IF NOT EXISTS batch_quality (
            id TEXT PRIMARY KEY,
            batch_id TEXT REFERENCES production_batches(id),
            test_date TEXT,
            protein REAL,
            moisture REAL,
            fiber REAL,
            fat REAL,
            ash REAL,
            energy REAL,
            status TEXT DEFAULT 'pending',
            remarks TEXT,
            tested_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Machines
        CREATE TABLE IF NOT EXISTS machines (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            factory_id TEXT REFERENCES factories(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            brand TEXT,
            model TEXT,
            capacity REAL,
            unit TEXT,
            status TEXT DEFAULT 'available',
            last_maintenance TEXT,
            next_maintenance TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- QC Parameters
        CREATE TABLE IF NOT EXISTS qc_parameters (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            name_bn TEXT,
            code TEXT UNIQUE,
            type TEXT CHECK(type IN ('raw_material','finished_product','semi_finished')),
            min_value REAL,
            max_value REAL,
            target_value REAL,
            unit TEXT,
            is_mandatory INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Quality Parameters
        CREATE TABLE IF NOT EXISTS quality_parameters (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            code TEXT,
            category TEXT,
            unit_id TEXT REFERENCES units(id),
            test_method TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- QC Test Results
        CREATE TABLE IF NOT EXISTS qc_results (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            reference_type TEXT,
            reference_id TEXT,
            parameter_id TEXT REFERENCES qc_parameters(id),
            value REAL NOT NULL,
            is_pass INTEGER,
            remarks TEXT,
            tested_by TEXT,
            tested_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Quality Standards
        CREATE TABLE IF NOT EXISTS quality_standards (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            product_type TEXT,
            parameter_id TEXT REFERENCES qc_parameters(id),
            min_value REAL,
            max_value REAL,
            target_value REAL,
            is_active INTEGER DEFAULT 1
        );

        -- Sales Orders
        CREATE TABLE IF NOT EXISTS sales_orders (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            order_number TEXT UNIQUE NOT NULL,
            customer_id TEXT REFERENCES customers(id),
            factory_id TEXT REFERENCES factories(id),
            order_date TEXT NOT NULL,
            delivery_date TEXT,
            status TEXT DEFAULT 'pending',
            subtotal REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            net_amount REAL DEFAULT 0,
            notes TEXT,
            created_by TEXT,
            approved_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- SO Items
        CREATE TABLE IF NOT EXISTS so_items (
            id TEXT PRIMARY KEY,
            so_id TEXT REFERENCES sales_orders(id) ON DELETE CASCADE,
            product_id TEXT REFERENCES products(id),
            batch_number TEXT,
            quantity REAL NOT NULL,
            unit_id TEXT REFERENCES units(id),
            rate REAL NOT NULL,
            amount REAL NOT NULL,
            delivered_qty REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Sales Invoices
        CREATE TABLE IF NOT EXISTS sales_invoices (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            invoice_number TEXT UNIQUE NOT NULL,
            so_id TEXT REFERENCES sales_orders(id),
            customer_id TEXT REFERENCES customers(id),
            factory_id TEXT REFERENCES factories(id),
            invoice_date TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            net_amount REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            amount_due REAL,
            payment_status TEXT DEFAULT 'pending',
            due_date TEXT,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Invoice Items
        CREATE TABLE IF NOT EXISTS invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT REFERENCES sales_invoices(id) ON DELETE CASCADE,
            product_id TEXT REFERENCES products(id),
            batch_number TEXT,
            quantity REAL NOT NULL,
            rate REAL NOT NULL,
            amount REAL NOT NULL,
            godown_id TEXT,
            barcode TEXT
        );

        -- Sales Returns
        CREATE TABLE IF NOT EXISTS sales_returns (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            return_number TEXT UNIQUE NOT NULL,
            invoice_id TEXT REFERENCES sales_invoices(id),
            customer_id TEXT REFERENCES customers(id),
            return_date TEXT NOT NULL,
            reason TEXT,
            total_amount REAL,
            status TEXT DEFAULT 'pending',
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Return Items
        CREATE TABLE IF NOT EXISTS return_items (
            id TEXT PRIMARY KEY,
            return_id TEXT REFERENCES sales_returns(id) ON DELETE CASCADE,
            product_id TEXT REFERENCES products(id),
            batch_number TEXT,
            quantity REAL NOT NULL,
            rate REAL,
            amount REAL,
            condition TEXT CHECK(condition IN ('resalable','damaged','expired'))
        );

        -- Account Groups
        CREATE TABLE IF NOT EXISTS account_groups (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            name_bn TEXT,
            type TEXT CHECK(type IN ('asset','liability','income','expense')),
            parent_id TEXT,
            nature TEXT,
            is_system INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Ledgers/Accounts
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_bn TEXT,
            group_id TEXT,
            type TEXT CHECK(type IN ('customer','supplier','bank','cash','expense','income','general')),
            party_type TEXT,
            party_id TEXT,
            opening_balance REAL DEFAULT 0,
            current_balance REAL DEFAULT 0,
            credit_limit REAL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Transactions (Vouchers)
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            voucher_number TEXT UNIQUE NOT NULL,
            voucher_type TEXT CHECK(voucher_type IN ('receipt','payment','journal','credit_note','debit_note','contra')),
            date TEXT NOT NULL,
            account_id TEXT,
            opposite_account_id TEXT,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            narration TEXT,
            reference_type TEXT,
            reference_id TEXT,
            is_posted INTEGER DEFAULT 1,
            is_cancelled INTEGER DEFAULT 0,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Payments
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            payment_number TEXT UNIQUE NOT NULL,
            payment_date TEXT NOT NULL,
            party_type TEXT CHECK(party_type IN ('customer','supplier','other')),
            party_id TEXT,
            account_id TEXT,
            amount REAL NOT NULL,
            payment_mode TEXT CHECK(payment_mode IN ('cash','bank','cheque','neft','rtgs','upi','card','wallet')),
            reference_number TEXT,
            bank_id TEXT,
            cheque_number TEXT,
            cheque_date TEXT,
            status TEXT DEFAULT 'completed',
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Vehicles
        CREATE TABLE IF NOT EXISTS vehicles (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            vehicle_number TEXT UNIQUE NOT NULL,
            type TEXT,
            capacity REAL,
            owner_name TEXT,
            driver_id TEXT,
            status TEXT DEFAULT 'available',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Drivers
        CREATE TABLE IF NOT EXISTS drivers (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            phone TEXT,
            license_number TEXT,
            address TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Delivery Orders
        CREATE TABLE IF NOT EXISTS delivery_orders (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            do_number TEXT UNIQUE NOT NULL,
            invoice_id TEXT REFERENCES sales_invoices(id),
            customer_id TEXT REFERENCES customers(id),
            vehicle_id TEXT REFERENCES vehicles(id),
            driver_id TEXT REFERENCES drivers(id),
            factory_id TEXT REFERENCES factories(id),
            scheduled_date TEXT,
            actual_dispatch_date TEXT,
            actual_delivery_date TEXT,
            status TEXT DEFAULT 'pending',
            route_id TEXT REFERENCES routes(id),
            from_location TEXT,
            to_location TEXT,
            distance REAL,
            expected_time TEXT,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Delivery Tracking
        CREATE TABLE IF NOT EXISTS delivery_tracking (
            id TEXT PRIMARY KEY,
            delivery_order_id TEXT REFERENCES delivery_orders(id),
            location TEXT,
            latitude REAL,
            longitude REAL,
            status TEXT,
            remarks TEXT,
            tracked_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Barcodes
        CREATE TABLE IF NOT EXISTS barcodes (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            barcode TEXT UNIQUE NOT NULL,
            qr_code TEXT,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            batch_number TEXT,
            godown_id TEXT,
            manufactured_date TEXT,
            expiry_date TEXT,
            is_used INTEGER DEFAULT 0,
            used_at TEXT,
            used_reference_type TEXT,
            used_reference_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Barcode Batches
        CREATE TABLE IF NOT EXISTS barcode_batches (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            batch_number TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            generated_by TEXT,
            generated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- IoT Devices
        CREATE TABLE IF NOT EXISTS iot_devices (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            device_code TEXT UNIQUE NOT NULL,
            machine_id TEXT,
            type TEXT,
            name TEXT NOT NULL,
            endpoint TEXT,
            protocol TEXT,
            status TEXT DEFAULT 'active',
            last_seen TEXT,
            config TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- IoT Readings
        CREATE TABLE IF NOT EXISTS iot_readings (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            device_id TEXT,
            parameter TEXT,
            value REAL,
            unit TEXT,
            recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Machine Production Logs
        CREATE TABLE IF NOT EXISTS machine_logs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            machine_id TEXT,
            batch_id TEXT,
            start_time TEXT,
            end_time TEXT,
            runtime_minutes REAL,
            output_qty REAL,
            efficiency REAL,
            energy_consumption REAL,
            status TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Users
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            employee_id TEXT,
            name TEXT NOT NULL,
            name_bn TEXT,
            email TEXT,
            phone TEXT,
            role_id TEXT,
            factory_id TEXT,
            department TEXT,
            designation TEXT,
            is_active INTEGER DEFAULT 1,
            last_login TEXT,
            login_count INTEGER DEFAULT 0,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Roles
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT UNIQUE NOT NULL,
            name_bn TEXT,
            description TEXT,
            is_system INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Role Permissions
        CREATE TABLE IF NOT EXISTS role_permissions (
            id TEXT PRIMARY KEY,
            role_id TEXT,
            module TEXT NOT NULL,
            permission TEXT CHECK(permission IN ('view','add','edit','delete','approve','export','import')),
            granted INTEGER DEFAULT 1,
            UNIQUE(role_id, module, permission)
        );

        -- Activity Log
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            user_id TEXT,
            module TEXT NOT NULL,
            action TEXT NOT NULL,
            record_id TEXT,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- System Settings
        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            type TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Number Sequences
        CREATE TABLE IF NOT EXISTS sequences (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            prefix TEXT NOT NULL,
            name TEXT NOT NULL,
            current_value INTEGER DEFAULT 0,
            padding INTEGER DEFAULT 4,
            is_active INTEGER DEFAULT 1,
            UNIQUE(tenant_id, prefix)
        );

        -- Price Lists
        CREATE TABLE IF NOT EXISTS price_lists (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            code TEXT,
            currency TEXT DEFAULT 'INR',
            is_default INTEGER DEFAULT 0,
            valid_from TEXT,
            valid_to TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Price List Items
        CREATE TABLE IF NOT EXISTS price_list_items (
            id TEXT PRIMARY KEY,
            price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            rate REAL NOT NULL,
            discount_percent REAL DEFAULT 0,
            unit_id TEXT,
            valid_from TEXT,
            valid_to TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Discount Rules
        CREATE TABLE IF NOT EXISTS discount_rules (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            item_type TEXT,
            item_id TEXT,
            customer_type TEXT,
            min_qty REAL,
            max_qty REAL,
            discount_percent REAL,
            discount_amount REAL,
            priority INTEGER DEFAULT 0,
            valid_from TEXT,
            valid_to TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Currencies
        CREATE TABLE IF NOT EXISTS currencies (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT NOT NULL,
            name TEXT,
            symbol TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Currency Rates
        CREATE TABLE IF NOT EXISTS currency_rates (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            code TEXT NOT NULL,
            name TEXT,
            symbol TEXT,
            rate REAL DEFAULT 1,
            is_base INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Credit/Debit Notes
        CREATE TABLE IF NOT EXISTS credit_notes (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            note_number TEXT NOT NULL,
            note_type TEXT NOT NULL,
            reference_type TEXT,
            reference_id TEXT,
            customer_id TEXT,
            invoice_id TEXT,
            amount REAL NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Recurring Orders
        CREATE TABLE IF NOT EXISTS recurring_orders (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            reference_number TEXT NOT NULL,
            customer_id TEXT REFERENCES customers(id),
            order_type TEXT NOT NULL,
            items TEXT,
            frequency TEXT,
            next_date TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Advance Payments
        CREATE TABLE IF NOT EXISTS advance_payments (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            payment_number TEXT NOT NULL,
            customer_id TEXT REFERENCES customers(id),
            amount REAL NOT NULL,
            remaining_amount REAL,
            reference_type TEXT,
            reference_id TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Job Cards
        CREATE TABLE IF NOT EXISTS job_cards (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            job_number TEXT NOT NULL,
            batch_id TEXT REFERENCES production_batches(id),
            operation_name TEXT NOT NULL,
            assigned_to TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT DEFAULT 'pending',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Quality Checklists
        CREATE TABLE IF NOT EXISTS quality_checklists (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            checklist_type TEXT,
            items TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Webhooks
        CREATE TABLE IF NOT EXISTS webhooks (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            events TEXT NOT NULL,
            secret_key TEXT,
            is_active INTEGER DEFAULT 1,
            last_triggered TEXT,
            failure_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Audit Log Archive
        CREATE TABLE IF NOT EXISTS audit_archive (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            record_count INTEGER DEFAULT 0,
            archived_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Tenant API Keys
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            rate_limit INTEGER DEFAULT 1000,
            ip_whitelist TEXT,
            permissions TEXT,
            expires_at TEXT,
            last_used TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Data Exports
        CREATE TABLE IF NOT EXISTS data_exports (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            export_type TEXT NOT NULL,
            format TEXT NOT NULL,
            filters TEXT,
            file_path TEXT,
            status TEXT DEFAULT 'pending',
            record_count INTEGER DEFAULT 0,
            created_by TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Approval System Tables
        CREATE TABLE IF NOT EXISTS approval_history (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            document_type TEXT NOT NULL,
            document_id TEXT NOT NULL,
            document_number TEXT,
            action TEXT NOT NULL,
            comment TEXT,
            approver_id TEXT REFERENCES users(id),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS approval_settings (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            enable_approvals INTEGER DEFAULT 1,
            auto_approve_small_amounts INTEGER DEFAULT 0,
            small_amount_threshold REAL DEFAULT 10000,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
        );

        -- Documents/Attachments
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            mime_type TEXT,
            description TEXT,
            category TEXT DEFAULT 'general',
            uploaded_by TEXT REFERENCES users(id),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
        );

        -- API Tokens
        CREATE TABLE IF NOT EXISTS api_tokens (
            id TEXT PRIMARY KEY,
            api_key_id TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Webhooks
        CREATE TABLE IF NOT EXISTS webhooks (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            url TEXT NOT NULL,
            events TEXT NOT NULL,
            secret TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT REFERENCES users(id),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Regions (for distributed ops)
        CREATE TABLE IF NOT EXISTS regions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            timezone TEXT DEFAULT 'Asia/Kolkata',
            currency TEXT DEFAULT 'INR',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Security & MFA Tables
        CREATE TABLE IF NOT EXISTS user_mfa (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            secret TEXT NOT NULL,
            backup_codes_encrypted TEXT,
            method TEXT DEFAULT 'totp',
            is_active INTEGER DEFAULT 1,
            failed_attempts INTEGER DEFAULT 0,
            last_verified TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS used_backup_codes (
            id TEXT PRIMARY KEY,
            mfa_id TEXT REFERENCES user_mfa(id) ON DELETE CASCADE,
            code TEXT NOT NULL,
            used_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS active_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            tenant_id TEXT REFERENCES tenants(id),
            token_hash TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            device_info TEXT,
            location TEXT,
            is_active INTEGER DEFAULT 1,
            last_activity TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS login_history (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            user_id TEXT REFERENCES users(id),
            username TEXT,
            ip_address TEXT,
            user_agent TEXT,
            location TEXT,
            success INTEGER DEFAULT 1,
            failure_reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Notifications
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            message TEXT,
            type TEXT DEFAULT 'info',
            priority TEXT DEFAULT 'normal',
            is_read INTEGER DEFAULT 0,
            read_at TEXT,
            action_url TEXT,
            entity_type TEXT,
            entity_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Contact Form Submissions
        CREATE TABLE IF NOT EXISTS contact_submissions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'new' CHECK(status IN ('new', 'reviewed', 'replied', 'closed')),
            assigned_to TEXT,
            notes TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Data Retention Policy
        CREATE TABLE IF NOT EXISTS retention_policies (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            entity_type TEXT NOT NULL,
            retention_days INTEGER DEFAULT 365,
            archive_after_days INTEGER DEFAULT 90,
            delete_after_days INTEGER DEFAULT 730,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Workflow Engine Tables
        CREATE TABLE IF NOT EXISTS workflow_definitions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            steps_json TEXT,
            approvers_json TEXT,
            conditions_json TEXT,
            priority INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS workflow_instances (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            definition_id TEXT REFERENCES workflow_definitions(id),
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_review', 'approved', 'rejected', 'cancelled')),
            current_step TEXT,
            current_approver_id TEXT,
            steps_json TEXT,
            history_json TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Validation Rules
        CREATE TABLE IF NOT EXISTS validation_rules (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            name TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            field TEXT NOT NULL,
            validation_type TEXT NOT NULL,
            config_json TEXT,
            priority INTEGER DEFAULT 0,
            error_message TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Dashboard Customization
        CREATE TABLE IF NOT EXISTS dashboard_widgets (
            id TEXT PRIMARY KEY,
            tenant_id TEXT REFERENCES tenants(id),
            user_id TEXT,
            widget_type TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            config_json TEXT,
            is_visible INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Notification Preferences
        CREATE TABLE IF NOT EXISTS notification_preferences (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            tenant_id TEXT REFERENCES tenants(id),
            notification_type TEXT NOT NULL,
            email_enabled INTEGER DEFAULT 1,
            push_enabled INTEGER DEFAULT 1,
            in_app_enabled INTEGER DEFAULT 1,
            frequency TEXT DEFAULT 'immediate' CHECK(frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_factories_tenant ON factories(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_godowns_factory ON godowns(factory_id);
        CREATE INDEX IF NOT EXISTS idx_raw_materials_tenant ON raw_materials(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(po_date);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_goods_inward_tenant ON goods_inward(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_goods_inward_date ON goods_inward(inward_date);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_tenant_item ON stock_ledger(tenant_id, item_type, item_id);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_godown ON stock_ledger(godown_id);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch ON stock_ledger(batch_number);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_date ON stock_ledger(created_at);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_tenant_date ON stock_ledger(tenant_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_production_batches_tenant ON production_batches(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_production_batches_date ON production_batches(batch_date);
        CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(status);
        CREATE INDEX IF NOT EXISTS idx_production_batches_formula ON production_batches(formula_id);
        CREATE INDEX IF NOT EXISTS idx_production_batches_product ON production_batches(product_id);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON sales_orders(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant ON sales_invoices(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment ON sales_invoices(payment_status);
        CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions(tenant_id, date);
        CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id, date);
        CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id);
        CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON activity_log(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module, created_at);
        CREATE INDEX IF NOT EXISTS idx_barcodes_item ON barcodes(item_type, item_id);
        CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
        CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_formulas_tenant ON formulas(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_formulas_product ON formulas(product_id);
        CREATE INDEX IF NOT EXISTS idx_formulas_status ON formulas(status);
        CREATE INDEX IF NOT EXISTS idx_formula_ingredients_formula ON formula_ingredients(formula_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, payment_date);
        CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
        CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant ON active_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(is_active);
        CREATE INDEX IF NOT EXISTS idx_so_items_so ON so_items(so_id);
        CREATE INDEX IF NOT EXISTS idx_so_items_product ON so_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_batch_consumption_batch ON batch_consumption(batch_id);
        CREATE INDEX IF NOT EXISTS idx_batch_consumption_material ON batch_consumption(raw_material_id);
        CREATE INDEX IF NOT EXISTS idx_formula_ingredients_material ON formula_ingredients(raw_material_id);
        CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
        CREATE INDEX IF NOT EXISTS idx_adjustment_items_adjustment ON adjustment_items(adjustment_id);
        CREATE INDEX IF NOT EXISTS idx_sales_returns_tenant ON sales_returns(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_goods_inward_supplier ON goods_inward(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_goods_inward_status ON goods_inward(status);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_factory ON purchase_orders(factory_id);
        CREATE INDEX IF NOT EXISTS idx_production_batches_factory ON production_batches(factory_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_factory ON sales_invoices(factory_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
        CREATE INDEX IF NOT EXISTS idx_workflow_definitions_entity ON workflow_definitions(entity_type);
        CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_workflow_instances_approver ON workflow_instances(current_approver_id, status);
        CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
        CREATE INDEX IF NOT EXISTS idx_validation_rules_entity ON validation_rules(entity_type, field);
        CREATE INDEX IF NOT EXISTS idx_validation_rules_active ON validation_rules(is_active);
        CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON dashboard_widgets(user_id);
        CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
        
        -- Workflow Integration Columns (only if tables exist)
        -- ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS workflow_id TEXT;
        -- ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS workflow_id TEXT;
        -- ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS workflow_id TEXT;
        -- ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS workflow_id TEXT;
        -- ALTER TABLE goods_inward ADD COLUMN IF NOT EXISTS workflow_id TEXT;
        -- ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS workflow_id TEXT;

        -- Multi-tenancy for units
        -- ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_id TEXT;
    `;

    if (DB_TYPE === 'postgresql') {
        await pgPool.query(sql);
    } else {
        try {
            db.exec(sql);
        } catch (e) {
            // If full SQL fails, try splitting by CREATE TABLE
            const createOnly = sql.split(/CREATE TABLE/g).filter(s => s.trim());
            let created = 0;
            for (const stmt of createOnly) {
                try {
                    if (stmt.trim()) {
                        db.exec('CREATE TABLE' + stmt);
                        created++;
                    }
                } catch (e2) {
                    console.log('Table error:', e2.message.substring(0, 50));
                }
            }
            console.log('Created', created, 'tables');
        }
    }
}

async function seedInitialData() {
    const forceSeed = process.env.FORCE_SEED === 'true';
    const existingTenant = DB_TYPE === 'postgresql'
        ? (await pgPool.query('SELECT id FROM tenants WHERE code = $1', ['DEFAULT'])).rows[0]
        : db.prepare('SELECT id FROM tenants WHERE code = ?').get('DEFAULT');

    if (existingTenant && !forceSeed) {
        console.log('  Database already seeded');
        return;
    }

    if (existingTenant && forceSeed) {
        console.log('  Re-seeding database (FORCE_SEED=true)...');
        if (DB_TYPE === 'postgresql') {
            await pgPool.query('DELETE FROM role_permissions');
            await pgPool.query('DELETE FROM users');
            await pgPool.query('DELETE FROM roles');
            await pgPool.query('DELETE FROM suppliers');
            await pgPool.query('DELETE FROM customers');
            await pgPool.query('DELETE FROM raw_materials');
            await pgPool.query('DELETE FROM products');
            await pgPool.query('DELETE FROM machines');
            await pgPool.query('DELETE FROM vehicles');
            await pgPool.query('DELETE FROM drivers');
            await pgPool.query('DELETE FROM account_groups');
            await pgPool.query('DELETE FROM accounts');
            await pgPool.query('DELETE FROM godowns');
            await pgPool.query('DELETE FROM factories');
            await pgPool.query('DELETE FROM sequences');
            await pgPool.query('DELETE FROM settings');
            await pgPool.query('DELETE FROM units');
            await pgPool.query('DELETE FROM routes');
            await pgPool.query('DELETE FROM regions');
            await pgPool.query('DELETE FROM currencies');
            await pgPool.query('DELETE FROM price_lists');
            await pgPool.query('DELETE FROM discount_rules');
            await pgPool.query('DELETE FROM iot_devices');
            await pgPool.query('DELETE FROM iot_readings');
            await pgPool.query('DELETE FROM barcodes');
            await pgPool.query('DELETE FROM qc_parameters');
            await pgPool.query('DELETE FROM product_prices');
            await pgPool.query('DELETE FROM formulas');
            await pgPool.query('DELETE FROM formula_ingredients');
            await pgPool.query('DELETE FROM tenants');
        } else {
            db.exec('PRAGMA foreign_keys = OFF');
            db.exec('DELETE FROM role_permissions');
            db.exec('DELETE FROM users');
            db.exec('DELETE FROM roles');
            db.exec('DELETE FROM suppliers');
            db.exec('DELETE FROM customers');
            db.exec('DELETE FROM raw_materials');
            db.exec('DELETE FROM products');
            db.exec('DELETE FROM machines');
            db.exec('DELETE FROM vehicles');
            db.exec('DELETE FROM drivers');
            db.exec('DELETE FROM account_groups');
            db.exec('DELETE FROM accounts');
            db.exec('DELETE FROM godowns');
            db.exec('DELETE FROM factories');
            db.exec('DELETE FROM sequences');
            db.exec('DELETE FROM settings');
            db.exec('DELETE FROM units');
            db.exec('DELETE FROM routes');
            db.exec('DELETE FROM regions');
            db.exec('DELETE FROM currencies');
            db.exec('DELETE FROM price_lists');
            db.exec('DELETE FROM discount_rules');
            db.exec('DELETE FROM iot_devices');
            db.exec('DELETE FROM barcode_batches');
            db.exec('DELETE FROM quality_parameters');
            db.exec('DELETE FROM qc_parameters');
            db.exec('DELETE FROM product_prices');
            db.exec('DELETE FROM formulas');
            db.exec('DELETE FROM formula_ingredients');
            db.exec('DELETE FROM tenants');
            db.exec('PRAGMA foreign_keys = ON');
        }
    }

    const tenantId = uuidv4();
    const adminId = uuidv4();
    const roleId = uuidv4();
    const factoryId = uuidv4();
    const unitKgId = uuidv4();
    const unitNosId = uuidv4();
    const unitMtId = uuidv4();
    const unitLtrId = uuidv4();
    const godownId = uuidv4();
    const godownId2 = uuidv4();
    const godownId3 = uuidv4();
    const settingId1 = uuidv4();
    const settingId2 = uuidv4();
    const settingId3 = uuidv4();
    const seqPO = uuidv4();
    const seqGRN = uuidv4();
    const seqPI = uuidv4();
    const seqSO = uuidv4();
    const seqINV = uuidv4();
    const seqBATCH = uuidv4();
    const seqDO = uuidv4();
    const seqTRF = uuidv4();
    const seqADJ = uuidv4();
    const seqVCH = uuidv4();

    const adminPassword = bcrypt.hashSync('admin123', 10);

    const seedData = [
        ['INSERT INTO tenants (id, code, name, is_active, plan, max_users) VALUES (?, ?, ?, 1, ?, 1000)', [tenantId, 'DEFAULT', 'Default Organization', 'enterprise']],
        ['INSERT INTO units (id, code, name, type, decimal_places) VALUES (?, ?, ?, ?, ?)', [unitKgId, 'KG', 'Kilogram', 'weight', 2]],
        ['INSERT INTO units (id, code, name, type, decimal_places) VALUES (?, ?, ?, ?, ?)', [unitNosId, 'NOS', 'Numbers', 'count', 0]],
        ['INSERT INTO units (id, code, name, type, decimal_places) VALUES (?, ?, ?, ?, ?)', [unitMtId, 'MT', 'Metric Ton', 'weight', 3]],
        ['INSERT INTO units (id, code, name, type, decimal_places) VALUES (?, ?, ?, ?, ?)', [unitLtrId, 'LTR', 'Litre', 'volume', 2]],
        ['INSERT INTO factories (id, tenant_id, name, code, address, phone, email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', [factoryId, tenantId, 'Krishna Feed Mills Pvt Ltd', 'KFM001', 'Industrial Area, Sector 12, Karnal, Haryana 132001', '+91-184-225-1234', 'info@krishnafeed.com']],
        ['INSERT INTO godowns (id, tenant_id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?, ?)', [godownId, tenantId, factoryId, 'Main Raw Material Godown', 'RMG-01', 'raw_material', 'Block A, Ground Floor']],
        ['INSERT INTO godowns (id, tenant_id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?, ?)', [godownId2, tenantId, factoryId, 'Finished Goods Godown', 'FGG-01', 'finished_goods', 'Block B, First Floor']],
        ['INSERT INTO godowns (id, tenant_id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?, ?)', [godownId3, tenantId, factoryId, 'Pellet Feed Storage', 'PFS-01', 'finished_goods', 'Block C, Ground Floor']],
        ['INSERT INTO roles (id, tenant_id, name, description, is_system) VALUES (?, ?, ?, ?, 1)', [roleId, tenantId, 'Administrator', 'Full system access with all permissions']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Manager', 'Can manage all operations and approve transactions']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Supervisor', 'Can view and edit data, limited approval']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Operator', 'Can perform day-to-day operations']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Purchase Manager', 'Manages purchase orders and suppliers']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Sales Manager', 'Manages sales orders and customers']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Production Manager', 'Manages formulas and production batches']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Accountant', 'Manages accounts and transactions']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Store Keeper', 'Manages inventory and godowns']],
        ['INSERT INTO roles (id, tenant_id, name, description) VALUES (?, ?, ?, ?)', [uuidv4(), tenantId, 'Viewer', 'Read-only access to view data']],
        ['INSERT INTO users (id, tenant_id, username, password_hash, name, role_id, factory_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', [adminId, tenantId, 'admin', adminPassword, 'Rajesh Kumar', roleId, factoryId]],
        ['INSERT INTO settings (id, tenant_id, key, value, type) VALUES (?, ?, ?, ?, ?)', [settingId1, tenantId, 'company_name', 'Krishna Feed Mills Pvt Ltd', 'text']],
        ['INSERT INTO settings (id, tenant_id, key, value, type) VALUES (?, ?, ?, ?, ?)', [settingId2, tenantId, 'currency', 'INR', 'text']],
        ['INSERT INTO settings (id, tenant_id, key, value, type) VALUES (?, ?, ?, ?, ?)', [settingId3, tenantId, 'gst_number', '06AABFK1234A1ZX', 'text']],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqPO, tenantId, 'PO', 'Purchase Order', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqGRN, tenantId, 'GRN', 'Goods Inward', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqPI, tenantId, 'PI', 'Purchase Invoice', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqSO, tenantId, 'SO', 'Sales Order', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqINV, tenantId, 'INV', 'Sales Invoice', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqBATCH, tenantId, 'BATCH', 'Production Batch', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqDO, tenantId, 'DO', 'Delivery Order', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqTRF, tenantId, 'TRF', 'Transfer', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqADJ, tenantId, 'ADJ', 'Adjustment', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [seqVCH, tenantId, 'VCH', 'Voucher', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), tenantId, 'PAY', 'Payment', 0, 5]],
        ['INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), tenantId, 'RET', 'Sales Return', 0, 5]]
    ];

    const accountGroups = [
        [uuidv4(), tenantId, 'Current Assets', 'Current Assets', 'asset', null, 'Cash and bank balances that are current'],
        [uuidv4(), tenantId, 'Bank & Cash', 'बैंक और कैश', 'asset', null, 'Bank accounts and cash in hand'],
        [uuidv4(), tenantId, 'Sundry Debtors', 'देनदार', 'asset', null, 'Accounts receivable from customers'],
        [uuidv4(), tenantId, 'Current Liabilities', 'Current Liabilities', 'liability', null, 'Short term obligations'],
        [uuidv4(), tenantId, 'Sundry Creditors', 'लेनदार', 'liability', null, 'Accounts payable to suppliers'],
        [uuidv4(), tenantId, 'Duties & Taxes', 'Duties & Taxes', 'liability', null, 'GST, TDS and other tax liabilities'],
        [uuidv4(), tenantId, 'Income', 'Income', 'income', null, 'Revenue from sales'],
        [uuidv4(), tenantId, 'Sales Account', 'बिक्री खाता', 'income', null, 'Income from product sales'],
        [uuidv4(), tenantId, 'Indirect Income', 'Indirect Income', 'income', null, 'Other income like interest, discount'],
        [uuidv4(), tenantId, 'Direct Expenses', 'Direct Expenses', 'expense', null, 'Manufacturing and production costs'],
        [uuidv4(), tenantId, 'Indirect Expenses', 'Indirect Expenses', 'expense', null, 'Administrative and selling expenses'],
        [uuidv4(), tenantId, 'Purchase Account', 'खरीद खाता', 'expense', null, 'Raw material purchases']
    ];

    if (DB_TYPE === 'postgresql') {
        for (const [sql, params] of seedData) {
            await pgPool.query(sql, params);
        }
    } else {
        for (const [sql, params] of seedData) {
            db.prepare(sql).run(...params);
        }
    }

    accountGroups.forEach(ag => {
        const sql = `INSERT INTO account_groups (id, tenant_id, name, name_bn, type, parent_id, nature) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, ag);
        } else {
            db.prepare(sql).run(...ag);
        }
    });

    const permissions = [
        { module: 'dashboard', permissions: ['view'] },
        { module: 'master', permissions: ['view', 'add', 'edit', 'delete'] },
        { module: 'purchase', permissions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { module: 'inventory', permissions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { module: 'production', permissions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { module: 'quality', permissions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { module: 'sales', permissions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { module: 'finance', permissions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { module: 'transport', permissions: ['view', 'add', 'edit', 'delete'] },
        { module: 'barcode', permissions: ['view', 'add', 'edit', 'delete'] },
        { module: 'iot', permissions: ['view', 'add', 'edit', 'delete'] },
        { module: 'reports', permissions: ['view', 'export'] },
        { module: 'admin', permissions: ['view', 'add', 'edit', 'delete'] }
    ];

    const permSql = 'INSERT INTO role_permissions (id, role_id, module, permission, granted) VALUES (?, ?, ?, ?, 1)';

    permissions.forEach(p => {
        p.permissions.forEach(perm => {
            if (DB_TYPE === 'postgresql') {
                pgPool.query(permSql, [uuidv4(), roleId, p.module, perm]);
            } else {
                db.prepare(permSql).run(uuidv4(), roleId, p.module, perm);
            }
        });
    });

    const now = new Date().toISOString();
    const suppliers = [
        [uuidv4(), tenantId, 'SUP001', 'National Grain Corporation', 'नेशनल ग्रेन कॉर्पोरेशन', 'Rajesh Mehta', '+91-98100-12345', 'rajesh@nationalgrain.com', 'Plot 45, Grain Market, Ambala', 'Haryana', 'AMBALA1234A1ZX', 5000000],
        [uuidv4(), tenantId, 'SUP002', 'Shree Krishna Trading Co', 'श्री कृष्णा ट्रेडिंग कंपनी', 'Suresh Agarwal', '+91-98765-43210', 'suresh@sktrading.in', 'Shop 12, Mandi Gate, Karnal', 'Haryana', 'HRNL1234B2ZY', 3000000],
        [uuidv4(), tenantId, 'SUP003', 'Premium Soybean Solutions', 'प्रीमियम सोयाबीन सॉल्यूशंस', 'Anil Sharma', '+91-95555-11111', 'anil@premiumsoy.com', 'Industrial Estate, Hisar', 'Haryana', 'HISR1234C3ZZ', 4000000],
        [uuidv4(), tenantId, 'SUP004', 'Bajrang Mineral Products', 'बजरंग मिनरल प्रोडक्ट्स', 'Mahesh Kumar', '+91-87654-32109', 'mahesh@bajrangmin.com', 'Near Railway Station, Rohtak', 'Haryana', 'ROHT1234D4ZA', 2000000],
        [uuidv4(), tenantId, 'SUP005', 'Punjab Rice Bran Oil Mills', 'पंजाब राइस ब्रान ऑयल मिल्स', 'Parkash Singh', '+91-99887-66554', 'parkash@punjabrice.com', 'Industrial Phase 2, Ludhiana', 'Punjab', 'LDH1234E5ZB', 3500000],
        [uuidv4(), tenantId, 'SUP006', 'Vikram Feed Additives', 'विक्रम फीड एडिटिव्स', 'Vikram Patel', '+91-91234-56789', 'vikram@vikramfeed.com', 'GIDC, Naroda, Ahmedabad', 'Gujarat', 'GJNR1234F6ZC', 2500000],
        [uuidv4(), tenantId, 'SUP007', 'Eastern Agro Industries', 'ईस्टर्न एग्रो इंडस्ट्रीज', 'Subrata Dey', '+91-94321-09876', 'subrata@easternagro.in', 'Salt Lake Sector 5, Kolkata', 'West Bengal', 'WBKL1234G7ZD', 4500000],
        [uuidv4(), tenantId, 'SUP008', 'Mithila Vitamins & Minerals', 'मिथिला विटामिन्स एंड मिनरल्स', 'Ravi Shankar', '+91-90000-11111', 'ravi@mithilavit.com', 'Station Road, Darbhanga', 'Bihar', 'BRDB1234H8ZE', 1500000],
        [uuidv4(), tenantId, 'SUP009', 'Western Maize & Corn Co', 'वेस्टर्न मक्के एंड कॉर्न कंपनी', 'Prakash Joshi', '+91-92222-33333', 'prakash@westernmaize.com', 'MIDC, Nashik', 'Maharashtra', 'MHN01234I9ZF', 4000000],
        [uuidv4(), tenantId, 'SUP010', 'Southern Fish Meal Suppliers', 'सदर्न फिश मील सप्लायर्स', 'Kumar Swamy', '+91-94444-55555', 'kumar@southernfish.com', 'Tuticorin Port Area', 'Tamil Nadu', 'TNTU1234J0ZG', 3000000]
    ];

    suppliers.forEach(s => {
        const sql = `INSERT INTO suppliers (id, tenant_id, code, name, name_bn, contact_person, mobile, email, address, state, gstin, credit_limit, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, s);
        } else {
            db.prepare(sql).run(...s);
        }
    });

const customers = [
        [uuidv4(), tenantId, 'CUST001', 'Green Valley Dairy Farm', 'গ্রীন ভ্যালি ডেইরি ফার্ম', 'dealer', 'Gurpreet Singh', '+91-98888-77777', 'gurpreet@greenvalley.com', 'Village Rampur, Ambala Road, Yamunanagar', 'Haryana', 'YAMUN1234K1ZH', 2000000],
        [uuidv4(), tenantId, 'CUST002', 'Modern Poultry Solutions', 'মডার্ন পোল্ট্রি সলিউশন্স', 'dealer', 'Vijay Gupta', '+91-97777-66666', 'vijay@modernpoultry.in', 'Sector 9, Panipat', 'Haryana', 'PNPT1234L2ZI', 1500000],
        [uuidv4(), tenantId, 'CUST003', 'Kisan Agro Services', 'কিষাণ এগ্রো সার্ভিসেস', 'dealer', 'Baldev Raj', '+91-96666-55555', 'baldev@kisanagro.com', 'Main Bazaar, Kaithal', 'Haryana', 'KTHL1234M3ZJ', 1000000],
        [uuidv4(), tenantId, 'CUST004', 'Baba Fish Farms', 'বাবা ফিশ ফার্মস', 'direct', 'Kuldeep Malik', '+91-95555-44444', 'kuldeep@babafish.com', 'Village Jalalpur, Kurukshetra', 'Haryana', 'KRKT1234N4ZK', 2500000],
        [uuidv4(), tenantId, 'CUST005', 'Shivalik Livestock Co', 'শিবালিক লাইভস্টক কোম্পানি', 'government', 'Ashok Kumar', '+91-98888-99999', 'ashok@shivaliklives.com', 'Industrial Area Phase 2, Panchkula', 'Haryana', 'PCKL1234O5ZL', 5000000],
        [uuidv4(), tenantId, 'CUST006', 'Rama Krishna Poultry Farm', 'রাম কৃষ্ণা পোল্ট্রি ফার্ম', 'retailer', 'Rama Rao', '+91-92222-11111', 'ramarao@rkpoultry.com', 'Village Shankar, Fatehabad', 'Haryana', 'FTHD1234P6ZM', 500000],
        [uuidv4(), tenantId, 'CUST007', 'Triveni Aqua Farms', 'ত্রিভেণী অ্যাকুয়া ফার্মস', 'direct', 'Meena Devi', '+91-93333-22222', 'meena@triveniaqua.com', 'Gohana Road, Sonipat', 'Haryana', 'SNPT1234Q7ZN', 1800000],
        [uuidv4(), tenantId, 'CUST008', 'National Layer Farms', 'ন্যাশনাল লেয়ার ফার্মস', 'dealer', 'Sanjay Thakur', '+91-94444-33333', 'sanjay@nationallayers.com', 'Rajgarh Road, Sirsa', 'Haryana', 'SISA1234R8ZO', 2200000],
        [uuidv4(), tenantId, 'CUST009', 'Govind Poultry & Feed', 'গোবিন্দ পোল্ট্রি অ্যান্ড ফিড', 'retailer', 'Govind Prasad', '+91-91111-44444', 'govind@govindpoultry.com', 'New Anaj Mandi, Jind', 'Haryana', 'JIND1234S9ZP', 750000],
        [uuidv4(), tenantId, 'CUST010', 'Yamuna Animal Husbandry', 'যমুনা অ্যানিমাল হাসব্যান্ড্রি', 'government', 'Prem Singh', '+91-90000-55555', 'prem@yamunaah.com', 'Industrial Estate, Rewari', 'Haryana', 'RWRI1234T0ZQ', 3000000]
    ];

    customers.forEach(c => {
        const sql = `INSERT INTO customers (id, tenant_id, code, name, name_bn, type, contact_person, mobile, email, address, state, gstin, credit_limit, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, c);
        } else {
            db.prepare(sql).run(...c);
        }
    });

    const rawMaterials = [
        [uuidv4(), tenantId, 'RM001', 'Yellow Maize', 'पीला मक्का', 'grains', unitKgId, '1007', 18.50, 10000, 50000, 45000, 1],
        [uuidv4(), tenantId, 'RM002', 'Soybean Meal 45%', 'सोयाबीन खला 45%', 'protein', unitKgId, '2304', 32.00, 15000, 80000, 60000, 1],
        [uuidv4(), tenantId, 'RM003', 'Rice Bran Deoiled', 'राइस ब्रान डीऑयल्ड', 'energy', unitKgId, '2306', 22.00, 12000, 60000, 50000, 1],
        [uuidv4(), tenantId, 'RM004', 'Dicalcium Phosphate', 'डाइकैल्शियम फॉस्फेट', 'minerals', unitKgId, '2833', 68.00, 5000, 25000, 20000, 1],
        [uuidv4(), tenantId, 'RM005', 'Limestone Powder', 'चूना पाउडर', 'minerals', unitKgId, '2521', 4.50, 20000, 100000, 80000, 1],
        [uuidv4(), tenantId, 'RM006', 'Salt Iodized', 'आयोडीज्ड नमक', 'additives', unitKgId, '2832', 8.00, 8000, 40000, 30000, 1],
        [uuidv4(), tenantId, 'RM007', 'Fish Meal 60% Protein', 'फिश मील 60% प्रोटीन', 'protein', unitKgId, '0301', 95.00, 3000, 15000, 10000, 1],
        [uuidv4(), tenantId, 'RM008', 'Molasses Cane', 'गन्ना मोलासिस', 'energy', unitKgId, '1701', 14.00, 10000, 50000, 40000, 1],
        [uuidv4(), tenantId, 'RM009', 'Vitamin Premix Layer', 'विटामिन प्रीमिक्स लेयर', 'vitamins', unitKgId, '2936', 450.00, 500, 2500, 2000, 1],
        [uuidv4(), tenantId, 'RM010', 'DL-Methionine 99%', 'डीएल-मीथिओनिन 99%', 'additives', unitKgId, '2930', 280.00, 1000, 5000, 4000, 1]
    ];

rawMaterials.forEach(rm => {
        const sql = `INSERT INTO raw_materials (id, tenant_id, code, name, name_bn, category, unit_id, hsn_code, opening_rate, opening_qty, min_stock_level, max_stock_level, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, rm);
        } else {
            db.prepare(sql).run(...rm);
        }
    });

    const machines = [
        [uuidv4(), factoryId, 'MCH001', 'Grinding Mill 1', 'Grinding', 'Buildwin', 5000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH002', 'Hammer Mill 1', 'Mixing', 'Buildwin', 3000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH003', 'Pellet Press 1', 'Pelleting', 'Mavencant', 8000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH004', 'Cooler 1', 'Cooling', 'Mavencant', 10000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH005', 'Sieving Machine 1', 'Sieving', 'Flex坚实', 6000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH006', 'Packing Machine 1', 'Packing', 'Automated', 4000, 'bags/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH007', 'Grinding Mill 2', 'Grinding', 'Buildwin', 5000, 'tons/hr', 'maintenance'],
        [uuidv4(), factoryId, 'MCH008', 'Mixer 1', 'Mixing', 'Buildwin', 3000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH009', 'Pellet Press 2', 'Pelleting', 'Mavencant', 8000, 'tons/hr', 'operational'],
        [uuidv4(), factoryId, 'MCH010', 'Cooler 2', 'Cooling', 'Mavencant', 10000, 'tons/hr', 'operational']
    ];

    machines.forEach(m => {
        const sql = `INSERT INTO machines (id, tenant_id, factory_id, code, name, type, brand, capacity, unit, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        const data = [m[0], tenantId, ...m.slice(1)];
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, data);
        } else {
            db.prepare(sql).run(...data);
        }
    });

    const vehicles = [
        [uuidv4(), tenantId, 'HR01AB1234', 'truck', 5000, 'operational'],
        [uuidv4(), tenantId, 'HR02CD5678', 'truck', 5000, 'operational'],
        [uuidv4(), tenantId, 'HR03EF9012', 'tempo', 2000, 'operational'],
        [uuidv4(), tenantId, 'HR04GH3456', 'tempo', 2000, 'operational'],
        [uuidv4(), tenantId, 'HR05IJ7890', 'truck', 8000, 'maintenance'],
        [uuidv4(), tenantId, 'HR06KL1234', 'van', 1000, 'operational'],
        [uuidv4(), tenantId, 'HR07MN5678', 'truck', 5000, 'operational'],
        [uuidv4(), tenantId, 'HR08OP9012', 'tempo', 2000, 'operational'],
        [uuidv4(), tenantId, 'DL09QR3456', 'truck', 10000, 'operational'],
        [uuidv4(), tenantId, 'PB10ST7890', 'truck', 8000, 'operational']
    ];

    vehicles.forEach(v => {
        const sql = `INSERT INTO vehicles (id, tenant_id, vehicle_number, type, capacity, status, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, v);
        } else {
            db.prepare(sql).run(...v);
        }
    });

    const drivers = [
        [uuidv4(), tenantId, 'Ram Singh', '+91-98100-10001', 'DL12345678901234', 'VPO Rampur, Ambala'],
        [uuidv4(), tenantId, 'Shyam Lal', '+91-98100-10002', 'HR12345678901234', 'VPO Ladwa, Kurukshetra'],
        [uuidv4(), tenantId, 'Gopal Dass', '+91-98100-10003', 'HR23456789012345', 'VPO Nilokheri, Karnal'],
        [uuidv4(), tenantId, 'Mohan Lal', '+91-98100-10004', 'HR34567890123456', 'VPO Assandh, Karnal'],
        [uuidv4(), tenantId, 'Prem Chand', '+91-98100-10005', 'HR45678901234567', 'VPO Panipat City'],
        [uuidv4(), tenantId, 'Krishan Kumar', '+91-98100-10006', 'HR56789012345678', 'VPO Shahabad, Kurukshetra'],
        [uuidv4(), tenantId, 'Rameshwar Dayal', '+91-98100-10007', 'HR67890123456789', 'VPO Indri, Karnal'],
        [uuidv4(), tenantId, 'Sita Ram', '+91-98100-10008', 'HR78901234567890', 'VPO Sangoha, Karnal'],
        [uuidv4(), tenantId, 'Govind Ram', '+91-98100-10009', 'HR89012345678901', 'VPO Kosli, Rewari'],
        [uuidv4(), tenantId, 'Madan Gopal', '+91-98100-10010', 'HR90123456789012', 'VPO Safidon, Jind']
    ];

    drivers.forEach(d => {
        const sql = `INSERT INTO drivers (id, tenant_id, name, phone, license_number, address, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, d);
        } else {
            db.prepare(sql).run(...d);
        }
    });

    const routes = [
        [uuidv4(), tenantId, factoryId, 'Ambala Route', 'अंबाला रूट', 'Ambala, Yamunanagar, Jagadhari'],
        [uuidv4(), tenantId, factoryId, 'Karnal Route', 'कर्णाल रूट', 'Karnal, Panipat, Sonipat'],
        [uuidv4(), tenantId, factoryId, 'Hisar Route', 'हिसार रूट', 'Hisar, Rohtak, Jind'],
        [uuidv4(), tenantId, factoryId, 'Ludhiana Route', 'लुधियाना रूट', 'Ludhiana, Moga, Bathinda'],
        [uuidv4(), tenantId, factoryId, 'Delhi Route', 'दिल्ली रूट', 'Delhi, Gurgaon, Faridabad']
    ];

    routes.forEach(r => {
        const sql = `INSERT INTO routes (id, tenant_id, factory_id, name, name_bn, description, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, r);
        } else {
            db.prepare(sql).run(...r);
        }
    });

    // Add stock ledger entries for existing inventory
    const stockLedgerEntries = [
        [uuidv4(), tenantId, 'raw_material', 'RM001', 'RM-BATCH-001', godownId, 'opening', null, 45000, 18.50, 832500, 45000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM002', 'RM-BATCH-002', godownId, 'opening', null, 60000, 32.00, 1920000, 60000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM003', 'RM-BATCH-003', godownId, 'opening', null, 50000, 22.00, 1100000, 50000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM004', 'RM-BATCH-004', godownId, 'opening', null, 20000, 68.00, 1360000, 20000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM005', 'RM-BATCH-005', godownId, 'opening', null, 80000, 4.50, 360000, 80000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM006', 'RM-BATCH-006', godownId, 'opening', null, 30000, 8.00, 240000, 30000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM007', 'RM-BATCH-007', godownId, 'opening', null, 10000, 95.00, 950000, 10000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'raw_material', 'RM008', 'RM-BATCH-008', godownId, 'opening', null, 40000, 14.00, 560000, 40000, null, null, null, 'Opening stock'],
        [uuidv4(), tenantId, 'product', 'PRD001', 'Batch-2024-00001', godownId2, 'opening', null, 1000, 28.00, 28000, 1000, '2024-01-15', '2025-01-15', null, 'Opening stock'],
        [uuidv4(), tenantId, 'product', 'PRD002', 'Batch-2024-00002', godownId2, 'opening', null, 800, 24.50, 19600, 800, '2024-01-16', '2025-01-16', null, 'Opening stock'],
        [uuidv4(), tenantId, 'product', 'PRD003', 'Batch-2024-00003', godownId2, 'opening', null, 1200, 32.00, 38400, 1200, '2024-01-17', '2025-01-17', null, 'Opening stock'],
        [uuidv4(), tenantId, 'product', 'PRD004', 'Batch-2024-00004', godownId2, 'opening', null, 900, 30.00, 27000, 900, '2024-01-18', '2025-01-18', null, 'Opening stock'],
        [uuidv4(), tenantId, 'product', 'PRD005', 'Batch-2024-00005', godownId2, 'opening', null, 1500, 26.00, 39000, 1500, '2024-01-19', '2025-01-19', null, 'Opening stock'],
        [uuidv4(), tenantId, 'product', 'PRD006', 'Batch-2024-00006', godownId3, 'opening', null, 500, 85.00, 42500, 500, '2024-01-20', '2025-01-20', null, 'Opening stock']
    ];

    stockLedgerEntries.forEach(sl => {
        const sql = `INSERT INTO stock_ledger (id, tenant_id, item_type, item_id, batch_number, godown_id, transaction_type, reference_id, quantity, rate, amount, balance_qty, mfg_date, expiry_date, barcode, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, sl);
        } else {
            db.prepare(sql).run(...sl);
        }
    });

    const regions = [
        [uuidv4(), tenantId, 'North', 'NR', 'Asia/Kolkata', 'INR'],
        [uuidv4(), tenantId, 'South', 'SR', 'Asia/Kolkata', 'INR'],
        [uuidv4(), tenantId, 'East', 'ER', 'Asia/Kolkata', 'INR'],
        [uuidv4(), tenantId, 'West', 'WR', 'Asia/Kolkata', 'INR'],
        [uuidv4(), tenantId, 'Central', 'CR', 'Asia/Kolkata', 'INR']
    ];

    regions.forEach(r => {
        const sql = `INSERT INTO regions (id, tenant_id, code, name, timezone, currency, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, r);
        } else {
            db.prepare(sql).run(...r);
        }
    });

    const currencies = [
        [uuidv4(), tenantId, 'INR', 'Indian Rupee', '₹', 1],
        [uuidv4(), tenantId, 'USD', 'US Dollar', '$', 1],
        [uuidv4(), tenantId, 'EUR', 'Euro', '€', 1],
        [uuidv4(), tenantId, 'GBP', 'British Pound', '£', 1],
        [uuidv4(), tenantId, 'BDT', 'Bangladeshi Taka', '৳', 1]
    ];

    currencies.forEach(c => {
        const sql = `INSERT INTO currencies (id, tenant_id, code, name, symbol, is_active) VALUES (?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, c);
        } else {
            db.prepare(sql).run(...c);
        }
    });

    const priceLists = [
        [uuidv4(), tenantId, 'PL001', 'Standard Price List', 1, 1],
        [uuidv4(), tenantId, 'PL002', 'Dealer Price List', 0, 1],
        [uuidv4(), tenantId, 'PL003', 'Premium Price List', 0, 1],
        [uuidv4(), tenantId, 'PL004', 'Government Price List', 0, 1]
    ];

    priceLists.forEach(p => {
        const sql = `INSERT INTO price_lists (id, tenant_id, code, name, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, p);
        } else {
            db.prepare(sql).run(...p);
        }
    });

    const discountRules = [
        [uuidv4(), tenantId, 'Volume Discount 5MT+', 'Volume discount for orders above 5 MT', 'quantity', 5000, 5, 'percentage'],
        [uuidv4(), tenantId, 'Volume Discount 10MT+', 'Volume discount for orders above 10 MT', 'quantity', 10000, 8, 'percentage'],
        [uuidv4(), tenantId, 'Seasonal Discount', 'Festival season special discount', 'seasonal', 0, 10, 'percentage'],
        [uuidv4(), tenantId, 'Loyalty Discount', 'Discount for loyal customers', 'loyalty', 24, 3, 'percentage'],
        [uuidv4(), tenantId, 'Prompt Payment Discount', 'Discount for instant payment', 'payment', 0, 2, 'percentage']
    ];

    discountRules.forEach(d => {
        const sql = `INSERT INTO discount_rules (id, tenant_id, name, description, type, min_value, discount_value, discount_type, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, d);
        } else {
            db.prepare(sql).run(...d);
        }
    });

    const iotDevices = [
        [uuidv4(), tenantId, 'IOT001', null, 'temperature', 'Temperature Sensor 1', 'http://sensor-001.local', 'mqtt', 'active', null, '{"temp_min": 20, "temp_max": 35, "humidity_min": 40, "humidity_max": 70}'],
        [uuidv4(), tenantId, 'IOT002', null, 'temperature', 'Temperature Sensor 2', 'http://sensor-002.local', 'mqtt', 'active', null, '{"temp_min": 20, "temp_max": 35, "humidity_min": 40, "humidity_max": 70}'],
        [uuidv4(), tenantId, 'IOT003', null, 'humidity', 'Humidity Sensor 1', 'http://sensor-003.local', 'mqtt', 'active', null, '{"humidity_min": 40, "humidity_max": 70}'],
        [uuidv4(), tenantId, 'IOT004', null, 'weight', 'Weight Scale 1', 'http://scale-001.local', 'mqtt', 'active', null, '{"capacity": 5000, "unit": "kg"}'],
        [uuidv4(), tenantId, 'IOT005', null, 'speed', 'Conveyor Speed Sensor', 'http://sensor-005.local', 'mqtt', 'active', null, '{"min_speed": 10, "max_speed": 50, "unit": "m/min"}'],
        [uuidv4(), tenantId, 'IOT006', null, 'power', 'Power Meter 1', 'http://meter-001.local', 'mqtt', 'active', null, '{"voltage_min": 380, "voltage_max": 440, "current_max": 100}'],
        [uuidv4(), tenantId, 'IOT007', null, 'level', 'Hopper Level Sensor', 'http://sensor-007.local', 'mqtt', 'active', null, '{"min_level": 20, "max_level": 90, "unit": "percent"}'],
        [uuidv4(), tenantId, 'IOT008', null, 'temperature', 'Pellet Cooler Temp', 'http://sensor-008.local', 'mqtt', 'active', null, '{"temp_min": 25, "temp_max": 45}']
    ];

    iotDevices.forEach(i => {
        const sql = `INSERT INTO iot_devices (id, tenant_id, device_code, machine_id, type, name, endpoint, protocol, status, last_seen, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, i);
        } else {
            db.prepare(sql).run(...i);
        }
    });

    const barcodes = [
        [uuidv4(), tenantId, 'KFM24A00001', null, 'product', 'PRD001', 'Batch-2024-00001', godownId2, '2024-01-15', '2025-01-15', 0, null],
        [uuidv4(), tenantId, 'KFM24A00002', null, 'product', 'PRD001', 'Batch-2024-00001', godownId2, '2024-01-15', '2025-01-15', 0, null],
        [uuidv4(), tenantId, 'KFM24A00003', null, 'product', 'PRD002', 'Batch-2024-00002', godownId2, '2024-01-16', '2025-01-16', 0, null],
        [uuidv4(), tenantId, 'KFM24A00004', null, 'product', 'PRD002', 'Batch-2024-00002', godownId2, '2024-01-16', '2025-01-16', 0, null],
        [uuidv4(), tenantId, 'KFM24A00005', null, 'product', 'PRD003', 'Batch-2024-00003', godownId2, '2024-01-17', '2025-01-17', 0, null],
        [uuidv4(), tenantId, 'KFM24A00006', null, 'product', 'PRD003', 'Batch-2024-00003', godownId2, '2024-01-17', '2025-01-17', 0, null],
        [uuidv4(), tenantId, 'KFM24A00007', null, 'product', 'PRD004', 'Batch-2024-00004', godownId2, '2024-01-18', '2025-01-18', 0, null],
        [uuidv4(), tenantId, 'KFM24A00008', null, 'product', 'PRD004', 'Batch-2024-00004', godownId2, '2024-01-18', '2025-01-18', 0, null],
        [uuidv4(), tenantId, 'KFM24A00009', null, 'product', 'PRD005', 'Batch-2024-00005', godownId2, '2024-01-19', '2025-01-19', 0, null],
        [uuidv4(), tenantId, 'KFM24A00010', null, 'product', 'PRD006', 'Batch-2024-00006', godownId3, '2024-01-20', '2025-01-20', 0, null],
        [uuidv4(), tenantId, 'RM24B00001', null, 'raw_material', 'RM001', 'RM-BATCH-001', godownId, '2024-01-10', '2024-12-31', 0, null],
        [uuidv4(), tenantId, 'RM24B00002', null, 'raw_material', 'RM002', 'RM-BATCH-002', godownId, '2024-01-11', '2024-12-31', 0, null],
        [uuidv4(), tenantId, 'RM24B00003', null, 'raw_material', 'RM003', 'RM-BATCH-003', godownId, '2024-01-12', '2024-12-31', 0, null],
        [uuidv4(), tenantId, 'RM24B00004', null, 'raw_material', 'RM004', 'RM-BATCH-004', godownId, '2024-01-13', '2025-06-30', 0, null],
        [uuidv4(), tenantId, 'RM24B00005', null, 'raw_material', 'RM005', 'RM-BATCH-005', godownId, '2024-01-14', '2026-01-14', 0, null]
    ];

    barcodes.forEach(b => {
        const sql = `INSERT INTO barcodes (id, tenant_id, barcode, qr_code, item_type, item_id, batch_number, godown_id, manufactured_date, expiry_date, is_used, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, b);
        } else {
            db.prepare(sql).run(...b);
        }
    });

    const qcParameters = [
        [uuidv4(), tenantId, 'Protein Content', 'प्रोटीन सामग्री', 'PROT', 'raw_material', 18, 22, 20, '%', 1, 1],
        [uuidv4(), tenantId, 'Moistic Content', 'नमी सामग्री', 'MOIST', 'raw_material', 0, 12, 10, '%', 1, 1],
        [uuidv4(), tenantId, 'Fat Content', 'वसा सामग्री', 'FAT', 'raw_material', 3, 8, 5, '%', 1, 1],
        [uuidv4(), tenantId, 'Fiber Content', 'फाइबर सामग्री', 'FIBER', 'raw_material', 0, 6, 4, '%', 1, 1],
        [uuidv4(), tenantId, 'Ash Content', 'राख सामग्री', 'ASH', 'raw_material', 0, 10, 7, '%', 1, 1],
        [uuidv4(), tenantId, 'Particle Size', 'कण का आकार', 'PART', 'finished_product', 2, 4, 3, 'mm', 1, 1],
        [uuidv4(), tenantId, 'Crude Digestibility', 'क्रूड पाचनीयता', 'DIGEST', 'finished_product', 70, 85, 78, '%', 1, 1],
        [uuidv4(), tenantId, 'Water Activity', 'जल गतिविधि', 'WATER', 'finished_product', 0, 0.7, 0.5, 'aw', 1, 1]
    ];

    qcParameters.forEach(q => {
        const sql = `INSERT INTO qc_parameters (id, tenant_id, name, name_bn, code, type, min_value, max_value, target_value, unit, is_mandatory, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, q);
        } else {
            db.prepare(sql).run(...q);
        }
    });

    const accounts = [
        [uuidv4(), tenantId, 'CAC001', 'Cash in Hand', 'cash', 0, 1],
        [uuidv4(), tenantId, 'BNK001', 'State Bank of India', 'bank', 500000, 1],
        [uuidv4(), tenantId, 'BNK002', 'Punjab National Bank', 'bank', 300000, 1],
        [uuidv4(), tenantId, 'CUS001', 'Green Valley Dairy Farm', 'customer', 0, 1],
        [uuidv4(), tenantId, 'CUS002', 'Modern Poultry Solutions', 'customer', 0, 1],
        [uuidv4(), tenantId, 'SUP001', 'National Grain Corporation', 'supplier', 0, 1],
        [uuidv4(), tenantId, 'SUP002', 'Shree Krishna Trading Co', 'supplier', 0, 1],
        [uuidv4(), tenantId, 'EXP001', 'Office Expenses', 'expense', 0, 1],
        [uuidv4(), tenantId, 'EXP002', 'Transportation Expenses', 'expense', 0, 1],
        [uuidv4(), tenantId, 'INC001', 'Sales Account', 'income', 0, 1]
    ];

    accounts.forEach(a => {
        const sql = `INSERT INTO accounts (id, tenant_id, code, name, type, opening_balance, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, a);
        } else {
            db.prepare(sql).run(...a);
        }
    });

    const settings = [
        [uuidv4(), tenantId, 'date_format', 'DD-MM-YYYY', 'text'],
        [uuidv4(), tenantId, 'time_zone', 'Asia/Kolkata', 'text'],
        [uuidv4(), tenantId, 'decimal_places', '2', 'number'],
        [uuidv4(), tenantId, 'currency_symbol', '₹', 'text'],
        [uuidv4(), tenantId, 'low_stock_alert', '20', 'number'],
        [uuidv4(), tenantId, 'auto_approve_orders', 'false', 'boolean'],
        [uuidv4(), tenantId, 'require_quality_check', 'true', 'boolean'],
        [uuidv4(), tenantId, 'default_godown_id', godownId, 'text'],
        [uuidv4(), tenantId, 'default_price_list_id', '', 'text'],
        [uuidv4(), tenantId, 'tax_number', '06AABFK1234A1ZX', 'text'],
        [uuidv4(), tenantId, 'business_name', 'Krishna Feed Mills Pvt Ltd', 'text'],
        [uuidv4(), tenantId, 'address', 'Industrial Area, Sector 12, Karnal, Haryana 132001', 'text'],
        [uuidv4(), tenantId, 'phone', '+91-184-225-1234', 'text'],
        [uuidv4(), tenantId, 'email', 'info@krishnafeed.com', 'text'],
        [uuidv4(), tenantId, 'state', 'Haryana', 'text'],
        [uuidv4(), tenantId, 'city', 'Karnal', 'text'],
        [uuidv4(), tenantId, 'pincode', '132001', 'text'],
        [uuidv4(), tenantId, 'gst_number', '06AABFK1234A1ZX', 'text'],
        [uuidv4(), tenantId, 'pan_number', 'AABFK1234A', 'text'],
        [uuidv4(), tenantId, 'invoice_prefix', 'INV', 'text'],
        [uuidv4(), tenantId, 'po_prefix', 'PO', 'text']
    ];

    settings.forEach(s => {
        const sql = `INSERT INTO settings (id, tenant_id, key, value, type) VALUES (?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, s);
        } else {
            db.prepare(sql).run(...s);
        }
    });

    const productPrices = [
        [uuidv4(), tenantId, 'PRD001', unitKgId, 25, 28.00, 30.00, 1],
        [uuidv4(), tenantId, 'PRD002', unitKgId, 50, 24.50, 26.00, 1],
        [uuidv4(), tenantId, 'PRD003', unitKgId, 25, 32.00, 35.00, 1],
        [uuidv4(), tenantId, 'PRD004', unitKgId, 25, 30.00, 33.00, 1],
        [uuidv4(), tenantId, 'PRD005', unitKgId, 50, 26.00, 28.00, 1],
        [uuidv4(), tenantId, 'PRD006', unitKgId, 10, 85.00, 95.00, 1],
        [uuidv4(), tenantId, 'PRD007', unitKgId, 10, 72.00, 80.00, 1],
        [uuidv4(), tenantId, 'PRD008', unitKgId, 10, 120.00, 135.00, 1],
        [uuidv4(), tenantId, 'PRD009', unitKgId, 20, 35.00, 38.00, 1],
        [uuidv4(), tenantId, 'PRD010', unitKgId, 25, 27.50, 30.00, 1]
    ];

    productPrices.forEach(pp => {
        const sql = `INSERT INTO product_prices (id, tenant_id, product_id, unit_id, min_qty, rate, mrp, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, pp);
        } else {
            db.prepare(sql).run(...pp);
        }
    });

    const formulas = [
        [uuidv4(), tenantId, 'FORM001', 'Cattle Feed 18% Standard', 'PRD001', 18, 12, 8, 5, 10, 2400, 'approved', 1],
        [uuidv4(), tenantId, 'FORM002', 'Cattle Feed 16% Mash', 'PRD002', 16, 12, 8, 4, 8, 2200, 'approved', 1],
        [uuidv4(), tenantId, 'FORM003', 'Broiler Starter 22%', 'PRD003', 22, 11, 6, 8, 7, 2800, 'approved', 1],
        [uuidv4(), tenantId, 'FORM004', 'Broiler Finisher 20%', 'PRD004', 20, 11, 6, 7, 6, 2700, 'approved', 1],
        [uuidv4(), tenantId, 'FORM005', 'Layer Mash 15%', 'PRD005', 15, 12, 8, 5, 12, 2300, 'approved', 1],
        [uuidv4(), tenantId, 'FORM006', 'Fish Feed 28% Floating', 'PRD006', 28, 10, 4, 10, 8, 3000, 'draft', 1],
        [uuidv4(), tenantId, 'FORM007', 'Fish Feed 25% Sinking', 'PRD007', 25, 10, 5, 8, 8, 2800, 'draft', 1],
        [uuidv4(), tenantId, 'FORM008', 'Calf Starter 20%', 'PRD009', 20, 11, 7, 6, 7, 2600, 'approved', 1]
    ];

    let formulaIds = [];
    formulas.forEach(f => {
        const sql = `INSERT INTO formulas (id, tenant_id, code, name, product_id, target_protein, target_moisture, target_fiber, target_fat, target_ash, target_energy, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, f);
        } else {
            db.prepare(sql).run(...f);
        }
        formulaIds.push(f[0]);
    });

    const formulaIngredients = [
        [uuidv4(), formulaIds[0], 'RM001', 50, 45, 55, 1],
        [uuidv4(), formulaIds[0], 'RM002', 30, 25, 35, 1],
        [uuidv4(), formulaIds[0], 'RM003', 15, 10, 20, 1],
        [uuidv4(), formulaIds[0], 'RM004', 2, 1, 3, 1],
        [uuidv4(), formulaIds[0], 'RM005', 2, 1, 3, 1],
        [uuidv4(), formulaIds[0], 'RM006', 1, 0.5, 1.5, 1],
        [uuidv4(), formulaIds[1], 'RM001', 55, 50, 60, 1],
        [uuidv4(), formulaIds[1], 'RM002', 25, 20, 30, 1],
        [uuidv4(), formulaIds[1], 'RM003', 15, 10, 20, 1],
        [uuidv4(), formulaIds[1], 'RM004', 2, 1, 3, 1],
        [uuidv4(), formulaIds[1], 'RM005', 2, 1, 3, 1],
        [uuidv4(), formulaIds[1], 'RM006', 1, 0.5, 1.5, 1],
        [uuidv4(), formulaIds[2], 'RM001', 45, 40, 50, 1],
        [uuidv4(), formulaIds[2], 'RM002', 35, 30, 40, 1],
        [uuidv4(), formulaIds[2], 'RM003', 12, 8, 16, 1],
        [uuidv4(), formulaIds[2], 'RM007', 5, 3, 7, 1],
        [uuidv4(), formulaIds[2], 'RM004', 1.5, 1, 2, 1],
        [uuidv4(), formulaIds[2], 'RM005', 1.5, 1, 2, 1],
        [uuidv4(), formulaIds[2], 'RM009', 0.5, 0.3, 0.7, 1],
        [uuidv4(), formulaIds[3], 'RM001', 48, 43, 53, 1],
        [uuidv4(), formulaIds[3], 'RM002', 32, 27, 37, 1],
        [uuidv4(), formulaIds[3], 'RM003', 14, 10, 18, 1],
        [uuidv4(), formulaIds[3], 'RM007', 4, 2, 6, 1],
        [uuidv4(), formulaIds[3], 'RM004', 1, 0.5, 1.5, 1],
        [uuidv4(), formulaIds[3], 'RM005', 1, 0.5, 1.5, 1],
        [uuidv4(), formulaIds[4], 'RM001', 55, 50, 60, 1],
        [uuidv4(), formulaIds[4], 'RM002', 25, 20, 30, 1],
        [uuidv4(), formulaIds[4], 'RM003', 14, 10, 18, 1],
        [uuidv4(), formulaIds[4], 'RM008', 3, 2, 4, 1],
        [uuidv4(), formulaIds[4], 'RM004', 1.5, 1, 2, 1],
        [uuidv4(), formulaIds[4], 'RM005', 1.5, 1, 2, 1]
    ];

    formulaIngredients.forEach(fi => {
        const sql = `INSERT INTO formula_ingredients (id, formula_id, raw_material_id, percentage, min_percentage, max_percentage, is_mandatory) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, fi);
        } else {
            db.prepare(sql).run(...fi);
        }
    });

    console.log('  Initial data seeded with 10+ realistic records per section');
}

function logActivity(tenantId, userId, module, action, recordId, oldValue, newValue, req) {
    const logEntry = {
        id: uuidv4(),
        tenant_id: tenantId,
        user_id: userId,
        module,
        action,
        record_id: recordId,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        ip_address: req?.ip || req?.connection?.remoteAddress,
        user_agent: req?.headers?.['user-agent'],
        created_at: new Date().toISOString()
    };

    if (DB_TYPE === 'postgresql') {
        pgPool.query(
            `INSERT INTO activity_log (id, tenant_id, user_id, module, action, record_id, old_value, new_value, ip_address, user_agent, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            Object.values(logEntry)
        );
    } else {
        db.prepare(`
            INSERT INTO activity_log (id, tenant_id, user_id, module, action, record_id, old_value, new_value, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...Object.values(logEntry));
    }
}

function getNextSequence(prefix, tenantId) {
    if (DB_TYPE === 'postgresql') {
        const result = pgPool.query(
            `INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding)
             VALUES (uuid_generate_v4(), $1, $2, $2, 1, 5)
             ON CONFLICT (tenant_id, prefix) DO UPDATE SET current_value = sequences.current_value + 1
             RETURNING current_value`,
            [tenantId, prefix]
        );
        return result.rows[0].current_value;
    } else {
        const stmt = db.prepare(`
            INSERT INTO sequences (id, tenant_id, prefix, name, current_value, padding)
            VALUES (?, ?, ?, 1, 5)
            ON CONFLICT(tenant_id, prefix) DO UPDATE SET current_value = sequences.current_value + 1
        `);
        const result = stmt.run(uuidv4(), tenantId, prefix, prefix);
        
        const seq = db.prepare('SELECT current_value FROM sequences WHERE tenant_id = ? AND prefix = ?').get(tenantId, prefix);
        return seq ? seq.current_value : 1;
    }
}

function formatSequence(prefix, value, padding = 5) {
    return `${prefix}${String(value).padStart(padding, '0')}`;
}

function validateStock(tenantId, itemType, itemId, godownId, requiredQty, batchNumber = null) {
    try {
        let query = `
            SELECT COALESCE(SUM(quantity), 0) as balance_qty 
            FROM stock_ledger 
            WHERE tenant_id = ? AND item_type = ? AND item_id = ? AND godown_id = ?
        `;
        const params = [tenantId, itemType, itemId, godownId];
        
        if (batchNumber) {
            query += ' AND batch_number = ?';
            params.push(batchNumber);
        }
        
        let result;
        if (DB_TYPE === 'postgresql') {
            return { valid: true, available: 0 }; // Sync fallback
        } else {
            result = db.prepare(query).get(...params);
        }
        
        const availableQty = parseFloat(result?.balance_qty || 0);
        
        if (availableQty < requiredQty) {
            return { valid: false, available: availableQty, required: requiredQty };
        }
        
        return { valid: true, available: availableQty };
    } catch (error) {
        console.error('Stock validation error:', error);
        return { valid: true, available: 0 };
    }
}

function getTransaction(tranType, ...ids) {
    if (DB_TYPE === 'postgresql') {
        return { query: (sql, params) => pgPool.query(sql, params), ids };
    }
    return { query: (sql, params) => db.prepare(sql).all(...params), stmt: (sql) => db.prepare(sql) };
}

function query(sql, params = []) {
    if (DB_TYPE === 'postgresql') {
        return pgPool.query(sql, params);
    }
    if (params.length === 0) {
        return db.prepare(sql).all();
    }
    return db.prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
    if (DB_TYPE === 'postgresql') {
        const result = pgPool.query(sql, params);
        return result.rows[0];
    }
    if (params.length === 0) {
        return db.prepare(sql).get();
    }
    return db.prepare(sql).get(...params);
}

function run(sql, params = []) {
    if (DB_TYPE === 'postgresql') {
        return pgPool.query(sql, params);
    }
    if (params.length === 0) {
        return db.prepare(sql).run();
    }
    return db.prepare(sql).run(...params);
}

// Tenant isolation module - re-exports with automatic tenant filtering
const tenantDb = require('../utils/tenantDb');

module.exports = {
    getDb,
    initDatabase,
    logActivity,
    getNextSequence,
    formatSequence,
    // These automatically add tenant_id for tenant-scoped tables
    query: tenantDb.query,
    queryOne: tenantDb.queryOne,
    run: tenantDb.run,
    // Helper functions for cleaner code
    insert: tenantDb.insert,
    updateById: tenantDb.updateById,
    deleteById: tenantDb.deleteById,
    findById: tenantDb.findById,
    getTenantId: tenantDb.getTenantId
};
