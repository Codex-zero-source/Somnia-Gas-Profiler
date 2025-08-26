#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
require('dotenv').config();

const profiler = require('../profiler');
const reporter = require('../reporter');
const { profile } = require('./profile');
const { compileAndProfile } = require('./compile-and-profile');
const { quickAnalyze } = require('./quick-analyze');

const cli = yargs(hideBin(process.argv))
  .scriptName('somnia-gas-profiler')
  .usage('Usage: $0 <command> [options]')
  .version('1.0.0')
  .help('h')
  .alias('h', 'help')
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .epilogue('For more information, visit: https://docs.somnia.network/');

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
        describe: 'ABI file path or inline JSON',
        type: 'string',
        demandOption: true
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
        describe: 'Enable gasless simulation (experimental)',
        type: 'boolean',
        default: false
      })
      .option('paymaster', {
        describe: 'Paymaster address for gasless simulation',
        type: 'string'
      })
      .option('verbose', {
        describe: 'Enable verbose logging',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 analyze --address 0x123... --abi ./ERC20.json --fn "transfer(address,uint256)" --args \'["0xabc...", 1000]\' --runs 5', 'Profile ERC20 transfer function'],
        ['$0 analyze --address 0x456... --abi \'[{"inputs":[],"name":"get","outputs":[{"type":"uint256"}],"type":"function"}]\' --fn "get()" --runs 3', 'Profile simple getter with inline ABI']
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
      .option('nl', {
        describe: 'Generate natural language summary',
        type: 'boolean',
        default: false
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
        ['$0 report --in results.json --nl', 'Generate table with AI summary'],
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
        console.log(chalk.gray(`  Natural language: ${argv.nl ? 'enabled' : 'disabled'}`));
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
        ['$0 profile --address 0x123... --abi ./contract.json', 'Profile deployed contract'],
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
        describe: 'Specific functions to profile',
        type: 'array'
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