const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheManager {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'api', 'cache');
    this.contractsDir = path.join(this.cacheDir, 'contracts');
    this.analysisDir = path.join(this.cacheDir, 'analysis');
    this.tempDir = path.join(this.cacheDir, 'temp');
  }

  /**
   * Initialize cache directory structure
   */
  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(this.contractsDir, { recursive: true });
      await fs.mkdir(this.analysisDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      
      console.log('Cache directory structure initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize cache directory:', error.message);
      return false;
    }
  }

  /**
   * Generate cache key for contract data
   */
  generateCacheKey(contractAddress, dataType = 'profile') {
    // Ensure contractAddress is a string
    const addressStr = typeof contractAddress === 'string' ? contractAddress : String(contractAddress || 'unknown');
    
    const hash = crypto.createHash('md5')
      .update(`${addressStr}-${dataType}-${Date.now()}`)
      .digest('hex');
    return `${addressStr.slice(0, 10)}-${dataType}-${hash.slice(0, 8)}`;
  }

  /**
   * Save profiled contract data to cache
   */
  async saveContractProfile(contractAddress, profileData) {
    try {
      const cacheKey = this.generateCacheKey(contractAddress, 'profile');
      const filename = `${cacheKey}.json`;
      const filepath = path.join(this.contractsDir, filename);
      
      const cacheData = {
        contractAddress,
        timestamp: new Date().toISOString(),
        cacheKey,
        data: profileData
      };
      
      await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
      console.log(`Contract profile cached: ${filename}`);
      
      return {
        success: true,
        cacheKey,
        filepath,
        filename
      };
    } catch (error) {
      console.error('Failed to save contract profile to cache:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save AI analysis results to cache
   */
  async saveAnalysisResults(contractAddress, analysisData) {
    try {
      const cacheKey = this.generateCacheKey(contractAddress, 'analysis');
      const filename = `${cacheKey}.json`;
      const filepath = path.join(this.analysisDir, filename);
      
      const cacheData = {
        contractAddress,
        timestamp: new Date().toISOString(),
        cacheKey,
        analysis: analysisData
      };
      
      await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
      console.log(`AI analysis cached: ${filename}`);
      
      return {
        success: true,
        cacheKey,
        filepath,
        filename
      };
    } catch (error) {
      console.error('Failed to save analysis to cache:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve cached contract profile
   */
  async getContractProfile(contractAddress, maxAge = 3600000) { // 1 hour default
    try {
      const addressStr = typeof contractAddress === 'string' ? contractAddress : String(contractAddress || 'unknown');
      const files = await fs.readdir(this.contractsDir);
      const contractFiles = files.filter(file => 
        file.startsWith(addressStr.slice(0, 10)) && 
        file.includes('profile') &&
        file.endsWith('.json')
      );
      
      if (contractFiles.length === 0) {
        return { found: false, reason: 'No cached profile found' };
      }
      
      // Get the most recent file
      const latestFile = contractFiles.sort().reverse()[0];
      const filepath = path.join(this.contractsDir, latestFile);
      
      const cacheData = JSON.parse(await fs.readFile(filepath, 'utf8'));
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      
      if (cacheAge > maxAge) {
        return { found: false, reason: 'Cache expired', age: cacheAge };
      }
      
      return {
        found: true,
        data: cacheData.data,
        cacheKey: cacheData.cacheKey,
        age: cacheAge
      };
    } catch (error) {
      return { found: false, reason: error.message };
    }
  }

  /**
   * Retrieve cached analysis results
   */
  async getAnalysisResults(contractAddress, maxAge = 3600000) { // 1 hour default
    try {
      const addressStr = typeof contractAddress === 'string' ? contractAddress : String(contractAddress || 'unknown');
      const files = await fs.readdir(this.analysisDir);
      const analysisFiles = files.filter(file => 
        file.startsWith(addressStr.slice(0, 10)) && 
        file.includes('analysis') &&
        file.endsWith('.json')
      );
      
      if (analysisFiles.length === 0) {
        return { found: false, reason: 'No cached analysis found' };
      }
      
      // Get the most recent file
      const latestFile = analysisFiles.sort().reverse()[0];
      const filepath = path.join(this.analysisDir, latestFile);
      
      const cacheData = JSON.parse(await fs.readFile(filepath, 'utf8'));
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      
      if (cacheAge > maxAge) {
        return { found: false, reason: 'Cache expired', age: cacheAge };
      }
      
      return {
        found: true,
        analysis: cacheData.analysis,
        cacheKey: cacheData.cacheKey,
        age: cacheAge
      };
    } catch (error) {
      return { found: false, reason: error.message };
    }
  }

  /**
   * Clean up old cache files
   */
  async cleanupCache(maxAge = 86400000) { // 24 hours default
    try {
      let cleanedCount = 0;
      
      // Clean contracts cache
      const contractFiles = await fs.readdir(this.contractsDir);
      for (const file of contractFiles) {
        const filepath = path.join(this.contractsDir, file);
        const stats = await fs.stat(filepath);
        const fileAge = Date.now() - stats.mtime.getTime();
        
        if (fileAge > maxAge) {
          await fs.unlink(filepath);
          cleanedCount++;
        }
      }
      
      // Clean analysis cache
      const analysisFiles = await fs.readdir(this.analysisDir);
      for (const file of analysisFiles) {
        const filepath = path.join(this.analysisDir, file);
        const stats = await fs.stat(filepath);
        const fileAge = Date.now() - stats.mtime.getTime();
        
        if (fileAge > maxAge) {
          await fs.unlink(filepath);
          cleanedCount++;
        }
      }
      
      // Clean temp directory
      const tempFiles = await fs.readdir(this.tempDir);
      for (const file of tempFiles) {
        const filepath = path.join(this.tempDir, file);
        await fs.unlink(filepath);
        cleanedCount++;
      }
      
      console.log(`Cache cleanup completed: ${cleanedCount} files removed`);
      return { success: true, filesRemoved: cleanedCount };
    } catch (error) {
      console.error('Cache cleanup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const contractFiles = await fs.readdir(this.contractsDir);
      const analysisFiles = await fs.readdir(this.analysisDir);
      const tempFiles = await fs.readdir(this.tempDir);
      
      // Calculate total cache size
      let totalSize = 0;
      const allFiles = [
        ...contractFiles.map(f => path.join(this.contractsDir, f)),
        ...analysisFiles.map(f => path.join(this.analysisDir, f)),
        ...tempFiles.map(f => path.join(this.tempDir, f))
      ];
      
      for (const filepath of allFiles) {
        try {
          const stats = await fs.stat(filepath);
          totalSize += stats.size;
        } catch (error) {
          // File might have been deleted, skip
        }
      }
      
      return {
        contractProfiles: contractFiles.length,
        analysisResults: analysisFiles.length,
        tempFiles: tempFiles.length,
        totalFiles: contractFiles.length + analysisFiles.length + tempFiles.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      return {
        error: error.message,
        contractProfiles: 0,
        analysisResults: 0,
        tempFiles: 0,
        totalFiles: 0,
        totalSizeBytes: 0,
        totalSizeMB: '0.00'
      };
    }
  }

  /**
   * Create a temporary file for processing
   */
  async createTempFile(data, prefix = 'temp') {
    try {
      const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`;
      const filepath = path.join(this.tempDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      
      return {
        success: true,
        filepath,
        filename,
        cleanup: async () => {
          try {
            await fs.unlink(filepath);
          } catch (error) {
            console.warn(`Failed to cleanup temp file ${filepath}: ${error.message}`);
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CacheManager;