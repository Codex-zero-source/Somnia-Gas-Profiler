const chalk = require('chalk');
const path = require('path');
const { ethers } = require('ethers');

const { BytecodeProcessor } = require('../lib/bytecode-processor');
const { ContractCompiler } = require('../lib/contract-compiler');
const { ABIExtractor } = require('../lib/abi-extractor');
const { IONetClient } = require('../lib/io-net-client');
const profiler = require('../profiler');

/**
 * One-command profiling with automatic analysis
 * Handles bytecode, deployed addresses, and source files
 */
async function profile(options) {
  try {
    console.log(chalk.blue('🚀 Starting enhanced gas profiling...\n'));

    // Initialize components
    const provider = new ethers.JsonRpcProvider(options.rpc || 'https://dream-rpc.somnia.network');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
    
    const bytecodeProcessor = new BytecodeProcessor(provider, wallet);
    const compiler = new ContractCompiler();
    const abiExtractor = new ABIExtractor();
    const ioNetClient = new IONetClient();

    // Auto-detect input type and load contract
    const contractData = await autoDetectAndLoad(options, {
      bytecodeProcessor,
      compiler,
      abiExtractor
    });

    console.log(chalk.green(`✅ Contract loaded: ${contractData.address}`));
    console.log(chalk.gray(`   Source: ${contractData.source}`));
    console.log(chalk.gray(`   Functions: ${contractData.functions.length}`));

    // Generate test arguments
    const contractType = bytecodeProcessor.detectContractType(contractData.abi);
    const testArgs = bytecodeProcessor.generateTestArguments(contractData.abi, contractType);

    console.log(chalk.blue(`\n🔍 Detected contract type: ${contractType}`));

    // Prepare profiling configuration
    const profilingConfig = {
      rpc: options.rpc || 'https://dream-rpc.somnia.network',
      address: contractData.address,
      abi: JSON.stringify(contractData.abi),
      fn: contractData.functions,
      args: contractData.functions.map(func => JSON.stringify(testArgs[func] || [])),
      runs: options.runs || 3,
      out: options.output || `profiling_${Date.now()}.json`,
      gasless: options.gasless || false,
      verbose: options.verbose || false
    };

    // Run profiling
    console.log(chalk.blue('\n⚡ Running gas profiling...\n'));
    await profiler.analyze(profilingConfig);

    // Generate CSV report
    const csvFile = profilingConfig.out.replace('.json', '.csv');
    await generateCSVReport(profilingConfig.out, csvFile);

    // Generate natural language analysis if IO.net is configured
    if (ioNetClient.isConfigured()) {
      await generateNaturalLanguageAnalysis(profilingConfig.out, ioNetClient, contractData.address);
    } else {
      console.log(chalk.yellow('\n⚠️  IO.net API not configured. Set IOINTELLIGENCE_API_KEY for AI analysis.'));
    }

    // Display success summary
    console.log(chalk.green('\n🎉 Enhanced profiling complete!'));
    console.log(chalk.gray(`   JSON results: ${profilingConfig.out}`));
    console.log(chalk.gray(`   CSV report: ${csvFile}`));
    console.log(chalk.gray(`   Contract type: ${contractType}`));

  } catch (error) {
    throw new Error(`Profile command failed: ${error.message}`);
  }
}

/**
 * Auto-detect input type and load contract accordingly
 */
async function autoDetectAndLoad(options, components) {
  const { bytecodeProcessor, compiler, abiExtractor } = components;

  // Check if input is a deployed address
  if (options.address) {
    console.log(chalk.blue('📍 Loading deployed contract...'));
    
    // Try to get ABI from provided file or auto-detect
    let abi = null;
    if (options.abi) {
      abi = await abiExtractor.extractFromFile(options.abi);
    } else {
      abi = await abiExtractor.autoDetectABI({ address: options.address });
    }

    if (!abi) {
      throw new Error('Could not load or detect ABI for deployed contract. Please provide --abi option.');
    }

    const contract = new ethers.Contract(options.address, abi, bytecodeProcessor.provider);
    
    return {
      contract: contract,
      address: options.address,
      abi: abi,
      source: 'deployed',
      functions: abiExtractor.getFunctionSignatures(abi)
    };
  }

  // Check if input is bytecode
  if (options.bytecode) {
    console.log(chalk.blue('📝 Loading from bytecode...'));
    
    let abi = null;
    if (options.abi) {
      abi = await abiExtractor.extractFromFile(options.abi);
    }

    return await bytecodeProcessor.loadFromBytecode(options.bytecode, abi);
  }

  // Check if input is source code file
  if (options.source) {
    console.log(chalk.blue('🔧 Compiling source code...'));
    
    const compilation = await compiler.compileFile(options.source, options.contractName);
    return await bytecodeProcessor.loadFromBytecode(compilation.bytecode, compilation.abi);
  }

  // Check if input is inline source code
  if (options.code) {
    console.log(chalk.blue('🔧 Compiling inline source code...'));
    
    const contractName = options.contractName || 'InlineContract';
    const compilation = await compiler.compileSource(options.code, contractName);
    return await bytecodeProcessor.loadFromBytecode(compilation.bytecode, compilation.abi);
  }

  throw new Error('No valid input provided. Use --address, --bytecode, --source, or --code');
}

/**
 * Generate CSV report from JSON results
 */
async function generateCSVReport(jsonFile, csvFile) {
  try {
    console.log(chalk.blue('📊 Generating CSV report...'));
    
    const reporter = require('../reporter');
    await reporter.generate({
      in: jsonFile,
      format: 'csv',
      out: csvFile
    });

    console.log(chalk.green(`✅ CSV report saved: ${csvFile}`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  CSV generation failed: ${error.message}`));
  }
}

/**
 * Generate natural language analysis using IO.net
 */
async function generateNaturalLanguageAnalysis(jsonFile, ioNetClient, contractAddress) {
  try {
    console.log(chalk.blue('\n🤖 Generating AI analysis...'));
    
    const fs = require('fs').promises;
    const profilingData = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    
    const analysis = await ioNetClient.analyzeGasProfile(profilingData, contractAddress);
    
    console.log(ioNetClient.formatAnalysisOutput(analysis));

  } catch (error) {
    console.log(chalk.yellow(`⚠️  AI analysis failed: ${error.message}`));
  }
}

module.exports = {
  profile
};