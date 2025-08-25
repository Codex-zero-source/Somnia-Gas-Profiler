#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
require('dotenv').config();

const profiler = require('../profiler');
const reporter = require('../reporter');

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