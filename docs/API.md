# FeedMill ERP API Documentation

## Overview

The FeedMill ERP API is a comprehensive RESTful API for managing cattle feed manufacturing operations. It provides endpoints for authentication, master data management, inventory, production, sales, finance, and reporting.

## Base URL

```
Production: https://api.feedmill-erp.com
Development: http://localhost:3006/api
```

## Authentication

### POST /api/auth/login

Authenticate user and receive JWT tokens.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token",
    "expiresIn": 1800,
    "mfaRequired": false,
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "tenant_id": "uuid",
      "role": "string",
      "factory_id": "uuid"
    }
  }
}
```

### POST /api/auth/refresh

Refresh access token.

**Request:**
```json
{
  "refreshToken": "string"
}
```

### POST /api/auth/logout

Logout and invalidate tokens.

### POST /api/auth/register

Register new tenant/user.

**Request:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string",
  "company_name": "string"
}
```

### MFA Endpoints

#### POST /api/auth/mfa/setup
Initialize MFA for user account.

#### POST /api/auth/mfa/verify
Verify MFA code during login.

#### POST /api/auth/mfa/disable
Disable MFA for user account.

#### GET /api/auth/mfa/status
Get MFA status for user.

## Master Data

### Factories

#### GET /api/master/factories
Get all factories for tenant.

**Query Parameters:**
- `search`: Search by name/code
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

#### POST /api/master/factories
Create new factory.

#### GET /api/master/factories/:id
Get factory by ID.

#### PUT /api/master/factories/:id
Update factory.

#### DELETE /api/master/factories/:id
Delete factory.

### Godowns

#### GET /api/master/godowns
Get all godowns.

**Query Parameters:**
- `factory_id`: Filter by factory
- `type`: Filter by type (raw_material, finished_goods, semi_finished, general)

### Products

#### GET /api/master/products
Get all products.

**Query Parameters:**
- `search`: Search by name/code
- `type`: Filter by type (cattle, poultry, fish, other)
- `page`: Page number
- `limit`: Items per page

#### POST /api/master/products
Create new product.

### Raw Materials

#### GET /api/master/raw-materials
Get all raw materials.

**Query Parameters:**
- `search`: Search by name/code
- `category`: Filter by category (grain, protein, mineral, vitamin, additive)

### Customers

#### GET /api/master/customers
Get all customers.

**Query Parameters:**
- `search`: Search by name/code
- `type`: Filter by type (dealer, retailer, direct, government, corporate)
- `page`: Page number
- `limit`: Items per page

#### POST /api/master/customers
Create new customer.

**Request:**
```json
{
  "code": "string",
  "name": "string",
  "type": "dealer|retailer|direct|government|corporate",
  "contact_person": "string",
  "phone": "string",
  "mobile": "string",
  "email": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "gstin": "string",
  "credit_limit": "number",
  "payment_terms": "NET15|NET30|NET45|NET60|IMMEDIATE",
  "is_active": "boolean"
}
```

### Suppliers

#### GET /api/master/suppliers
Get all suppliers.

### Units

#### GET /api/master/units
Get all units of measurement.

## Inventory

### GET /api/inventory/stock
Get current stock positions.

**Query Parameters:**
- `godown_id`: Filter by godown
- `item_type`: Filter by type (raw_material, product)
- `page`: Page number
- `limit`: Items per page

### GET /api/inventory/stock/alerts
Get low stock alerts.

### GET /api/inventory/stock/valuation
Get stock valuation report.

### POST /api/inventory/adjustments
Create stock adjustment.

### POST /api/inventory/transfers
Create stock transfer.

## Production

### GET /api/production/formulas
Get all production formulas.

**Query Parameters:**
- `status`: Filter by status (draft, active, archived)
- `product_id`: Filter by product

### POST /api/production/formulas
Create new formula.

### GET /api/production/batches
Get all production batches.

**Query Parameters:**
- `status`: Filter by status
- `from_date`: Start date
- `to_date`: End date
- `page`: Page number

### POST /api/production/batches
Create new batch.

### POST /api/production/batches/:id/complete
Complete a batch with actual quantities.

### GET /api/production/machines
Get all machines.

### GET /api/production/job-cards
Get all job cards.

## Sales

### GET /api/sales/orders
Get all sales orders.

**Query Parameters:**
- `status`: Filter by status (pending, confirmed, dispatched, delivered, cancelled)
- `customer_id`: Filter by customer
- `from_date`: Start date
- `to_date`: End date

### POST /api/sales/orders
Create new sales order.

### GET /api/sales/invoices
Get all sales invoices.

### POST /api/sales/invoices
Create new invoice.

### GET /api/sales/invoices/:id
Get invoice details.

### PUT /api/sales/invoices/:id/status
Update invoice status.

### GET /api/sales/returns
Get all sales returns.

## Purchase

### GET /api/purchase/suppliers
Get all suppliers.

### POST /api/purchase/suppliers
Create new supplier.

### GET /api/purchase/purchase-orders
Get all purchase orders.

### POST /api/purchase/purchase-orders
Create new purchase order.

### GET /api/purchase/goods-inward
Get all goods inward entries.

### POST /api/purchase/goods-inward
Create goods inward entry.

## Finance

### GET /api/finance/accounts
Get all accounts.

### POST /api/finance/accounts
Create new account.

### GET /api/finance/transactions
Get all transactions.

**Query Parameters:**
- `account_id`: Filter by account
- `type`: Filter by type (debit, credit)
- `from_date`: Start date
- `to_date`: End date

### POST /api/finance/transactions
Create new transaction.

### GET /api/finance/payments
Get all payments.

### POST /api/finance/payments
Create new payment.

## Reports

### GET /api/reports/stock-position
Get stock position report.

**Query Parameters:**
- `godown_id`: Filter by godown
- `as_on_date`: Report date (YYYY-MM-DD)

### GET /api/reports/stock-position/export
Export stock position report.

**Query Parameters:**
- `format`: Export format (csv, excel, pdf)
- `godown_id`: Filter by godown
- `as_on_date`: Report date

### GET /api/reports/sales-summary
Get sales summary report.

**Query Parameters:**
- `from_date`: Start date
- `to_date`: End date
- `customer_id`: Filter by customer

### GET /api/reports/production-summary
Get production summary report.

### GET /api/reports/stock-valuation
Get stock valuation report.

### GET /api/reports/profit-analysis
Get profit analysis report.

### GET /api/reports/audit-log
Get audit trail.

**Query Parameters:**
- `from_date`: Start date
- `to_date`: End date
- `user_id`: Filter by user
- `module`: Filter by module

### GET /api/reports/customer-statement
Get customer account statement.

### GET /api/reports/supplier-statement
Get supplier account statement.

### GET /api/reports/account-ledger
Get account ledger report.

### GET /api/reports/profit-loss
Get profit & loss statement.

### GET /api/reports/balance-sheet
Get balance sheet.

### GET /api/reports/cash-flow
Get cash flow statement.

## Bulk Operations

### GET /api/bulk/export/:entity
Export data for an entity.

**Query Parameters:**
- `format`: Export format (csv, excel)
- `search`: Search term
- `status`: Filter by status
- `limit`: Max records (default: 1000)

**Supported Entities:**
- raw-materials
- products
- suppliers
- customers
- formulas
- units
- godowns
- machines

### GET /api/bulk/import/:entity/template
Download CSV template for import.

### POST /api/bulk/import/:entity
Import data from CSV/JSON.

**Request:**
```json
{
  "items": [...],
  "mode": "create|update|skip"
}
```

### POST /api/bulk/:entity
Bulk operations on multiple records.

**Request:**
```json
{
  "ids": ["uuid1", "uuid2"],
  "action": "delete|activate|deactivate|update",
  "data": {} // Required for update action
}
```

### GET /api/bulk/sales/export
Export sales data.

### GET /api/bulk/inventory/export
Export inventory data.

## Workflow

### GET /api/workflow/definitions
Get all workflow definitions.

### POST /api/workflow/definitions
Create workflow definition.

**Request:**
```json
{
  "name": "string",
  "entity_type": "purchase_order|sales_order|invoice|payment",
  "steps": [...],
  "approvers": [...],
  "conditions": {},
  "priority": 0
}
```

### GET /api/workflow/instances
Get all workflow instances.

**Query Parameters:**
- `entity_type`: Filter by entity type
- `status`: Filter by status (pending, in_review, approved, rejected)

### POST /api/workflow/instances
Create new workflow instance.

### GET /api/workflow/instances/:id
Get workflow instance details.

### POST /api/workflow/instances/:id/action
Perform action on workflow.

**Request:**
```json
{
  "action": "submit|approve|reject|revert",
  "comment": "string",
  "approver_id": "uuid" // Optional
}
```

### GET /api/workflow/my-pending
Get workflows pending current user's approval.

## Validation Rules

### GET /api/validation/rules
Get all validation rules.

**Query Parameters:**
- `entity_type`: Filter by entity
- `is_active`: Filter by status

### POST /api/validation/rules
Create validation rule.

**Request:**
```json
{
  "name": "string",
  "entity_type": "string",
  "field": "string",
  "validation_type": "required|unique|pattern|range|dependent|duplication",
  "config": {},
  "priority": 0,
  "error_message": "string"
}
```

### POST /api/validation/validate
Validate data against rules.

**Request:**
```json
{
  "entity_type": "string",
  "data": {},
  "exclude_id": "uuid" // Optional, for updates
}
```

## Admin

### GET /api/admin/users
Get all users.

### POST /api/admin/users
Create new user.

### GET /api/admin/users/:id
Get user details.

### PUT /api/admin/users/:id
Update user.

### DELETE /api/admin/users/:id
Delete user.

### GET /api/admin/roles
Get all roles.

### POST /api/admin/roles
Create new role.

### PUT /api/admin/roles/:id
Update role permissions.

### GET /api/admin/activity-log
Get activity log.

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|-------|
| General | 100 | 15 minutes |
| Auth | 100 | 15 minutes |
| Login | 5 | 15 minutes |
| Payments | 50 | 1 hour |
| Contact | 10 | 1 hour |

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Pagination

All list endpoints support pagination:

```
GET /api/resource?page=1&limit=50
```

Response includes meta:
```json
{
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```
