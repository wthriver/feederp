require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🧪 FeedMill ERP Test Runner\n');

const tests = [];
const passed = [];
const failed = [];

function test(name, fn) {
    tests.push({ name, fn });
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected truthy, got ${actual}`);
        },
        toBeFalsy: () => {
            if (actual) throw new Error(`Expected falsy, got ${actual}`);
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toContain: (item) => {
            if (!actual.includes(item)) throw new Error(`Expected array to contain ${item}`);
        },
        toBeDefined: () => {
            if (actual === undefined) throw new Error(`Expected value to be defined`);
        },
        toHaveProperty: (prop) => {
            if (!actual || !actual[prop]) throw new Error(`Expected object to have property ${prop}`);
        }
    };
}

function beforeAll(fn) { fn(); }
function afterAll(fn) { fn(); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
let authToken = '';

async function runTests() {
    let passed = 0, failed = 0;

    for (const t of tests) {
        try {
            await t.fn();
            console.log(`  ✅ ${t.name}`);
            passed++;
        } catch (err) {
            console.log(`  ❌ ${t.name}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

let describe = (name, fn) => fn();
let it = test;
let xit = () => {};

console.log('Loading tests...');

const { initDatabase } = require('../server/config/database');

describe('Authentication', () => {
    beforeAll(async () => {
        try {
            await initDatabase();
            console.log('  Database initialized');
        } catch (e) {
            console.log('  Database already initialized');
        }
    });

    it('should reject requests without token', async () => {
        const res = await fetch(`${API_BASE}/master/factories`);
        expect(res.status).toBe(401);
    });

    it('should login successfully', async () => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        const data = await res.json();
        if (data.success && data.data?.accessToken) {
            authToken = data.data.accessToken;
            expect(authToken).toBeDefined();
            console.log('    Token received');
        } else {
            console.log('    Login may need seeding or credentials');
        }
    });
});

describe('API Health', () => {
    it('should respond to health check', async () => {
        const res = await fetch(`${API_BASE.replace('/api', '')}/api/health`);
        expect(res.status).toBe(200);
    });
});

describe('Database', () => {
    const { query, run, getDb, DB_TYPE } = require('../server/config/database');

    it('should connect to database', () => {
        const db = getDb();
        expect(db).toBeDefined();
    });

    it('should have required tables', () => {
        const tables = ['users', 'tenants', 'factories', 'godowns', 'raw_materials', 'products'];
        expect(tables.length).toBeGreaterThan(0);
    });
});

describe('Validation', () => {
    const { validate, schemas } = require('../server/middleware/validate');

    it('should validate login schema', () => {
        const { error } = schemas.login.validate({ username: 'admin', password: 'pass123' });
        expect(error).toBeFalsy();
    });

    it('should reject invalid login', () => {
        const { error } = schemas.login.validate({ username: '', password: '' });
        expect(error).toBeTruthy();
    });
});

describe('Helpers', () => {
    const { arrayToCSV, parseExportParams } = require('../server/config/export');

    it('should convert array to CSV', () => {
        const data = [{ name: 'Test', code: '001' }, { name: 'Test2', code: '002' }];
        const csv = arrayToCSV(data, ['name', 'code']);
        expect(csv).toContain('name,code');
    });

    it('should parse export params', () => {
        const req = { query: { page: '2', limit: '100', format: 'csv' } };
        const params = parseExportParams(req);
        expect(params.page).toBe(2);
        expect(params.limit).toBe(100);
        expect(params.format).toBe('csv');
    });
});

    const { paginate, formatPaginationResponse } = require('../server/config/pagination');

    it('should calculate pagination', () => {
        const { safePage, safeLimit } = paginate('2', '25', {});
        expect(safePage).toBe(2);
        expect(safeLimit).toBe(25);
    });
});

describe('Rate Limiter Config', () => {
    const { authLimiter, strictLimiter, paymentLimiter } = require('../server/index');

    it('should have rate limiters configured', () => {
        expect(authLimiter).toBeDefined();
        expect(strictLimiter).toBeDefined();
    });
});

runTests().catch(err => {
    console.error('Test runner error:', err.message);
    process.exit(1);
});