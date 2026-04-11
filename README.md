# FeedMill ERP

Enterprise Resource Planning system for Cattle/Poultry/Fish Feed Factory Management.

## Quick Start

### Development Mode

```bash
# Start Backend
cd server
npm install
npm start

# Start Frontend (new terminal)
cd frontend
npm install
npm run dev
```

- Backend: http://localhost:3000
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

### Manual Production Deployment

```bash
# Backend
cd server
npm install --production
npm start

# Frontend
cd frontend
npm install
npm run build
# Serve dist/ with nginx
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

## API Documentation

Base URL: `http://localhost:3000/api`

### Authentication
- POST `/auth/login` - User login
- POST `/auth/logout` - User logout
- GET `/auth/me` - Get current user

### Master Data
- GET `/master/factories` - List factories
- GET `/master/godowns` - List godowns
- GET `/master/raw-materials` - List raw materials
- GET `/master/products` - List products

### Purchase
- GET `/purchase/purchase-orders` - List POs
- POST `/purchase/purchase-orders` - Create PO
- POST `/purchase/purchase-orders/:id/approve` - Approve PO
- GET `/purchase/goods-inward` - List GRNs
- POST `/purchase/goods-inward` - Create GRN

### Production
- GET `/production/formulas` - List formulas
- POST `/production/formulas` - Create formula
- GET `/production/batches` - List batches
- POST `/production/batches` - Create batch
- POST `/production/formulas/:id/optimize` - Optimize formula

### Reports
- GET `/reports/stock-position` - Stock position
- GET `/reports/sales-summary` - Sales summary
- GET `/reports/production-summary` - Production summary

### Export
- GET `/reports/stock-position/export?format=pdf` - Export PDF
- GET `/reports/stock-position/export?format=excel` - Export Excel

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | Server port | 3000 |
| DB_TYPE | Database type | sqlite |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_NAME | Database name | feedmill_erp |
| JWT_SECRET | JWT secret | - |
| JWT_EXPIRY | Token expiry | 8h |

## License

Proprietary - All rights reserved
