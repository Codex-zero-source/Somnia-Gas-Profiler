const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { GaslessSimulator } = require('./gasless-simulator');
const { PaymasterUtils } = require('../utils/paymaster');
const { BytecodeProcessor } = require('../lib/bytecode-processor');

class SomniaGasProfiler {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.gaslessSimulator = null;
    this.paymasterUtils = null;
    this.bytecodeProcessor = null;
    this.results = {
      rpc: '',
      address: '',
      network: 'Somnia Testnet',
      timestamp: '',
      results: {}
    };
  }

  async initialize(rpcUrl, privateKey) {
    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.results.rpc = rpcUrl;
      
      // Initialize gasless simulator and paymaster utils
      this.gaslessSimulator = new GaslessSimulator(this.provider);
      this.paymasterUtils = new PaymasterUtils(this.provider);
      
      // Initialize bytecode processor for intelligent argument generation
      this.bytecodeProcessor = new BytecodeProcessor(this.provider, this.wallet);
      
      // Test connection
      const network = await this.provider.getNetwork();
      const networkName = network.chainId === 50312n ? 'Somnia Testnet' : (network.name || 'Unknown');
      console.log(chalk.green(`✅ Connected to network: ${networkName} (Chain ID: ${network.chainId})`));
      
      // Initialize wallet if private key provided
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        const balance = await this.provider.getBalance(this.wallet.address);
        const network = await this.provider.getNetwork();
        const currency = network.chainId === 50312n ? 'STT' : 'ETH';
        console.log(chalk.blue(`💰 Wallet: ${this.wallet.address} (Balance: ${ethers.formatEther(balance)} ${currency})`));
      } else {
        throw new Error('PRIVATE_KEY environment variable is required for transaction execution');
      }
      
    } catch (error) {
      throw new Error(`Failed to initialize Somnia connection: ${error.message}`);
    }
  }

  async loadABI(abiInput) {
    try {
      let abi;
      
      // Check if it's a file path or inline JSON
      if (abiInput.startsWith('[') || abiInput.startsWith('{')) {
        // Inline JSON
        abi = JSON.parse(abiInput);
      } else {
        // File path
        const abiPath = path.resolve(abiInput);
        const abiContent = await fs.readFile(abiPath, 'utf8');
        abi = JSON.parse(abiContent);
      }
      
      // Validate ABI format
      if (!Array.isArray(abi)) {
        throw new Error('ABI must be an array');
      }
      
      console.log(chalk.green(`✅ ABI loaded successfully (${abi.length} entries)`));
      return abi;
      
    } catch (error) {
      throw new Error(`Failed to load ABI: ${error.message}`);
    }
  }

  async validateContract(contractAddress, abi) {
    try {
      // Create contract instance with wallet for transaction execution
      const contract = new ethers.Contract(contractAddress, abi, this.wallet);
      
      // Try to get contract code to verify it exists
      const code = await this.provider.getCode(contractAddress);
      if (code === '0x') {
        throw new Error('No contract found at the specified address');
      }
      
      console.log(chalk.green(`✅ Contract validated at ${contractAddress}`));
      return contract;
      
    } catch (error) {
      throw new Error(`Contract validation failed: ${error.message}`);
    }
  }

  parseFunctionSignatures(functionSignatures, abi) {
    const functions = [];
    
    for (const sig of functionSignatures) {
      // Find matching function in ABI
      const funcFragment = abi.find(item => {
        if (item.type !== 'function') return false;
        const fullSig = `${item.name}(${item.inputs.map(input => input.type).join(',')})`;
        return fullSig === sig || item.name === sig;
      });
      
      if (!funcFragment) {
        throw new Error(`Function '${sig}' not found in ABI`);
      }
      
      functions.push({
        signature: sig,
        fragment: funcFragment,
        fullSignature: `${funcFragment.name}(${funcFragment.inputs.map(input => input.type).join(',')})`
      });
    }
    
    console.log(chalk.green(`✅ Parsed ${functions.length} function signature(s)`));
    return functions;
  }

  parseArguments(argsArray, functions) {
    const parsedArgs = [];
    
    for (let i = 0; i < functions.length; i++) {
      const func = functions[i];
      const rawArgs = argsArray[i] || [];
      
      let args;
      if (typeof rawArgs === 'string') {
        try {
          args = JSON.parse(rawArgs);
        } catch {
          args = [rawArgs];
        }
      } else {
        args = rawArgs;
      }
      
      // Handle case where no arguments provided and function expects arguments
      if (args.length === 0 && func.fragment.inputs.length > 0) {
        console.log(chalk.yellow(`⚠️  No arguments provided for ${func.signature}, will use intelligent generation`));
        // Return empty array - intelligent generation will handle this
        parsedArgs.push([]);
        continue;
      }
      
      // Validate argument count only if arguments were actually provided
      if (args.length > 0 && args.length !== func.fragment.inputs.length) {
        throw new Error(
          `Function '${func.signature}' expects ${func.fragment.inputs.length} arguments, got ${args.length}`
        );
      }
      
      parsedArgs.push(args);
    }
    
    return parsedArgs;
  }

  /**
   * Enhanced paymaster-sponsored transaction simulation using GaslessSimulator
   * @param {Contract} contract - The contract instance
   * @param {Object} func - Function metadata
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {Object} options - Simulation options
   * @returns {Promise<Object>} Enhanced simulation result
   */
  async simulatePaymasterTransaction(contract, func, args, paymasterAddress, options = {}) {
    try {
      const {
        mode = 'auto',
        useCache = true,
        detailedAnalysis = true,
        fallbackOnError = true
      } = options;

      console.log(chalk.gray(`    🔍 Simulating paymaster transaction (mode: ${mode})`));
      
      // Use the advanced gasless simulator
      const simulationResult = await this.gaslessSimulator.simulate({
        contract,
        functionName: func.fragment.name,
        args,
        mode,
        paymasterAddress,
        sender: this.wallet.address,
        useCache,
        fallbackOnError
      });

      if (!simulationResult.success) {
        throw new Error(`Gasless simulation failed: ${simulationResult.error}`);
      }

      // Add enhanced logging
      if (simulationResult.fromCache) {
        console.log(chalk.gray(`    📋 Result from cache (confidence: ${simulationResult.confidence}%)`));
      } else {
        console.log(chalk.gray(`    ✅ Simulation completed (confidence: ${simulationResult.confidence}%)`));
      }

      if (simulationResult.paymasterOverhead > 0) {
        console.log(chalk.gray(`    💰 Paymaster overhead: ${simulationResult.paymasterOverhead.toLocaleString()} gas`));
      }

      if (simulationResult.fallback) {
        console.log(chalk.yellow(`    ⚠️  Used fallback simulation: ${simulationResult.mode}`));
      }

      // Return the gas amount for compatibility with existing code
      return simulationResult.gasUsed;
      
    } catch (error) {
      throw new Error(`Enhanced paymaster simulation failed: ${error.message}`);
    }
  }

  /**
   * Prepare transaction options for paymaster-sponsored execution
   * @param {Contract} contract - The contract instance
   * @param {Object} func - Function metadata
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Transaction options
   */
  async preparePaymasterTransaction(contract, func, args, paymasterAddress) {
    try {
      // Basic paymaster transaction preparation
      // Note: This is a simplified implementation
      // Real EIP-4337 implementation would require:
      // - UserOperation construction
      // - Paymaster validation
      // - Signature aggregation
      
      const txOptions = {
        // Add custom fields for paymaster support
        customData: {
          paymasterAddress,
          paymasterData: '0x', // Empty for basic sponsorship
          gasToken: ethers.ZeroAddress // ETH
        }
      };
      
      // Estimate gas with paymaster overhead
      const baseGasLimit = await contract[func.fragment.name].estimateGas(...args);
      txOptions.gasLimit = Number(baseGasLimit) + 30000; // Add paymaster overhead
      
      return txOptions;
      
    } catch (error) {
      throw new Error(`Paymaster transaction preparation failed: ${error.message}`);
    }
  }

  /**
   * Enhanced paymaster configuration validation
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Comprehensive paymaster validation result
   */
  async validatePaymaster(paymasterAddress) {
    try {
      if (!this.paymasterUtils) {
        throw new Error('PaymasterUtils not initialized');
      }

      console.log(chalk.blue(`🔍 Performing comprehensive paymaster validation...`));
      
      // Use enhanced validation from PaymasterUtils
      const validation = await this.paymasterUtils.validatePaymasterInterface(paymasterAddress);
      
      if (validation.valid) {
        console.log(chalk.green(`✅ Paymaster validation successful`));
        console.log(chalk.gray(`   EIP-4337 Compliant: ${validation.eip4337Compliant ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`   Balance: ${validation.balance} ETH`));
        console.log(chalk.gray(`   Confidence: ${validation.validation ? Object.values(validation.validation).filter(Boolean).length * 33 : 0}%`));
        
        if (validation.gasEstimate) {
          console.log(chalk.gray(`   Validation Gas: ${validation.gasEstimate.validateGas || 'N/A'}`));
          console.log(chalk.gray(`   PostOp Gas: ${validation.gasEstimate.postOpGas || 'N/A'}`));
        }
      } else {
        console.log(chalk.yellow(`⚠️  Paymaster validation issues found:`));
        if (validation.errors) {
          validation.errors.forEach(error => {
            console.log(chalk.gray(`   - ${error}`));
          });
        }
      }
      
      return validation;
      
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        address: paymasterAddress
      };
    }
  }

  async profileFunction(contract, func, args, runs, gaslessMode = false, paymasterAddress = null, argumentAnalysis = null) {
    const results = {
      runs: [],
      aggregated: {
        min: Infinity,
        max: 0,
        avg: 0,
        total: 0,
        callCount: 0,
        // Add cost tracking
        minCost: Infinity,
        maxCost: 0,
        avgCost: 0,
        totalCost: 0
      }
    };
    
    console.log(chalk.blue(`🔄 Profiling ${func.fullSignature} (${runs} runs)...`));
    
    // Get current gas price for cost calculations
    let gasPrice = null;
    try {
      const feeData = await this.provider.getFeeData();
      gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      if (gasPrice) {
        console.log(chalk.gray(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not fetch gas price: ${error.message}`));
    }
    
    for (let run = 1; run <= runs; run++) {
      try {
        let gasUsed;
        let txHash = '';
        let blockNumber = 0;
        let mode = gaslessMode ? 'gasless' : 'standard';
        let paymasterUsed = false;
        
        if (gaslessMode) {
          // Enhanced gasless simulation with multiple modes and fallbacks
          if (paymasterAddress) {
            // Use enhanced paymaster simulation
            try {
              gasUsed = await this.simulatePaymasterTransaction(contract, func, args, paymasterAddress, {
                mode: 'paymaster',
                useCache: true,
                detailedAnalysis: true,
                fallbackOnError: true
              });
              mode = 'paymaster_simulation_v2';
              paymasterUsed = true;
            } catch (error) {
              console.log(chalk.yellow(`⚠️  Enhanced paymaster simulation failed: ${error.message.substring(0, 80)}...`));
              console.log(chalk.gray('   Trying fallback gasless simulation...'));
              
              // Fallback to standard gasless simulation
              try {
                const fallbackResult = await this.gaslessSimulator.simulate({
                  contract,
                  functionName: func.fragment.name,
                  args,
                  mode: 'estimate',
                  useCache: true,
                  fallbackOnError: true
                });
                
                gasUsed = fallbackResult.gasUsed;
                mode = `gasless_fallback_${fallbackResult.mode}`;
                
                if (fallbackResult.confidence < 50) {
                  console.log(chalk.yellow(`   ⚠️  Low confidence estimate (${fallbackResult.confidence}%)`));
                }
              } catch (fallbackError) {
                console.log(chalk.yellow(`⚠️  All gasless simulations failed, using conservative estimate`));
                gasUsed = this._getConservativeGasEstimate(func.fragment.name);
                mode = 'conservative_estimate';
              }
            }
          } else {
            // Standard gasless simulation using enhanced simulator
            try {
              // Determine optimal sender if argument analysis is available
              let optimalSender = this.wallet.address;
              if (argumentAnalysis && argumentAnalysis.intelligent && argumentAnalysis.testArgs[func.fullSignature]) {
                optimalSender = argumentAnalysis.testArgs[func.fullSignature].sender || this.wallet.address;
                console.log(chalk.gray(`    📝 Using optimized sender: ${optimalSender}`));
              }
              
              const simulationResult = await this.gaslessSimulator.simulate({
                contract,
                functionName: func.fragment.name,
                args,
                mode: 'auto',
                sender: optimalSender,
                useCache: true,
                fallbackOnError: true
              });
              
              gasUsed = simulationResult.gasUsed;
              mode = `gasless_${simulationResult.mode}`;
              
              if (simulationResult.fromCache) {
                console.log(chalk.gray(`    📋 Using cached result`));
              }
              
              if (simulationResult.fallback) {
                console.log(chalk.yellow(`    ⚠️  Used fallback method: ${simulationResult.mode}`));
              }
              
              if (simulationResult.confidence < 70) {
                console.log(chalk.yellow(`    ⚠️  Moderate confidence estimate (${simulationResult.confidence}%)`));
              }
              
            } catch (simulationError) {
              // Final fallback: try basic estimateGas
              console.log(chalk.yellow(`⚠️  Enhanced simulation failed: ${simulationError.message.substring(0, 80)}...`));
              console.log(chalk.gray('   Trying basic gas estimation...'));
              
              try {
                gasUsed = await contract[func.fragment.name].estimateGas(...args);
                gasUsed = Number(gasUsed);
                mode = 'basic_estimate';
              } catch (estimateError) {
                console.log(chalk.yellow(`⚠️  Basic estimation also failed, using conservative fallback`));
                console.log(chalk.gray(`   Reason: ${estimateError.message.substring(0, 100)}...`));
                gasUsed = this._getConservativeGasEstimate(func.fragment.name);
                mode = 'conservative_fallback';
              }
            }
          }
        } else {
          // Standard transaction execution
          let txOptions = {};
          
          if (paymasterAddress) {
            // Add paymaster data to transaction
            txOptions = await this.preparePaymasterTransaction(contract, func, args, paymasterAddress);
            mode = 'paymaster_sponsored';
            paymasterUsed = true;
          }
          
          const tx = await contract[func.fragment.name](...args, txOptions);
          const receipt = await tx.wait();
          
          gasUsed = Number(receipt.gasUsed);
          txHash = receipt.hash;
          blockNumber = receipt.blockNumber;
        }
        
        // Update aggregated stats
        results.aggregated.min = Math.min(results.aggregated.min, gasUsed);
        results.aggregated.max = Math.max(results.aggregated.max, gasUsed);
        results.aggregated.total += gasUsed;
        results.aggregated.callCount++;
        
        // Calculate cost in STT if gas price is available
        let costInSTT = null;
        let costInSTTFormatted = null;
        if (gasPrice && !gaslessMode) {
          costInSTT = BigInt(gasUsed) * gasPrice;
          costInSTTFormatted = ethers.formatEther(costInSTT);
          
          // Update cost aggregates
          const costNum = Number(costInSTTFormatted);
          results.aggregated.minCost = Math.min(results.aggregated.minCost, costNum);
          results.aggregated.maxCost = Math.max(results.aggregated.maxCost, costNum);
          results.aggregated.totalCost += costNum;
        }
        
        // Store run details
        results.runs.push({
          run,
          args: args,
          gasUsed,
          mode,
          txHash,
          blockNumber,
          paymasterUsed,
          paymasterAddress: paymasterUsed ? paymasterAddress : null,
          costInSTT: costInSTTFormatted,
          costInWei: costInSTT ? costInSTT.toString() : null,
          gasPrice: gasPrice ? gasPrice.toString() : null
        });
        
        const modeDisplay = gaslessMode ? '(simulated)' : paymasterUsed ? '(paymaster)' : '';
        const costDisplay = costInSTTFormatted && !gaslessMode ? ` | ${parseFloat(costInSTTFormatted).toFixed(8)} STT` : '';
        console.log(chalk.gray(`  Run ${run}: ${gasUsed.toLocaleString()} gas${costDisplay} ${modeDisplay}`));
        
        // Add small delay between runs to avoid overwhelming the RPC
        if (run < runs) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        throw new Error(`Run ${run} failed: ${error.message}`);
      }
    }
    
    // Calculate averages
    results.aggregated.avg = Math.round(results.aggregated.total / results.aggregated.callCount);
    
    // Calculate cost averages if we have cost data
    if (results.aggregated.totalCost > 0) {
      results.aggregated.avgCost = results.aggregated.totalCost / results.aggregated.callCount;
    } else {
      // Remove cost fields if no cost data
      delete results.aggregated.minCost;
      delete results.aggregated.maxCost;
      delete results.aggregated.avgCost;
      delete results.aggregated.totalCost;
    }
    
    console.log(chalk.green(`  ✅ Average: ${results.aggregated.avg.toLocaleString()} gas`));
    console.log(chalk.green(`  📊 Range: ${results.aggregated.min.toLocaleString()} - ${results.aggregated.max.toLocaleString()} gas`));
    
    // Display cost information if available
    if (results.aggregated.avgCost !== undefined) {
      console.log(chalk.green(`  💰 Avg Cost: ${results.aggregated.avgCost.toFixed(8)} STT`));
      console.log(chalk.green(`  💵 Cost Range: ${results.aggregated.minCost.toFixed(8)} - ${results.aggregated.maxCost.toFixed(8)} STT`));
    }
    
    return results;
  }

  async analyze(options) {
    const {
      rpc,
      address,
      abi: abiInput,
      fn: functionSignatures,
      args: argsArray,
      runs,
      out: outputPath,
      gasless,
      paymaster,
      verbose
    } = options;
    
    try {
      // Initialize connection
      const privateKey = process.env.PRIVATE_KEY;
      await this.initialize(rpc, privateKey);
      
      // Load and validate ABI
      const abi = await this.loadABI(abiInput);
      const contract = await this.validateContract(address, abi);
      
      // Parse function signatures
      const functions = this.parseFunctionSignatures(functionSignatures, abi);
      
      // Enhanced argument handling with intelligent generation
      let parsedArgs;
      let argumentAnalysis = null;
      
      if (!argsArray || argsArray.length === 0 || argsArray.every(arg => !arg || arg.length === 0)) {
        // No arguments provided - use intelligent generation
        console.log(chalk.blue('🧠 No arguments provided, using intelligent argument generation...'));
        
        try {
          const contractType = this.bytecodeProcessor.detectContractType(abi);
          const functionSignaturesList = functions.map(f => f.fullSignature);
          
          argumentAnalysis = await this.bytecodeProcessor.generateTestArguments(
            abi, 
            contractType, 
            address, 
            functionSignaturesList
          );
          
          // Extract arguments for each function
          parsedArgs = functions.map(func => {
            const argData = argumentAnalysis.testArgs[func.fullSignature];
            return argData ? argData.args : [];
          });
          
          if (argumentAnalysis.intelligent) {
            console.log(chalk.green('✅ Using intelligent argument generation with contract state analysis'));
          } else {
            console.log(chalk.yellow('⚠️  Using basic argument generation (state analysis failed)'));
          }
          
        } catch (argError) {
          console.log(chalk.yellow(`⚠️  Intelligent argument generation failed: ${argError.message}`));
          console.log(chalk.gray('   Using basic fallback arguments...'));
          
          // Fallback to basic empty arguments
          parsedArgs = functions.map(func => 
            func.fragment.inputs.map(() => '0')
          );
        }
      } else {
        // Arguments provided - parse them normally
        parsedArgs = this.parseArguments(argsArray, functions);
      }
      
      // Initialize results
      this.results.address = address;
      this.results.timestamp = new Date().toISOString();
      
      // Profile each function
      for (let i = 0; i < functions.length; i++) {
        const func = functions[i];
        const args = parsedArgs[i];
        
        try {
          // Validate paymaster if provided
          if (paymaster) {
            console.log(chalk.blue(`🔍 Validating paymaster: ${paymaster}`));
            const paymasterValidation = await this.validatePaymaster(paymaster);
            
            if (!paymasterValidation.valid) {
              console.log(chalk.yellow(`⚠️  Paymaster validation failed: ${paymasterValidation.error}`));
              console.log(chalk.gray('   Proceeding without paymaster support'));
            } else {
              console.log(chalk.green(`✅ Paymaster validated: ${paymasterValidation.balance} ETH balance`));
            }
          }
          
          const functionResults = await this.profileFunction(
            contract, 
            func, 
            args, 
            runs, 
            gasless,
            paymaster,
            argumentAnalysis // Pass argument analysis for enhanced profiling
          );
          
          this.results.results[func.fullSignature] = functionResults;
          
        } catch (error) {
          console.error(chalk.red(`❌ Failed to profile ${func.fullSignature}: ${error.message}`));
          throw error;
        }
      }
      
      // Save results
      await this.saveResults(outputPath);
      
    } catch (error) {
      throw new Error(`Profiling analysis failed: ${error.message}`);
    }
  }

  /**
   * Get conservative gas estimate based on function name patterns
   * @param {string} functionName - Function name
   * @returns {number} Conservative gas estimate
   */
  _getConservativeGasEstimate(functionName) {
    const patterns = {
      'transfer': 65000,
      'approve': 45000,
      'set': 50000,
      'update': 55000,
      'get': 25000,
      'view': 25000,
      'read': 25000,
      'mint': 80000,
      'burn': 60000,
      'swap': 180000,
      'add': 70000,
      'remove': 65000,
      'withdraw': 70000,
      'deposit': 75000,
      'create': 100000,
      'delete': 45000,
      'execute': 120000
    };
    
    const lowerName = functionName.toLowerCase();
    
    // Check for known patterns
    for (const [pattern, gas] of Object.entries(patterns)) {
      if (lowerName.includes(pattern)) {
        return gas;
      }
    }
    
    // Very conservative default for unknown functions
    return 80000;
  }

  async saveResults(outputPath) {
    try {
      const outputDir = path.dirname(path.resolve(outputPath));
      await fs.mkdir(outputDir, { recursive: true });
      
      await fs.writeFile(
        outputPath, 
        JSON.stringify(this.results, null, 2), 
        'utf8'
      );
      
      console.log(chalk.green(`💾 Results saved to ${outputPath}`));
      
    } catch (error) {
      throw new Error(`Failed to save results: ${error.message}`);
    }
  }
}

module.exports = {
  analyze: async (options) => {
    const profiler = new SomniaGasProfiler();
    await profiler.analyze(options);
  },
  SomniaGasProfiler
};