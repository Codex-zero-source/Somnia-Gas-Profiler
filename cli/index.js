#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { analyze } = require('./profile');
const { compileAndProfile } = require('./compile-and-profile');
const { quickAnalyze } = require('./quick-analyze');
const { generate } = require('../reporter');
const { batchProfile } = require('./batch-profiling');
const { paymasterDiscovery } = require('./paymaster-discovery');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { RedisExporter } = require('../lib/redis-exporter');

// Load environment variables
require('dotenv').config();

// Check for required environment variables
if (!process.env.RPC_URL) {
  console.log(chalk.red('❌ RPC_URL environment variable is required'));
  console.log(chalk.gray('   Add RPC_URL=https://dream-rpc.somnia.network to your .env file'));
  process.exit(1);
}

// CLI configuration
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .command('profile', 'Profile a smart contract', (yargs) => {
    return yargs
      .option('address', {
        describe: 'Contract address',
        type: 'string'
      })
      .option('abi', {
        describe: 'ABI file path or JSON string',
        type: 'string'
      })
      .option('fn', {
        describe: 'Function signatures to profile',
        type: 'array'
      })
      .option('args', {
        describe: 'Function arguments',
        type: 'array'
      })
      .option('runs', {
        describe: 'Number of profiling runs per function',
        type: 'number',
        default: parseInt(process.env.DEFAULT_PROFILING_RUNS) || 3
      })
      .option('out', {
        describe: 'Output file path',
        type: 'string',
        default: './profiling_results.json'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation mode',
        type: 'boolean',
        default: false
      })
      .option('paymaster', {
        describe: 'Paymaster address for sponsored transactions',
        type: 'string'
      })
      .option('export-redis', {
        describe: 'Export results to Redis',
        type: 'boolean',
        default: false
      })
      .option('redis-url', {
        describe: 'Redis connection URL',
        type: 'string'
      })
      .check((argv) => {
        if (!argv.address && !argv.bytecode && !argv.source && !argv.code) {
          throw new Error('Either --address, --bytecode, --source, or --code is required');
        }
        return true;
      });
  }, async (argv) => {
    try {
      await analyze(argv);
      
      // Export to Redis if requested
      if (argv.exportRedis) {
        console.log(chalk.blue('\n📤 Exporting results to Redis...'));
        const exporter = new RedisExporter(argv.redisUrl);
        const connected = await exporter.connect();
        if (connected) {
          await exporter.exportResults(argv.out);
          await exporter.disconnect();
        }
      }
      
      console.log(chalk.green('\n✅ Profiling completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Profiling failed: ${error.message}`));
      process.exit(1);
    }
  })
  .command('compile-and-profile', 'Compile Solidity source and profile the contract', (yargs) => {
    return yargs
      .option('source', {
        describe: 'Solidity source file path',
        type: 'string'
      })
      .option('code', {
        describe: 'Inline Solidity code',
        type: 'string'
      })
      .option('contract-name', {
        describe: 'Contract name (auto-detected if not provided)',
        type: 'string'
      })
      .option('optimization-runs', {
        describe: 'Solidity optimizer runs',
        type: 'number',
        default: parseInt(process.env.DEFAULT_OPTIMIZATION_RUNS) || 200
      })
      .option('solc-version', {
        describe: 'Solidity compiler version',
        type: 'string',
        default: process.env.DEFAULT_SOLC_VERSION || '0.8.19'
      })
      .option('via-ir', {
        describe: 'Enable compilation via IR',
        type: 'boolean',
        default: false
      })
      .option('runs', {
        describe: 'Number of profiling runs per function',
        type: 'number',
        default: parseInt(process.env.DEFAULT_PROFILING_RUNS) || 3
      })
      .option('out', {
        describe: 'Output file path',
        type: 'string',
        default: './profiling_results.json'
      })
      .option('gasless', {
        describe: 'Enable gasless simulation mode',
        type: 'boolean',
        default: false
      })
      .option('export-redis', {
        describe: 'Export results to Redis',
        type: 'boolean',
        default: false
      })
      .option('redis-url', {
        describe: 'Redis connection URL',
        type: 'string'
      })
      .check((argv) => {
        if (!argv.source && !argv.code) {
          throw new Error('Either --source or --code is required');
        }
        return true;
      });
  }, async (argv) => {
    try {
      await compileAndProfile(argv);
      
      // Export to Redis if requested
      if (argv.exportRedis) {
        console.log(chalk.blue('\n📤 Exporting results to Redis...'));
        const exporter = new RedisExporter(argv.redisUrl);
        const connected = await exporter.connect();
        if (connected) {
          await exporter.exportResults(argv.out);
          await exporter.disconnect();
        }
      }
      
      console.log(chalk.green('\n✅ Compilation and profiling completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Compilation and profiling failed: ${error.message}`));
      process.exit(1);
    }
  })
  .command('quick-analyze', 'Quick analysis of a deployed contract', (yargs) => {
    return yargs
      .option('address', {
        describe: 'Contract address',
        demandOption: true,
        type: 'string'
      })
      .option('abi', {
        describe: 'Explicit ABI file path',
        type: 'string'
      })
      .option('standard', {
        describe: 'Standard ABI to use (ERC20, ERC721, ERC1155)',
        type: 'string'
      })
      .option('allow-minimal', {
        describe: 'Allow minimal ABI generation from bytecode',
        type: 'boolean',
        default: false
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
      .option('max-functions', {
        describe: 'Maximum number of functions to profile',
        type: 'number',
        default: parseInt(process.env.QUICK_ANALYZE_MAX_FUNCTIONS) || 10
      })
      .option('quick', {
        describe: 'Ultra-fast mode with fewer functions and runs',
        type: 'boolean',
        default: false
      })
      .option('runs', {
        describe: 'Number of profiling runs per function',
        type: 'number',
        default: 3
      })
      .option('skip-ai', {
        describe: 'Skip AI analysis',
        type: 'boolean',
        default: false
      })
      .option('out', {
        describe: 'Output file path',
        type: 'string',
        default: './quick_analysis_results.json'
      })
      .option('export-redis', {
        describe: 'Export results to Redis',
        type: 'boolean',
        default: false
      })
      .option('redis-url', {
        describe: 'Redis connection URL',
        type: 'string'
      });
  }, async (argv) => {
    try {
      await quickAnalyze(argv);
      
      // Export to Redis if requested
      if (argv.exportRedis) {
        console.log(chalk.blue('\n📤 Exporting results to Redis...'));
        const exporter = new RedisExporter(argv.redisUrl);
        const connected = await exporter.connect();
        if (connected) {
          await exporter.exportResults(argv.out);
          await exporter.disconnect();
        }
      }
      
      console.log(chalk.green('\n✅ Quick analysis completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Quick analysis failed: ${error.message}`));
      process.exit(1);
    }
  })
  .command('report', 'Generate reports from profiling results', (yargs) => {
    return yargs
      .option('in', {
        describe: 'Input results file',
        demandOption: true,
        type: 'string'
      })
      .option('format', {
        describe: 'Output format (table, csv, json)',
        type: 'string',
        default: 'table'
      })
      .option('out', {
        describe: 'Output file path',
        type: 'string'
      })
      .option('sort', {
        describe: 'Sort results by (avg, min, max, total)',
        type: 'string',
        default: 'avg'
      })
      .option('nl', {
        describe: 'Generate natural language summary',
        type: 'boolean',
        default: false
      })
      .option('compare', {
        describe: 'Compare with another results file',
        type: 'string'
      })
      .option('verbose', {
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      });
  }, async (argv) => {
    try {
      await generate(argv);
      console.log(chalk.green('\n✅ Report generated successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Report generation failed: ${error.message}`));
      process.exit(1);
    }
  })
  .command('batch-profile', 'Batch profile multiple contracts', (yargs) => {
    return yargs
      .option('config', {
        describe: 'Configuration file path',
        demandOption: true,
        type: 'string'
      })
      .option('parallel', {
        describe: 'Number of parallel executions',
        type: 'number',
        default: 3
      })
      .option('continue-on-error', {
        describe: 'Continue processing despite errors',
        type: 'boolean',
        default: false
      })
      .option('output-dir', {
        describe: 'Output directory for results',
        type: 'string',
        default: './batch-results'
      })
      .option('export-redis', {
        describe: 'Export results to Redis',
        type: 'boolean',
        default: false
      })
      .option('redis-url', {
        describe: 'Redis connection URL',
        type: 'string'
      });
  }, async (argv) => {
    try {
      await batchProfile(argv);
      console.log(chalk.green('\n✅ Batch profiling completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Batch profiling failed: ${error.message}`));
      process.exit(1);
    }
  })
  .command('discover-paymasters', 'Discover and validate paymasters on Somnia', (yargs) => {
    return yargs
      .option('limit', {
        describe: 'Maximum number of paymasters to discover',
        type: 'number',
        default: 10
      })
      .option('validate', {
        describe: 'Validate discovered paymasters',
        type: 'boolean',
        default: false
      })
      .option('test-gas', {
        describe: 'Test gas estimation with paymasters',
        type: 'boolean',
        default: false
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string'
      });
  }, async (argv) => {
    try {
      await paymasterDiscovery(argv);
      console.log(chalk.green('\n✅ Paymaster discovery completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Paymaster discovery failed: ${error.message}`));
      process.exit(1);
    }
  })
  .command('dashboard', 'Start the dashboard server', (yargs) => {
    return yargs
      .option('port', {
        describe: 'Dashboard server port',
        type: 'number',
        default: 3000
      })
      .option('host', {
        describe: 'Dashboard server host',
        type: 'string',
        default: 'localhost'
      });
  }, async (argv) => {
    console.log(chalk.blue('🚀 Starting Somnia Gas Profiler Dashboard...'));
    console.log(chalk.gray(`   Dashboard will be available at http://${argv.host}:${argv.port}`));
    
    // Navigate to dashboard directory and start dev server
    const { spawn } = require('child_process');
    const dashboardProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..', 'dashboard'),
      stdio: 'inherit'
    });
    
    dashboardProcess.on('error', (error) => {
      console.error(chalk.red('❌ Failed to start dashboard:'), error.message);
      process.exit(1);
    });
    
    dashboardProcess.on('close', (code) => {
      if (code !== 0) {
        console.log(chalk.red(`\n❌ Dashboard process exited with code ${code}`));
      }
    });
  })
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .argv;