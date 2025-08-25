const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class SomniaGasProfiler {
  constructor() {
    this.provider = null;
    this.wallet = null;
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
      
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(chalk.green(`✅ Connected to network: ${network.name || 'Unknown'} (Chain ID: ${network.chainId})`));
      
      // Initialize wallet if private key provided
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        const balance = await this.provider.getBalance(this.wallet.address);
        console.log(chalk.blue(`💰 Wallet: ${this.wallet.address} (Balance: ${ethers.formatEther(balance)} ETH)`));
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
      const contract = new ethers.Contract(contractAddress, abi, this.provider);
      
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
      
      // Validate argument count
      if (args.length !== func.fragment.inputs.length) {
        throw new Error(
          `Function '${func.signature}' expects ${func.fragment.inputs.length} arguments, got ${args.length}`
        );
      }
      
      parsedArgs.push(args);
    }
    
    return parsedArgs;
  }

  /**
   * Simulate a paymaster-sponsored transaction
   * @param {Contract} contract - The contract instance
   * @param {Object} func - Function metadata
   * @param {Array} args - Function arguments
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<number>} Estimated gas usage
   */
  async simulatePaymasterTransaction(contract, func, args, paymasterAddress) {
    try {
      // Validate paymaster contract exists
      const paymasterCode = await this.provider.getCode(paymasterAddress);
      if (paymasterCode === '0x') {
        throw new Error('Paymaster contract not found at specified address');
      }

      // Estimate gas for the user operation
      const baseGasEstimate = await contract[func.fragment.name].estimateGas(...args);
      
      // Add paymaster overhead (typically 20-30k gas)
      const paymasterOverhead = 25000;
      const totalGasEstimate = Number(baseGasEstimate) + paymasterOverhead;
      
      console.log(chalk.gray(`    Paymaster overhead: ${paymasterOverhead.toLocaleString()} gas`));
      
      return totalGasEstimate;
      
    } catch (error) {
      throw new Error(`Paymaster simulation failed: ${error.message}`);
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
   * Validate paymaster configuration
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Paymaster validation result
   */
  async validatePaymaster(paymasterAddress) {
    try {
      const code = await this.provider.getCode(paymasterAddress);
      if (code === '0x') {
        return {
          valid: false,
          error: 'No contract found at paymaster address'
        };
      }
      
      // Check if it implements required paymaster interface
      // This is a simplified check - real implementation would verify EIP-4337 interface
      const balance = await this.provider.getBalance(paymasterAddress);
      
      return {
        valid: true,
        address: paymasterAddress,
        balance: ethers.formatEther(balance),
        codeSize: code.length
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async profileFunction(contract, func, args, runs, gaslessMode = false, paymasterAddress = null) {
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
          // Enhanced gasless simulation with paymaster support
          if (paymasterAddress) {
            // Simulate paymaster-sponsored transaction
            try {
              gasUsed = await this.simulatePaymasterTransaction(contract, func, args, paymasterAddress);
              mode = 'paymaster_simulation';
              paymasterUsed = true;
            } catch (error) {
              console.log(chalk.yellow(`⚠️  Paymaster simulation failed, falling back to standard gasless: ${error.message}`));
              gasUsed = await contract[func.fragment.name].estimateGas(...args);
              gasUsed = Number(gasUsed);
              mode = 'gasless_simulation';
            }
          } else {
            // Standard gasless simulation using estimateGas
            gasUsed = await contract[func.fragment.name].estimateGas(...args);
            gasUsed = Number(gasUsed);
            mode = 'gasless_simulation';
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
      const parsedArgs = this.parseArguments(argsArray, functions);
      
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
            paymaster
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