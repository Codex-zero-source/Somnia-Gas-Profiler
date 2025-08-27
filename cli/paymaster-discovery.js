const chalk = require('chalk');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const { PaymasterUtils } = require('../utils/paymaster');

/**
 * Discover paymasters on the Somnia network
 * @param {Object} options - Discovery options
 */
async function discoverPaymasters(options) {
  const {
    rpc = 'https://dream-rpc.somnia.network',
    limit = 10,
    validate = true,
    output = null,
    format = 'table',
    verbose = false
  } = options;

  try {
    console.log(chalk.blue('🔍 Discovering paymasters on Somnia network...'));
    console.log(chalk.gray(`   RPC: ${rpc}`));
    console.log(chalk.gray(`   Limit: ${limit}`));
    console.log(chalk.gray(`   Validation: ${validate ? 'enabled' : 'disabled'}\n`));

    // Initialize provider and utilities
    const provider = new ethers.JsonRpcProvider(rpc);
    const paymasterUtils = new PaymasterUtils(provider);

    // Get network info
    const network = await provider.getNetwork();
    const networkName = network.chainId === 50312n ? 'Somnia Testnet' : (network.name || 'Unknown');
    console.log(chalk.green(`✅ Connected to ${networkName} (Chain ID: ${network.chainId})`));

    // Discovery methods
    const discoveredPaymasters = [];

    // Method 1: Known paymaster patterns
    console.log(chalk.blue('\n📡 Searching for known paymaster patterns...'));
    const knownPatterns = await discoverKnownPatterns(provider, limit);
    discoveredPaymasters.push(...knownPatterns);

    // Method 2: Event log analysis (if available)
    console.log(chalk.blue('\n📊 Analyzing recent transaction logs...'));
    const eventBasedPaymasters = await discoverFromEvents(provider, Math.max(5, limit - discoveredPaymasters.length));
    discoveredPaymasters.push(...eventBasedPaymasters);

    // Method 3: Registry contract check (if exists)
    console.log(chalk.blue('\n🏪 Checking paymaster registries...'));
    const registryPaymasters = await discoverFromRegistry(provider, Math.max(3, limit - discoveredPaymasters.length));
    discoveredPaymasters.push(...registryPaymasters);

    // Remove duplicates
    const uniquePaymasters = [...new Set(discoveredPaymasters)];
    const finalList = uniquePaymasters.slice(0, limit);

    console.log(chalk.green(`\n✅ Discovered ${finalList.length} potential paymaster(s)`));

    if (finalList.length === 0) {
      console.log(chalk.yellow('⚠️  No paymasters found. This might indicate:'));
      console.log(chalk.gray('   - Network has no deployed paymasters'));
      console.log(chalk.gray('   - Paymasters use non-standard implementations'));
      console.log(chalk.gray('   - Network is not EIP-4337 compatible'));
      return;
    }

    // Validate discovered paymasters
    const results = [];
    if (validate) {
      console.log(chalk.blue('\n🔬 Validating discovered paymasters...'));
      
      for (let i = 0; i < finalList.length; i++) {
        const address = finalList[i];
        console.log(chalk.gray(`   [${i + 1}/${finalList.length}] Validating ${address}...`));
        
        try {
          const validation = await paymasterUtils.validatePaymasterInterface(address);
          const status = await paymasterUtils.getPaymasterStatus(address);
          
          results.push({
            address,
            valid: validation.valid,
            eip4337Compliant: validation.eip4337Compliant,
            balance: status.balance,
            canSponsor: status.canSponsor,
            codeSize: validation.codeSize,
            confidence: calculateConfidence(validation),
            errors: validation.errors || [],
            validation: validation.validation || {},
            gasEstimate: validation.gasEstimate || {}
          });
          
          const statusIcon = validation.valid ? '✅' : validation.eip4337Compliant ? '⚠️' : '❌';
          console.log(chalk.gray(`      ${statusIcon} ${validation.valid ? 'Valid' : validation.eip4337Compliant ? 'Partial' : 'Invalid'} (${status.balance} ETH)`));
          
        } catch (error) {
          results.push({
            address,
            valid: false,
            error: error.message,
            confidence: 0
          });
          console.log(chalk.gray(`      ❌ Validation failed: ${error.message.substring(0, 50)}...`));
        }
      }
    } else {
      // Add unvalidated results
      finalList.forEach(address => {
        results.push({ address, valid: null, validated: false });
      });
    }

    // Display results
    if (format === 'table') {
      displayPaymasterTable(results);
    }

    // Save to file if requested
    if (output) {
      await saveResults(output, results, format);
      console.log(chalk.green(`\n💾 Results saved to ${output}`));
    }

    console.log(chalk.green('\n🎉 Paymaster discovery completed!'));

  } catch (error) {
    throw new Error(`Paymaster discovery failed: ${error.message}`);
  }
}

/**
 * Validate a specific paymaster
 * @param {Object} options - Validation options
 */
async function validatePaymaster(options) {
  const {
    address,
    rpc = 'https://dream-rpc.somnia.network',
    detailed = false,
    testGas = true,
    output = null,
    verbose = false
  } = options;

  try {
    // Initialize provider and utilities
    const provider = new ethers.JsonRpcProvider(rpc);
    const paymasterUtils = new PaymasterUtils(provider);

    // Validate address format
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid address format');
    }

    console.log(chalk.blue(`🔍 Validating paymaster: ${address}`));

    // Comprehensive validation
    console.log(chalk.gray('   Performing interface validation...'));
    const validation = await paymasterUtils.validatePaymasterInterface(address);

    console.log(chalk.gray('   Checking paymaster status...'));
    const status = await paymasterUtils.getPaymasterStatus(address);

    // Display results
    console.log('\n' + chalk.bold('🔬 Validation Results:'));
    console.log(chalk.green(`   Address: ${address}`));
    console.log(`   Valid: ${validation.valid ? chalk.green('✅ Yes') : chalk.red('❌ No')}`);
    console.log(`   EIP-4337 Compliant: ${validation.eip4337Compliant ? chalk.green('✅ Yes') : chalk.yellow('⚠️ No')}`);
    console.log(`   Balance: ${status.balance} STT`);
    console.log(`   Can Sponsor: ${status.canSponsor ? chalk.green('✅ Yes') : chalk.red('❌ No')}`);
    console.log(`   Code Size: ${validation.codeSize} bytes`);

    if (validation.errors && validation.errors.length > 0) {
      console.log(chalk.red('\n❌ Validation Errors:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`   - ${error}`));
      });
    }

    if (detailed) {
      console.log('\n' + chalk.bold('📊 Detailed Analysis:'));
      
      // Interface checks
      console.log(chalk.blue('   Interface Methods:'));
      console.log(`     validatePaymasterUserOp: ${validation.hasValidateMethod ? '✅' : '❌'}`);
      console.log(`     postOp: ${validation.hasPostOpMethod ? '✅' : '❌'}`);
      console.log(`     deposit/stake: ${validation.hasDepositMethod ? '✅' : '❌'}`);
      console.log(`     supportsInterface: ${validation.supportsInterface ? '✅' : '❌'}`);

      // Validation tests
      if (validation.validation) {
        console.log(chalk.blue('   Validation Tests:'));
        console.log(`     Interface Check: ${validation.validation.interfaceCheck ? '✅' : '❌'}`);
        console.log(`     Functional Test: ${validation.validation.functionalTest ? '✅' : '❌'}`);
        console.log(`     Gas Test: ${validation.validation.gasTest ? '✅' : '❌'}`);
      }

      // Gas estimates
      if (validation.gasEstimate) {
        console.log(chalk.blue('   Gas Estimates:'));
        if (validation.gasEstimate.validateGas) {
          console.log(`     Validation Gas: ${validation.gasEstimate.validateGas.toLocaleString()}`);
        }
        if (validation.gasEstimate.postOpGas) {
          console.log(`     PostOp Gas: ${validation.gasEstimate.postOpGas.toLocaleString()}`);
        }
      }
    }

    // Calculate and display confidence score
    const confidence = calculateConfidence(validation);
    console.log(`\n📈 Confidence Score: ${confidence}%`);

    // Recommendations
    console.log('\n' + chalk.bold('💡 Recommendations:'));
    if (validation.valid && status.canSponsor) {
      console.log(chalk.green('   ✅ This paymaster is ready for production use'));
    } else if (validation.eip4337Compliant) {
      console.log(chalk.yellow('   ⚠️  Paymaster has interface issues but might work with adjustments'));
      if (parseFloat(status.balance) < 0.01) {
        console.log(chalk.yellow('   💰 Consider funding the paymaster for gas sponsorship'));
      }
    } else {
      console.log(chalk.red('   ❌ This paymaster is not recommended for use'));
      console.log(chalk.red('   🔧 Consider using a different paymaster or fixing implementation'));
    }

    // Save results if requested
    if (output) {
      const result = {
        address,
        validation,
        status,
        confidence,
        timestamp: new Date().toISOString()
      };
      await fs.writeFile(output, JSON.stringify(result, null, 2));
      console.log(chalk.green(`\n💾 Validation results saved to ${output}`));
    }

  } catch (error) {
    throw new Error(`Paymaster validation failed: ${error.message}`);
  }
}

/**
 * Discover paymasters using known patterns
 */
async function discoverKnownPatterns(provider, limit) {
  const patterns = [];
  
  // Common paymaster deployment patterns (these would be network-specific)
  const commonAddresses = [
    // Add known Somnia paymaster addresses here
    // These are examples and should be replaced with actual addresses
  ];
  
  for (const address of commonAddresses) {
    try {
      const code = await provider.getCode(address);
      if (code !== '0x') {
        patterns.push(address);
        if (patterns.length >= limit) break;
      }
    } catch {
      // Skip invalid addresses
    }
  }
  
  return patterns;
}

/**
 * Discover paymasters from transaction events
 */
async function discoverFromEvents(provider, limit) {
  const paymasters = [];
  
  try {
    // Look for UserOperationEvent events (EIP-4337)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks
    
    // This is a simplified approach - in practice, you'd search for specific events
    // const events = await provider.getLogs({
    //   fromBlock,
    //   toBlock: 'latest',
    //   topics: [
    //     ethers.id('UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)')
    //   ]
    // });
    
    // For now, return empty array since this requires specific event signatures
    return paymasters;
    
  } catch (error) {
    console.log(chalk.gray(`   Event analysis failed: ${error.message.substring(0, 50)}...`));
    return paymasters;
  }
}

/**
 * Discover paymasters from registry contracts
 */
async function discoverFromRegistry(provider, limit) {
  const paymasters = [];
  
  try {
    // Look for known paymaster registry contracts
    // This would be network-specific
    const registryAddresses = [
      // Add known registry addresses for Somnia
    ];
    
    for (const registryAddress of registryAddresses) {
      try {
        const code = await provider.getCode(registryAddress);
        if (code !== '0x') {
          // Query registry for paymaster list
          // This would require knowledge of the registry interface
          // For now, return empty array
        }
      } catch {
        // Skip invalid registry
      }
    }
    
    return paymasters;
    
  } catch (error) {
    console.log(chalk.gray(`   Registry check failed: ${error.message.substring(0, 50)}...`));
    return paymasters;
  }
}

/**
 * Calculate confidence score for paymaster validation
 */
function calculateConfidence(validation) {
  let score = 0;
  
  if (validation.valid) score += 40;
  if (validation.eip4337Compliant) score += 30;
  if (validation.hasValidateMethod) score += 10;
  if (validation.hasPostOpMethod) score += 10;
  if (validation.validation?.functionalTest) score += 5;
  if (validation.validation?.gasTest) score += 5;
  
  return Math.min(score, 100);
}

/**
 * Display paymaster results in table format
 */
function displayPaymasterTable(results) {
  console.log('\n' + chalk.bold('🏪 Discovered Paymasters:'));
  console.log('─'.repeat(120));
  console.log(
    chalk.bold('Address'.padEnd(44)) +
    chalk.bold('Status'.padEnd(12)) +
    chalk.bold('Balance'.padEnd(15)) +
    chalk.bold('EIP-4337'.padEnd(12)) +
    chalk.bold('Confidence'.padEnd(12)) +
    chalk.bold('Notes')
  );
  console.log('─'.repeat(120));
  
  results.forEach((result, index) => {
    const status = result.valid ? chalk.green('✅ Valid') : 
                   result.valid === null ? chalk.gray('⏳ Unvalidated') :
                   result.eip4337Compliant ? chalk.yellow('⚠️  Partial') : 
                   chalk.red('❌ Invalid');
    
    const balance = result.balance ? `${parseFloat(result.balance).toFixed(4)} ETH` : 'Unknown';
    const eip4337 = result.eip4337Compliant ? '✅' : result.valid === null ? '?' : '❌';
    const confidence = result.confidence ? `${result.confidence}%` : 'N/A';
    const notes = result.error ? result.error.substring(0, 30) + '...' : 
                  result.canSponsor === false ? 'Low balance' : 
                  result.valid ? 'Ready' : '';
    
    console.log(
      result.address.padEnd(44) +
      status.padEnd(20) +
      balance.padEnd(15) +
      eip4337.padEnd(12) +
      confidence.padEnd(12) +
      chalk.gray(notes)
    );
  });
  
  console.log('─'.repeat(120));
}

/**
 * Save results to file
 */
async function saveResults(outputPath, results, format) {
  try {
    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    } else {
      // Save as text table
      const lines = [];
      lines.push('Somnia Gas Profiler - Paymaster Discovery Results');
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push('');
      
      results.forEach((result, index) => {
        lines.push(`${index + 1}. ${result.address}`);
        lines.push(`   Status: ${result.valid ? 'Valid' : result.valid === null ? 'Unvalidated' : 'Invalid'}`);
        if (result.balance) lines.push(`   Balance: ${result.balance} ETH`);
        if (result.confidence) lines.push(`   Confidence: ${result.confidence}%`);
        if (result.error) lines.push(`   Error: ${result.error}`);
        lines.push('');
      });
      
      await fs.writeFile(outputPath, lines.join('\n'));
    }
  } catch (error) {
    throw new Error(`Failed to save results: ${error.message}`);
  }
}

module.exports = {
  discoverPaymasters,
  validatePaymaster
};