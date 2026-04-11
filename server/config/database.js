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
    await seedInitialData();
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
    pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'feedmill_erp',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    await pgPool.query('SELECT NOW()');
}

async function createTables() {
    const sql = `
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
            expires_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
            factory_id TEXT REFERENCES factories(id),
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            type TEXT CHECK(type IN ('raw_material','finished_goods','semi_finished','general')),
            location TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(factory_id, code)
        );

        -- Units of Measurement
        CREATE TABLE IF NOT EXISTS units (
            id TEXT PRIMARY KEY,
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
            min_stock REAL DEFAULT 0,
            max_stock REAL,
            opening_stock REAL DEFAULT 0,
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
            type TEXT CHECK(type IN ('cattle','poultry','fish','other')),
            category TEXT,
            pack_size REAL DEFAULT 50,
            unit_id TEXT REFERENCES units(id),
            mrp REAL,
            min_stock REAL DEFAULT 0,
            opening_stock REAL DEFAULT 0,
            opening_rate REAL DEFAULT 0,
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
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_item ON stock_ledger(item_type, item_id);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_godown ON stock_ledger(godown_id);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch ON stock_ledger(batch_number);
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_date ON stock_ledger(created_at);
        CREATE INDEX IF NOT EXISTS idx_production_batches_tenant ON production_batches(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_production_batches_date ON production_batches(batch_date);
        CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(status);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON sales_orders(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant ON sales_invoices(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
        CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id, date);
        CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id);
        CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_barcodes_item ON barcodes(item_type, item_id);
        CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    `;

    if (DB_TYPE === 'postgresql') {
        await pgPool.query(sql);
    } else {
        db.exec(sql);
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
        ['INSERT INTO godowns (id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?)', [godownId, factoryId, 'Main Raw Material Godown', 'RMG-01', 'raw_material', 'Block A, Ground Floor']],
        ['INSERT INTO godowns (id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?)', [godownId2, factoryId, 'Finished Goods Godown', 'FGG-01', 'finished_goods', 'Block B, First Floor']],
        ['INSERT INTO godowns (id, factory_id, name, code, type, location) VALUES (?, ?, ?, ?, ?, ?)', [godownId3, factoryId, 'Pellet Feed Storage', 'PFS-01', 'finished_goods', 'Block C, Ground Floor']],
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
        [uuidv4(), tenantId, 'CUST001', 'Green Valley Dairy Farm', 'ग्रीन वैली डेयरी फार्म', 'dealer', 'Gurpreet Singh', '+91-98888-77777', 'gurpreet@greenvalley.com', 'Village Rampur, Ambala Road, Yamunanagar', 'Haryana', 'YAMUN1234K1ZH', 2000000],
        [uuidv4(), tenantId, 'CUST002', 'Modern Poultry Solutions', 'मॉडर्न पोल्ट्री सॉल्यूशंस', 'dealer', 'Vijay Gupta', '+91-97777-66666', 'vijay@modernpoultry.in', 'Sector 9, Panipat', 'Haryana', 'PNPT1234L2ZI', 1500000],
        [uuidv4(), tenantId, 'CUST003', 'Kisan Agro Services', 'किसान एग्रो सर्विसेज', 'dealer', 'Baldev Raj', '+91-96666-55555', 'baldev@kisanagro.com', 'Main Bazaar, Kaithal', 'Haryana', 'KTHL1234M3ZJ', 1000000],
        [uuidv4(), tenantId, 'CUST004', 'Baba Fish Farms', 'बाबा फिश फार्म्स', 'direct', 'Kuldeep Malik', '+91-95555-44444', 'kuldeep@babafish.com', 'Village Jalalpur, Kurukshetra', 'Haryana', 'KRKT1234N4ZK', 2500000],
        [uuidv4(), tenantId, 'CUST005', 'Shivalik Livestock Co', 'शिवालिक लाइवस्टॉक कंपनी', 'government', 'Ashok Kumar', '+91-98888-99999', 'ashok@shivaliklives.com', 'Industrial Area Phase 2, Panchkula', 'Haryana', 'PCKL1234O5ZL', 5000000],
        [uuidv4(), tenantId, 'CUST006', 'Rama Krishna Poultry Farm', 'राम कृष्णा पोल्ट्री फार्म', 'retail', 'Rama Rao', '+91-92222-11111', 'ramarao@rkpoultry.com', 'Village Shankar, Fatehabad', 'Haryana', 'FTHD1234P6ZM', 500000],
        [uuidv4(), tenantId, 'CUST007', 'Triveni Aqua Farms', 'त्रिवेणी एक्वा फार्म्स', 'direct', 'Meena Devi', '+91-93333-22222', 'meena@triveniaqua.com', 'Gohana Road, Sonipat', 'Haryana', 'SNPT1234Q7ZN', 1800000],
        [uuidv4(), tenantId, 'CUST008', 'National Layer Farms', 'नेशनल लेयर फार्म्स', 'dealer', 'Sanjay Thakur', '+91-94444-33333', 'sanjay@nationallayers.com', 'Rajgarh Road, Sirsa', 'Haryana', 'SISA1234R8ZO', 2200000],
        [uuidv4(), tenantId, 'CUST009', 'Govind Poultry & Feed', 'गोविंद पोल्ट्री एंड फीड', 'retail', 'Govind Prasad', '+91-91111-44444', 'govind@govindpoultry.com', 'New Anaj Mandi, Jind', 'Haryana', 'JIND1234S9ZP', 750000],
        [uuidv4(), tenantId, 'CUST010', 'Yamuna Animal Husbandry', 'यमुना एनिमल हसबैंड्री', 'government', 'Prem Singh', '+91-90000-55555', 'prem@yamunaah.com', 'Industrial Estate, Rewari', 'Haryana', 'RWRI1234T0ZQ', 3000000]
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
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, rm);
        } else {
            db.prepare(sql).run(...rm);
        }
    });

    const products = [
        [uuidv4(), tenantId, 'PRD001', 'Cattle Feed Pellets 18%', 'गाय का चारा पेलेट 18%', 'cattle', 'feed', unitKgId, 25, 28.00, '0411', 1],
        [uuidv4(), tenantId, 'PRD002', 'Cattle Feed Mash 16%', 'गाय का चारा मैश 16%', 'cattle', 'feed', unitKgId, 50, 24.50, '0411', 1],
        [uuidv4(), tenantId, 'PRD003', 'Broiler Starter Mash 22%', 'ब्रॉयलर स्टार्टर मैश 22%', 'poultry', 'feed', unitKgId, 25, 32.00, '0408', 1],
        [uuidv4(), tenantId, 'PRD004', 'Broiler Finisher Pellets 20%', 'ब्रॉयलर फिनिशर पेलेट 20%', 'poultry', 'feed', unitKgId, 25, 30.00, '0408', 1],
        [uuidv4(), tenantId, 'PRD005', 'Layer Mash 15% with Premix', 'लेयर मैश 15% प्रीमिक्स सहित', 'poultry', 'feed', unitKgId, 50, 26.00, '0408', 1],
        [uuidv4(), tenantId, 'PRD006', 'Fish Feed Floating Pellets 28%', 'मछली का चारा फ्लोटिंग पेलेट 28%', 'fish', 'feed', unitKgId, 10, 85.00, '0409', 1],
        [uuidv4(), tenantId, 'PRD007', 'Fish Feed Sinking Pellets 25%', 'मछली का चारा सिंकिंग पेलेट 25%', 'fish', 'feed', unitKgId, 10, 72.00, '0409', 1],
        [uuidv4(), tenantId, 'PRD008', 'Shrimp Feed PL 15%', 'झींगा चारा पीएल 15%', 'shrimp', 'feed', unitKgId, 10, 120.00, '0409', 1],
        [uuidv4(), tenantId, 'PRD009', 'Calf Starter 20% Protein', 'बछड़ा स्टार्टर 20% प्रोटीन', 'cattle', 'feed', unitKgId, 20, 35.00, '0411', 1],
        [uuidv4(), tenantId, 'PRD010', 'Layer Crumbles 16%', 'लेयर क्रंबल्स 16%', 'poultry', 'feed', unitKgId, 25, 27.50, '0408', 1]
    ];

    products.forEach(p => {
        const sql = `INSERT INTO products (id, tenant_id, code, name, name_bn, product_type, category, unit_id, pack_size, sale_rate, hsn_code, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, p);
        } else {
            db.prepare(sql).run(...p);
        }
    });

    const machines = [
        [uuidv4(), factoryId, 'Machine 1', 'MCH001', 'Grinding', 5000, 'operational'],
        [uuidv4(), factoryId, 'Machine 2', 'MCH002', 'Mixing', 3000, 'operational'],
        [uuidv4(), factoryId, 'Machine 3', 'MCH003', 'Pelleting', 8000, 'operational'],
        [uuidv4(), factoryId, 'Machine 4', 'MCH004', 'Cooling', 10000, 'operational'],
        [uuidv4(), factoryId, 'Machine 5', 'MCH005', 'Sieving', 6000, 'operational'],
        [uuidv4(), factoryId, 'Machine 6', 'MCH006', 'Packing', 4000, 'operational'],
        [uuidv4(), factoryId, 'Machine 7', 'MCH007', 'Grinding', 5000, 'maintenance'],
        [uuidv4(), factoryId, 'Machine 8', 'MCH008', 'Mixing', 3000, 'operational'],
        [uuidv4(), factoryId, 'Machine 9', 'MCH009', 'Pelleting', 8000, 'operational'],
        [uuidv4(), factoryId, 'Machine 10', 'MCH010', 'Cooling', 10000, 'operational']
    ];

    machines.forEach(m => {
        const sql = `INSERT INTO machines (id, factory_id, name, code, type, capacity, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
        if (DB_TYPE === 'postgresql') {
            pgPool.query(sql, m);
        } else {
            db.prepare(sql).run(...m);
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
        const sql = `INSERT INTO vehicles (id, tenant_id, vehicle_number, vehicle_type, capacity, status, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`;
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

module.exports = {
    getDb,
    initDatabase,
    logActivity,
    getNextSequence,
    formatSequence,
    query,
    queryOne,
    run
};
