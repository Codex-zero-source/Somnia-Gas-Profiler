const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const { ethers } = require('ethers');
const profiler = require('../profiler');

/**
 * Batch gasless profiling for multiple contracts
 * @param {Object} options - Batch options
 */
async function batchGaslessProfile(options) {
  const {
    config: configPath,
    rpc = 'https://dream-rpc.somnia.network',
    parallel = 3,
    outputDir = './batch-results',
    continueOnError = true,
    verbose = false
  } = options;

  try {
    // Load and validate configuration
    console.log(chalk.blue('📄 Loading batch configuration...'));
    const config = await loadBatchConfig(configPath);
    console.log(chalk.green(`✅ Loaded ${config.contracts.length} contract(s) for processing`));

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    console.log(chalk.gray(`   Output directory: ${path.resolve(outputDir)}`));

    // Initialize batch processing
    const results = {
      started: new Date().toISOString(),
      rpc,
      configuration: {
        parallel,
        continueOnError,
        totalContracts: config.contracts.length
      },
      contracts: [],
      summary: {
        successful: 0,
        failed: 0,
        skipped: 0,
        totalGasProfiled: 0,
        averageGasPerFunction: 0
      }
    };

    console.log(chalk.blue(`\n🚀 Starting batch processing (${parallel} parallel workers)...\n`));

    // Process contracts in batches
    const batches = chunkArray(config.contracts, parallel);
    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(chalk.blue(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} contracts)...`));

      // Process batch in parallel
      const batchPromises = batch.map(async (contractConfig, index) => {
        const contractIndex = processedCount + index;
        return processContract(contractConfig, contractIndex, config, results, outputDir, {
          rpc,
          continueOnError,
          verbose
        });
      });

      try {
        await Promise.all(batchPromises);
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        console.log(chalk.yellow(`⚠️  Batch ${batchIndex + 1} had some failures, continuing...`));
      }

      processedCount += batch.length;
      
      // Progress update
      const progress = Math.round((processedCount / config.contracts.length) * 100);
      console.log(chalk.gray(`   Progress: ${processedCount}/${config.contracts.length} (${progress}%)\n`));
    }

    // Finalize results
    results.completed = new Date().toISOString();
    results.duration = Date.now() - new Date(results.started).getTime();
    
    // Calculate summary statistics
    calculateSummaryStats(results);
    
    // Save batch results
    const batchResultsPath = path.join(outputDir, 'batch-results.json');
    await fs.writeFile(batchResultsPath, JSON.stringify(results, null, 2));
    
    // Display summary
    displayBatchSummary(results);
    
    console.log(chalk.green(`\n💾 Batch results saved to ${batchResultsPath}`));
    console.log(chalk.green('🎉 Batch gasless profiling completed!'));

  } catch (error) {
    throw new Error(`Batch gasless profiling failed: ${error.message}`);
  }
}

/**
 * Load and validate batch configuration
 * @param {string} configPath - Path to configuration file
 * @returns {Object} Validated configuration
 */
async function loadBatchConfig(configPath) {
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Validate configuration structure
    if (!config.contracts || !Array.isArray(config.contracts)) {
      throw new Error('Configuration must contain "contracts" array');
    }
    
    if (config.contracts.length === 0) {
      throw new Error('No contracts specified in configuration');
    }
    
    // Validate each contract configuration
    for (let i = 0; i < config.contracts.length; i++) {
      const contract = config.contracts[i];
      
      if (!contract.address && !contract.bytecode && !contract.source) {
        throw new Error(`Contract ${i + 1}: Must specify address, bytecode, or source`);
      }
      
      if (!contract.name) {
        contract.name = `Contract_${i + 1}`;
      }
      
      // Set defaults
      contract.runs = contract.runs || 3;
      contract.gasless = contract.gasless !== false; // Default to true for batch gasless
      contract.functions = contract.functions || ['*']; // Profile all functions by default
    }
    
    console.log(chalk.gray(`   Configuration validated: ${config.contracts.length} contracts`));
    
    return config;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    throw new Error(`Invalid configuration: ${error.message}`);
  }
}

/**
 * Process a single contract
 * @param {Object} contractConfig - Contract configuration
 * @param {number} index - Contract index
 * @param {Object} globalConfig - Global configuration
 * @param {Object} results - Results object
 * @param {string} outputDir - Output directory
 * @param {Object} options - Processing options
 */
async function processContract(contractConfig, index, globalConfig, results, outputDir, options) {
  const { rpc, continueOnError, verbose } = options;
  const startTime = Date.now();
  
  const contractResult = {
    index: index + 1,
    name: contractConfig.name,
    address: contractConfig.address,
    started: new Date().toISOString(),
    status: 'processing',
    functions: [],
    errors: []
  };
  
  try {
    console.log(chalk.blue(`   [${index + 1}] Processing ${contractConfig.name}...`));
    
    // Prepare profiling options
    const profilingOptions = {
      rpc,
      runs: contractConfig.runs,
      gasless: contractConfig.gasless,
      paymaster: contractConfig.paymaster,
      verbose: verbose
    };
    
    // Handle different input types
    if (contractConfig.address) {
      // Deployed contract
      if (!contractConfig.abi) {
        throw new Error('ABI required for deployed contract');
      }
      
      profilingOptions.address = contractConfig.address;
      profilingOptions.abi = contractConfig.abi;
      profilingOptions.fn = contractConfig.functions.includes('*') ? 
        await getAllFunctionSignatures(contractConfig.abi) : 
        contractConfig.functions;
      profilingOptions.args = generateDefaultArgs(profilingOptions.fn, contractConfig.abi);
      
    } else if (contractConfig.bytecode) {
      // Bytecode profiling
      if (!contractConfig.abi) {
        throw new Error('ABI required for bytecode profiling');
      }
      
      // Deploy contract temporarily (would need enhancement)
      throw new Error('Bytecode profiling not yet implemented in batch mode');
      
    } else if (contractConfig.source) {
      // Source code compilation and profiling
      throw new Error('Source compilation not yet implemented in batch mode');
    }
    
    // Set output path
    const contractOutputFile = path.join(outputDir, `${sanitizeFilename(contractConfig.name)}_results.json`);
    profilingOptions.out = contractOutputFile;
    
    // Execute profiling
    await profiler.analyze(profilingOptions);
    
    // Load and parse results
    const profilingResults = JSON.parse(await fs.readFile(contractOutputFile, 'utf8'));
    
    // Extract function results
    Object.entries(profilingResults.results).forEach(([functionSig, funcResult]) => {
      contractResult.functions.push({
        signature: functionSig,
        runs: funcResult.runs.length,
        averageGas: funcResult.aggregated.avg,
        minGas: funcResult.aggregated.min,
        maxGas: funcResult.aggregated.max,
        mode: funcResult.runs[0]?.mode || 'unknown',
        paymasterUsed: funcResult.runs[0]?.paymasterUsed || false
      });
    });
    
    // Update status
    contractResult.status = 'completed';
    contractResult.completed = new Date().toISOString();
    contractResult.duration = Date.now() - startTime;
    contractResult.outputFile = contractOutputFile;
    
    // Add to results
    results.contracts.push(contractResult);
    results.summary.successful++;
    
    console.log(chalk.green(`   [${index + 1}] ✅ ${contractConfig.name} completed (${contractResult.functions.length} functions)`));
    
  } catch (error) {
    contractResult.status = 'failed';
    contractResult.error = error.message;
    contractResult.completed = new Date().toISOString();
    contractResult.duration = Date.now() - startTime;
    
    results.contracts.push(contractResult);
    results.summary.failed++;
    
    console.log(chalk.red(`   [${index + 1}] ❌ ${contractConfig.name} failed: ${error.message.substring(0, 80)}...`));
    
    if (!continueOnError) {
      throw error;
    }
  }
}

/**
 * Get all function signatures from ABI
 * @param {Array|string} abi - Contract ABI
 * @returns {Array} Function signatures
 */
async function getAllFunctionSignatures(abi) {
  const abiArray = typeof abi === 'string' ? JSON.parse(abi) : abi;
  
  return abiArray
    .filter(item => item.type === 'function' && item.stateMutability !== 'view' && item.stateMutability !== 'pure')
    .map(func => `${func.name}(${func.inputs.map(input => input.type).join(',')})`)
    .slice(0, 10); // Limit to 10 functions to avoid excessive profiling
}

/**
 * Generate default arguments for functions
 * @param {Array} functionSignatures - Function signatures
 * @param {Array|string} abi - Contract ABI
 * @returns {Array} Default arguments
 */
function generateDefaultArgs(functionSignatures, abi) {
  const abiArray = typeof abi === 'string' ? JSON.parse(abi) : abi;
  
  return functionSignatures.map(sig => {
    const func = abiArray.find(item => {
      const fullSig = `${item.name}(${item.inputs.map(input => input.type).join(',')})`;
      return fullSig === sig;
    });
    
    if (!func) return [];
    
    // Generate simple default arguments
    return func.inputs.map(input => {
      switch (input.type) {
        case 'uint256':
        case 'uint':
          return '1000';
        case 'address':
          return '0x0000000000000000000000000000000000000001';
        case 'bool':
          return 'true';
        case 'string':
          return '"test"';
        case 'bytes':
        case 'bytes32':
          return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        default:
          return '0'; // Generic fallback
      }
    });
  });
}

/**
 * Calculate summary statistics
 * @param {Object} results - Results object
 */
function calculateSummaryStats(results) {
  let totalGas = 0;
  let totalFunctions = 0;
  
  results.contracts.forEach(contract => {
    if (contract.status === 'completed') {
      contract.functions.forEach(func => {
        totalGas += func.averageGas;
        totalFunctions++;
      });
    }
  });
  
  results.summary.totalGasProfiled = totalGas;
  results.summary.averageGasPerFunction = totalFunctions > 0 ? Math.round(totalGas / totalFunctions) : 0;
  results.summary.totalFunctions = totalFunctions;
}

/**
 * Display batch processing summary
 * @param {Object} results - Results object
 */
function displayBatchSummary(results) {
  console.log('\n' + chalk.bold('📊 Batch Processing Summary'));
  console.log('─'.repeat(60));
  console.log(chalk.green(`✅ Successful: ${results.summary.successful}`));
  console.log(chalk.red(`❌ Failed: ${results.summary.failed}`));
  console.log(chalk.gray(`📈 Total Functions: ${results.summary.totalFunctions || 0}`));
  console.log(chalk.gray(`⛽ Total Gas Profiled: ${(results.summary.totalGasProfiled || 0).toLocaleString()}`));
  console.log(chalk.gray(`📊 Average Gas/Function: ${(results.summary.averageGasPerFunction || 0).toLocaleString()}`));
  console.log(chalk.gray(`⏱️  Duration: ${Math.round((results.duration || 0) / 1000)}s`));
  console.log('─'.repeat(60));
  
  if (results.summary.failed > 0) {
    console.log(chalk.yellow('\n⚠️  Failed Contracts:'));
    results.contracts
      .filter(c => c.status === 'failed')
      .forEach(contract => {
        console.log(chalk.red(`   - ${contract.name}: ${contract.error}`));
      });
  }
}

/**
 * Split array into chunks
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sanitize filename
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

module.exports = {
  batchGaslessProfile
};