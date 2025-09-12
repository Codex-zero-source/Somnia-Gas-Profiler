const redis = require('redis');

// Create Redis client
const createRedisClient = async () => {
  const client = redis.createClient({
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    password: process.env.REDIS_PASSWORD || undefined,
    database: process.env.REDIS_DB || 0,
  });

  // Event listeners
  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Connected to Redis server');
  });

  client.on('ready', () => {
    console.log('Redis client ready');
  });

  client.on('end', () => {
    console.log('Redis connection ended');
  });

  client.on('reconnecting', () => {
    console.log('Reconnecting to Redis...');
  });

  await client.connect(); // <-- required for redis@4

  return client;
};

// Redis key patterns for different data types
const REDIS_KEYS = {
  CONTRACT_ANALYSIS: (address) => `contract:analysis:${address.toLowerCase()}`,
  CONTRACT_METADATA: (address) => `contract:metadata:${address.toLowerCase()}`,
  ANALYSIS_HISTORY: (address) => `contract:history:${address.toLowerCase()}`,
  GLOBAL_STATS: 'global:stats',
  RECENT_ANALYSES: 'recent:analyses',
};

// TTL (Time To Live) configurations in seconds
const TTL = {
  CONTRACT_ANALYSIS: 24 * 60 * 60, // 24 hours
  CONTRACT_METADATA: 7 * 24 * 60 * 60, // 7 days
  ANALYSIS_HISTORY: 30 * 24 * 60 * 60, // 30 days
  GLOBAL_STATS: 60 * 60, // 1 hour
  RECENT_ANALYSES: 60 * 60, // 1 hour
};

module.exports = {
  createRedisClient,
  REDIS_KEYS,
  TTL,
};
