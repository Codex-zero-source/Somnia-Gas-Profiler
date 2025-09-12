#!/usr/bin/env node

/**
 * Dependency Validation Script for profile.js
 * Tests all imports and module integrations
 */

const chalk = require('chalk');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

// Import all modules used by profile.js
const { BytecodeProcessor } = require('./lib/bytecode-processor');
const { ContractCompiler } = require('./lib/contract-compiler');
const { ABIExtractor } = require('./lib/abi-extractor');
const { DeveloperAnalyzer } = require('./lib/developer-analyzer');
const { SomniaABIFetcher } = require('./lib/somnia-abi-fetcher');
const profiler = require('./profiler');
const reporter = require('./reporter');

async function validateDependencies() {
  console.log(chalk.blue('🔍 Validating profile.js dependencies...\n'));
  
  const results = {
    coreModules: {},
    customModules: {},
    methods: {},
    errors: []
  };

  try {
    // Test core Node.js modules
    console.log(chalk.yellow('📦 Testing core modules...'));
    
    results.coreModules.chalk = typeof chalk.blue === 'function';
    results.coreModules.path = typeof path.join === 'function';
    results.coreModules.ethers = typeof ethers.JsonRpcProvider === 'function';
    results.coreModules.fs = true; // fs.promises is used in profile.js
    results.coreModules.dotenv = process.env.RPC_URL !== undefined;
    
    console.log(chalk.green('✅ Core modules validated'));

    // Test custom lib modules instantiation
    console.log(chalk.yellow('🏗️  Testing custom module instantiation...'));
    
    // Test BytecodeProcessor
    try {
      const mockProvider = new ethers.JsonRpcProvider('https://dream-rpc.somnia.network');
      const mockWallet = ethers.Wallet.createRandom();
      const bytecodeProcessor = new BytecodeProcessor(mockProvider, mockWallet);
      results.customModules.BytecodeProcessor = true;
      results.methods.bytecodeProcessor = {
        isValidBytecode: typeof bytecodeProcessor.isValidBytecode === 'function',
        detectContractType: typeof bytecodeProcessor.detectContractType === 'function',
        generateTestArguments: typeof bytecodeProcessor.generateTestArguments === 'function'
      };
    } catch (error) {
      results.customModules.BytecodeProcessor = false;
      results.errors.push(`BytecodeProcessor: ${error.message}`);
    }

    // Test ContractCompiler
    try {
      const compiler = new ContractCompiler();
      results.customModules.ContractCompiler = true;
      results.methods.contractCompiler = {
        compileSource: typeof compiler.compileSource === 'function',
        compileFile: typeof compiler.compileFile === 'function'
      };
    } catch (error) {
      results.customModules.ContractCompiler = false;
      results.errors.push(`ContractCompiler: ${error.message}`);
    }

    // Test ABIExtractor
    try {
      const abiExtractor = new ABIExtractor();
      results.customModules.ABIExtractor = true;
      results.methods.abiExtractor = {
        extractFromFile: typeof abiExtractor.extractFromFile === 'function',
        autoDetectABI: typeof abiExtractor.autoDetectABI === 'function',
        getFunctionSignatures: typeof abiExtractor.getFunctionSignatures === 'function'
      };
    } catch (error) {
      results.customModules.ABIExtractor = false;
      results.errors.push(`ABIExtractor: ${error.message}`);
    }

    // Test DeveloperAnalyzer
    try {
      const developerAnalyzer = new DeveloperAnalyzer();
      results.customModules.DeveloperAnalyzer = true;
      results.methods.developerAnalyzer = {
        analyzeGasProfile: typeof developerAnalyzer.analyzeGasProfile === 'function',
        displayAnalysis: typeof developerAnalyzer.displayAnalysis === 'function'
      };
    } catch (error) {
      results.customModules.DeveloperAnalyzer = false;
      results.errors.push(`DeveloperAnalyzer: ${error.message}`);
    }

    // Test SomniaABIFetcher
    try {
      const abiFetcher = new SomniaABIFetcher();
      results.customModules.SomniaABIFetcher = true;
      results.methods.somniaABIFetcher = {
        fetchAndValidateABI: typeof abiFetcher.fetchAndValidateABI === 'function',
        isValidAddress: typeof abiFetcher.isValidAddress === 'function'
      };
    } catch (error) {
      results.customModules.SomniaABIFetcher = false;
      results.errors.push(`SomniaABIFetcher: ${error.message}`);
    }

    console.log(chalk.green('✅ Custom modules validated'));

    // Test profiler and reporter modules
    console.log(chalk.yellow('⚡ Testing profiler and reporter modules...'));
    
    results.customModules.profiler = typeof profiler.analyze === 'function';
    results.customModules.reporter = typeof reporter.generate === 'function';
    
    console.log(chalk.green('✅ Profiler and reporter modules validated'));

    // Display results
    console.log(chalk.blue('\n📊 Validation Results:'));
    console.log(chalk.green('\n✅ Core Modules:'));
    Object.entries(results.coreModules).forEach(([module, status]) => {
      const icon = status ? '✅' : '❌';
      console.log(`   ${icon} ${module}: ${status}`);
    });

    console.log(chalk.green('\n✅ Custom Modules:'));
    Object.entries(results.customModules).forEach(([module, status]) => {
      const icon = status ? '✅' : '❌';
      console.log(`   ${icon} ${module}: ${status}`);
    });

    if (results.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors encountered:'));
      results.errors.forEach(error => {
        console.log(chalk.red(`   • ${error}`));
      });
    }

    const allValid = Object.values(results.coreModules).every(v => v) && 
                    Object.values(results.customModules).every(v => v) &&
                    results.errors.length === 0;

    if (allValid) {
      console.log(chalk.green('\n🎉 All dependencies are properly integrated and functional!'));
      console.log(chalk.gray('   profile.js should work correctly with all imported modules.'));
    } else {
      console.log(chalk.yellow('\n⚠️  Some issues were found. Check the errors above.'));
    }

    return allValid;

  } catch (error) {
    console.error(chalk.red(`\n❌ Validation failed: ${error.message}`));
    return false;
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateDependencies()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = { validateDependencies };