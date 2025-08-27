const chalk = require('chalk');
const path = require('path');
const { ethers } = require('ethers');

const { ContractCompiler } = require('../lib/contract-compiler');
const { BytecodeProcessor } = require('../lib/bytecode-processor');
const { DeveloperAnalyzer } = require('../lib/developer-analyzer');
const profiler = require('../profiler');

/**
 * Compile Solidity contract and immediately profile
 * Workflow: Solidity → Compile → Deploy → Profile → Analyze
 */
async function compileAndProfile(options) {
  try {
    console.log(chalk.blue('🔧 Starting compile-and-profile workflow...\n'));

    // Initialize components
    const provider = new ethers.JsonRpcProvider(options.rpc || 'https://dream-rpc.somnia.network');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
    
    const compiler = new ContractCompiler();
    const bytecodeProcessor = new BytecodeProcessor(provider, wallet);
    const developerAnalyzer = new DeveloperAnalyzer();

    // Check available compilation tools
    await compiler.displayAvailableTools();

    // Determine source input
    let sourceCode, contractName;
    if (options.source) {
      // File input
      console.log(chalk.blue(`📂 Reading source file: ${options.source}`));
      const fs = require('fs').promises;
      sourceCode = await fs.readFile(options.source, 'utf8');
      contractName = options.contractName || compiler.extractContractName(sourceCode) || path.basename(options.source, '.sol');
    } else if (options.code) {
      // Inline code input
      console.log(chalk.blue('📝 Using inline source code'));
      sourceCode = options.code;
      contractName = options.contractName || compiler.extractContractName(sourceCode) || 'InlineContract';
    } else {
      throw new Error('No source provided. Use --source <file> or --code <inline>');
    }

    console.log(chalk.gray(`   Contract name: ${contractName}`));

    // Compile contract
    console.log(chalk.blue('\n🔨 Compiling contract...'));
    const compilationOptions = {
      optimizationRuns: options.optimizationRuns || 200,
      solcVersion: options.solcVersion || '0.8.19',
      viaIR: options.viaIR || false
    };

    const compilation = await compiler.compileSource(sourceCode, contractName, compilationOptions);
    
    console.log(chalk.green(`✅ Compilation successful using ${compilation.compiler}`));
    console.log(chalk.gray(`   Bytecode length: ${compilation.bytecode.length} characters`));
    console.log(chalk.gray(`   ABI entries: ${compilation.abi.length}`));

    // Deploy and profile
    console.log(chalk.blue('\n🚀 Deploying contract for profiling...'));
    const contractData = await bytecodeProcessor.loadFromBytecode(compilation.bytecode, compilation.abi);
    
    // Detect contract type and generate test arguments
    const contractType = bytecodeProcessor.detectContractType(contractData.abi);
    const testArgs = bytecodeProcessor.generateTestArguments(contractData.abi, contractType);

    console.log(chalk.blue(`\n🔍 Contract analysis:`));
    console.log(chalk.gray(`   Type: ${contractType}`));
    console.log(chalk.gray(`   Functions: ${contractData.functions.length}`));
    console.log(chalk.gray(`   Address: ${contractData.address}`));

    // Prepare profiling configuration
    const timestamp = Date.now();
    const profilingConfig = {
      rpc: options.rpc || 'https://dream-rpc.somnia.network',
      address: contractData.address,
      abi: JSON.stringify(contractData.abi),
      fn: contractData.functions,
      args: contractData.functions.map(func => JSON.stringify(testArgs[func] || [])),
      runs: options.runs || 3,
      out: options.output || `${contractName}_profiling_${timestamp}.json`,
      gasless: options.gasless || false,
      verbose: options.verbose || false
    };

    // Run profiling
    console.log(chalk.blue('\n⚡ Running gas profiling...\n'));
    await profiler.analyze(profilingConfig);

    // Generate reports
    await generateReports(profilingConfig, contractName, compilation, contractType);

    // Generate developer-focused analysis
    if (developerAnalyzer) {
      await generateCompilationAnalysis(profilingConfig.out, developerAnalyzer, contractData.address, {
        contractName,
        contractType,
        compiler: compilation.compiler,
        optimizationRuns: compilationOptions.optimizationRuns
      });
    } else {
      console.log(chalk.yellow('\n⚠️  Developer analysis not available.'));
    }

    // Display completion summary
    displayCompletionSummary(contractName, contractData.address, profilingConfig.out, contractType, compilation);

  } catch (error) {
    throw new Error(`Compile-and-profile failed: ${error.message}`);
  }
}

/**
 * Generate CSV and JSON reports
 */
async function generateReports(profilingConfig, contractName, compilation, contractType) {
  try {
    console.log(chalk.blue('📊 Generating reports...'));
    
    const reporter = require('../reporter');
    
    // Generate CSV report
    const csvFile = profilingConfig.out.replace('.json', '.csv');
    await reporter.generate({
      in: profilingConfig.out,
      format: 'csv',
      out: csvFile
    });

    // Generate enhanced table report
    await reporter.generate({
      in: profilingConfig.out,
      format: 'table',
      sort: 'avg'
    });

    console.log(chalk.green(`✅ Reports generated successfully`));
    console.log(chalk.gray(`   JSON: ${profilingConfig.out}`));
    console.log(chalk.gray(`   CSV: ${csvFile}`));

  } catch (error) {
    console.log(chalk.yellow(`⚠️  Report generation failed: ${error.message}`));
  }
}

/**
 * Generate developer-focused analysis specific to compilation
 */
async function generateCompilationAnalysis(jsonFile, developerAnalyzer, contractAddress, metadata) {
  try {
    console.log(chalk.blue('\n🔍 Generating compilation-specific analysis...'));
    
    const fs = require('fs').promises;
    const profilingData = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    
    const analysis = developerAnalyzer.analyzeGasProfile(profilingData, contractAddress);
    
    // Display analysis with compilation context
    console.log(chalk.cyan('\n🧠 Developer Analysis - Compilation & Gas Optimization'));
    console.log(chalk.gray('─'.repeat(65)));
    console.log(chalk.white(`Contract: ${metadata.contractName}`));
    console.log(chalk.white(`Type: ${metadata.contractType}`));
    console.log(chalk.white(`Compiler: ${metadata.compiler}`));
    console.log(chalk.white(`Optimization: ${metadata.optimizationRuns} runs`));
    console.log(chalk.gray('─'.repeat(65)));
    
    developerAnalyzer.displayAnalysis(analysis);

  } catch (error) {
    console.log(chalk.yellow(`⚠️  Analysis failed: ${error.message}`));
  }
}

/**
 * Display comprehensive completion summary
 */
function displayCompletionSummary(contractName, address, outputFile, contractType, compilation) {
  console.log(chalk.green('\n🎉 Compile-and-profile workflow complete!'));
  console.log(chalk.cyan('\n📋 Summary'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`Contract: ${contractName}`));
  console.log(chalk.white(`Type: ${contractType}`));
  console.log(chalk.white(`Address: ${address}`));
  console.log(chalk.white(`Compiler: ${compilation.compiler}`));
  console.log(chalk.white(`Bytecode: ${compilation.bytecode.length} chars`));
  console.log(chalk.white(`Functions: ${compilation.abi.filter(e => e.type === 'function').length}`));
  console.log(chalk.white(`Results: ${outputFile}`));
  
  // Performance tips
  console.log(chalk.yellow('\n💡 Optimization Tips:'));
  console.log(chalk.gray('   - Review functions with highest gas usage'));
  console.log(chalk.gray('   - Consider different optimization levels'));
  console.log(chalk.gray('   - Test with different Solidity versions'));
  console.log(chalk.gray('   - Use viaIR for complex contracts (--via-ir)'));
}

/**
 * Validate compilation options
 */
function validateOptions(options) {
  if (!options.source && !options.code) {
    throw new Error('Either --source <file> or --code <inline> must be provided');
  }

  if (options.optimizationRuns && (options.optimizationRuns < 0 || options.optimizationRuns > 10000)) {
    throw new Error('Optimization runs must be between 0 and 10000');
  }

  if (options.runs && (options.runs < 1 || options.runs > 50)) {
    throw new Error('Profiling runs must be between 1 and 50');
  }
}

module.exports = {
  compileAndProfile,
  validateOptions
};