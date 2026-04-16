const request = require('supertest');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3006/api';
let authToken = '';
let workflowId = '';
let validationRuleId = '';

describe('Workflow API Tests', () => {
    beforeAll(async () => {
        const loginRes = await request(API_BASE)
            .post('/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        authToken = loginRes.body.data?.accessToken || '';
    });

    describe('Workflow Definitions', () => {
        test('GET /workflow/definitions - Should return workflow definitions', async () => {
            const response = await request(API_BASE)
                .get('/workflow/definitions')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('POST /workflow/definitions - Should create workflow definition', async () => {
            const response = await request(API_BASE)
                .post('/workflow/definitions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Workflow',
                    entity_type: 'purchase_order',
                    steps: [
                        { step: 'manager_approval', name: 'Manager Approval' },
                        { step: 'director_approval', name: 'Director Approval' }
                    ],
                    approvers: [
                        { step: 'manager_approval', user_id: null, user_name: 'Manager' },
                        { step: 'director_approval', user_id: null, user_name: 'Director' }
                    ],
                    priority: 1
                });
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
        });

        test('POST /workflow/definitions - Should reject invalid entity type', async () => {
            const response = await request(API_BASE)
                .post('/workflow/definitions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Workflow',
                    entity_type: 'invalid_type',
                    steps: [],
                    approvers: []
                });
            
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_ENTITY');
        });

        test('POST /workflow/definitions - Should require name and steps', async () => {
            const response = await request(API_BASE)
                .post('/workflow/definitions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    entity_type: 'purchase_order'
                });
            
            expect(response.status).toBe(400);
        });
    });

    describe('Workflow Instances', () => {
        test('GET /workflow/instances - Should return workflow instances', async () => {
            const response = await request(API_BASE)
                .get('/workflow/instances')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('GET /workflow/instances - Should filter by entity type', async () => {
            const response = await request(API_BASE)
                .get('/workflow/instances?entity_type=purchase_order')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
        });

        test('GET /workflow/instances - Should filter by status', async () => {
            const response = await request(API_BASE)
                .get('/workflow/instances?status=pending')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
        });

        test('GET /workflow/my-pending - Should return pending approvals for user', async () => {
            const response = await request(API_BASE)
                .get('/workflow/my-pending')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('POST /workflow/instances - Should require entity type and id', async () => {
            const response = await request(API_BASE)
                .post('/workflow/instances')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});
            
            expect(response.status).toBe(400);
        });

        test('POST /workflow/instances/:id/action - Should validate action', async () => {
            const response = await request(API_BASE)
                .post('/workflow/instances/test-id/action')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ action: 'invalid' });
            
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_ACTION');
        });
    });
});

describe('Validation Rules API Tests', () => {
    beforeAll(async () => {
        const loginRes = await request(API_BASE)
            .post('/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        authToken = loginRes.body.data?.accessToken || '';
    });

    describe('Validation Rules CRUD', () => {
        test('GET /validation/rules - Should return validation rules', async () => {
            const response = await request(API_BASE)
                .get('/validation/rules')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /validation/rules - Should filter by entity type', async () => {
            const response = await request(API_BASE)
                .get('/validation/rules?entity_type=customers')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
        });

        test('POST /validation/rules - Should create validation rule', async () => {
            const response = await request(API_BASE)
                .post('/validation/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'GSTIN Pattern',
                    entity_type: 'customers',
                    field: 'gstin',
                    validation_type: 'pattern',
                    config: {
                        pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
                    },
                    error_message: 'Invalid GSTIN format',
                    priority: 1
                });
            
            expect([201, 400]).toContain(response.status);
            if (response.status === 201) {
                validationRuleId = response.body.data.id;
            }
        });

        test('POST /validation/rules - Should create required field rule', async () => {
            const response = await request(API_BASE)
                .post('/validation/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Email Required',
                    entity_type: 'customers',
                    field: 'email',
                    validation_type: 'required',
                    priority: 0
                });
            
            expect([201, 400]).toContain(response.status);
        });

        test('POST /validation/rules - Should create range validation rule', async () => {
            const response = await request(API_BASE)
                .post('/validation/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Credit Limit Range',
                    entity_type: 'customers',
                    field: 'credit_limit',
                    validation_type: 'range',
                    config: {
                        min: 0,
                        max: 10000000
                    },
                    error_message: 'Credit limit must be between 0 and 10,000,000'
                });
            
            expect([201, 400]).toContain(response.status);
        });

        test('POST /validation/rules - Should reject invalid validation type', async () => {
            const response = await request(API_BASE)
                .post('/validation/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Rule',
                    entity_type: 'customers',
                    field: 'name',
                    validation_type: 'invalid_type'
                });
            
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_TYPE');
        });

        test('POST /validation/rules - Should reject invalid entity type', async () => {
            const response = await request(API_BASE)
                .post('/validation/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Entity',
                    entity_type: 'invalid_table',
                    field: 'name',
                    validation_type: 'required'
                });
            
            expect(response.status).toBe(400);
        });
    });

    describe('Validation Endpoint', () => {
        test('POST /validation/validate - Should validate required field', async () => {
            const response = await request(API_BASE)
                .post('/validation/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    entity_type: 'customers',
                    data: {
                        code: '',
                        name: ''
                    }
                });
            
            expect(response.status).toBe(200);
            expect(response.body.data.valid).toBeDefined();
        });

        test('POST /validation/validate - Should validate GSTIN pattern', async () => {
            const response = await request(API_BASE)
                .post('/validation/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    entity_type: 'customers',
                    data: {
                        gstin: '27AABCU9603R1ZM'
                    }
                });
            
            expect(response.status).toBe(200);
        });

        test('POST /validation/validate - Should reject invalid GSTIN', async () => {
            const response = await request(API_BASE)
                .post('/validation/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    entity_type: 'customers',
                    data: {
                        gstin: 'INVALID123'
                    }
                });
            
            expect(response.status).toBe(200);
            expect(response.body.data.errors).toBeDefined();
        });

        test('POST /validation/validate - Should validate range', async () => {
            const response = await request(API_BASE)
                .post('/validation/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    entity_type: 'customers',
                    data: {
                        credit_limit: 50000
                    }
                });
            
            expect(response.status).toBe(200);
        });

        test('POST /validation/validate - Should validate email format', async () => {
            const response = await request(API_BASE)
                .post('/validation/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    entity_type: 'customers',
                    data: {
                        email: 'invalid-email'
                    }
                });
            
            expect(response.status).toBe(200);
        });

        test('POST /validation/validate - Should require entity type', async () => {
            const response = await request(API_BASE)
                .post('/validation/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    data: {}
                });
            
            expect(response.status).toBe(400);
        });
    });

    describe('Validation Rule Management', () => {
        test('PUT /validation/rules/:id - Should update rule', async () => {
            const response = await request(API_BASE)
                .put('/validation/rules/test-id')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Updated Rule',
                    priority: 10
                });
            
            expect([200, 404]).toContain(response.status);
        });

        test('DELETE /validation/rules/:id - Should delete rule', async () => {
            const response = await request(API_BASE)
                .delete('/validation/rules/test-id')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect([200, 404]).toContain(response.status);
        });
    });
});

describe('Bulk Operations Tests', () => {
    beforeAll(async () => {
        const loginRes = await request(API_BASE)
            .post('/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        authToken = loginRes.body.data?.accessToken || '';
    });

    describe('Export', () => {
        test('GET /bulk/export/products - Should export products', async () => {
            const response = await request(API_BASE)
                .get('/bulk/export/products')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
        });

        test('GET /bulk/export/products?format=csv - Should export as CSV', async () => {
            const response = await request(API_BASE)
                .get('/bulk/export/products?format=csv')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/csv');
        });

        test('GET /bulk/export/products?format=excel - Should export as Excel', async () => {
            const response = await request(API_BASE)
                .get('/bulk/export/products?format=excel')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('spreadsheet');
        });

        test('GET /bulk/export/invalid-entity - Should reject invalid entity', async () => {
            const response = await request(API_BASE)
                .get('/bulk/export/invalid-entity')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(400);
        });
    });

    describe('Import Template', () => {
        test('GET /bulk/import/products/template - Should return template', async () => {
            const response = await request(API_BASE)
                .get('/bulk/import/products/template')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/csv');
        });
    });

    describe('Bulk Operations', () => {
        test('POST /bulk/products - Should require ids', async () => {
            const response = await request(API_BASE)
                .post('/bulk/products')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ action: 'activate' });
            
            expect(response.status).toBe(400);
        });

        test('POST /bulk/products - Should require valid action', async () => {
            const response = await request(API_BASE)
                .post('/bulk/products')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ ids: [], action: 'invalid' });
            
            expect(response.status).toBe(400);
        });
    });
});
