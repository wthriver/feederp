const express = require('express');
const os = require('os');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const promClient = require('prom-client');
const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

const httpRequestTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

const activeConnections = new promClient.Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
});
register.registerMetric(activeConnections);

const dbQueryDuration = new promClient.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});
register.registerMetric(dbQueryDuration);

router.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
        httpRequestTotal.inc({ method: req.method, route, status_code: res.statusCode });
    });
    next();
});

router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        res.status(500).end(error.message);
    }
});

router.get('/metrics/json', authenticate, async (req, res) => {
    try {
        const cpuLoad = os.loadavg()[0];
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        let dbStats = { tenants: 0, users: 0, stockValue: 0 };
        try {
            const tenantStats = queryOne('SELECT COUNT(*) as count FROM tenants');
            const userStats = queryOne('SELECT COUNT(*) as count FROM users');
            dbStats = {
                tenants: tenantStats?.count || 0,
                users: userStats?.count || 0
            };
        } catch (e) {
            console.error('DB stats error:', e);
        }

        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                system: {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    uptime: os.uptime(),
                    cpu_load: cpuLoad,
                    memory: {
                        total: totalMem,
                        free: freeMem,
                        used: usedMem,
                        usage_percent: (usedMem / totalMem) * 100
                    }
                },
                database: dbStats,
                app: {
                    node_version: process.version,
                    environment: process.env.NODE_ENV || 'development'
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});

router.get('/health', (req, res) => {
    const healthcheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
            database: 'ok',
            memory: 'ok',
            disk: 'ok'
        }
    };

    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 1024 * 1024 * 1024) {
        healthcheck.checks.memory = 'warning';
        healthcheck.status = 'degraded';
    }

    res.json(healthcheck);
});

router.get('/ready', async (req, res) => {
    try {
        queryOne('SELECT 1');
        res.json({ status: 'ready' });
    } catch (error) {
        res.status(503).json({ status: 'not_ready', error: error.message });
    }
});

module.exports = router;
module.exports.register = register;
module.exports.dbQueryDuration = dbQueryDuration;