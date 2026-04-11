# Feed Mill ERP - Complete Implementation Plan

**Project:** Cattle / Poultry / Fish Feed Factory Management System  
**Version:** 1.0  
**Last Updated:** April 2026  
**Status:** Development In Progress

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [Module Specifications](#5-module-specifications)
6. [API Documentation](#6-api-documentation)
7. [UI/UX Design](#7-ux-design)
8. [Security Features](#8-security-features)
9. [Advanced Features](#9-advanced-features)
10. [Implementation Phases](#10-implementation-phases)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Plan](#12-deployment-plan)
13. [Maintenance & Support](#13-maintenance--support)

---

## 1. Executive Summary

### 1.1 Project Overview

Feed Mill ERP is a comprehensive, cloud-ready enterprise resource planning system designed specifically for cattle, poultry, and fish feed manufacturing industries. The system provides end-to-end management of production, inventory, sales, finance, and operations in a centralized, multi-tenant SaaS platform.

### 1.2 Key Objectives

- **Streamline Operations**: Automate feed manufacturing processes from raw material procurement to finished product delivery
- **Inventory Optimization**: Real-time stock tracking with FIFO valuation and low-stock alerts
- **Quality Assurance**: Comprehensive QC workflow with batch-level traceability
- **Financial Control**: Integrated accounting with AR/AP management and profit analysis
- **Scalability**: Multi-tenant SaaS architecture supporting 400-500+ concurrent users
- **Accessibility**: Mobile-responsive design with offline capability
- **Localization**: English and Bengali language support with regional compliance

### 1.3 Target Users

| User Role | Description | Access Level |
|-----------|-------------|---------------|
| Administrator | Full system access, configuration | All modules |
| Factory Manager | Factory-level operations | Production, Inventory, Quality |
| Purchase Manager | Supplier & procurement | Purchase, Inventory |
| Sales Manager | Customer & sales | Sales, Delivery |
| Accountant | Financial operations | Finance, Reports |
| Quality Manager | QC operations | Quality, Lab |
| Operator | Data entry operations | Assigned modules |

---

## 2. Technology Stack

### 2.1 Frontend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Vue.js | 3.4+ | Reactive UI framework |
| State Management | Pinia | 2.1+ | Centralized state |
| Router | Vue Router | 4.3+ | SPA navigation |
| Internationalization | Vue-i18n | 9.10+ | Multi-language |
| HTTP Client | Axios | 1.6+ | API communication |
| Charts | Chart.js + vue-chartjs | 4.4+ | Data visualization |
| Build Tool | Vite | 5.2+ | Fast development |
| CSS | Vanilla CSS | - | Lightweight styling |

### 2.2 Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | 20+ | JavaScript runtime |
| Framework | Express.js | 4.18+ | REST API |
| Database (Dev) | SQLite | 3.x | Portable development |
| Database (Prod) | PostgreSQL | 15+ | Production scale |
| ORM | better-sqlite3 | 9.4+ | SQLite driver |
| Authentication | JWT | 9.0+ | Token auth |
| Password Hashing | bcryptjs | 2.4+ | Security |
| File Upload | Multer | 1.4+ | Media handling |
| PDF Generation | PDFKit | 0.14+ | Report export |
| Excel Generation | ExcelJS | 4.4+ | Spreadsheet export |
| Scheduler | node-cron | 3.0+ | Background jobs |
| Validation | Custom | - | Input validation |

### 2.3 Project Structure

```
feedmill-erp/
├── server/                    # Backend API
│   ├── index.js             # Express entry point
│   ├── config/
│   │   └── database.js      # Database configuration
│   ├── middleware/
│   │   ├── auth.js          # JWT authentication
│   │   └── permissions.js   # Role-based access
│   ├── routes/
│   │   ├── auth.js          # Authentication
│   │   ├── master.js        # Master data
│   │   ├── purchase.js      # Procurement
│   │   ├── inventory.js     # Stock management
│   │   ├── production.js    # Manufacturing
│   │   ├── quality.js       # QC system
│   │   ├── sales.js         # Distribution
│   │   ├── finance.js       # Accounting
│   │   ├── transport.js     # Logistics
│   │   ├── barcode.js       # Barcode system
│   │   ├── iot.js           # IoT integration
│   │   ├── dashboard.js     # Analytics
│   │   ├── reports.js       # Reporting
│   │   └── admin.js         # Administration
│   ├── models/              # Data access layer
│   ├── utils/              # Helper functions
│   └── migrations/         # Database migrations
├── frontend/               # Vue.js application
│   ├── src/
│   │   ├── main.js          # Vue entry
│   │   ├── App.vue          # Root component
│   │   ├── router/          # Vue Router
│   │   ├── store/           # Pinia stores
│   │   ├── api/             # API client
│   │   ├── i18n/            # Translations
│   │   ├── assets/          # Styles, images
│   │   ├── components/      # Reusable components
│   │   └── views/           # Page components
│   │       ├── master/
│   │       ├── purchase/
│   │       ├── inventory/
│   │       ├── production/
│   │       ├── quality/
│   │       ├── sales/
│   │       ├── finance/
│   │       ├── transport/
│   │       ├── barcode/
│   │       ├── iot/
│   │       ├── reports/
│   │       └── admin/
│   ├── public/              # Static assets
│   ├── index.html          # HTML entry
│   ├── vite.config.js      # Vite config
│   └── package.json
├── data/                   # SQLite database
├── uploads/                # File storage
├── .env                    # Environment config
├── package.json            # Root package
└── README.md
```

---

## 3. System Architecture

### 3.1 Multi-Tenant SaaS Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                        │
│                    (Nginx / AWS ALB)                       │
└─────────────────────┬─────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼───────┐           ┌──────▼───────┐
│   App Server  │           │ App Server   │
│   (Node.js)   │           │  (Node.js)   │
│   Instance 1  │           │  Instance 2   │
└───────┬───────┘           └───────┬───────┘
        │                           │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼───────┐           ┌──────▼───────┐
│  PostgreSQL  │           │  PostgreSQL  │
│   Primary    │◄──────────►│   Replica    │
└──────────────┘           └──────────────┘
```

### 3.2 Request Flow

```
Client Browser
     │
     ▼
┌─────────────────┐
│  Vue.js SPA    │
│  (Port 5173)   │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Nginx Proxy   │
│  (Port 80/443) │
└────────┬────────┘
         │ API
         ▼
┌─────────────────┐
│  Express API    │
│  (Port 3000)   │
└────────┬────────┘
         │ SQL
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  Database      │
└─────────────────┘
```

---

## 4. Database Design

### 4.1 Core Tables (40+ Tables)

#### Multi-Tenancy
- `tenants` - SaaS organization
- `users` - User accounts
- `roles` - Role definitions
- `role_permissions` - Permission matrix
- `activity_log` - Audit trail

#### Master Data
- `factories` - Manufacturing plants
- `godowns` - Warehouses
- `units` - Measurement units
- `raw_materials` - Ingredients
- `products` - Finished goods
- `formulas` - Feed recipes
- `formula_ingredients` - Recipe details
- `suppliers` - Vendor management
- `customers` - Dealer/distributor
- `routes` - Delivery routes

#### Operations
- `purchase_orders` - PO management
- `po_items` - PO line items
- `goods_inward` - GRN processing
- `inward_items` - GRN details
- `purchase_invoices` - Supplier bills
- `stock_ledger` - Inventory tracking
- `transfers` - Godown transfers
- `transfer_items` - Transfer details
- `stock_adjustments` - Stock corrections
- `adjustment_items` - Adjustment details
- `production_batches` - Manufacturing batches
- `batch_consumption` - Material usage
- `batch_quality` - Batch QC results
- `machines` - Equipment registry
- `sales_orders` - Customer orders
- `so_items` - Order line items
- `sales_invoices` - Customer invoices
- `invoice_items` - Invoice details
- `sales_returns` - Returns processing
- `return_items` - Return details

#### Quality Control
- `qc_parameters` - Test parameters
- `qc_results` - Test outcomes
- `quality_standards` - Acceptance criteria

#### Finance
- `account_groups` - Chart of accounts
- `accounts` - Ledger accounts
- `transactions` - Journal entries
- `payments` - Payment records

#### Logistics
- `vehicles` - Transport fleet
- `drivers` - Driver registry
- `delivery_orders` - Delivery planning
- `delivery_tracking` - GPS tracking

#### Advanced
- `barcodes` - QR/Barcode registry
- `iot_devices` - Sensor management
- `iot_readings` - Sensor data
- `machine_logs` - Equipment logs
- `sequences` - Auto-numbering
- `settings` - Configuration

### 4.2 Key Relationships

```
Tenant (1) ──────< Factory (1) ──────< Godown (1) ──────< Stock Ledger
  │                                                           │
  │                                                           │
  └────< User (1) ──< Role (1) ──< Role Permissions           │
                                                              │
Supplier (1) ────< Purchase Order (1) ────< PO Items          │
       │                              │                        │
       │                              ▼                        │
       └────< Goods Inward (1) ────< Inward Items ─────────────┘
                           │
                           ▼
                    Purchase Invoice

Customer (1) ────< Sales Order (1) ────< SO Items
       │                              │
       │                              ▼
       └────< Sales Invoice (1) ────< Invoice Items ─────────┘
                           │
                           ▼
                    Delivery Order

Formula (1) ────< Formula Ingredients
       │
       ▼
Production Batch (1) ────< Batch Consumption
                           │
                           ▼
                      Stock Ledger

Machine (1) ────< Machine Logs
       │
       ▼
IoT Devices (1) ────< IoT Readings
```

### 4.3 Indexes for Performance

```sql
-- High-frequency queries optimized
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(po_date);
CREATE INDEX idx_goods_inward_date ON goods_inward(inward_date);
CREATE INDEX idx_stock_ledger_item ON stock_ledger(item_type, item_id);
CREATE INDEX idx_stock_ledger_godown ON stock_ledger(godown_id);
CREATE INDEX idx_stock_ledger_batch ON stock_ledger(batch_number);
CREATE INDEX idx_production_batches_date ON production_batches(batch_date);
CREATE INDEX idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX idx_transactions_account ON transactions(account_id, date);
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at);
```

---

## 5. Module Specifications

### 5.1 Purchase & Supplier Management

#### Features
- Supplier database with GSTIN, PAN, contact details
- Purchase order creation with item-level tracking
- PO approval workflow (draft → sent → partial → received)
- Goods inward (GRN) with batch generation
- Quality hold for pending QC
- Purchase invoice matching
- Supplier performance tracking (delivery time, quality)
- Credit limit management

#### Workflow
```
Supplier Selection → PO Creation → PO Approval → PO Dispatch
                                              │
                                              ▼
                                    Goods Receipt (GRN)
                                              │
                                              ▼
                                    Quality Check
                                    ↙         ↘
                              Passed       Failed
                                  │            │
                                  ▼            ▼
                            Stock Update   Return/Reject
                                              │
                                              ▼
                                    Purchase Invoice
                                              │
                                              ▼
                                    Payment Processing
```

### 5.2 Inventory Management

#### Features
- Multi-godown support (Raw Material, Finished Goods, WIP)
- Batch-wise inventory with manufacturing dates
- FIFO stock valuation
- Average cost calculation
- Low stock alerts with configurable thresholds
- Stock transfer between godowns
- Stock adjustments with approval workflow
- Expiry date tracking and alerts
- Real-time stock position reports

#### Stock Valuation Methods
```javascript
// FIFO Valuation
function calculateFIFO(stockLedger) {
    const sorted = stockLedger.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at));
    return sorted.map(entry => ({
        ...entry,
        cumulative_qty: runningTotal,
        valuation: 'FIFO'
    }));
}

// Average Cost
function calculateAverageCost(stockLedger) {
    const totalValue = stockLedger.reduce((sum, e) => 
        sum + (e.quantity * e.rate), 0);
    const totalQty = stockLedger.reduce((sum, e) => 
        sum + e.quantity, 0);
    return totalValue / totalQty;
}
```

### 5.3 Production Management

#### Features
- Feed formula/recipe management
- Version-controlled formulas
- Nutritional target setting (protein, moisture, fiber, energy)
- Batch-wise production planning
- Machine allocation and scheduling
- Shift-based production logging
- Raw material consumption tracking
- Production loss monitoring
- Batch completion with QC linkage
- Cost per batch calculation

#### Formula Optimization Engine
```javascript
// Auto-optimize formula based on ingredient prices
async function optimizeFormula(formulaId, constraints) {
    const formula = await getFormula(formulaId);
    const ingredients = await getIngredients(formulaId);
    const prices = await getCurrentPrices();
    
    // Linear programming for cost optimization
    const optimized = linearSolve({
        minimize: sum(ingredients.price * quantity),
        subjectTo: {
            protein: sum(ingredients.protein * quantity) >= formula.targetProtein,
            moisture: sum(ingredients.moisture * quantity) <= formula.targetMoisture,
            fiber: sum(ingredients.fiber * quantity) <= formula.targetFiber,
            total: sum(quantity) = 1000 // per ton
        }
    });
    
    return optimized;
}
```

### 5.4 Quality Control

#### QC Parameters
| Parameter | Raw Material | Finished Product | Unit | Min | Max |
|-----------|-------------|-----------------|------|-----|-----|
| Protein | ✓ | ✓ | % | 18 | 50 |
| Moisture | ✓ | ✓ | % | - | 14 |
| Fiber | ✓ | ✓ | % | - | 8 |
| Fat | ✓ | ✓ | % | 2 | 10 |
| Ash | ✓ | ✓ | % | - | 12 |
| Aflatoxin | ✓ | ✓ | ppb | - | 20 |
| Uric Acid | - | ✓ | % | - | 1.5 |

#### Quality Workflow
```
Raw Material Inward
        │
        ▼
   QC Sampling
        │
        ▼
   Lab Testing
        │
        ▼
┌──────┴──────┐
│             │
▼             ▼
Passed      Failed
 │             │
 ▼             ▼
Accept     Reject/
 │         Quarantine
 ▼
Stock Update
```

### 5.5 Sales & Distribution

#### Features
- Customer/dealer database
- Credit limit management
- Price lists (Standard, Wholesale, Retail)
- Sales order processing
- Order-to-delivery tracking
- Invoice generation with GST
- Payment tracking and receipts
- Sales return handling
- Outstanding reports
- Route-wise distribution

### 5.6 Finance & Accounts

#### Chart of Accounts Structure
```
Assets (1000-1999)
├── 1001 - Cash
├── 1002 - Bank Accounts
├── 1100 - Debtors (Customers)
├── 1200 - Inventory
└── 1300 - Fixed Assets

Liabilities (2000-2999)
├── 2001 - Creditors (Suppliers)
├── 2100 - Loans
└── 2200 - GST Payable

Income (3000-3999)
├── 3001 - Sales Revenue
└── 3002 - Other Income

Expenses (4000-4999)
├── 4001 - Cost of Goods Sold
├── 4002 - Raw Material Cost
├── 4003 - Production Cost
└── 4004 - Operating Expenses
```

### 5.7 Transport & Delivery

#### Features
- Vehicle management with capacity
- Driver registry with license tracking
- Delivery order creation
- Vehicle/driver assignment
- Route optimization
- Real-time delivery tracking
- Proof of delivery (POD)
- Delivery status updates (pending → in_transit → delivered)

---

## 6. API Documentation

### 6.1 Authentication

| Method | Endpoint | Description |
|-------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/refresh-token` | Refresh JWT |

### 6.2 Master Data

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/master/factories` | List factories |
| GET | `/api/master/godowns` | List godowns |
| GET | `/api/master/raw-materials` | List raw materials |
| GET | `/api/master/products` | List products |
| GET | `/api/master/suppliers` | List suppliers |
| GET | `/api/master/units` | List units |

### 6.3 Purchase

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/purchase/purchase-orders` | List POs |
| POST | `/api/purchase/purchase-orders` | Create PO |
| POST | `/api/purchase/purchase-orders/:id/approve` | Approve PO |
| GET | `/api/purchase/goods-inward` | List GRNs |
| POST | `/api/purchase/goods-inward` | Create GRN |

### 6.4 Inventory

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/inventory/stock` | Stock summary |
| GET | `/api/inventory/stock/alerts` | Low stock alerts |
| GET | `/api/inventory/stock/valuation` | Stock valuation |
| POST | `/api/inventory/transfers` | Create transfer |
| POST | `/api/inventory/adjustments` | Create adjustment |

### 6.5 Production

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/production/formulas` | List formulas |
| POST | `/api/production/formulas` | Create formula |
| GET | `/api/production/batches` | List batches |
| POST | `/api/production/batches` | Create batch |
| POST | `/api/production/batches/:id/start` | Start batch |
| POST | `/api/production/batches/:id/complete` | Complete batch |
| GET | `/api/production/formulas/:id/optimize` | Optimize formula |

### 6.6 Quality

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/quality/parameters` | QC parameters |
| POST | `/api/quality/parameters` | Create parameter |
| GET | `/api/quality/results` | QC results |
| POST | `/api/quality/results` | Submit QC results |

### 6.7 Sales

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/sales/customers` | List customers |
| GET | `/api/sales/orders` | List sales orders |
| POST | `/api/sales/orders` | Create order |
| GET | `/api/sales/invoices` | List invoices |
| POST | `/api/sales/invoices` | Create invoice |
| POST | `/api/sales/invoices/:id/payment` | Record payment |

### 6.8 Finance

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/finance/accounts` | List accounts |
| GET | `/api/finance/transactions` | List transactions |
| POST | `/api/finance/transactions` | Create transaction |
| GET | `/api/finance/payments` | List payments |
| POST | `/api/finance/payments` | Create payment |

### 6.9 Reports

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/reports/stock-position` | Stock position |
| GET | `/api/reports/stock-valuation` | Stock valuation |
| GET | `/api/reports/production-summary` | Production report |
| GET | `/api/reports/sales-summary` | Sales report |
| GET | `/api/reports/profit-analysis` | Profit analysis |

### 6.10 Response Format

```json
{
    "success": true,
    "data": { },
    "meta": {
        "page": 1,
        "limit": 50,
        "total": 156,
        "totalPages": 4
    },
    "message": "Operation successful"
}
```

### 6.11 Error Format

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid input data",
        "details": [
            { "field": "quantity", "message": "Quantity must be positive" }
        ]
    }
}
```

---

## 7. UI/UX Design

### 7.1 Design Principles

1. **Spreadsheet-Inspired**: Familiar Excel-like interface for data entry
2. **Legacy Aesthetic**: Classic business application look
3. **Sheet-Style Design**: Grid-based layouts with clear headers
4. **Lightweight**: Vanilla CSS, no heavy frameworks
5. **Mobile-First**: Responsive design for all screen sizes

### 7.2 Color Palette

```css
:root {
    --primary: #1a5fb4;        /* Business Blue */
    --primary-dark: #0d47a1;    /* Dark Blue */
    --primary-light: #64b5f6;   /* Light Blue */
    
    --bg-primary: #ffffff;      /* Paper White */
    --bg-secondary: #f5f5f5;   /* Light Gray */
    --bg-header: #f0f0f0;      /* Header Gray */
    
    --text-primary: #1a1a1a;   /* Near Black */
    --text-secondary: #4a4a4a; /* Dark Gray */
    --text-muted: #888888;      /* Muted Gray */
    
    --border-light: #d0d0d0;  /* Light Border */
    --border-medium: #a0a0a0;  /* Medium Border */
    
    --success: #2e7d32;        /* Green */
    --warning: #f57c00;        /* Orange */
    --danger: #c62828;         /* Red */
    --info: #0277bd;           /* Blue */
}
```

### 7.3 Typography

```css
:root {
    --font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-data: 'Consolas', 'Monaco', 'Courier New', monospace;
    --font-size-xs: 11px;
    --font-size-sm: 12px;
    --font-size-base: 13px;
    --font-size-lg: 14px;
    --font-size-xl: 16px;
}
```

### 7.4 Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  HEADER (48px)                                           │
│  [Logo] [Factory ▼] | Search | Notifications | User ▼ │
├───────────┬───────────────────────────────────────────────-─┤
│ SIDEBAR  │  TOOLBAR                                      │
│ (200px)  │  [+New] [Save] [Delete] | Filters | Export  │
│          ├───────────────────────────────────────────────┤
│ Dashboard│  DATA GRID (Spreadsheet Style)              │
│ ─────────│  ┌────┬────────┬────────┬────────┬────────┐ │
│ Purchase │  │ □  │ Code ▼ │ Name   │ Qty    │ Rate   │ │
│  ├ PO    │  ├────┼────────┼────────┼────────┼────────┤ │
│  ├ Inward│  │ □  │ RM001  │ Corn   │ 5000   │ 22.50  │ │
│  └ Invoice│  │ □  │ RM002  │ Soya   │ 3000   │ 45.00  │ │
│ ─────────│  │ □  │ RM003  │ Fish   │ 1000   │ 120.00 │ │
│ Inventory│  └────┴────────┴────────┴────────┴────────┘ │
│ ─────────├───────────────────────────────────────────────┤
│ Production│  PAGINATION                                 │
│ ─────────├───────────────────────────────────────────────┤
│ Quality   │  Showing 1-20 of 156 | ◄ 1 2 3 4 5 6 ►   │
│ ─────────└───────────────────────────────────────────────┤
│ Sales     │                                               │
│ ─────────│                                               │
│ Finance   │                                               │
│ ─────────│                                               │
│ Reports   │                                               │
│ ─────────│                                               │
│ Settings  │                                               │
└───────────┴──────────────────────────────────────────────┘
```

### 7.5 Mobile Layout

```
┌─────────────────────────┐
│ ≡  FeedMill ERP    [👤] │  <- Header
├─────────────────────────┤
│  ┌─────────┐ ┌───────┐ │
│  │ Stock  │ │ Sales │ │
│  │ Alert  │ │ Today │ │
│  │  12    │ │₹45K  │ │
│  └─────────┘ └───────┘ │
│                         │
│  ┌─────────────────────┐│
│  │ QUICK ACTIONS      ││
│  │ [+ Production]    ││
│  │ [+ Stock Entry]    ││
│  │ [+ Invoice]        ││
│  │ [📷 Scan Barcode]  ││
│  └─────────────────────┘│
│                         │
│  ┌─────────────────────┐│
│  │ RECENT ACTIVITY    ││
│  │ • PO #1234 Created ││
│  │ • Batch #B56 Done   ││
│  └─────────────────────┘│
├─────────────────────────┤
│ [🏠] [📦] [📊] [⚙️] [☰]│  <- Bottom Nav
└─────────────────────────┘
```

---

## 8. Security Features

### 8.1 Authentication
- JWT-based stateless authentication
- 8-hour token expiry
- Password hashing with bcrypt (cost factor 10)
- Login attempt limiting (5 attempts, 15-minute lockout)
- Session invalidation on logout

### 8.2 Authorization
```javascript
// Role-based access control
const permissions = {
    administrator: ['*'],  // All modules
    manager: ['dashboard', 'master', 'purchase', 'inventory', 'production', 'quality', 'sales', 'finance', 'reports'],
    operator: ['inventory', 'production'],
    viewer: ['dashboard', 'reports']
};

// Module-level permissions
const modulePermissions = {
    view: true,
    add: ['add', 'edit'].includes(action),
    edit: ['edit', 'delete'].includes(action),
    delete: action === 'delete',
    approve: ['approve'].includes(action),
    export: ['export'].includes(action)
};
```

### 8.3 Data Protection
- SQL injection prevention (parameterized queries)
- XSS prevention (output encoding)
- CSRF protection
- Input validation on all endpoints
- Rate limiting (100 requests/minute)
- Tenant isolation at database level

### 8.4 Audit Trail
```javascript
// Activity logging
function logActivity(tenantId, userId, module, action, recordId, oldValue, newValue) {
    const log = {
        id: uuidv4(),
        tenant_id: tenantId,
        user_id: userId,
        module,
        action,
        record_id: recordId,
        old_value: JSON.stringify(oldValue),
        new_value: JSON.stringify(newValue),
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString()
    };
    
    db.insert('activity_log', log);
}
```

---

## 9. Advanced Features

### 9.1 Multi-Factory Support

```javascript
// Factory context in requests
app.use((req, res, next) => {
    req.factoryId = req.headers['x-factory-id'] || 
                     req.user.defaultFactoryId;
    next();
});

// Cross-factory queries
async function getCrossFactoryInventory(tenantId) {
    const factories = await db.query(
        'SELECT * FROM factories WHERE tenant_id = ?',
        [tenantId]
    );
    
    const inventory = {};
    for (const factory of factories) {
        inventory[factory.id] = await db.query(`
            SELECT * FROM stock_ledger sl
            JOIN godowns g ON sl.godown_id = g.id
            WHERE g.factory_id = ?
        `, [factory.id]);
    }
    
    return inventory;
}
```

### 9.2 Barcode/QR System

#### Barcode Format
```
RM + MaterialID + Date(YYYYMMDD) + Sequence(0001)
RMABCD123456202604150001
```

#### QR Code Data
```json
{
    "type": "raw_material",
    "id": "abc123",
    "batch": "RMABCD123456",
    "code": "RMABCD123456202604150001",
    "mfg": "2026-04-15",
    "exp": "2026-07-15"
}
```

### 9.3 IoT Integration

#### Supported Protocols
- HTTP/REST (for webhooks)
- MQTT (for real-time streaming)
- Modbus TCP (for PLCs)
- WebSocket (for live dashboard)

#### Device Configuration
```javascript
const deviceConfig = {
    id: 'sensor-001',
    code: 'TEMP-001',
    machine_id: 'machine-001',
    type: 'sensor',
    protocol: 'mqtt',
    endpoint: 'mqtt://broker.local:1883',
    parameters: [
        { name: 'temperature', unit: '°C', min: 0, max: 100 },
        { name: 'humidity', unit: '%', min: 0, max: 100 },
        { name: 'pressure', unit: 'bar', min: 0, max: 10 }
    ],
    pollInterval: 5000 // ms
};
```

### 9.4 Formula Optimization

```javascript
// Cost optimization algorithm
async function optimizeFormula(params) {
    const { formulaId, maxBudget, minProtein, maxMoisture } = params;
    
    // Get current ingredient prices
    const ingredients = await getIngredients(formulaId);
    const prices = await getCurrentPrices();
    
    // Define constraints
    const constraints = {
        protein: { min: minProtein, weight: 1.0 },
        moisture: { max: maxMoisture, weight: 1.0 },
        cost: { max: maxBudget, weight: 2.0 }
    };
    
    // Run optimization (simplified linear programming)
    const result = await linearProgramming({
        variables: ingredients.map(i => ({
            name: i.name,
            cost: prices[i.id],
            protein: i.protein_content,
            moisture: i.moisture_content
        })),
        objective: 'minimize cost',
        constraints
    });
    
    return {
        ingredients: result.solution,
        totalCost: result.cost,
        nutritionalValues: calculateNutrition(result.solution),
        savings: calculateSavings(formulaId, result)
    };
}
```

### 9.5 Auto Formula Optimization Algorithm

```javascript
// Intelligent feed formulation engine
class FeedFormulator {
    constructor() {
        this.limits = {
            protein: { min: 18, max: 50 },
            moisture: { min: 0, max: 14 },
            fiber: { min: 0, max: 8 },
            fat: { min: 2, max: 10 },
            energy: { min: 2500, max: 4000 } // kcal/kg
        };
    }
    
    async optimize(params) {
        const { targetNutrients, availableIngredients, maxCost } = params;
        
        // Step 1: Get ingredient nutritional data and prices
        const ingredients = await this.getIngredientData(availableIngredients);
        
        // Step 2: Run linear programming for cost minimization
        const solution = this.solveLP({
            ingredients,
            constraints: {
                ...this.limits,
                ...targetNutrients
            },
            objective: { type: 'minimize', function: 'cost' }
        });
        
        // Step 3: Validate solution
        const validation = this.validateSolution(solution);
        
        if (!validation.valid) {
            // Adjust constraints and retry
            return this.optimizeWithRelaxedConstraints(params, validation.violations);
        }
        
        return {
            ingredients: solution.variables,
            totalCost: solution.cost,
            nutrition: this.calculateNutrition(solution.variables),
            comparison: await this.compareWithCurrentFormula(params.formulaId, solution)
        };
    }
    
    async compareWithCurrentFormula(currentId, optimized) {
        const current = await this.getFormulaIngredients(currentId);
        const currentCost = this.calculateCost(current);
        const optimizedCost = optimized.cost;
        
        return {
            currentCost,
            optimizedCost,
            savings: currentCost - optimizedCost,
            savingsPercent: ((currentCost - optimizedCost) / currentCost * 100).toFixed(2)
        };
    }
}
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 1.1 | Project Setup | Folder structure, dependencies |
| 1.2 | Database Schema | 40+ tables created |
| 1.3 | Authentication | JWT login, role system |
| 1.4 | UI Shell | Layout, navigation, theme |
| 1.5 | Master Data UI | Factories, godowns, units |

**Milestone:** Core authentication and master data working

### Phase 2: Purchase & Inventory (Week 3-4)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 2.1 | Supplier Management | Supplier CRUD, ledger |
| 2.2 | PO System | PO creation, approval |
| 2.3 | Goods Inward | GRN processing, batch |
| 2.4 | Stock Management | FIFO, valuation, alerts |
| 2.5 | Transfers & Adjustments | Movement tracking |

**Milestone:** Procurement and inventory complete

### Phase 3: Production (Week 5-6)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 3.1 | Formula Management | Recipe CRUD, versioning |
| 3.2 | Batch Production | Planning, execution |
| 3.3 | Material Consumption | Auto-deduction |
| 3.4 | Machine Management | Equipment registry |
| 3.5 | Production Reports | Batch summary |

**Milestone:** Manufacturing workflow complete

### Phase 4: Quality Control (Week 7)
**Duration:** 1 week

| Task | Description | Deliverables |
|------|-------------|--------------|
| 4.1 | QC Parameters | Lab standards |
| 4.2 | Test Management | Result entry, approval |
| 4.3 | Quality Workflow | Pass/fail routing |

**Milestone:** QC system operational

### Phase 5: Sales & Distribution (Week 8-9)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 5.1 | Customer Management | Dealer registry |
| 5.2 | Sales Orders | Order processing |
| 5.3 | Invoicing | GST-compliant invoices |
| 5.4 | Delivery Management | DO, vehicle assignment |
| 5.5 | Returns | Return handling |

**Milestone:** Sales cycle complete

### Phase 6: Finance (Week 10-11)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 6.1 | Chart of Accounts | Account groups |
| 6.2 | Vouchers | Receipt, payment, journal |
| 6.3 | Party Ledgers | AR/AP management |
| 6.4 | Financial Reports | Trial balance, P&L |

**Milestone:** Accounting operational

### Phase 7: Advanced Features (Week 12-13)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 7.1 | Barcode System | QR/barcode generation |
| 7.2 | Formula Optimization | Cost minimization |
| 7.3 | IoT Integration | Device management |
| 7.4 | Multi-Factory | Branch support |

**Milestone:** Advanced features live

### Phase 8: Reports & Dashboard (Week 14-15)
**Duration:** 2 weeks

| Task | Description | Deliverables |
|------|-------------|--------------|
| 8.1 | Dashboard | KPIs, charts |
| 8.2 | Report Builder | Custom reports |
| 8.3 | Export | PDF, Excel |
| 8.4 | Print Layouts | Invoices, reports |

**Milestone:** Analytics complete

### Phase 9: Testing & Deployment (Week 16)
**Duration:** 1 week

| Task | Description | Deliverables |
|------|-------------|--------------|
| 9.1 | Integration Testing | End-to-end workflows |
| 9.2 | Performance Testing | Load testing |
| 9.3 | Bug Fixes | Issue resolution |
| 9.4 | Documentation | User manual |
| 9.5 | Deployment | Production setup |

**Milestone:** Go-live ready

---

## 11. Testing Strategy

### 11.1 Test Categories

| Category | Coverage | Tools |
|----------|----------|-------|
| Unit Tests | API endpoints, business logic | Jest |
| Integration Tests | Database operations | Supertest |
| UI Tests | Forms, navigation | Playwright |
| E2E Tests | Complete workflows | Playwright |

### 11.2 Test Scenarios

#### Purchase Flow
1. Create supplier → Verify in list
2. Create PO → Verify total calculation
3. Approve PO → Verify status change
4. Create GRN from PO → Verify stock update
5. Create invoice → Verify GL entries

#### Production Flow
1. Create formula → Verify ingredients total 100%
2. Create batch → Verify material allocation
3. Start batch → Verify status change
4. Complete batch → Verify stock update
5. QC test → Verify approval workflow

### 11.3 Performance Benchmarks

| Metric | Target |
|--------|--------|
| Page Load | < 2 seconds |
| API Response | < 200ms |
| Concurrent Users | 500+ |
| Database Queries | < 50ms |

---

## 12. Deployment Plan

### 12.1 Development Environment

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  api:
    build: ./server
    ports:
      - "3000:3000"
    volumes:
      - ./server:/app
      - ./data:/app/data
    environment:
      - NODE_ENV=development
      - DB_TYPE=sqlite
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
```

### 12.2 Production Environment

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api:
    image: feedmill-erp-api:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_TYPE=postgresql
      - DB_HOST=postgres
    depends_on:
      - postgres
    restart: unless-stopped
  
  frontend:
    image: feedmill-erp-frontend:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped
  
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=feedmill_erp
      - POSTGRES_USER=feedmill
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

### 12.3 Nginx Configuration

```nginx
# /etc/nginx/sites-available/feedmill-erp
server {
    listen 80;
    server_name erp.feedmill.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.feedmill.com;
    
    ssl_certificate /etc/nginx/ssl/erp.feedmill.com.crt;
    ssl_certificate_key /etc/nginx/ssl/erp.feedmill.com.key;
    
    # Frontend
    location / {
        root /var/www/feedmill-erp/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API Proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
    
    # File Uploads
    location /uploads {
        alias /var/uploads/feedmill;
        expires 1M;
        add_header Cache-Control "public";
    }
}
```

### 12.4 Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
DB_TYPE=postgresql
DB_HOST=postgres.internal
DB_PORT=5432
DB_NAME=feedmill_erp
DB_USER=feedmill
DB_PASSWORD=secure_password_here

# JWT
JWT_SECRET=your_very_long_and_secure_secret_key_here_minimum_32_chars
JWT_EXPIRY=8h

# Application
APP_NAME=FeedMill ERP
APP_URL=https://erp.feedmill.com
UPLOAD_PATH=/var/uploads/feedmill
MAX_UPLOAD_SIZE=10mb

# Multi-tenant
ENABLE_MULTI_TENANT=true

# IoT
IOT_ENABLED=true
IOT_POLL_INTERVAL=5000
```

---

## 13. Maintenance & Support

### 13.1 Support Levels

| Level | Response Time | Description |
|-------|---------------|-------------|
| Critical | 1 hour | System down, data loss |
| High | 4 hours | Major feature broken |
| Medium | 24 hours | Feature not working |
| Low | 72 hours | Minor issues, questions |

### 13.2 Maintenance Schedule

| Frequency | Task |
|----------|------|
| Daily | Log monitoring, backups |
| Weekly | Performance review, security patches |
| Monthly | Database optimization, cleanup |
| Quarterly | Feature updates, security audit |

### 13.3 Backup Strategy

```bash
#!/bin/bash
# backup.sh

# Daily backup at 2 AM
BACKUP_DIR=/var/backups/feedmill
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
pg_dump -Fc feedmill_erp > $BACKUP_DIR/db_$DATE.dump

# Retain 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

# Upload to S3
aws s3 cp $BACKUP_DIR/db_$DATE.dump s3://feedmill-backups/
```

### 13.4 Monitoring

```javascript
// Health check endpoint
app.get('/api/health', (req, res) => {
    const health = {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: checkDatabaseConnection(),
        timestamp: new Date().toISOString()
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});
```

---

## Appendix A: Database Schema Summary

```
Total Tables: 45+
Total Indexes: 25+
Estimated Size: 10-50 MB (initial)
Growth Rate: 1-5 MB/month (typical usage)
```

## Appendix B: API Rate Limits

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/auth/*` | 10 | per minute |
| `/api/*` (authenticated) | 100 | per minute |
| `/api/reports/*` | 20 | per minute |

## Appendix C: Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Mobile Safari | 14+ | ✅ Full |
| Chrome Mobile | 90+ | ✅ Full |

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| GRN | Goods Received Note |
| PO | Purchase Order |
| FIFO | First In, First Out |
| QC | Quality Control |
| DO | Delivery Order |
| WIP | Work In Progress |
| AR | Accounts Receivable |
| AP | Accounts Payable |
| POD | Proof of Delivery |
| IoT | Internet of Things |
| MQTT | Message Queuing Telemetry Transport |

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Author:** Implementation Team  
**Status:** Development In Progress
