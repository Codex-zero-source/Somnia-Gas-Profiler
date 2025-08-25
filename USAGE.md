# Somnia Gas Profiler - Usage Guide

A comprehensive CLI tool for profiling gas usage and calculating transaction costs in STT (Somnia native token) for smart contracts deployed on the Somnia blockchain network.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [STT Cost Calculation](#stt-cost-calculation)
- [Configuration](#configuration)
- [Commands](#commands)
  - [Analyze Command](#analyze-command)
  - [Report Command](#report-command)
- [Advanced Usage](#advanced-usage)
- [Output Formats](#output-formats)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Access to Somnia testnet
- Private key with sufficient balance for transactions

### Install Dependencies

```bash
npm install
```

### Global Installation (Optional)

```bash
npm link
# or
npm install -g .
```

## Quick Start

### 1. Set up Environment

Create a `.env` file in the project root:

```env
PRIVATE_KEY=your_private_key_here
RPC_URL=https://dream-rpc.somnia.network
OPENAI_API_KEY=your_openai_key_here  # Optional, for AI summaries
```

### 2. Deploy Example Contract

```bash
# Compile contracts
npm run compile

# Deploy example contracts
npm run deploy:somnia
```

### 3. Run Basic Profiling

```bash
# Profile a simple function
somnia-gas-profiler analyze \\
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \\
  --abi ./examples/SimpleStorage.json \\
  --fn "set(uint256)" \\
  --args '[42]' \\
  --runs 5
```

### 4. Generate Report

```bash
# Display formatted table
somnia-gas-profiler report --in profiling_results.json --format table

# Generate CSV export
somnia-gas-profiler report --in profiling_results.json --format csv --out gas-report.csv
```

## STT Cost Calculation

The Somnia Gas Profiler automatically calculates transaction costs in STT (Somnia's native token) when analyzing smart contracts. This feature provides real-world cost insights for gas optimization.

### How It Works

1. **Gas Price Fetching**: Retrieves current gas prices from the Somnia network using `provider.getFeeData()`
2. **Cost Calculation**: Multiplies gas used by gas price: `cost = gas_used * gas_price`
3. **Token Conversion**: Converts wei to STT using `ethers.formatEther()`
4. **Aggregation**: Tracks min, max, average, and total costs across multiple runs

### Cost Display Features

- **Console Output**: Shows cost per run during analysis
- **Table Reports**: Includes cost columns in formatted tables
- **CSV Export**: Exports detailed cost data for spreadsheet analysis
- **Summary Statistics**: Displays total and average costs

### Example Output

```
🔄 Profiling set(uint256) (5 runs)...
  Gas Price: 1.0 gwei
  Run 1: 43,000 gas | 0.00004300 STT
  Run 2: 28,123 gas | 0.00002812 STT
  ✅ Average: 31,234 gas
  💰 Avg Cost: 0.00003123 STT
  💵 Cost Range: 0.00002812 - 0.00004300 STT
```

### Gasless Mode

When using `--gasless` mode, cost calculation is skipped since no actual transactions are executed. This allows for cost-free testing of expensive operations.

```bash
somnia-gas-profiler analyze \\
  --address 0x123...abc \\
  --abi ./contract.json \\
  --fn "expensiveFunction(uint256)" \\
  --args '[1000]' \\
  --gasless \\
  --runs 10
```

### Cost Optimization Workflow

1. **Baseline Analysis**: Profile original contract with cost calculation
2. **Optimize Contract**: Implement gas optimizations
3. **Compare Costs**: Use comparison reports to measure cost savings
4. **Monitor Impact**: Track cost changes over time

```bash
# Before optimization
somnia-gas-profiler analyze --address $OLD_CONTRACT --out baseline.json

# After optimization  
somnia-gas-profiler analyze --address $NEW_CONTRACT --out optimized.json

# Compare costs
somnia-gas-profiler report --in baseline.json --compare optimized.json
```

## Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PRIVATE_KEY` | Yes | Private key for transaction signing | - |
| `RPC_URL` | No | Custom RPC endpoint | `https://dream-rpc.somnia.network` |
| `OPENAI_API_KEY` | No | OpenAI API key for natural language summaries | - |

### CLI Options

Global options available for all commands:

- `--help, -h`: Show help information
- `--version`: Show version number
- `--verbose`: Enable verbose logging

## Commands

### Analyze Command

Profile gas usage of smart contract functions.

#### Syntax

```bash
somnia-gas-profiler analyze [options]
```

#### Required Options

- `--address <address>`: Target contract address
- `--abi <path|json>`: ABI file path or inline JSON
- `--fn <signatures...>`: Function signature(s) to profile

#### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--rpc <url>` | string | `https://dream-rpc.somnia.network` | Custom RPC endpoint |
| `--args <arrays...>` | array | `[]` | Function arguments as JSON arrays |
| `--runs <number>` | number | `3` | Number of iterations per function |
| `--out <path>` | string | `profiling_results.json` | Output file path |
| `--gasless` | boolean | `false` | Enable gasless simulation |
| `--paymaster <address>` | string | - | Paymaster address for gasless |
| `--verbose` | boolean | `false` | Enable verbose logging |

#### Examples

**Single Function Analysis:**
```bash
somnia-gas-profiler analyze \\
  --address 0x123...abc \\
  --abi ./ERC20.json \\
  --fn "transfer(address,uint256)" \\
  --args '["0x456...def", 1000]' \\
  --runs 5
```

**Multiple Functions:**
```bash
somnia-gas-profiler analyze \\
  --address 0x123...abc \\
  --abi ./ERC20.json \\
  --fn "transfer(address,uint256)" "balanceOf(address)" \\
  --args '["0x456...def", 1000]' '["0x456...def"]' \\
  --runs 3
```

**Inline ABI:**
```bash
somnia-gas-profiler analyze \\
  --address 0x123...abc \\
  --abi '[{"inputs":[],"name":"get","outputs":[{"type":"uint256"}],"type":"function"}]' \\
  --fn "get()" \\
  --args '[]'
```

**Gasless Simulation:**
```bash
somnia-gas-profiler analyze \\
  --address 0x123...abc \\
  --abi ./contract.json \\
  --fn "expensiveFunction(uint256)" \\
  --args '[1000]' \\
  --gasless \\
  --runs 10
```

### Report Command

Generate formatted reports from profiling results.

#### Syntax

```bash
somnia-gas-profiler report [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--in <path>` | string | `profiling_results.json` | Input results file |
| `--format <type>` | string | `table` | Output format (json, csv, table) |
| `--out <path>` | string | - | Output file (stdout if not specified) |
| `--sort <metric>` | string | `avg` | Sort by metric (avg, min, max, total) |
| `--nl` | boolean | `false` | Generate natural language summary |
| `--compare <path>` | string | - | Compare with another results file |
| `--verbose` | boolean | `false` | Enable verbose logging |

#### Examples

**Basic Table Report:**
```bash
somnia-gas-profiler report --in results.json --format table
```

**CSV Export:**
```bash
somnia-gas-profiler report \\
  --in results.json \\
  --format csv \\
  --out gas-analysis.csv \\
  --sort total
```

**AI-Powered Summary:**
```bash
somnia-gas-profiler report \\
  --in results.json \\
  --format table \\
  --nl
```

**Comparison Analysis:**
```bash
somnia-gas-profiler report \\
  --in optimization-before.json \\
  --compare optimization-after.json
```

## Advanced Usage

### Batch Analysis

Create a script for analyzing multiple contracts:

```bash
#!/bin/bash

# Array of contracts to analyze
contracts=(
  "0x123...abc:./abi/ERC20.json"
  "0x456...def:./abi/Storage.json"
  "0x789...ghi:./abi/Complex.json"
)

for contract_info in "${contracts[@]}"; do
  IFS=':' read -r address abi <<< "$contract_info"
  
  echo "Analyzing contract: $address"
  somnia-gas-profiler analyze \\
    --address "$address" \\
    --abi "$abi" \\
    --fn "mainFunction(uint256)" \\
    --args '[100]' \\
    --runs 5 \\
    --out "results_$(basename $address).json"
done
```

### Optimization Workflow

1. **Baseline Analysis:**
```bash
somnia-gas-profiler analyze \\
  --address $CONTRACT_ADDRESS \\
  --abi ./contract.json \\
  --fn "optimizeMe(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --out baseline.json
```

2. **Optimize Contract and Redeploy**

3. **Post-Optimization Analysis:**
```bash
somnia-gas-profiler analyze \\
  --address $NEW_CONTRACT_ADDRESS \\
  --abi ./contract.json \\
  --fn "optimizeMe(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --out optimized.json
```

4. **Generate Comparison:**
```bash
somnia-gas-profiler report \\
  --in baseline.json \\
  --compare optimized.json \\
  --nl
```

### Integration with CI/CD

```yaml
# .github/workflows/gas-analysis.yml
name: Gas Analysis

on:
  pull_request:
    branches: [main]

jobs:
  gas-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Deploy contracts
        run: npm run deploy
        env:
          PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
          
      - name: Run gas profiling
        run: |
          somnia-gas-profiler analyze \\
            --address $CONTRACT_ADDRESS \\
            --abi ./artifacts/Contract.json \\
            --fn "criticalFunction(uint256)" \\
            --args '[1000]' \\
            --runs 5 \\
            --out pr-results.json
            
      - name: Compare with baseline
        run: |
          somnia-gas-profiler report \\
            --in baseline-results.json \\
            --compare pr-results.json \\
            --format table
```

## Output Formats

### JSON Format

Raw profiling data with complete run information including STT costs:

```json
{
  "rpc": "https://dream-rpc.somnia.network",
  "address": "0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15",
  "network": "Somnia Testnet",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": {
    "set(uint256)": {
      "runs": [
        {
          "run": 1,
          "args": [42],
          "gasUsed": 43000,
          "mode": "standard",
          "txHash": "0xabc123",
          "blockNumber": 100,
          "costInSTT": "0.00004300",
          "costInWei": "43000000000000000",
          "gasPrice": "1000000000"
        }
      ],
      "aggregated": {
        "min": 28000,
        "max": 43000,
        "avg": 33000,
        "total": 99000,
        "callCount": 3,
        "minCost": 0.00002800,
        "maxCost": 0.00004300,
        "avgCost": 0.00003300,
        "totalCost": 0.00009900
      }
    }
  }
}
```

### CSV Format

Flat format suitable for spreadsheet analysis with cost data:

```csv
function,run,args_json,gas_used,mode,tx_hash,block_number,rpc,cost_stt,cost_wei,gas_price_wei
"set(uint256)",1,"[42]",43000,"standard","0xabc123",100,"https://dream-rpc.somnia.network","0.00004300","43000000000000000","1000000000"
"get()",1,"[]",2300,"standard","0xdef456",101,"https://dream-rpc.somnia.network","0.00000230","2300000000000000","1000000000"
```

### Table Format

Human-readable formatted table with summary statistics including costs:

```
📊 Somnia Gas Profiling Report
─────────────────────────────────────
🌐 Network: Somnia Testnet
🔗 RPC: https://dream-rpc.somnia.network
📋 Contract: 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15
⏰ Timestamp: 1/15/2024, 11:30:00 AM
📈 Sorted by: avg gas

┌──────────────┬──────┬─────────┬─────────┬─────────┬───────────┬──────────────┬──────────────┬──────────────┬───────────────┐
│ Function     │ Runs │ Min Gas │ Max Gas │ Avg Gas │ Total Gas │ Min Cost(STT)│ Max Cost(STT)│ Avg Cost(STT)│ Total Cost(STT)│
├──────────────┼──────┼─────────┼─────────┼─────────┼───────────┼──────────────┼──────────────┼──────────────┼───────────────┤
│ set(uint256) │ 3    │ 28,000  │ 43,000  │ 33,000  │ 99,000    │ 0.00002800   │ 0.00004300   │ 0.00003300   │ 0.00009900    │
│ get()        │ 2    │ 2,300   │ 2,300   │ 2,300   │ 4,600     │ 0.00000230   │ 0.00000230   │ 0.00000230   │ 0.00000460    │
└──────────────┴──────┴─────────┴─────────┴─────────┴───────────┴──────────────┴──────────────┴──────────────┴───────────────┘

📈 Summary Statistics
─────────────────────
Functions profiled: 2
Total transactions: 5
Total gas consumed: 103,600
Average per transaction: 20,720
Total cost: 0.00010360 STT
Average cost per transaction: 0.00002072 STT
```

## Troubleshooting

### Common Issues

**1. "PRIVATE_KEY environment variable is required"**
- Ensure `.env` file contains valid `PRIVATE_KEY`
- Check that the private key has `0x` prefix

**2. "Failed to initialize Somnia connection"**
- Verify RPC URL is accessible
- Check network connectivity
- Ensure Somnia testnet is operational

**3. "Contract validation failed"**
- Verify contract address is correct
- Ensure contract is deployed on the target network
- Check that the ABI matches the deployed contract

**4. "Function not found in ABI"**
- Verify function signature matches exactly
- Check function exists in the provided ABI
- Ensure correct parameter types

**5. "Insufficient balance"**
- Fund the wallet with testnet tokens
- Reduce number of runs or complexity
- Consider using gasless mode for simulation

### Debug Mode

Enable verbose logging for detailed information:

```bash
somnia-gas-profiler analyze \\
  --address 0x123...abc \\
  --abi ./contract.json \\
  --fn "test()" \\
  --verbose
```

### Performance Optimization

**For Large Datasets:**
- Use fewer runs for initial analysis
- Profile functions individually
- Consider gasless mode for complex functions

**For CI/CD:**
- Cache compiled contracts
- Use minimal run counts
- Implement result caching

### Getting Help

- Check the [Examples](./EXAMPLES.md) for common use cases
- Review the [README](./README.md) for project overview
- Open an issue on GitHub for bugs or feature requests

## Best Practices

1. **Start with gasless simulation** for expensive functions
2. **Use multiple runs** (5-10) for accurate averages
3. **Profile before and after optimizations** to measure improvements
4. **Export results to CSV** for detailed analysis in spreadsheets
5. **Use AI summaries** to identify optimization opportunities
6. **Integrate with CI/CD** to track gas usage over time
7. **Document your profiling methodology** for reproducible results

---

For more examples and use cases, see [EXAMPLES.md](./EXAMPLES.md).