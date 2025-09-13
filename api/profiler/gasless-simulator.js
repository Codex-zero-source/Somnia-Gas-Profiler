const { ethers } = require('ethers');
const chalk = require('chalk');
const { PaymasterUtils } = require('../utils/paymaster');

/**
 * Advanced Gasless Simulation Engine for Somnia Gas Profiler
 * Provides multiple simulation modes with intelligent fallbacks and caching
 */
class GaslessSimulator {
  constructor(provider) {
    this.provider = provider;
    this.paymasterUtils = new PaymasterUtils(provider);
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
    this.fallbackStrategies = [
      'estimate',
      'staticCall',
      'trace',
      'bytecodeAnalysis'
    ];
  }

  /**
   * Main simulation method with mode selection and fallback
   * @param {Object} options - Simulation options
   * @returns {Promise<Object>} Simulation result
   */
  async simulate(options) {
    const {
      contract,
      functionName,
      args = [],
      mode = 'auto',
      paymasterAddress = null,
      sender = null,
      useCache = true,
      fallbackOnError = true
    } = options;

    try {
      // Generate cache key
      const cacheKey = this._generateCacheKey(contract.target, functionName, args, mode, paymasterAddress);
      
      // Check cache first
      if (useCache && this._getCachedResult(cacheKey)) {
        const cached = this._getCachedResult(cacheKey);
        console.log(chalk.gray(`    📋 Using cached result (${cached.mode})`));
        return { ...cached, fromCache: true };
      }

      // Determine simulation mode
      const simulationMode = mode === 'auto' ? await this._selectOptimalMode(contract, functionName, args) : mode;
      
      let result = null;
      const attempts = [];

      // Try primary simulation mode
      try {
        result = await this._executeSimulation(simulationMode, contract, functionName, args, paymasterAddress, sender);
        result.mode = simulationMode;
        result.attempts = [simulationMode];
      } catch (error) {
        attempts.push({ mode: simulationMode, error: error.message });
        
        if (fallbackOnError) {
          // Try fallback strategies
          result = await this._executeFallbackStrategies(contract, functionName, args, paymasterAddress, sender, attempts);
        } else {
          throw error;
        }
      }

      // Add metadata
      result.timestamp = Date.now();
      result.cacheKey = cacheKey;
      result.attempts = attempts.length > 0 ? attempts : [simulationMode];

      // Cache successful result
      if (useCache && result.success) {
        this._cacheResult(cacheKey, result);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        mode: 'failed',
        gasUsed: this._getDefaultGasEstimate(functionName),
        confidence: 10,
        fallback: true
      };
    }
  }

  /**
   * Execute specific simulation mode
   * @param {string} mode - Simulation mode
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @param {string} sender - Sender address
   * @returns {Promise<Object>} Simulation result
   */
  async _executeSimulation(mode, contract, functionName, args, paymasterAddress, sender) {
    switch (mode) {
      case 'estimate':
        return await this._estimateGasMode(contract, functionName, args, paymasterAddress);
      
      case 'staticCall':
        return await this._staticCallMode(contract, functionName, args, paymasterAddress);
      
      case 'trace':
        return await this._traceMode(contract, functionName, args, paymasterAddress, sender);
      
      case 'debug':
        return await this._debugMode(contract, functionName, args, paymasterAddress, sender);
      
      case 'paymaster':
        return await this._paymasterMode(contract, functionName, args, paymasterAddress, sender);
      
      case 'bytecodeAnalysis':
        return await this._bytecodeAnalysisMode(contract, functionName, args);
      
      default:
        throw new Error(`Unknown simulation mode: ${mode}`);
    }
  }

  /**
   * Standard gas estimation mode
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @returns {Promise<Object>} Estimation result
   */
  async _estimateGasMode(contract, functionName, args, paymasterAddress) {
    const gasEstimate = await contract[functionName].estimateGas(...args);
    let totalGas = Number(gasEstimate);
    let paymasterOverhead = 0;

    if (paymasterAddress) {
      const overheadAnalysis = await this.paymasterUtils.calculatePaymasterOverhead(
        paymasterAddress, 
        { callGasLimit: totalGas }
      );
      paymasterOverhead = overheadAnalysis.totalOverhead;
      totalGas += paymasterOverhead;
    }

    return {
      success: true,
      gasUsed: totalGas,
      baseGas: Number(gasEstimate),
      paymasterOverhead,
      confidence: paymasterAddress ? 85 : 95,
      details: {
        method: 'estimateGas',
        paymasterAnalysis: paymasterAddress ? true : false
      }
    };
  }

  /**
   * Static call simulation mode (for view/pure functions)
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @returns {Promise<Object>} Simulation result
   */
  async _staticCallMode(contract, functionName, args, paymasterAddress) {
    // Try static call to validate the function works
    try {
      await contract[functionName].staticCall(...args);
    } catch (error) {
      if (error.message.includes('revert')) {
        throw new Error(`Function would revert: ${error.message}`);
      }
    }

    // Fallback to estimate gas
    return await this._estimateGasMode(contract, functionName, args, paymasterAddress);
  }

  /**
   * Trace-based simulation mode (detailed gas breakdown)
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @param {string} sender - Sender address
   * @returns {Promise<Object>} Trace result
   */
  async _traceMode(contract, functionName, args, paymasterAddress, sender) {
    try {
      // Prepare transaction data
      const txData = {
        to: contract.target,
        data: contract.interface.encodeFunctionData(functionName, args),
        from: sender || ethers.ZeroAddress
      };

      // Use debug_traceCall if available
      const trace = await this.provider.send('debug_traceCall', [
        txData,
        'latest',
        { tracer: 'callTracer' }
      ]);

      let gasUsed = parseInt(trace.gasUsed, 16);
      let paymasterOverhead = 0;

      if (paymasterAddress) {
        const overheadAnalysis = await this.paymasterUtils.calculatePaymasterOverhead(
          paymasterAddress, 
          { callGasLimit: gasUsed }
        );
        paymasterOverhead = overheadAnalysis.totalOverhead;
        gasUsed += paymasterOverhead;
      }

      return {
        success: true,
        gasUsed,
        baseGas: parseInt(trace.gasUsed, 16),
        paymasterOverhead,
        confidence: 90,
        details: {
          method: 'debug_traceCall',
          trace: {
            type: trace.type,
            gasUsed: trace.gasUsed,
            output: trace.output
          }
        }
      };

    } catch (error) {
      // Fallback to estimate if trace is not available
      console.log(chalk.yellow(`    ⚠️  Trace simulation failed: ${error.message.substring(0, 50)}...`));
      return await this._estimateGasMode(contract, functionName, args, paymasterAddress);
    }
  }

  /**
   * Debug mode with detailed analysis
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @param {string} sender - Sender address
   * @returns {Promise<Object>} Debug result
   */
  async _debugMode(contract, functionName, args, paymasterAddress, sender) {
    const results = {};
    
    // Try multiple estimation methods
    try {
      results.estimateGas = await this._estimateGasMode(contract, functionName, args, paymasterAddress);
    } catch (error) {
      results.estimateGas = { error: error.message };
    }

    try {
      results.staticCall = await this._staticCallMode(contract, functionName, args, paymasterAddress);
    } catch (error) {
      results.staticCall = { error: error.message };
    }

    try {
      results.trace = await this._traceMode(contract, functionName, args, paymasterAddress, sender);
    } catch (error) {
      results.trace = { error: error.message };
    }

    // Select best result
    const successfulResults = Object.values(results).filter(r => r.success);
    if (successfulResults.length === 0) {
      throw new Error('All debug simulation methods failed');
    }

    const bestResult = successfulResults.reduce((best, current) => 
      (current.confidence || 0) > (best.confidence || 0) ? current : best
    );

    return {
      ...bestResult,
      confidence: Math.min((bestResult.confidence || 0) + 5, 100), // Bonus for debug mode
      details: {
        ...bestResult.details,
        debugResults: results,
        method: 'debug_multi'
      }
    };
  }

  /**
   * Paymaster-specific simulation mode
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @param {string} sender - Sender address
   * @returns {Promise<Object>} Paymaster simulation result
   */
  async _paymasterMode(contract, functionName, args, paymasterAddress, sender) {
    if (!paymasterAddress) {
      throw new Error('Paymaster address required for paymaster simulation mode');
    }

    // Validate paymaster
    const validation = await this.paymasterUtils.validatePaymasterInterface(paymasterAddress);
    if (!validation.valid) {
      throw new Error(`Invalid paymaster: ${validation.errors?.join(', ')}`);
    }

    // Create UserOperation
    const userOp = await this.paymasterUtils.createUserOperationFromCall({
      contract,
      functionName,
      args,
      sender: sender || ethers.ZeroAddress,
      paymasterAddress
    });

    // Simulate sponsored transaction
    const simulation = await this.paymasterUtils.simulateSponsoredTransaction({
      contract,
      functionName,
      args,
      paymasterAddress,
      sender: sender || ethers.ZeroAddress
    });

    if (!simulation.success) {
      throw new Error(`Paymaster simulation failed: ${simulation.error}`);
    }

    return {
      success: true,
      gasUsed: simulation.totalGas,
      baseGas: simulation.sponsoredGas,
      paymasterOverhead: simulation.paymasterOverhead,
      confidence: 88,
      details: {
        method: 'paymaster_simulation',
        userOperation: userOp,
        gasEstimates: simulation.gasEstimates,
        paymasterValidation: validation
      }
    };
  }

  /**
   * Bytecode analysis mode (fallback method)
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @returns {Promise<Object>} Analysis result
   */
  async _bytecodeAnalysisMode(contract, functionName, args) {
    const bytecode = await this.provider.getCode(contract.target);
    const functionSelector = contract.interface.getFunction(functionName).selector;
    
    // Basic bytecode analysis
    const complexity = this._analyzeComplexity(bytecode, functionSelector);
    const gasEstimate = this._estimateGasFromComplexity(complexity, args.length);

    return {
      success: true,
      gasUsed: gasEstimate,
      baseGas: gasEstimate,
      paymasterOverhead: 0,
      confidence: 30, // Low confidence for bytecode analysis
      details: {
        method: 'bytecode_analysis',
        complexity,
        codeSize: bytecode.length,
        functionSelector
      }
    };
  }

  /**
   * Execute fallback strategies when primary simulation fails
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @param {string} sender - Sender address
   * @param {Array} attempts - Previous attempts
   * @returns {Promise<Object>} Fallback result
   */
  async _executeFallbackStrategies(contract, functionName, args, paymasterAddress, sender, attempts) {
    console.log(chalk.yellow(`    🔄 Primary simulation failed, trying fallback strategies...`));
    
    for (const strategy of this.fallbackStrategies) {
      // Skip if already attempted
      if (attempts.some(a => a.mode === strategy)) continue;
      
      try {
        console.log(chalk.gray(`    🔄 Trying ${strategy} simulation...`));
        const result = await this._executeSimulation(strategy, contract, functionName, args, paymasterAddress, sender);
        
        result.fallback = true;
        result.primaryFailure = attempts[0]?.error || 'Unknown error';
        
        console.log(chalk.green(`    ✅ ${strategy} simulation succeeded`));
        return result;
        
      } catch (error) {
        attempts.push({ mode: strategy, error: error.message });
        console.log(chalk.gray(`    ❌ ${strategy} failed: ${error.message.substring(0, 50)}...`));
      }
    }
    
    // All strategies failed, return default estimate
    return {
      success: false,
      gasUsed: this._getDefaultGasEstimate(functionName),
      confidence: 5,
      fallback: true,
      error: 'All simulation strategies failed',
      attempts
    };
  }

  /**
   * Select optimal simulation mode based on function characteristics
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @returns {Promise<string>} Optimal mode
   */
  async _selectOptimalMode(contract, functionName, args) {
    try {
      const func = contract.interface.getFunction(functionName);
      
      // View/pure functions - use static call
      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        return 'staticCall';
      }
      
      // Complex functions with many parameters - use trace
      if (args.length > 3) {
        return 'trace';
      }
      
      // Default to estimate
      return 'estimate';
      
    } catch {
      return 'estimate';
    }
  }

  /**
   * Analyze bytecode complexity
   * @param {string} bytecode - Contract bytecode
   * @param {string} functionSelector - Function selector
   * @returns {number} Complexity score
   */
  _analyzeComplexity(bytecode, functionSelector) {
    const code = bytecode.toLowerCase();
    let complexity = 1;
    
    // Look for expensive operations
    if (code.includes('sstore')) complexity += 3;
    if (code.includes('call')) complexity += 2;
    if (code.includes('create')) complexity += 5;
    if (code.includes('delegatecall')) complexity += 4;
    
    // Check for loops (approximate)
    const loopPatterns = ['jumpi', 'jump'];
    loopPatterns.forEach(pattern => {
      complexity += (code.match(new RegExp(pattern, 'g')) || []).length * 0.5;
    });
    
    return Math.min(complexity, 10); // Cap at 10
  }

  /**
   * Estimate gas from complexity analysis
   * @param {number} complexity - Complexity score
   * @param {number} argCount - Number of arguments
   * @returns {number} Gas estimate
   */
  _estimateGasFromComplexity(complexity, argCount) {
    const baseGas = 21000;
    const complexityGas = complexity * 5000;
    const argGas = argCount * 1000;
    
    return baseGas + complexityGas + argGas;
  }

  /**
   * Get default gas estimate for function type
   * @param {string} functionName - Function name
   * @returns {number} Default gas estimate
   */
  _getDefaultGasEstimate(functionName) {
    const defaults = {
      'transfer': 65000,
      'approve': 45000,
      'set': 45000,
      'get': 25000,
      'mint': 70000,
      'burn': 50000,
      'swap': 150000
    };
    
    // Check for known patterns
    for (const [pattern, gas] of Object.entries(defaults)) {
      if (functionName.toLowerCase().includes(pattern)) {
        return gas;
      }
    }
    
    return 50000; // Conservative default
  }

  /**
   * Generate cache key
   * @param {string} contractAddress - Contract address
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} mode - Simulation mode
   * @param {string} paymasterAddress - Paymaster address
   * @returns {string} Cache key
   */
  _generateCacheKey(contractAddress, functionName, args, mode, paymasterAddress) {
    const argsHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(args)));
    return `${contractAddress}_${functionName}_${argsHash}_${mode}_${paymasterAddress || 'none'}`;
  }

  /**
   * Cache simulation result
   * @param {string} key - Cache key
   * @param {Object} result - Simulation result
   */
  _cacheResult(key, result) {
    this.cache.set(key, {
      ...result,
      cachedAt: Date.now()
    });
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      this._cleanCache();
    }
  }

  /**
   * Get cached result if valid
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result or null
   */
  _getCachedResult(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.cachedAt > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }

  /**
   * Clean expired cache entries
   */
  _cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.cachedAt > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Access control bypass mode - try with different sender addresses
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @param {string} originalSender - Original sender address
   * @returns {Promise<Object>} Simulation result
   */
  async _accessControlBypassMode(contract, functionName, args, paymasterAddress, originalSender) {
    // Try with contract deployer/owner address if detectable
    const alternatives = [
      ethers.ZeroAddress, // Sometimes contracts allow zero address
      '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15', // Common test address
      '0x8ba1f109551bD432803012645Hac136c4C0532925a' // Another test address
    ];
    
    // Try to get contract owner if available
    try {
      const owner = await contract.owner();
      if (owner && owner !== ethers.ZeroAddress) {
        alternatives.unshift(owner);
      }
    } catch (error) {
      // Owner function not available
    }
    
    for (const testSender of alternatives) {
      try {
        // Create a new contract instance with the test sender
        const testWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, this.provider);
        const testContract = contract.connect(testWallet);
        
        const gasEstimate = await testContract[functionName].estimateGas(...args, {
          from: testSender
        });
        
        return {
          success: true,
          gasUsed: Number(gasEstimate),
          baseGas: Number(gasEstimate),
          confidence: 60,
          details: {
            method: 'accessControlBypass',
            successfulSender: testSender,
            note: 'Used alternative sender to bypass access control'
          }
        };
      } catch (error) {
        continue; // Try next sender
      }
    }
    
    throw new Error('Access control bypass failed with all test senders');
  }

  /**
   * Multi-sender test mode - systematically try different senders
   * @param {Contract} contract - Contract instance
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster address
   * @returns {Promise<Object>} Simulation result
   */
  async _multiSenderTestMode(contract, functionName, args, paymasterAddress) {
    const testSenders = [
      this.provider.getSigner ? await this.provider.getSigner().getAddress() : null,
      '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
      '0x8ba1f109551bD432803012645Hac136c4C0532925a',
      '0x1234567890123456789012345678901234567890',
      ethers.ZeroAddress
    ].filter(Boolean);
    
    const results = [];
    
    for (const sender of testSenders) {
      try {
        const gasEstimate = await contract[functionName].estimateGas(...args, {
          from: sender
        });
        
        results.push({
          sender,
          gasUsed: Number(gasEstimate),
          success: true
        });
        
        // Return first successful result
        return {
          success: true,
          gasUsed: Number(gasEstimate),
          baseGas: Number(gasEstimate),
          confidence: 70,
          details: {
            method: 'multiSenderTest',
            successfulSender: sender,
            totalAttempts: results.length,
            allResults: results
          }
        };
        
      } catch (error) {
        results.push({
          sender,
          error: error.message,
          success: false
        });
      }
    }
    
    throw new Error(`Multi-sender test failed for all ${testSenders.length} senders`);
  }

  /**
   * Clear all cached results
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      keys: Array.from(this.cache.keys())
    };
  }
}

module.exports = {
  GaslessSimulator,
  createGaslessSimulator: (provider) => new GaslessSimulator(provider)
};