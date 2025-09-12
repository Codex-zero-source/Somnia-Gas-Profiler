const { createRedisClient, REDIS_KEYS, TTL } = require('../config/redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  // Initialize Redis connection
  async connect() {
    try {
      this.client = createRedisClient();
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
      
      // Test the connection
      await this.client.ping();
      console.log('✅ Redis ping successful');
      
    } catch (error) {
      this.isConnected = false;
      console.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
      console.log('💡 To enable Redis caching, please install and start Redis server on port 6379');
      // Don't throw error, allow API to continue without Redis
    }
  }

  // Disconnect from Redis
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('Redis service disconnected');
    }
  }

  // Check if Redis is connected
  isReady() {
    return this.isConnected && this.client;
  }

  // Store contract analysis result
  async storeContractAnalysis(contractAddress, analysisData) {
    if (!this.isReady()) {
      throw new Error('Redis client not connected');
    }

    try {
      const key = REDIS_KEYS.CONTRACT_ANALYSIS(contractAddress);
      const dataToStore = {
        contractAddress: contractAddress.toLowerCase(),
        analysis: analysisData,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };

      // Store the analysis data
      await this.client.setEx(
        key,
        TTL.CONTRACT_ANALYSIS,
        JSON.stringify(dataToStore)
      );

      // Add to recent analyses list
      await this.addToRecentAnalyses(contractAddress, analysisData);

      // Update global stats
      await this.updateGlobalStats();

      console.log(`Stored analysis for contract: ${contractAddress}`);
      return true;
    } catch (error) {
      console.error('Error storing contract analysis:', error);
      throw error;
    }
  }

  // Retrieve contract analysis result
  async getContractAnalysis(contractAddress) {
    if (!this.isReady()) {
      throw new Error('Redis client not connected');
    }

    try {
      const key = REDIS_KEYS.CONTRACT_ANALYSIS(contractAddress);
      const data = await this.client.get(key);
      
      if (data) {
        const parsedData = JSON.parse(data);
        console.log(`Retrieved analysis for contract: ${contractAddress}`);
        return parsedData;
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving contract analysis:', error);
      throw error;
    }
  }

  // Store contract metadata
  async storeContractMetadata(contractAddress, metadata) {
    if (!this.isReady()) {
      throw new Error('Redis client not connected');
    }

    try {
      const key = REDIS_KEYS.CONTRACT_METADATA(contractAddress);
      const dataToStore = {
        contractAddress: contractAddress.toLowerCase(),
        metadata,
        timestamp: new Date().toISOString(),
      };

      await this.client.setEx(
        key,
        TTL.CONTRACT_METADATA,
        JSON.stringify(dataToStore)
      );

      console.log(`Stored metadata for contract: ${contractAddress}`);
      return true;
    } catch (error) {
      console.error('Error storing contract metadata:', error);
      throw error;
    }
  }

  // Add analysis to recent analyses list
  async addToRecentAnalyses(contractAddress, analysisData) {
    try {
      const key = REDIS_KEYS.RECENT_ANALYSES;
      const recentItem = {
        contractAddress: contractAddress.toLowerCase(),
        timestamp: new Date().toISOString(),
        gasEfficiency: analysisData.gasEfficiency || 'N/A',
        securityGrade: analysisData.securityGrade || 'N/A',
      };

      // Add to the beginning of the list
      await this.client.lPush(key, JSON.stringify(recentItem));
      
      // Keep only the last 100 analyses
      await this.client.lTrim(key, 0, 99);
      
      // Set expiration
      await this.client.expire(key, TTL.RECENT_ANALYSES);
    } catch (error) {
      console.error('Error adding to recent analyses:', error);
    }
  }

  // Get recent analyses
  async getRecentAnalyses(limit = 10) {
    if (!this.isReady()) {
      return [];
    }

    try {
      const key = REDIS_KEYS.RECENT_ANALYSES;
      const recentData = await this.client.lRange(key, 0, limit - 1);
      
      return recentData.map(item => JSON.parse(item));
    } catch (error) {
      console.error('Error retrieving recent analyses:', error);
      return [];
    }
  }

  // Update global statistics
  async updateGlobalStats() {
    try {
      const key = REDIS_KEYS.GLOBAL_STATS;
      const currentStats = await this.client.get(key);
      
      let stats = {
        totalAnalyses: 0,
        lastUpdated: new Date().toISOString(),
      };

      if (currentStats) {
        stats = JSON.parse(currentStats);
      }

      stats.totalAnalyses += 1;
      stats.lastUpdated = new Date().toISOString();

      await this.client.setEx(
        key,
        TTL.GLOBAL_STATS,
        JSON.stringify(stats)
      );
    } catch (error) {
      console.error('Error updating global stats:', error);
    }
  }

  // Get global statistics
  async getGlobalStats() {
    if (!this.isReady()) {
      return { totalAnalyses: 0, lastUpdated: new Date().toISOString() };
    }

    try {
      const key = REDIS_KEYS.GLOBAL_STATS;
      const data = await this.client.get(key);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return { totalAnalyses: 0, lastUpdated: new Date().toISOString() };
    } catch (error) {
      console.error('Error retrieving global stats:', error);
      return { totalAnalyses: 0, lastUpdated: new Date().toISOString() };
    }
  }

  // Check if contract analysis exists in cache
  async hasContractAnalysis(contractAddress) {
    if (!this.isReady()) {
      return false;
    }

    try {
      const key = REDIS_KEYS.CONTRACT_ANALYSIS(contractAddress);
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Error checking contract analysis existence:', error);
      return false;
    }
  }

  // Delete contract analysis from cache
  async deleteContractAnalysis(contractAddress) {
    if (!this.isReady()) {
      throw new Error('Redis client not connected');
    }

    try {
      const key = REDIS_KEYS.CONTRACT_ANALYSIS(contractAddress);
      const result = await this.client.del(key);
      console.log(`Deleted analysis for contract: ${contractAddress}`);
      return result === 1;
    } catch (error) {
      console.error('Error deleting contract analysis:', error);
      throw error;
    }
  }

  // Get cache statistics
  async getCacheStats() {
    if (!this.isReady()) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: true,
        memory: info,
        keyspace: keyspace,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { connected: false, error: error.message };
    }
  }
}

// Create singleton instance
const redisService = new RedisService();

module.exports = redisService;