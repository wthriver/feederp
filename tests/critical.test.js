const { test, expect, describe, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3006/api';
let authToken = '';
let testTenantId = '';
let testUserId = '';

describe('FeedMill ERP - Critical Path Tests', () => {
    describe('Authentication', () => {
        test('POST /auth/login - Success', async () => {
            const res = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'admin', password: 'admin123' });
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.accessToken).toBeDefined();
            authToken = res.body.data.accessToken;
            testTenantId = res.body.data.user.tenant_id;
            testUserId = res.body.data.user.id;
        }, 10000);

        test('POST /auth/login - Invalid credentials', async () => {
            const res = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'admin', password: 'wrongpassword' });
            
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test('POST /auth/login - Missing credentials', async () => {
            const res = await request(API_BASE)
                .post('/auth/login')
                .send({});
            
            expect(res.status).toBe(400);
        });
    });

    describe('Master Data', () => {
        const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };

        test('GET /master/factories - Returns array', async () => {
            const res = await request(API_BASE)
                .get('/master/factories')
                .set(headers);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        test('GET /master/customers - Returns paginated', async () => {
            const res = await request(API_BASE)
                .get('/master/customers?page=1&limit=10')
                .set(headers);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.meta).toBeDefined();
            expect(res.body.meta.total).toBeDefined();
        });

        test('POST /master/customers - Create new', async () => {
            const res = await request(API_BASE)
                .post('/master/customers')
                .set(headers)
                .send({
                    code: `CUST${Date.now()}`,
                    name: 'Test Customer',
                    type: 'dealer',
                    phone: '9876543210',
                    email: 'test@example.com'
                });
            
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        test('GET /master/units - Returns units', async () => {
            const res = await request(API_BASE)
                .get('/master/units')
                .set(headers);
            
            expect(res.status).toBe(200);
        });
    });

    describe('Sales', () => {
        const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };

        test('GET /sales/orders - List orders', async () => {
            const res = await request(API_BASE)
                .get('/sales/orders?page=1&limit=10')
                .set(headers);
            
            expect(res.status).toBe(200);
        });

        test('POST /sales/orders - Create with validation', async () => {
            const res = await request(API_BASE)
                .post('/sales/orders')
                .set(headers)
                .send({
                    customer_id: '00000000-0000-0000-0000-000000000000',
                    order_date: new Date().toISOString().slice(0, 10),
                    items: []
                });
            
            expect(res.status).toBe(400);
        });
    });

    describe('Inventory', () => {
        const headers = { 'Authorization': `Bearer ${authToken}` };

        test('GET /inventory/stock - Returns stock', async () => {
            const res = await request(API_BASE)
                .get('/inventory/stock?page=1&limit=10')
                .set(headers);
            
            expect(res.status).toBe(200);
        });

        test('GET /inventory/stock/alerts - Returns alerts', async () => {
            const res = await request(API_BASE)
                .get('/inventory/stock/alerts')
                .set(headers);
            
            expect(res.status).toBe(200);
        });

        test('GET /inventory/stock/valuation - Returns valuation', async () => {
            const res = await request(API_BASE)
                .get('/inventory/stock/valuation')
                .set(headers);
            
            expect(res.status).toBe(200);
        });
    });

    describe('Production', () => {
        const headers = { 'Authorization': `Bearer ${authToken}` };

        test('GET /production/formulas - List formulas', async () => {
            const res = await request(API_BASE)
                .get('/production/formulas?page=1&limit=10')
                .set(headers);
            
            expect(res.status).toBe(200);
        });

        test('GET /production/batches - List batches', async () => {
            const res = await request(API_BASE)
                .get('/production/batches?page=1&limit=10')
                .set(headers);
            
            expect(res.status).toBe(200);
        });

        test('GET /production/machines - List machines', async () => {
            const res = await request(API_BASE)
                .get('/production/machines')
                .set(headers);
            
            expect(res.status).toBe(200);
        });
    });

    describe('Dashboard', () => {
        const headers = { 'Authorization': `Bearer ${authToken}` };

        test('GET /dashboard/summary - Returns summary', async () => {
            const res = await request(API_BASE)
                .get('/dashboard/summary')
                .set(headers);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.today).toBeDefined();
            expect(res.body.data.stock).toBeDefined();
        });
    });

    describe('Health Check', () => {
        test('GET /api/health - Returns health status', async () => {
            const res = await request(API_BASE.replace('/api', ''))
                .get('/api/health');
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.version).toBeDefined();
        });
    });
});

console.log('Running FeedMill ERP Critical Path Tests...');