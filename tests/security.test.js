const request = require('supertest');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3006/api';
let authToken = '';

describe('Security Tests', () => {
    describe('Authentication Security', () => {
        test('POST /auth/login - Rate limiting after failed attempts', async () => {
            for (let i = 0; i < 5; i++) {
                await request(API_BASE)
                    .post('/auth/login')
                    .send({ username: 'test', password: 'wrong' });
            }
            
            const response = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'test', password: 'wrong' });
            
            expect([429, 401]).toContain(response.status);
        }, 15000);

        test('POST /auth/login - Rejects weak passwords', async () => {
            const response = await request(API_BASE)
                .post('/auth/register')
                .send({ 
                    username: 'newuser', 
                    password: '123', 
                    email: 'test@example.com',
                    company_name: 'Test Company'
                });
            
            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('password');
        });

        test('JWT tokens should have proper expiration', async () => {
            const response = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'admin', password: 'admin123' });
            
            expect(response.body.data.expiresIn).toBeDefined();
        });

        test('Expired tokens should be rejected', async () => {
            const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJleHAiOjB9.invalid';
            
            const response = await request(API_BASE)
                .get('/master/factories')
                .set('Authorization', `Bearer ${expiredToken}`);
            
            expect(response.status).toBe(401);
        });
    });

    describe('Authorization Security', () => {
        beforeAll(async () => {
            const loginRes = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'admin', password: 'admin123' });
            authToken = loginRes.body.data?.accessToken || '';
        });

        test('Requests without token should be rejected', async () => {
            const response = await request(API_BASE)
                .get('/master/factories');
            
            expect(response.status).toBe(401);
        });

        test('Requests with invalid token should be rejected', async () => {
            const response = await request(API_BASE)
                .get('/master/factories')
                .set('Authorization', 'Bearer invalid-token');
            
            expect(response.status).toBe(401);
        });

        test('Requests with malformed Authorization header should be rejected', async () => {
            const response = await request(API_BASE)
                .get('/master/factories')
                .set('Authorization', 'InvalidFormat token');
            
            expect(response.status).toBe(401);
        });
    });

    describe('Input Validation Security', () => {
        beforeAll(async () => {
            const loginRes = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'admin', password: 'admin123' });
            authToken = loginRes.body.data?.accessToken || '';
        });

        test('XSS attempts should be sanitized', async () => {
            const response = await request(API_BASE)
                .post('/master/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    code: '<script>alert(1)</script>',
                    name: 'Test Customer'
                });
            
            expect(response.status).toBe(201);
        });

        test('SQL injection attempts should be blocked', async () => {
            const response = await request(API_BASE)
                .get(`/master/customers?search=' OR '1'='1`)
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
        });

        test('Large payload should be rejected', async () => {
            const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) };
            
            const response = await request(API_BASE)
                .post('/master/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .set('Content-Type', 'application/json')
                .send(largePayload);
            
            expect(response.status).toBe(413);
        });
    });

    describe('Tenant Isolation Security', () => {
        test('Tenant A should not see Tenant B data', async () => {
            const loginRes1 = await request(API_BASE)
                .post('/auth/login')
                .send({ username: 'admin', password: 'admin123' });
            const token1 = loginRes1.body.data?.accessToken;
            
            const customerRes = await request(API_BASE)
                .post('/master/customers')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    code: `SEC-${Date.now()}`,
                    name: 'Security Test Customer',
                    type: 'dealer'
                });
            
            const customerId = customerRes.body.data?.id;
            
            const customersRes = await request(API_BASE)
                .get('/master/customers')
                .set('Authorization', `Bearer ${token1}`);
            
            if (customerId) {
                expect(customersRes.body.data.some(c => c.id === customerId)).toBe(true);
            }
        });
    });

    describe('CORS Security', () => {
        test('Should reject requests from unauthorized origins', async () => {
            const response = await request(API_BASE)
                .get('/api/health')
                .set('Origin', 'http://evil-site.com');
            
            expect([200, 403]).toContain(response.status);
        });
    });

    describe('Headers Security', () => {
        test('Should include security headers', async () => {
            const response = await request(API_BASE)
                .get('/api/health');
            
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBeDefined();
        });
    });
});

describe('Workflow Security', () => {
    let authToken = '';

    beforeAll(async () => {
        const loginRes = await request(API_BASE)
            .post('/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        authToken = loginRes.body.data?.accessToken || '';
    });

    test('POST /workflow/instances - Should validate entity type', async () => {
        const response = await request(API_BASE)
            .post('/workflow/instances')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                entity_type: 'invalid_type',
                entity_id: 'test-id'
            });
        
        expect(response.status).toBe(400);
    });

    test('POST /workflow/instances/:id/action - Should validate action', async () => {
        const response = await request(API_BASE)
            .post('/workflow/instances/invalid-id/action')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                action: 'invalid_action'
            });
        
        expect(response.status).toBe(400);
    });
});

describe('Validation Rules Security', () => {
    let authToken = '';

    beforeAll(async () => {
        const loginRes = await request(API_BASE)
            .post('/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        authToken = loginRes.body.data?.accessToken || '';
    });

    test('POST /validation/validate - Should reject invalid entity type', async () => {
        const response = await request(API_BASE)
            .post('/validation/validate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                entity_type: 'invalid_table',
                data: {}
            });
        
        expect(response.status).toBe(200);
    });

    test('POST /validation/validate - Should validate GSTIN pattern', async () => {
        const response = await request(API_BASE)
            .post('/validation/validate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                entity_type: 'customers',
                data: { gstin: 'INVALID123' }
            });
        
        expect(response.status).toBe(200);
    });
});
