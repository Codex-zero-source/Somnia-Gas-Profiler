#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const path = require('path');

// Load .env from the project root directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const profiler = require('../profiler');
const reporter = require('../reporter');
const { profile } = require('./profile');
const { compileAndProfile } = require('./compile-and-profile');
const { quickAnalyze } = require('./quick-analyze');

/**
 * Detect if gasless mode should be automatically enabled
 * @param {Array} abi - Contract ABI
 * @param {Array} functionSignatures - Function signatures to profile
 * @returns {boolean} Whether to enable gasless mode
 */
function detectGaslessMode(abi, functionSignatures) {
  // Check for minimal ABI characteristics
  const hasMinimalABI = abi.length < 5; // Very small ABI
  
  // Check for generic/unknown function names
  const hasGenericFunctions = abi.some(item => {
    if (item.type !== 'function') return false;
    return item.name && (
      item.name.startsWith('function_') ||
      item.name.includes('unknown') ||
      item.name.length < 3
    );
  });
  
  // Check for missing input/output information
  const hasMissingInfo = abi.some(item => {
    if (item.type !== 'function') return false;
    return !item.inputs || !item.outputs || 
           item.inputs.some(input => !input.type || !input.name) ||
           item.outputs.some(output => !output.type);
  });
  
  // Check if functions in signatures are not in ABI (indicating incomplete ABI)
  const missingFunctions = functionSignatures.some(sig => {
    return !abi.find(item => {
      if (item.type !== 'function') return false;
      const fullSig = `${item.name}(${(item.inputs || []).map(input => input.type).join(',')})`;
      return fullSig === sig || item.name === sig;
    });
  });
  
  // Gasless mode beneficial if:
  // 1. Very minimal ABI (likely auto-generated or incomplete)
  // 2. Has generic function names (indicates bytecode analysis)
  // 3. Missing type information (incomplete ABI)
  // 4. Functions requested but not in ABI
  
  const shouldUseGasless = hasMinimalABI || hasGenericFunctions || hasMissingInfo || missingFunctions;
  
  return shouldUseGasless;
}

const cli = yargs(hideBin(process.argv))
  .scriptName('somnia-gas-profiler')
  .usage('Usage: $0 <command> [options]')
  .version('1.0.0')
  .help('h')
  .alias('h', 'help')
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .epilogue(`For more information:
  • Gasless Mode: Run 'help-gasless' for comprehensive gasless features guide
  • Documentation: https://docs.somnia.network/
  • EIP-4337 Paymasters: https://eips.ethereum.org/EIPS/eip-4337
  • GitHub: https://github.com/somnia-network/gas-profiler

Quick Start:
  somnia-gas-profiler analyze --address 0x123... --fn "transfer(address,uint256)" --gasless
  somnia-gas-profiler profile --address 0x456...
  somnia-gas-profiler discover-paymasters --limit 5`);

// Analyze command
cli.command(
  'analyze',
  'Run profiling on deployed contracts',
  (yargs) => {
    return yargs
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('address', {
        describe: 'Target contract address',
        type: 'string',
        demandOption: true
      })
      .option('abi', {
        describe: 'ABI file path or inline JSON (auto-fetched from Somnia explorer if not provided)',
        type: 'string',
        demandOption: false
      })
      .option('fn', {
        describe: 'Function signature(s) to profile',
        type: 'array',
        demandOption: true
      })
      .option('args', {
        describe: 'Function arguments as JSON arrays',
        type: 'array',
        default: []
      })
      .option('runs', {
        describe: 'Number of iterations per function',
        type: 'number',
        default: 3
      })
      .option('out', {
        describe: 'Output file path',
        type: 'string',
        default: 'profiling_results.json'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation (auto-detected for minimal ABIs)',
        type: 'boolean',
        default: false
      })
      .option('paymaster', {
        describe: 'Paymaster address for gasless simulation',
        type: 'string'
      })
      .option('simulation-mode', {
        describe: 'Gasless simulation mode',
        choices: ['auto', 'estimate', 'staticCall', 'trace', 'debug', 'paymaster'],
        default: 'auto'
      })
      .option('force-gasless', {
        describe: 'Force gasless mode even for complete ABIs',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 analyze --address 0x123... --fn "transfer(address,uint256)" --args \'["0xabc...", 1000]\' --runs 5', 'Profile ERC20 transfer with auto-fetched ABI'],
        ['$0 analyze --address 0x456... --abi ./ERC20.json --fn "get()" --runs 3', 'Profile with custom ABI file']
      ]);
  },
  async (argv) => {
    try {
      console.log(chalk.blue('🔍 Starting Somnia Gas Profiler Analysis...\n'));
      
      if (argv.verbose) {
        console.log(chalk.gray('Configuration:'));
        console.log(chalk.gray(`  RPC: ${argv.rpc}`));
        console.log(chalk.gray(`  Contract: ${argv.address}`));
        console.log(chalk.gray(`  Functions: ${argv.fn.join(', ')}`));
        console.log(chalk.gray(`  Runs per function: ${argv.runs}`));
        console.log(chalk.gray(`  Output: ${argv.out}\n`));
      }

      // Auto-detect gasless mode if not explicitly set
      if (!argv.gasless && !argv.forceGasless) {
        try {
          // Load ABI to check for minimal/incomplete ABI characteristics
          const fs = require('fs').promises;
          const path = require('path');
          
          let abi;
          if (argv.abi.startsWith('[') || argv.abi.startsWith('{')) {
            abi = JSON.parse(argv.abi);
          } else {
            const abiPath = path.resolve(argv.abi);
            const abiContent = await fs.readFile(abiPath, 'utf8');
            abi = JSON.parse(abiContent);
          }
          
          // Check if ABI suggests gasless mode would be beneficial
          const shouldUseGasless = detectGaslessMode(abi, argv.fn);
          
          if (shouldUseGasless) {
            console.log(chalk.yellow('🤖 Auto-detected minimal ABI - enabling gasless simulation mode'));
            console.log(chalk.gray('   This prevents execution errors with incomplete function signatures'));
            argv.gasless = true;
          }
          
        } catch (error) {
          // If ABI detection fails, continue without auto-detection
          if (argv.verbose) {
            console.log(chalk.gray(`   ABI auto-detection failed: ${error.message}`));
          }
        }
      } else if (argv.forceGasless) {
        console.log(chalk.blue('🔧 Force gasless mode enabled'));
        argv.gasless = true;
      }
      
      // Enhanced gasless mode messaging
      if (argv.gasless) {
        console.log(chalk.blue('⚡ Gasless simulation mode enabled'));
        console.log(chalk.gray(`   Simulation mode: ${argv.simulationMode}`));
        
        if (argv.paymaster) {
          console.log(chalk.blue(`💰 Paymaster integration: ${argv.paymaster}`));
        }
      }

      await profiler.analyze(argv);
      
      console.log(chalk.green(`✅ Analysis complete! Results saved to ${argv.out}`));
      console.log(chalk.yellow(`💡 Run 'somnia-gas-profiler report --in ${argv.out}' to view formatted results`));
      
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Report command
cli.command(
  'report',
  'Generate formatted reports and summaries',
  (yargs) => {
    return yargs
      .option('in', {
        describe: 'Input profiling results file',
        type: 'string',
        default: 'profiling_results.json'
      })
      .option('format', {
        describe: 'Output format',
        choices: ['json', 'csv', 'table'],
        default: 'table'
      })
      .option('out', {
        describe: 'Output file (optional, defaults to stdout for table)',
        type: 'string'
      })
      .option('sort', {
        describe: 'Sort results by metric',
        choices: ['avg', 'min', 'max', 'total'],
        default: 'avg'
      })
      .option('compare', {
        describe: 'Compare with another profiling results file',
        type: 'string'
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 report --in results.json --format table', 'Display results as a formatted table'],
        ['$0 report --in results.json --format csv --out report.csv', 'Export results to CSV'],
        ['$0 report --in results1.json --compare results2.json', 'Compare two profiling runs']
      ]);
  },
  async (argv) => {
    try {
      console.log(chalk.blue('📊 Generating Somnia Gas Profiler Report...\n'));
      
      if (argv.verbose) {
        console.log(chalk.gray('Configuration:'));
        console.log(chalk.gray(`  Input: ${argv.in}`));
        console.log(chalk.gray(`  Format: ${argv.format}`));
        console.log(chalk.gray(`  Sort by: ${argv.sort}`));
        if (argv.compare) {
          console.log(chalk.gray(`  Compare with: ${argv.compare}`));
        }
        console.log('');
      }

      await reporter.generate(argv);
      
      console.log(chalk.green('✅ Report generated successfully!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Report generation failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Enhanced Profile command
cli.command(
  'profile',
  'One-command profiling with automatic analysis (bytecode, address, or source)',
  (yargs) => {
    return yargs
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('address', {
        describe: 'Contract address to profile',
        type: 'string'
      })
      .option('bytecode', {
        describe: 'Contract bytecode (hex string)',
        type: 'string'
      })
      .option('source', {
        describe: 'Solidity source file path',
        type: 'string'
      })
      .option('code', {
        describe: 'Inline Solidity source code',
        type: 'string'
      })
      .option('abi', {
        describe: 'ABI file path or inline JSON',
        type: 'string'
      })
      .option('contractName', {
        describe: 'Contract name (for source compilation)',
        type: 'string'
      })
      .option('runs', {
        describe: 'Number of profiling runs',
        type: 'number',
        default: 3
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation',
        type: 'boolean',
        default: false
      })
      .option('paymaster', {
        describe: 'Paymaster address for sponsored transactions',
        type: 'string'
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .option('standard', {
        describe: 'Use standard contract ABI (ERC20, ERC721, ERC1155)',
        type: 'string'
      })
      .example([
        ['$0 profile --address 0x123... --runs 5', 'Profile deployed contract with auto-detection'],
        ['$0 profile --bytecode 0x608060405... --abi ./contract.json', 'Profile from bytecode'],
        ['$0 profile --source ./MyContract.sol --contractName MyContract', 'Compile and profile source'],
        ['$0 profile --address 0x123... --gasless --paymaster 0x456...', 'Profile with gasless simulation']
      ]);
  },
  profile
);

// Paymaster Discovery Command
cli.command(
  'discover-paymasters',
  'Discover and validate available paymasters on the network',
  (yargs) => {
    return yargs
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('limit', {
        describe: 'Maximum number of paymasters to discover',
        type: 'number',
        default: 10
      })
      .option('validate', {
        describe: 'Validate discovered paymasters',
        type: 'boolean',
        default: true
      })
      .option('output', {
        describe: 'Output file for discovered paymasters',
        type: 'string'
      })
      .option('format', {
        describe: 'Output format',
        choices: ['json', 'table'],
        default: 'table'
      })
      .example([
        ['$0 discover-paymasters --limit 5', 'Discover up to 5 paymasters'],
        ['$0 discover-paymasters --output paymasters.json --format json', 'Save results to JSON file']
      ]);
  },
  async (argv) => {
    try {
      console.log(chalk.blue('🔍 Discovering paymasters on Somnia network...\n'));
      
      const { discoverPaymasters } = require('./paymaster-discovery');
      await discoverPaymasters(argv);
      
    } catch (error) {
      console.error(chalk.red('❌ Paymaster discovery failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Paymaster Validation Command
cli.command(
  'validate-paymaster <address>',
  'Validate a specific paymaster contract',
  (yargs) => {
    return yargs
      .positional('address', {
        describe: 'Paymaster contract address',
        type: 'string'
      })
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('detailed', {
        describe: 'Show detailed validation analysis',
        type: 'boolean',
        default: false
      })
      .option('test-gas', {
        describe: 'Test gas estimation with dummy UserOperation',
        type: 'boolean',
        default: true
      })
      .option('output', {
        describe: 'Output file for validation results',
        type: 'string'
      })
      .example([
        ['$0 validate-paymaster 0x123... --detailed', 'Detailed paymaster validation'],
        ['$0 validate-paymaster 0x123... --output validation.json', 'Save validation to file']
      ]);
  },
  async (argv) => {
    try {
      console.log(chalk.blue(`🔍 Validating paymaster: ${argv.address}\n`));
      
      const { validatePaymaster } = require('./paymaster-discovery');
      await validatePaymaster(argv);
      
    } catch (error) {
      console.error(chalk.red('❌ Paymaster validation failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Batch Gasless Profiling Command
cli.command(
  'batch-gasless',
  'Run gasless profiling on multiple contracts',
  (yargs) => {
    return yargs
      .option('config', {
        describe: 'Batch configuration file (JSON)',
        type: 'string',
        demandOption: true
      })
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('parallel', {
        describe: 'Number of parallel executions',
        type: 'number',
        default: 3
      })
      .option('output-dir', {
        describe: 'Output directory for batch results',
        type: 'string',
        default: './batch-results'
      })
      .option('continue-on-error', {
        describe: 'Continue processing even if some contracts fail',
        type: 'boolean',
        default: true
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 batch-gasless --config ./batch-config.json', 'Run batch gasless profiling'],
        ['$0 batch-gasless --config ./contracts.json --parallel 5 --output-dir ./results', 'Custom batch configuration'],
        ['$0 batch-gasless --config ./batch.json --continue-on-error false', 'Stop on first error']
      ]);
  },
  async (argv) => {
    try {
      console.log(chalk.blue('🚀 Starting batch gasless profiling...\n'));
      
      const { batchGaslessProfile } = require('./batch-profiling');
      await batchGaslessProfile(argv);
      
    } catch (error) {
      console.error(chalk.red('❌ Batch gasless profiling failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Enhanced help command
cli.command(
  'help-gasless',
  'Show comprehensive help for gasless features',
  () => {},
  () => {
    console.log(chalk.bold.blue('\n🚀 Somnia Gas Profiler - Gasless Mode Features\n'));
    
    console.log(chalk.bold('📋 Overview:'));
    console.log('Gasless mode enables transaction simulation without actual execution,');
    console.log('perfect for cost analysis, incomplete ABIs, and paymaster integration.\n');
    
    console.log(chalk.bold('🔧 Basic Usage:'));
    console.log(chalk.blue('  analyze') + ' --address 0x123... --abi ./contract.json --fn "transfer(address,uint256)" ' + chalk.green('--gasless'));
    console.log(chalk.gray('  → Simulate transaction without execution\n'));
    
    console.log(chalk.bold('💰 Paymaster Integration:'));
    console.log(chalk.blue('  analyze') + ' --address 0x123... --abi ./contract.json --fn "mint(uint256)" ' + chalk.green('--gasless --paymaster 0x456...'));
    console.log(chalk.gray('  → Simulate with paymaster sponsorship\n'));
    
    console.log(chalk.bold('🔍 Paymaster Discovery:'));
    console.log(chalk.blue('  discover-paymasters') + ' --limit 10 --validate');
    console.log(chalk.gray('  → Find and validate paymasters on the network'));
    console.log(chalk.blue('  validate-paymaster') + ' 0x789... --detailed');
    console.log(chalk.gray('  → Comprehensive paymaster validation\n'));
    
    console.log(chalk.bold('📦 Batch Processing:'));
    console.log(chalk.blue('  batch-gasless') + ' --config ./batch-config.json --parallel 5');
    console.log(chalk.gray('  → Profile multiple contracts in parallel\n'));
    
    console.log(chalk.bold('⚙️  Simulation Modes:'));
    console.log('  • ' + chalk.green('auto') + '        - Automatically choose best method');
    console.log('  • ' + chalk.green('estimate') + '     - Use estimateGas calls');
    console.log('  • ' + chalk.green('staticCall') + '   - Use static calls for view functions');
    console.log('  • ' + chalk.green('trace') + '       - Use debug tracing (requires trace support)');
    console.log('  • ' + chalk.green('debug') + '       - Enhanced debugging with call traces');
    console.log('  • ' + chalk.green('paymaster') + '   - Paymaster-specific simulation\n');
    
    console.log(chalk.bold('🤖 Auto-Detection:'));
    console.log('Gasless mode is automatically enabled for:');
    console.log('  • Minimal ABIs (< 5 functions)');
    console.log('  • Generic function names (function_*, unknown_*)');
    console.log('  • Missing type information');
    console.log('  • Bytecode-derived ABIs\n');
    
    console.log(chalk.bold('📊 Sample Batch Configuration:'));
    console.log(chalk.gray(`{
  "contracts": [
    {
      "name": "ERC20Token",
      "address": "0x123...",
      "abi": "./ERC20.json",
      "functions": ["transfer(address,uint256)", "balanceOf(address)"],
      "runs": 5,
      "gasless": true,
      "paymaster": "0x456..."
    }
  ]
}\n`));
    
    console.log(chalk.bold('🔗 Examples:'));
    console.log(chalk.yellow('  # Basic gasless simulation'));
    console.log('  somnia-gas-profiler analyze --address 0xA0b86a33E6441b4aC029B3a0a8efb0bb8f2EaBFc \\');
    console.log('    --abi "[{\"inputs\":[],\"name\":\"totalSupply\",\"outputs\":[{\"type\":\"uint256\"}],\"type\":\"function\"}]" \\');
    console.log('    --fn "totalSupply()" --gasless\n');
    
    console.log(chalk.yellow('  # Paymaster-sponsored simulation'));
    console.log('  somnia-gas-profiler analyze --address 0xContract123... \\');
    console.log('    --abi ./MyContract.json --fn "stake(uint256)" \\');
    console.log('    --gasless --paymaster 0xPaymaster456... --simulation-mode paymaster\n');
    
    console.log(chalk.yellow('  # Auto-detect gasless mode with incomplete ABI'));
    console.log('  somnia-gas-profiler analyze --address 0xUnknown789... \\');
    console.log('    --abi "[{\"type\":\"function\",\"name\":\"get\"}]" \\');
    console.log('    --fn "get()"  # Automatically enables gasless mode\n');
    
    console.log(chalk.yellow('  # Batch gasless profiling'));
    console.log('  somnia-gas-profiler batch-gasless --config ./my-contracts.json \\');
    console.log('    --parallel 3 --output-dir ./gasless-results\n');
    
    console.log(chalk.yellow('  # Discover and validate paymasters'));
    console.log('  somnia-gas-profiler discover-paymasters --limit 5 --output paymasters.json');
    console.log('  somnia-gas-profiler validate-paymaster 0xPaymaster123... --detailed --output validation.json\n');
    
    console.log(chalk.bold('📚 For more information:'));
    console.log('  • Documentation: https://docs.somnia.network/');
    console.log('  • EIP-4337: https://eips.ethereum.org/EIPS/eip-4337');
    console.log('  • GitHub: https://github.com/somnia-network/gas-profiler\n');
  }
);


// Enhanced Profile command
cli.command(
  'profile',
  'One-command profiling with automatic analysis (bytecode, address, or source)',
  (yargs) => {
    return yargs
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('address', {
        describe: 'Deployed contract address',
        type: 'string'
      })
      .option('bytecode', {
        describe: 'Contract bytecode (0x prefixed hex)',
        type: 'string'
      })
      .option('source', {
        describe: 'Solidity source file path',
        type: 'string'
      })
      .option('code', {
        describe: 'Inline Solidity source code',
        type: 'string'
      })
      .option('abi', {
        describe: 'ABI file path (optional for bytecode/source)',
        type: 'string'
      })
      .option('standard', {
        describe: 'Contract standard for fallback ABI (ERC20, ERC721, ERC1155)',
        type: 'string',
        choices: ['ERC20', 'ERC721', 'ERC1155']
      })
      .option('contract-name', {
        describe: 'Contract name (auto-detected if not provided)',
        type: 'string'
      })
      .option('runs', {
        describe: 'Number of iterations per function',
        type: 'number',
        default: 3
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 profile --address 0x123... --abi ./contract.json', 'Profile deployed contract with ABI'],
        ['$0 profile --address 0x123... --standard ERC20', 'Profile ERC20 contract with standard ABI'],
        ['$0 profile --bytecode 0x608060... --runs 5', 'Profile from bytecode'],
        ['$0 profile --source ./MyContract.sol', 'Compile and profile contract'],
        ['$0 profile --code "contract Test { function get() public pure returns (uint256) { return 42; } }"', 'Profile inline code']
      ])
      .check((argv) => {
        const inputs = [argv.address, argv.bytecode, argv.source, argv.code].filter(Boolean);
        if (inputs.length !== 1) {
          throw new Error('Provide exactly one input: --address, --bytecode, --source, or --code');
        }
        return true;
      });
  },
  async (argv) => {
    try {
      await profile(argv);
    } catch (error) {
      console.error(chalk.red('❌ Profile command failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Compile-and-Profile command
cli.command(
  'compile-and-profile',
  'Compile Solidity contract and immediately profile',
  (yargs) => {
    return yargs
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('source', {
        describe: 'Solidity source file path',
        type: 'string'
      })
      .option('code', {
        describe: 'Inline Solidity source code',
        type: 'string'
      })
      .option('contract-name', {
        describe: 'Contract name (auto-detected if not provided)',
        type: 'string'
      })
      .option('optimization-runs', {
        describe: 'Solidity optimizer runs',
        type: 'number',
        default: 200
      })
      .option('solc-version', {
        describe: 'Solidity compiler version',
        type: 'string',
        default: '0.8.19'
      })
      .option('via-ir', {
        describe: 'Enable compilation via IR',
        type: 'boolean',
        default: false
      })
      .option('runs', {
        describe: 'Number of profiling iterations per function',
        type: 'number',
        default: 3
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 compile-and-profile --source ./MyContract.sol --runs 5', 'Compile and profile contract'],
        ['$0 compile-and-profile --code "contract Test {...}" --optimization-runs 1000', 'Profile inline code with high optimization'],
        ['$0 compile-and-profile --source ./Token.sol --via-ir', 'Compile via IR and profile']
      ])
      .check((argv) => {
        if (!argv.source && !argv.code) {
          throw new Error('Provide either --source <file> or --code <inline>');
        }
        return true;
      });
  },
  async (argv) => {
    try {
      await compileAndProfile(argv);
    } catch (error) {
      console.error(chalk.red('❌ Compile-and-profile failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Quick-Analyze command
cli.command(
  'quick-analyze',
  'Fast analysis of deployed contracts with auto-ABI detection',
  (yargs) => {
    return yargs
      .option('rpc', {
        describe: 'Custom RPC endpoint',
        type: 'string',
        default: 'https://dream-rpc.somnia.network'
      })
      .option('address', {
        describe: 'Target contract address',
        type: 'string',
        demandOption: true
      })
      .option('abi', {
        describe: 'ABI file path (optional, will auto-detect)',
        type: 'string'
      })
      .option('standard', {
        describe: 'Contract standard for ABI detection',
        choices: ['ERC20', 'ERC721', 'ERC1155'],
        type: 'string'
      })
      .option('functions', {
        describe: 'Specific functions to profile (comma-separated list or array)',
        type: 'array',
        coerce: (arg) => {
          // Handle both array and string inputs
          return Array.isArray(arg)
            ? arg
            : arg.split(',').map(f => f.trim());
        }
      })
      .option('view-only', {
        describe: 'Profile only view/pure functions',
        type: 'boolean',
        default: false
      })
      .option('state-only', {
        describe: 'Profile only state-changing functions',
        type: 'boolean',
        default: false
      })
      .option('quick', {
        describe: 'Ultra-fast mode (fewer functions, fewer runs)',
        type: 'boolean',
        default: false
      })
      .option('max-functions', {
        describe: 'Maximum number of functions to profile',
        type: 'number',
        default: 10
      })
      .option('runs', {
        describe: 'Number of iterations per function',
        type: 'number',
        default: 3
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation',
        type: 'boolean',
        default: true
      })
      .option('skip-ai', {
        describe: 'Skip AI analysis',
        type: 'boolean',
        default: false
      })
      .option('allow-minimal', {
        describe: 'Allow minimal ABI generation from bytecode',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 quick-analyze --address 0x123... --standard ERC20', 'Quick ERC20 token analysis'],
        ['$0 quick-analyze --address 0x456... --abi ./contract.json --quick', 'Ultra-fast analysis with ABI'],
        ['$0 quick-analyze --address 0x789... --view-only', 'Analyze only view functions'],
        ['$0 quick-analyze --address 0xabc... --functions "balanceOf(address)" "transfer(address,uint256)"', 'Analyze specific functions']
      ]);
  },
  async (argv) => {
    try {
      await quickAnalyze(argv);
    } catch (error) {
      console.error(chalk.red('❌ Quick analyze failed:'), error.message);
      if (argv.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }
);

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

// Parse arguments and execute only if this is the main module and not in test environment
if (require.main === module && process.env.NODE_ENV !== 'test') {
  cli.parse();
}

// Export for testing
module.exports = cli;