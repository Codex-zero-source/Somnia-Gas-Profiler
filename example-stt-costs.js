#!/usr/bin/env node

/**
 * Example: Demonstrating STT Cost Calculation
 * 
 * This script shows how the Somnia Gas Profiler calculates and displays
 * gas costs in STT (Somnia native token) equivalent values.
 */

const chalk = require('chalk');
const { SomniaGasProfiler } = require('./profiler');
const { SomniaGasReporter } = require('./reporter');

async function demonstrateSTTCosts() {
  console.log(chalk.cyan('🚀 Somnia Gas Profiler - STT Cost Calculation Demo\n'));
  
  // Example contract address (SimpleStorage from examples)
  const contractAddress = '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15';
  const abiPath = './examples/SimpleStorage.json';
  
  console.log(chalk.blue('📋 Demo Configuration:'));
  console.log(chalk.gray(`  Contract: ${contractAddress}`));
  console.log(chalk.gray(`  ABI: ${abiPath}`));
  console.log(chalk.gray(`  Network: Somnia Testnet`));
  console.log(chalk.gray(`  Functions: set(uint256), get(), increment()`));
  console.log('');
  
  console.log(chalk.yellow('💡 How STT Cost Calculation Works:'));
  console.log(chalk.gray('  1. Fetch current gas price from Somnia network using provider.getFeeData()'));
  console.log(chalk.gray('  2. Calculate cost per transaction: gas_used * gas_price'));
  console.log(chalk.gray('  3. Convert wei to STT: ethers.formatEther(cost_in_wei)'));
  console.log(chalk.gray('  4. Track min, max, average, and total costs across runs'));
  console.log(chalk.gray('  5. Display costs in reports alongside gas usage'));
  console.log('');
  
  console.log(chalk.blue('🔧 Example CLI Commands:'));
  console.log('');
  
  console.log(chalk.white('1. Analyze contract with cost calculation:'));
  console.log(chalk.gray('   somnia-gas-profiler analyze \\\\'));
  console.log(chalk.gray('     --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \\\\'));
  console.log(chalk.gray('     --abi ./examples/SimpleStorage.json \\\\'));
  console.log(chalk.gray('     --fn "set(uint256)" "get()" "increment()" \\\\'));
  console.log(chalk.gray('     --args \'[42]\' \'[]\' \'[]\' \\\\'));
  console.log(chalk.gray('     --runs 5 \\\\'));
  console.log(chalk.gray('     --out results-with-costs.json'));
  console.log('');
  
  console.log(chalk.white('2. Generate report showing STT costs:'));
  console.log(chalk.gray('   somnia-gas-profiler report \\\\'));
  console.log(chalk.gray('     --in results-with-costs.json \\\\'));
  console.log(chalk.gray('     --format table'));
  console.log('');
  
  console.log(chalk.white('3. Export cost data to CSV:'));
  console.log(chalk.gray('   somnia-gas-profiler report \\\\'));
  console.log(chalk.gray('     --in results-with-costs.json \\\\'));
  console.log(chalk.gray('     --format csv \\\\'));
  console.log(chalk.gray('     --out gas-costs-analysis.csv'));
  console.log('');
  
  console.log(chalk.green('✨ Expected Output Features:'));
  console.log('');
  
  console.log(chalk.white('📊 Enhanced Table Report:'));
  console.log(chalk.gray('┌─────────────┬──────┬─────────┬─────────┬─────────┬───────────┬──────────────┬──────────────┬──────────────┬───────────────┐'));
  console.log(chalk.gray('│ Function    │ Runs │ Min Gas │ Max Gas │ Avg Gas │ Total Gas │ Min Cost(STT)│ Max Cost(STT)│ Avg Cost(STT)│ Total Cost(STT)│'));
  console.log(chalk.gray('├─────────────┼──────┼─────────┼─────────┼─────────┼───────────┼──────────────┼──────────────┼──────────────┼───────────────┤'));
  console.log(chalk.gray('│ set(uint256)│ 5    │ 28,123  │ 43,456  │ 31,234  │ 156,170   │ 0.00002812   │ 0.00004346   │ 0.00003123   │ 0.00015617    │'));
  console.log(chalk.gray('│ increment() │ 5    │ 28,890  │ 29,123  │ 29,001  │ 145,005   │ 0.00002889   │ 0.00002912   │ 0.00002900   │ 0.00014501    │'));
  console.log(chalk.gray('│ get()       │ 5    │ 2,334   │ 2,334   │ 2,334   │ 11,670    │ 0.00000233   │ 0.00000233   │ 0.00000233   │ 0.00001167    │'));
  console.log(chalk.gray('└─────────────┴──────┴─────────┴─────────┴─────────┴───────────┴──────────────┴──────────────┴──────────────┴───────────────┘'));
  console.log('');
  
  console.log(chalk.white('📈 Enhanced Summary Statistics:'));
  console.log(chalk.gray('─────────────────────'));
  console.log(chalk.gray('Functions profiled: 3'));
  console.log(chalk.gray('Total transactions: 15'));
  console.log(chalk.gray('Total gas consumed: 312,845'));
  console.log(chalk.gray('Average per transaction: 20,856'));
  console.log(chalk.yellow('Total cost: 0.00031285 STT'));
  console.log(chalk.yellow('Average cost per transaction: 0.00002086 STT'));
  console.log('');
  
  console.log(chalk.white('📄 Enhanced CSV Export:'));
  console.log(chalk.gray('function,run,args_json,gas_used,mode,tx_hash,block_number,rpc,cost_stt,cost_wei,gas_price_wei'));
  console.log(chalk.gray('"set(uint256)",1,"[42]",43000,"standard","0xabc123",100,"https://dream-rpc.somnia.network","0.00004300","43000000000000000","1000000000"'));
  console.log(chalk.gray('"get()",1,"[]",2300,"standard","0xdef456",101,"https://dream-rpc.somnia.network","0.00000230","2300000000000000","1000000000"'));
  console.log('');
  
  console.log(chalk.cyan('🔍 Key Implementation Details:'));
  console.log('');
  
  console.log(chalk.white('1. Gas Price Fetching:'));
  console.log(chalk.gray('   - Uses ethers.js provider.getFeeData() to get current gas prices'));
  console.log(chalk.gray('   - Falls back to maxFeePerGas if gasPrice is not available'));
  console.log(chalk.gray('   - Displays gas price in gwei for user reference'));
  console.log('');
  
  console.log(chalk.white('2. Cost Calculation:'));
  console.log(chalk.gray('   - cost_in_wei = BigInt(gas_used) * gas_price'));
  console.log(chalk.gray('   - cost_in_stt = ethers.formatEther(cost_in_wei)'));
  console.log(chalk.gray('   - Precision: 8 decimal places for display'));
  console.log('');
  
  console.log(chalk.white('3. Aggregation:'));
  console.log(chalk.gray('   - Tracks minimum cost across all runs'));
  console.log(chalk.gray('   - Tracks maximum cost across all runs'));
  console.log(chalk.gray('   - Calculates average cost per transaction'));
  console.log(chalk.gray('   - Sums total cost for all transactions'));
  console.log('');
  
  console.log(chalk.white('4. Gasless Mode:'));
  console.log(chalk.gray('   - Cost calculation skipped for simulated transactions'));
  console.log(chalk.gray('   - Only actual transactions incur costs'));
  console.log(chalk.gray('   - Useful for testing expensive operations without cost'));
  console.log('');
  
  console.log(chalk.green('🚀 Ready to Use!'));
  console.log(chalk.gray('The enhanced Somnia Gas Profiler now includes comprehensive'));
  console.log(chalk.gray('STT cost calculation and reporting features.'));
  console.log('');
  
  console.log(chalk.yellow('💡 Pro Tips:'));
  console.log(chalk.gray('• Use gasless mode for initial analysis of expensive functions'));
  console.log(chalk.gray('• Export to CSV for detailed cost analysis in spreadsheets'));
  console.log(chalk.gray('• Compare costs before/after contract optimizations'));
  console.log(chalk.gray('• Monitor gas price fluctuations impact on transaction costs'));
  console.log('');
}

// Run the demonstration
if (require.main === module) {
  demonstrateSTTCosts().catch(console.error);
}

module.exports = { demonstrateSTTCosts };