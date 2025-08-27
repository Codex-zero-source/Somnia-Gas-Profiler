const chalk = require('chalk');
const path = require('path');
const { ethers } = require('ethers');

const { BytecodeProcessor } = require('../lib/bytecode-processor');
const { ContractCompiler } = require('../lib/contract-compiler');
const { ABIExtractor } = require('../lib/abi-extractor');
const { DeveloperAnalyzer } = require('../lib/developer-analyzer');
const { SomniaABIFetcher } = require('../lib/somnia-abi-fetcher');
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
    const developerAnalyzer = new DeveloperAnalyzer();
    const abiFetcher = new SomniaABIFetcher();

    // Auto-detect input type and load contract
    const contractData = await autoDetectAndLoad(options, {
      bytecodeProcessor,
      compiler,
      abiExtractor,
      abiFetcher
    });

    console.log(chalk.green(`✅ Contract loaded: ${contractData.address}`));
    console.log(chalk.gray(`   Source: ${contractData.source}`));
    console.log(chalk.gray(`   Functions: ${contractData.functions.length}`));

    // Generate test arguments
    const contractType = bytecodeProcessor.detectContractType(contractData.abi);
    const testArgs = bytecodeProcessor.generateTestArguments(contractData.abi, contractType);

    console.log(chalk.blue(`\n🔍 Detected contract type: ${contractType}`));

    // Prepare profiling configuration
    const useMinimalABI = contractData.source === 'deployed' && contractData.abi.some(func => func.name && func.name.startsWith('function_'));
    const shouldUseGasless = options.gasless || useMinimalABI;
    
    if (useMinimalABI && !options.gasless) {
      console.log(chalk.yellow('⚠️  Using gasless simulation for minimal ABI (functions may have unknown arguments)'));
    }
    
    const profilingConfig = {
      rpc: options.rpc || 'https://dream-rpc.somnia.network',
      address: contractData.address,
      abi: JSON.stringify(contractData.abi),
      fn: contractData.functions,
      args: contractData.functions.map(func => JSON.stringify(testArgs[func] || [])),
      runs: options.runs || 3,
      out: options.output || `profiling_${Date.now()}.json`,
      gasless: shouldUseGasless,
      verbose: options.verbose || false
    };

    // Run profiling
    console.log(chalk.blue('\n⚡ Running gas profiling...\n'));
    await profiler.analyze(profilingConfig);

    // Generate CSV report
    const csvFile = profilingConfig.out.replace('.json', '.csv');
    await generateCSVReport(profilingConfig.out, csvFile);

    // Generate developer-focused analysis
    await generateDeveloperAnalysis(profilingConfig.out, developerAnalyzer, contractData.address);

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
  const { bytecodeProcessor, compiler, abiExtractor, abiFetcher } = components;

  // Check if input is a deployed address
  if (options.address) {
    console.log(chalk.blue('📍 Loading deployed contract...'));
    
    // Try to get ABI from provided file or fetch from Somnia explorer
    let abi = null;
    if (options.abi) {
      abi = await abiExtractor.extractFromFile(options.abi);
    } else {
      // Try to fetch ABI from Somnia explorer first
      try {
        console.log(chalk.blue('🔍 Fetching ABI from Somnia explorer...'));
        const abiResult = await abiFetcher.fetchAndValidateABI(options.address, {
          allowMinimal: true,
          requireVerified: false
        });
        abi = abiResult.abi;
        console.log(chalk.green(`✅ ABI fetched from explorer (${abiResult.metadata.source})`, abi.length, 'entries'));
      } catch (fetchError) {
        console.log(chalk.yellow(`⚠️  Explorer ABI fetch failed: ${fetchError.message}`));
        // Fall back to existing auto-detection
        abi = await abiExtractor.autoDetectABI({ address: options.address });
      }
    }

    // Enhanced fallback mechanisms when ABI detection fails
    if (!abi) {
      console.log(chalk.yellow('🔧 ABI auto-detection failed, trying enhanced fallbacks...'));
      
      // Try to fetch contract bytecode and extract ABI
      try {
        console.log(chalk.blue('🔍 Fetching contract bytecode...'));
        const provider = new ethers.JsonRpcProvider(options.rpc || 'https://dream-rpc.somnia.network');
        const bytecode = await provider.getCode(options.address);
        
        if (bytecode && bytecode !== '0x') {
          console.log(chalk.gray(`   Bytecode length: ${bytecode.length} characters`));
          
          // Try to extract ABI from bytecode metadata
          abi = await abiExtractor.extractFromBytecode(bytecode);
          
          if (!abi) {
            // Generate minimal ABI from bytecode analysis
            console.log(chalk.blue('🛠️  Generating minimal ABI from bytecode analysis...'));
            abi = bytecodeProcessor.generateMinimalABI(bytecode);
          }
        }
      } catch (bytecodeError) {
        console.log(chalk.gray(`   Bytecode analysis failed: ${bytecodeError.message}`));
      }
      
      // If still no ABI, try common standards based on user hints
      if (!abi && options.standard) {
        console.log(chalk.blue(`🎯 Trying ${options.standard} standard ABI...`));
        abi = abiExtractor.getCommonABI(options.standard);
      }
      
      // Final fallback - provide helpful guidance
      if (!abi) {
        console.log(chalk.red('❌ All ABI detection methods failed.'));
        console.log(chalk.yellow('\n💡 Suggestions to fix this:'));
        console.log(chalk.gray('   1. Provide ABI file: --abi path/to/contract.json'));
        console.log(chalk.gray('   2. Try standard ABI: --standard ERC20 (or ERC721, ERC1155)'));
        console.log(chalk.gray('   3. Use bytecode instead: --bytecode 0x608060405...'));
        console.log(chalk.gray('   4. Compile source: --source MyContract.sol'));
        throw new Error('Could not load or detect ABI for deployed contract. See suggestions above.');
      }
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
 * Generate developer-focused analysis
 */
async function generateDeveloperAnalysis(jsonFile, developerAnalyzer, contractAddress) {
  try {
    const fs = require('fs').promises;
    const profilingData = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    
    const analysis = developerAnalyzer.analyzeGasProfile(profilingData, contractAddress);
    developerAnalyzer.displayAnalysis(analysis);

  } catch (error) {
    console.log(chalk.yellow(`⚠️  Analysis failed: ${error.message}`));
  }
}

module.exports = {
  profile
};