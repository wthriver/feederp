const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
let authToken = '';
let testTenantId = '';
let testUserId = '';

describe('FeedMill ERP API Tests', () => {
    describe('Authentication', () => {
        it('should login with valid credentials', async () => {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.accessToken).toBeDefined();
            authToken = data.data.accessToken;
            testTenantId = data.data.user.tenant_id;
            testUserId = data.data.user.id;
        });

        it('should reject invalid credentials', async () => {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'wrong' })
            });

            expect(response.status).toBe(401);
        });
    });

    describe('Master Data', () => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };

        it('should fetch factories', async () => {
            const response = await fetch(`${API_BASE}/master/factories`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(Array.isArray(data.data)).toBe(true);
        });

        it('should fetch godowns', async () => {
            const response = await fetch(`${API_BASE}/master/godowns`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should fetch raw materials', async () => {
            const response = await fetch(`${API_BASE}/master/raw-materials`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should fetch products', async () => {
            const response = await fetch(`${API_BASE}/master/products`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should create a new supplier', async () => {
            const response = await fetch(`${API_BASE}/purchase/suppliers`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    code: 'SUP001',
                    name: 'Test Supplier',
                    phone: '9876543210',
                    email: 'test@supplier.com'
                })
            });

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.id).toBeDefined();
        });
    });

    describe('Purchase Orders', () => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };

        it('should create a purchase order', async () => {
            const response = await fetch(`${API_BASE}/purchase/purchase-orders`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    supplier_id: 'test-supplier-id',
                    po_date: new Date().toISOString().slice(0, 10),
                    items: []
                })
            });

            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should list purchase orders', async () => {
            const response = await fetch(`${API_BASE}/purchase/purchase-orders`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('Inventory', () => {
        const headers = {
            'Authorization': `Bearer ${authToken}`
        };

        it('should fetch stock summary', async () => {
            const response = await fetch(`${API_BASE}/inventory/stock`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should fetch stock alerts', async () => {
            const response = await fetch(`${API_BASE}/inventory/stock/alerts`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('Production', () => {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };

        it('should fetch formulas', async () => {
            const response = await fetch(`${API_BASE}/production/formulas`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should fetch batches', async () => {
            const response = await fetch(`${API_BASE}/production/batches`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('Dashboard', () => {
        const headers = {
            'Authorization': `Bearer ${authToken}`
        };

        it('should fetch dashboard summary', async () => {
            const response = await fetch(`${API_BASE}/dashboard/summary`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toHaveProperty('today');
            expect(data.data).toHaveProperty('alerts');
        });
    });

    describe('Reports', () => {
        const headers = {
            'Authorization': `Bearer ${authToken}`
        };

        it('should fetch stock position report', async () => {
            const response = await fetch(`${API_BASE}/reports/stock-position`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should fetch sales summary report', async () => {
            const response = await fetch(`${API_BASE}/reports/sales-summary`, { headers });
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await fetch(`${API_BASE.replace('/api', '')}/api/health`);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.version).toBeDefined();
        });
    });
});
