const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const redisService = require('./services/redisService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Redis connection
let redisConnected = false;
redisService.connect()
  .then(() => {
    redisConnected = true;
    console.log('Redis service initialized successfully');
  })
  .catch((error) => {
    console.warn('Redis service failed to initialize:', error.message);
    console.warn('Continuing without Redis caching...');
  });

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Helper function to run CLI command and get results
async function runCLICommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Endpoint to analyze a contract
app.post('/api/analyze', async (req, res) => {
  try {
    const { contractAddress } = req.body;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Check Redis cache first if connected
    if (redisConnected && redisService.isReady()) {
      try {
        const cachedAnalysis = await redisService.getContractAnalysis(contractAddress);
        if (cachedAnalysis) {
          console.log(`Returning cached analysis for: ${contractAddress}`);
          return res.json({
            success: true,
            analysis: cachedAnalysis.analysis,
            cached: true,
            timestamp: cachedAnalysis.timestamp,
            rawOutput: 'Cached result',
            errors: ''
          });
        }
      } catch (cacheError) {
        console.warn('Cache retrieval failed:', cacheError.message);
      }
    }

    // Run the quick-analyze command
    const command = `node cli/index.js quick-analyze --address ${contractAddress}`;
    
    console.log(`Running command: ${command}`);
    
    try {
      const { stdout, stderr } = await runCLICommand(command);
      
      // Try to parse the output as JSON
      let result;
      try {
        // Extract JSON from stdout if possible
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonString = stdout.substring(jsonStart, jsonEnd);
          result = JSON.parse(jsonString);
        } else {
          result = { message: 'Analysis completed', output: stdout };
        }
      } catch (parseError) {
        result = { message: 'Analysis completed', output: stdout };
      }

      // Store in Redis cache if connected
      if (redisConnected && redisService.isReady()) {
        try {
          await redisService.storeContractAnalysis(contractAddress, result);
          console.log(`Cached analysis for: ${contractAddress}`);
        } catch (cacheError) {
          console.warn('Cache storage failed:', cacheError.message);
        }
      }
      
      res.json({
        success: true,
        analysis: result,
        cached: false,
        timestamp: new Date().toISOString(),
        rawOutput: stdout,
        errors: stderr
      });
    } catch (execError) {
      res.status(500).json({
        success: false,
        error: execError.error || 'Failed to execute analysis',
        stderr: execError.stderr || ''
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: {
      connected: redisConnected && redisService.isReady(),
      status: redisConnected ? 'connected' : 'disconnected'
    }
  };

  // Add Redis stats if connected
  if (redisConnected && redisService.isReady()) {
    try {
      const globalStats = await redisService.getGlobalStats();
      healthData.redis.globalStats = globalStats;
    } catch (error) {
      healthData.redis.error = error.message;
    }
  }

  res.json(healthData);
});

// Get recent analyses
app.get('/api/recent-analyses', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    if (!redisConnected || !redisService.isReady()) {
      return res.json({
        success: false,
        error: 'Redis not connected',
        data: []
      });
    }

    const recentAnalyses = await redisService.getRecentAnalyses(limit);
    
    res.json({
      success: true,
      data: recentAnalyses,
      count: recentAnalyses.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

// Get global statistics
app.get('/api/stats', async (req, res) => {
  try {
    if (!redisConnected || !redisService.isReady()) {
      return res.json({
        success: false,
        error: 'Redis not connected',
        stats: { totalAnalyses: 0, lastUpdated: new Date().toISOString() }
      });
    }

    const stats = await redisService.getGlobalStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stats: { totalAnalyses: 0, lastUpdated: new Date().toISOString() }
    });
  }
});

// Get cached analysis for a specific contract
app.get('/api/analysis/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    if (!redisConnected || !redisService.isReady()) {
      return res.json({
        success: false,
        error: 'Redis not connected',
        analysis: null
      });
    }

    const cachedAnalysis = await redisService.getContractAnalysis(contractAddress);
    
    if (cachedAnalysis) {
      res.json({
        success: true,
        analysis: cachedAnalysis,
        cached: true
      });
    } else {
      res.json({
        success: false,
        error: 'Analysis not found in cache',
        analysis: null
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      analysis: null
    });
  }
});

// Delete cached analysis for a specific contract
app.delete('/api/analysis/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    if (!redisConnected || !redisService.isReady()) {
      return res.json({
        success: false,
        error: 'Redis not connected'
      });
    }

    const deleted = await redisService.deleteContractAnalysis(contractAddress);
    
    res.json({
      success: true,
      deleted: deleted,
      message: deleted ? 'Analysis deleted from cache' : 'Analysis not found in cache'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get cache statistics
app.get('/api/cache/stats', async (req, res) => {
  try {
    if (!redisConnected || !redisService.isReady()) {
      return res.json({
        success: false,
        error: 'Redis not connected',
        stats: { connected: false }
      });
    }

    const cacheStats = await redisService.getCacheStats();
    
    res.json({
      success: true,
      stats: cacheStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stats: { connected: false, error: error.message }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Somnia Gas Profiler API server listening on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  
  if (redisConnected && redisService.isReady()) {
    try {
      await redisService.disconnect();
      console.log('Redis connection closed.');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  
  if (redisConnected && redisService.isReady()) {
    try {
      await redisService.disconnect();
      console.log('Redis connection closed.');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
});