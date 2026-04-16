# FeedMill ERP

Enterprise Resource Planning system for Cattle/Poultry/Fish Feed Factory Management.

## Quick Start

### Development Mode

```bash
# Install all dependencies
npm run install:all

# Start Backend
npm run server

# Start Frontend (new terminal)
npm run client
```

- Backend: http://localhost:3006
- Frontend: http://localhost:5173
- Default Login: admin / admin123

### Docker Deployment

```bash
# Copy environment file
cp .env.production.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Access at http://localhost:8080

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/security.test.js
```

## Features

- **Master Data**: Factories, Godowns, Raw Materials, Products, Suppliers, Customers
- **Purchase**: Purchase Orders, Goods Inward, Purchase Invoices
- **Inventory**: Stock Management, Transfers, Adjustments
- **Production**: Formulas, Batch Production, Machine Management
- **Quality Control**: QC Parameters, Test Results
- **Sales**: Orders, Invoices, Returns
- **Finance**: Accounts, Transactions, Payments
- **Transport**: Vehicles, Drivers, Deliveries
- **Reports**: Stock, Production, Sales, Financial Reports
- **Advanced**: Barcode/QR System, IoT Integration, Real-time Updates

## Technology Stack

- **Frontend**: Vue.js 3, Pinia, Vue Router, Vue-i18n
- **Backend**: Node.js, Express.js
- **Database**: SQLite (dev), PostgreSQL (prod)
- **Real-time**: Socket.io
- **Export**: PDFKit, ExcelJS

## Changelog

### Phase 1: Security & Performance Foundations
- ✅ MFA (TOTP) authentication with backup codes
- ✅ Database-backed session management
- ✅ Tenant isolation fixes in sales/production
- ✅ N+1 query optimizations in inventory/production
- ✅ Secure rate limit logging (no sensitive data)
- ✅ Enhanced input sanitization with XSS detection

### Phase 2: Frontend Component Standardization
- ✅ 38 views refactored to use AppModal component
- ✅ Consistent modal structure across all pages
- ✅ Loading state indicators on all forms
- ✅ Standardized form validation patterns

### Phase 3: Database Optimization
- ✅ 27 new database indexes added
- ✅ Optimized JOINs for sales orders, invoices, batches
- ✅ Improved query performance for reports

### Phase 4: Enterprise Core Features
- ✅ Enhanced bulk export (CSV, Excel) for 8+ entities
- ✅ CSV import templates with validation
- ✅ Bulk create/update/delete operations
- ✅ Sales and inventory export endpoints

### Phase 5: UX & Accessibility
- ✅ Keyboard navigation composables
- ✅ Focus trap utilities for modals
- ✅ Screen reader announcement support
- ✅ Error boundary component
- ✅ Enhanced skeleton loaders (table, card, list)
- ✅ Improved empty state accessibility

### Phase 6: Missing Enterprise Features
- ✅ Multi-step workflow approval engine
- ✅ Configurable validation rules
- ✅ Audit log export to CSV/Excel
- ✅ Dashboard widget customization
- ✅ User notification preferences

### Phase 7: Testing & Documentation
- ✅ Comprehensive Jest configuration
- ✅ Security tests (rate limiting, XSS, SQL injection)
- ✅ Workflow API tests
- ✅ Validation rules tests
- ✅ Full API documentation

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | Server port | 3006 |
| DB_TYPE | Database type | sqlite |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_NAME | Database name | feedmill_erp |
| JWT_SECRET | JWT secret | - |
| JWT_REFRESH_SECRET | Refresh token secret | - |

## License

MIT License - See LICENSE file for details
