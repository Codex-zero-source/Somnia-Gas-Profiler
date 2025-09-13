const chalk = require('chalk');
const { ethers } = require('ethers');

const { ABIExtractor } = require('../lib/abi-extractor');
const { SomniaABIFetcher } = require('../lib/somnia-abi-fetcher');
const { BytecodeProcessor } = require('../lib/bytecode-processor');
const { DeveloperAnalyzer } = require('../lib/developer-analyzer');
const profiler = require('../profiler');

/**
 * Fast analysis of deployed contracts
 * Features: Auto-ABI detection, immediate profiling, NL summary
 */
async function quickAnalyze(options) {
  try {
    console.log(chalk.blue('⚡ Starting quick contract analysis...\n'));

    // Validate input
    if (!options.address || !ethers.isAddress(options.address)) {
      throw new Error('Valid contract address is required (--address 0x...)');
    }

    // Initialize components
    const provider = new ethers.JsonRpcProvider(options.rpc || 'https://dream-rpc.somnia.network');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
    
    const abiExtractor = new ABIExtractor();
    const bytecodeProcessor = new BytecodeProcessor(provider, wallet);
    const developerAnalyzer = new DeveloperAnalyzer();

    // Display connection info
    console.log(chalk.gray(`🌐 Connected to: ${options.rpc || 'https://dream-rpc.somnia.network'}`));
    console.log(chalk.gray(`📍 Analyzing contract: ${options.address}\n`));

    // Check if contract exists
    const code = await provider.getCode(options.address);
    if (code === '0x') {
      throw new Error('No contract found at the specified address');
    }

    console.log(chalk.green('✅ Contract found on network'));
    console.log(chalk.gray(`   Bytecode length: ${code.length} characters\n`));

    // Load and detect ABI
    const abi = await loadContractABI(options, abiExtractor, code);
    
    if (!abi || abi.length === 0) {
      throw new Error('Could not load or detect contract ABI. Please provide --abi option.');
    }

    // Analyze contract
    const contractAnalysis = analyzeContract(abi, code, bytecodeProcessor);
    displayContractAnalysis(contractAnalysis);

    // Determine functions to profile first
    const functionsToProfile = selectFunctionsToProfile(abi, options);
    
    if (functionsToProfile.length === 0) {
      console.log(chalk.yellow('⚠️  No suitable functions found for profiling'));
      return;
    }

    // Generate test arguments
    const testArgsData = await bytecodeProcessor.generateTestArguments(abi, contractAnalysis.type, options.address, functionsToProfile);
    
    // Extract arguments for profiling config
    const testArgs = functionsToProfile.map(signature => {
      const argData = testArgsData.testArgs[signature];
      return argData ? argData.args : [];
    });

    console.log(chalk.blue(`\n⚡ Profiling ${functionsToProfile.length} functions...\n`));

    // Configure and run profiling
    const timestamp = Date.now();
    const profilingConfig = {
      rpc: options.rpc || 'https://dream-rpc.somnia.network',
      address: options.address,
      abi: JSON.stringify(abi),
      fn: functionsToProfile,
      args: testArgs.map(args => JSON.stringify(args)),
      runs: options.runs || (options.quick ? 2 : 1),
      out: options.out || `quick_analysis_${timestamp}.json`,
      gasless: options.gasless || true, // Default to gasless for quick analysis
      verbose: options.verbose || false
    };

    await profiler.analyze(profilingConfig);

    // Generate immediate analysis
    await generateQuickReports(profilingConfig, contractAnalysis);

    // Generate developer-focused analysis
    if (developerAnalyzer && !options.skipAnalysis) {
      // Create a simplified contract analysis object
      const simplifiedContractAnalysis = {
        type: contractAnalysis.type,
        complexity: contractAnalysis.complexity,
        totalFunctions: contractAnalysis.totalFunctions,
        viewFunctions: contractAnalysis.viewFunctions,
        stateChangingFunctions: contractAnalysis.stateChangingFunctions,
        events: contractAnalysis.events,
        bytecodeSize: contractAnalysis.bytecodeSize
      };
      
      await generateQuickAnalysis(profilingConfig.out, developerAnalyzer, options.address, simplifiedContractAnalysis);
    } else if (!options.skipAnalysis) {
      console.log(chalk.yellow('\n⚠️  Developer analysis not available.'));
    }

    // Display completion summary
    displayQuickSummary(profilingConfig, contractAnalysis);

  } catch (error) {
    throw new Error(`Quick analyze failed: ${error.message}`);
  }
}

/**
 * Load contract ABI from various sources
 */
async function loadContractABI(options, abiExtractor, bytecode) {
  console.log(chalk.blue('🔍 Loading contract ABI...'));

  let abi = null;

  // Try provided ABI file first
  if (options.abi) {
    try {
      abi = await abiExtractor.extractFromFile(options.abi);
      console.log(chalk.green('✅ ABI loaded from provided file'));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to load ABI file: ${error.message}`));
    }
  }

  // Try Somnia explorer ABI fetching if no ABI provided
  if (!abi) {
    console.log(chalk.blue('🕵️  Attempting ABI auto-detection...'));
    
    try {
      const abiReader = new SomniaABIFetcher();
      const result = await abiReader.fetchAndValidateABI(options.address, {
        allowMinimal: options.allowMinimal !== false,
        requireVerified: options.requireVerified || false
      });
      
      if (result && result.abi) {
        abi = result.abi;
        console.log(chalk.green(`✅ ABI fetched from Somnia explorer (${result.metadata.source})`));
        console.log(chalk.gray(`   Functions: ${result.metadata.functionCount}, Verified: ${result.metadata.isVerified}`));
      }
    } catch (explorerError) {
      console.log(chalk.yellow(`⚠️  Somnia explorer fetch failed: ${explorerError.message}`));
      
      // Fallback to local auto-detection
      abi = await abiExtractor.autoDetectABI({
        address: options.address,
        bytecode: bytecode,
        standard: options.standard
      });

      if (abi) {
        console.log(chalk.green('✅ ABI auto-detected from bytecode'));
      }
    }
  }

  // Try common standards if specified
  if (!abi && options.standard) {
    abi = abiExtractor.getCommonABI(options.standard);
    if (abi) {
      console.log(chalk.green(`✅ Using ${options.standard} standard ABI`));
    }
  }

  // Generate minimal ABI from bytecode if all else fails
  if (!abi && options.allowMinimal !== false) {
    console.log(chalk.yellow('⚠️  Generating minimal ABI from bytecode analysis...'));
    const selectors = bytecodeProcessor.extractFunctionSelectors(bytecode);
    abi = abiExtractor.generateMinimalABI(selectors.map(s => `function_${s}()`));
    
    if (abi.length > 0) {
      console.log(chalk.yellow(`⚠️  Created minimal ABI with ${abi.length} functions`));
    }
  }

  return abi;
}

/**
 * Analyze contract structure and characteristics
 */
function analyzeContract(abi, bytecode, bytecodeProcessor) {
  const abiExtractor = new ABIExtractor();
  const functions = abiExtractor.extractFunctions(abi);
  const viewFunctions = abiExtractor.extractViewFunctions(abi);
  const stateChanging = abiExtractor.extractStateChangingFunctions(abi);
  const contractType = bytecodeProcessor.detectContractType(abi);

  return {
    type: contractType,
    totalFunctions: functions.length,
    viewFunctions: viewFunctions.length,
    stateChangingFunctions: stateChanging.length,
    events: abi.filter(e => e.type === 'event').length,
    bytecodeSize: bytecode.length,
    complexity: calculateComplexity(functions)
  };
}

/**
 * Calculate contract complexity score
 */
function calculateComplexity(functions) {
  if (functions.length === 0) return 'unknown';
  if (functions.length <= 5) return 'simple';
  if (functions.length <= 15) return 'moderate';
  if (functions.length <= 30) return 'complex';
  return 'very complex';
}

/**
 * Display contract analysis results
 */
function displayContractAnalysis(analysis) {
  console.log(chalk.cyan('\n📋 Contract Analysis'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.white(`Type: ${analysis.type}`));
  console.log(chalk.white(`Complexity: ${analysis.complexity}`));
  console.log(chalk.white(`Total Functions: ${analysis.totalFunctions}`));
  console.log(chalk.white(`  - View/Pure: ${analysis.viewFunctions}`));
  console.log(chalk.white(`  - State-changing: ${analysis.stateChangingFunctions}`));
  console.log(chalk.white(`Events: ${analysis.events}`));
  console.log(chalk.white(`Bytecode: ${Math.round(analysis.bytecodeSize / 2)} bytes`));
}

/**
 * Select functions to profile based on options and analysis
 */
function selectFunctionsToProfile(abi, options) {
  const abiExtractor = new (require('../lib/abi-extractor')).ABIExtractor();
  
  // If specific functions requested as comma-separated list
  if (options.functions && options.functions.length > 0) {
    // Handle both array and string inputs
    const functions = Array.isArray(options.functions) 
      ? options.functions 
      : options.functions.split(',').map(f => f.trim());
    
    return functions;
  }

  // Smart selection based on analysis mode
  let candidates = [];
  
  if (options.viewOnly) {
    candidates = abiExtractor.extractViewFunctions(abi);
  } else if (options.stateOnly) {
    candidates = abiExtractor.extractStateChangingFunctions(abi);
  } else {
    // Default: all functions, prioritizing state-changing
    const stateChanging = abiExtractor.extractStateChangingFunctions(abi);
    const viewFunctions = abiExtractor.extractViewFunctions(abi);
    
    candidates = [...stateChanging, ...viewFunctions];
  }

  // Limit functions for quick analysis
  const limit = options.quick ? 5 : (options.maxFunctions || 10);
  candidates = candidates.slice(0, limit);

  const selectedFunctions = candidates.map(func => {
    const inputs = func.inputs.map(input => input.type).join(',');
    return `${func.name}(${inputs})`;
  });

  return selectedFunctions;
}

/**
 * Generate quick reports
 */
async function generateQuickReports(profilingConfig, contractAnalysis) {
  try {
    console.log(chalk.blue('\n📊 Generating quick reports...'));
    
    const reporter = require('../reporter');
    
    // Generate table report to console
    await reporter.generate({
      in: profilingConfig.out,
      format: 'table',
      sort: 'avg'
    });

    // Generate CSV if requested
    if (profilingConfig.csv !== false) {
      const csvFile = profilingConfig.out.replace('.json', '.csv');
      await reporter.generate({
        in: profilingConfig.out,
        format: 'csv',
        out: csvFile
      });
      console.log(chalk.gray(`📄 CSV saved: ${csvFile}`));
    }

  } catch (error) {
    console.log(chalk.yellow(`⚠️  Report generation failed: ${error.message}`));
  }
}

/**
 * Generate quick developer analysis
 */
async function generateQuickAnalysis(jsonFile, developerAnalyzer, contractAddress, contractAnalysis) {
  try {
    console.log(chalk.blue('\n🔍 Generating quick developer insights...'));
    
    const fs = require('fs').promises;
    const profilingData = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    
    const analysis = developerAnalyzer.analyzeGasProfile(profilingData, contractAddress, contractAnalysis);
    
    // Automatically save full analysis when called from API or with --export-redis
    const outputFileName = `${contractAddress.replace('0x', '')}-analysis.txt`;
    const fullOutput = developerAnalyzer.displayAnalysis(analysis, true);
    
    await fs.writeFile(outputFileName, fullOutput);
     console.log(chalk.green(`\n📄 Full analysis saved to ${outputFileName}`));
     console.log(chalk.gray('   You can view the full details in the file'));
    
    // Always display the concise version in terminal
    developerAnalyzer.displayAnalysis(analysis);
    
  } catch (error) {
    console.log(chalk.yellow(`\n⚠️  Analysis failed: ${error.message}`));
  }
}

/**
 * Display quick analysis summary
 */
function displayQuickSummary(profilingConfig, contractAnalysis) {
  console.log(chalk.green('\n⚡ Quick analysis complete!'));
  console.log(chalk.cyan('\n📈 Analysis Summary'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.white(`Contract Type: ${contractAnalysis.type}`));
  console.log(chalk.white(`Functions Analyzed: ${profilingConfig.fn.length}`));
  console.log(chalk.white(`Total Runs: ${profilingConfig.fn.length * profilingConfig.runs}`));
  console.log(chalk.white(`Mode: ${profilingConfig.gasless ? 'Gasless' : 'Standard'}`));
  console.log(chalk.white(`Results: ${profilingConfig.out}`));
  
  // Quick tips
  console.log(chalk.yellow('\n💡 Quick Tips:'));
  console.log(chalk.gray('   - Use --runs N for more iterations'));
  console.log(chalk.gray('   - Add --abi file.json for accurate analysis'));
  console.log(chalk.gray('   - Try --standard ERC20|ERC721 for token contracts'));
}

module.exports = {
  quickAnalyze
};