const { createClient } = require('redis');
const { logger } = require('../utils/logger');

let redisClient = null;
let isRedisAvailable = false;

const MEMORY_CACHE = new Map();
const CACHE_EXPIRY = new Map();

const DEFAULT_TTL = 300;

async function initRedis() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
        logger.warn('REDIS_URL not configured, using in-memory cache only');
        return;
    }

    try {
        redisClient = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis reconnection failed after 10 attempts');
                        return new Error('Redis reconnection failed');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            logger.error('Redis Client Error:', err.message);
            isRedisAvailable = false;
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
            isRedisAvailable = true;
        });

        redisClient.on('ready', () => {
            isRedisAvailable = true;
        });

        await redisClient.connect();
    } catch (error) {
        logger.warn('Redis connection failed, using in-memory cache:', error.message);
        isRedisAvailable = false;
    }
}

function getCacheKey(prefix, identifier) {
    return `feedmill:${process.env.NODE_ENV || 'dev'}:${prefix}:${identifier}`;
}

async function set(key, value, ttl = DEFAULT_TTL) {
    const serialized = JSON.stringify(value);

    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.setEx(key, ttl, serialized);
            return true;
        } catch (error) {
            logger.warn('Redis set error:', error.message);
        }
    }

    MEMORY_CACHE.set(key, value);
    CACHE_EXPIRY.set(key, Date.now() + (ttl * 1000));
    
    if (MEMORY_CACHE.size > 1000) {
        cleanupMemoryCache();
    }
    
    return true;
}

async function get(key) {
    if (isRedisAvailable && redisClient) {
        try {
            const value = await redisClient.get(key);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } catch (error) {
            logger.warn('Redis get error:', error.message);
        }
    }

    const value = MEMORY_CACHE.get(key);
    if (value === undefined) return null;
    
    const expiry = CACHE_EXPIRY.get(key);
    if (expiry && Date.now() > expiry) {
        MEMORY_CACHE.delete(key);
        CACHE_EXPIRY.delete(key);
        return null;
    }
    
    return value;
}

async function del(key) {
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.del(key);
        } catch (error) {
            logger.warn('Redis del error:', error.message);
        }
    }

    MEMORY_CACHE.delete(key);
    CACHE_EXPIRY.delete(key);
}

async function delByPattern(pattern) {
    if (isRedisAvailable && redisClient) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            logger.warn('Redis delByPattern error:', error.message);
        }
    }

    for (const key of MEMORY_CACHE.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
            MEMORY_CACHE.delete(key);
            CACHE_EXPIRY.delete(key);
        }
    }
}

function cleanupMemoryCache() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, expiry] of CACHE_EXPIRY) {
        if (now > expiry) {
            MEMORY_CACHE.delete(key);
            CACHE_EXPIRY.delete(key);
            removed++;
        }
    }

    if (MEMORY_CACHE.size > 1000 && removed < 100) {
        const entries = Array.from(MEMORY_CACHE.entries());
        entries.slice(0, 200).forEach(([key]) => {
            MEMORY_CACHE.delete(key);
            CACHE_EXPIRY.delete(key);
        });
    }
}

async function getStats() {
    const stats = {
        backend: 'memory',
        size: MEMORY_CACHE.size,
        isRedisConnected: isRedisAvailable
    };

    if (isRedisAvailable && redisClient) {
        try {
            const info = await redisClient.info('memory');
            stats.backend = 'redis';
            stats.redis = {
                used: MEMORY_CACHE.size,
                connected: true
            };
        } catch (error) {
            stats.redis = { connected: false, error: error.message };
        }
    }

    return stats;
}

function createCacheMiddleware(ttl = 60) {
    return async (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }

        const cacheKey = getCacheKey(req.path, JSON.stringify(req.query));
        
        try {
            const cached = await get(cacheKey);
            if (cached) {
                return res.json(cached);
            }

            const originalJson = res.json.bind(res);
            res.json = function(data) {
                if (res.statusCode === 200 && data.success) {
                    set(cacheKey, data, ttl).catch(() => {});
                }
                return originalJson(data);
            };

            next();
        } catch (error) {
            next();
        }
    };
}

module.exports = {
    initRedis,
    set,
    get,
    del,
    delByPattern,
    getStats,
    createCacheMiddleware,
    getCacheKey
};