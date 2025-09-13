const path = require('path');

// Load environment variables from project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const redisService = require('./services/redisService');
const BlockchainService = require('./services/blockchain');
const { DeveloperAnalyzer } = require('./lib/developer-analyzer');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
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

const blockchainService = new BlockchainService();
blockchainService.initialize();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Helper function to run CLI command and get results
async function runCLICommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Endpoint to analyze a contract (quick analysis)
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

      // Store in Redis cache if available
      try {
        if (redisService.isReady()) {
          await redisService.storeContractAnalysis(contractAddress, result);
          console.log('Analysis cached successfully');
        } else {
          console.log('Redis not available, skipping cache storage');
        }
      } catch (cacheError) {
        console.error('Cache storage failed:', cacheError.message);
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

// Endpoint for full contract analysis with CSV output
app.post('/api/full-analyze', async (req, res) => {
  try {
    const { contractAddress } = req.body;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Check Redis cache first for full analysis
    const cacheKey = `full_analysis:${contractAddress}`;
    if (redisConnected && redisService.isReady()) {
      try {
        const cachedAnalysis = await redisService.client.get(cacheKey);
        if (cachedAnalysis) {
          const parsed = JSON.parse(cachedAnalysis);
          console.log(`Returning cached full analysis for: ${contractAddress}`);
          
          // Generate formatted report for cached data if not already present
          let formattedReport = parsed.formattedReport || '';
          if (!formattedReport) {
            const developerAnalyzer = new DeveloperAnalyzer();
            try {
              const developerAnalysis = developerAnalyzer.analyzeGasProfile(
                parsed.analysis,
                contractAddress,
                parsed.analysis.contractAnalysis
              );
              formattedReport = developerAnalyzer.displayAnalysis(developerAnalysis, true);
            } catch (reportError) {
              console.error('Failed to generate formatted report for cached data:', reportError.message);
              formattedReport = 'Error generating formatted report';
            }
          }
          
          return res.json({
            success: true,
            analysis: parsed.analysis,
            formattedReport,
            csvData: parsed.csvData,
            cached: true,
            timestamp: parsed.timestamp,
            onChainMetadata: parsed.onChainMetadata || null
          });
        }
      } catch (cacheError) {
        console.warn('Cache retrieval failed:', cacheError.message);
      }
    }

    // Generate unique output filenames with absolute paths in output directory
    const timestamp = Date.now();
    const projectRoot = path.join(__dirname, '..');
    const outputDir = path.join(projectRoot, 'output');
    const jsonOutput = path.join(outputDir, `quick_analysis_${timestamp}.json`);
    const csvOutput = path.join(outputDir, `quick_analysis_${timestamp}.csv`);
    
    // Run the quick-analyze command for full analysis (works better than profile)
    const command = `node cli/index.js quick-analyze --address ${contractAddress} --export-redis --out "${jsonOutput}"`;
    
    // Ensure output directory exists
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`Running full analysis command: ${command}`);
    
    try {
      const { stdout, stderr } = await runCLICommand(command);
      
      // Read the generated JSON file
      const fs = require('fs').promises;
      let analysisResult;
      try {
        // Check if JSON file exists before reading
        await fs.access(jsonOutput);
        const jsonContent = await fs.readFile(jsonOutput, 'utf8');
        analysisResult = JSON.parse(jsonContent);
        console.log('✅ Successfully read JSON output file');
      } catch (fileError) {
        console.warn('Could not read JSON output file, using stdout:', fileError.message);
        // Fallback to parsing stdout
        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}') + 1;
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            const jsonString = stdout.substring(jsonStart, jsonEnd);
            analysisResult = JSON.parse(jsonString);
            console.log('✅ Successfully parsed JSON from stdout');
          } else {
            analysisResult = { message: 'Full analysis completed', output: stdout };
            console.log('⚠️ Using fallback analysis result');
          }
        } catch (parseError) {
          analysisResult = { message: 'Full analysis completed', output: stdout };
          console.log('⚠️ Using basic fallback analysis result');
        }
      }

      // Read the generated CSV file
      let csvData = null;
      try {
        // Check if CSV file exists before reading
        await fs.access(csvOutput);
        csvData = await fs.readFile(csvOutput, 'utf8');
        console.log('✅ Successfully read CSV output file');
      } catch (csvError) {
        console.warn('Could not read CSV output file:', csvError.message);
        // Generate CSV from analysis result if file doesn't exist
        if (analysisResult && analysisResult.results) {
          csvData = generateCSVFromAnalysis(analysisResult);
          console.log('✅ Generated CSV from analysis results');
        } else {
          console.log('⚠️ No CSV data available');
        }
      }

      // Prepare metadata for on-chain storage
      const onChainMetadata = {
        contractAddress,
        analysisTimestamp: new Date().toISOString(),
        totalFunctions: Object.keys(analysisResult.results || {}).length,
        avgGasUsage: calculateAverageGas(analysisResult),
        analysisHash: require('crypto').createHash('sha256').update(JSON.stringify(analysisResult)).digest('hex')
      };

      // Store analysis on blockchain if available
      let onChainResult = { stored: false };
      if (blockchainService.isAvailable()) {
        try {
          onChainResult = await blockchainService.storeAnalysisOnChain(
            { ...analysisResult, contractAddress },
            csvData,
            cacheKey
          );
        } catch (error) {
          console.error('Blockchain storage failed:', error.message);
        }
      }

      // Store in Redis cache
      try {
        if (redisService.isReady()) {
          const cacheData = {
            ...analysisResult,
            formattedReport,
            csvData,
            timestamp: new Date().toISOString(),
            onChainMetadata: onChainResult
          };
          await redisService.storeContractAnalysis(contractAddress, cacheData);
          console.log(`Cached full analysis for: ${contractAddress}`);
        } else {
          console.log('Redis not available, skipping cache storage');
        }
      } catch (cacheError) {
        console.error('Cache storage failed:', cacheError.message);
      }

      // Clean up temporary files
      try {
        const fs = require('fs').promises;
        try {
          await fs.access(jsonOutput);
          await fs.unlink(jsonOutput);
          console.log('✅ JSON file cleaned up successfully');
        } catch (jsonCleanupError) {
          console.log('JSON file already cleaned or not found');
        }
        
        try {
          await fs.access(csvOutput);
          await fs.unlink(csvOutput);
          console.log('✅ CSV file cleaned up successfully');
        } catch (csvCleanupError) {
          console.log('CSV file already cleaned or not found');
        }
      } catch (cleanupError) {
        console.error('Could not clean up temporary files:', cleanupError.message);
      }
      
      // Generate formatted report using DeveloperAnalyzer
      const developerAnalyzer = new DeveloperAnalyzer();
      let formattedReport = '';
      
      try {
        // Use the analysis result to generate the formatted report
        const developerAnalysis = developerAnalyzer.analyzeGasProfile(
          analysisResult,
          contractAddress,
          analysisResult.contractAnalysis
        );
        formattedReport = developerAnalyzer.displayAnalysis(developerAnalysis, true);
      } catch (reportError) {
        console.error('Failed to generate formatted report:', reportError.message);
        formattedReport = 'Error generating formatted report';
      }
      
      res.json({
        success: true,
        analysis: analysisResult,
        formattedReport,
        csvData,
        cached: false,
        timestamp: new Date().toISOString(),
        onChainMetadata,
        rawOutput: stdout,
        errors: stderr
      });
    } catch (execError) {
      res.status(500).json({
        success: false,
        error: execError.error || 'Failed to execute full analysis',
        stderr: execError.stderr || ''
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to generate CSV from analysis results
function generateCSVFromAnalysis(analysisResult) {
  if (!analysisResult || !analysisResult.results) {
    return 'Function,Average Gas,Min Gas,Max Gas,Total Gas,Calls\n';
  }

  let csv = 'Function,Average Gas,Min Gas,Max Gas,Total Gas,Calls\n';
  
  for (const [functionName, data] of Object.entries(analysisResult.results)) {
    if (data.aggregated) {
      const { avg, min, max, total, callCount } = data.aggregated;
      csv += `"${functionName}",${avg || 0},${min || 0},${max || 0},${total || 0},${callCount || 0}\n`;
    }
  }
  
  return csv;
}

// Helper function to calculate average gas usage
function calculateAverageGas(analysisResult) {
  if (!analysisResult || !analysisResult.results) {
    return 0;
  }

  const functions = Object.values(analysisResult.results);
  const totalGas = functions.reduce((sum, func) => {
    return sum + (func.aggregated?.avg || 0);
  }, 0);
  
  return functions.length > 0 ? Math.round(totalGas / functions.length) : 0;
}

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

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Somnia Gas Profiler API server listening on port ${PORT}`);
  console.log(`Frontend served from: ${path.join(__dirname, 'frontend', 'dist')}`);
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