# Somnia Gas Profiler

A developer-friendly CLI tool for profiling gas usage of smart contracts deployed on the Somnia testnet.

## Features

- 🔍 **Comprehensive Gas Analysis**: Profile any deployed smart contract with detailed gas metrics
- 📊 **Multiple Output Formats**: JSON, CSV, and formatted table outputs
- 🧠 **AI-Powered Summaries**: Optional natural language analysis using OpenAI
- ⚡ **Somnia Optimized**: Built specifically for Somnia's high-performance testnet
- 🔄 **Batch Profiling**: Run multiple iterations for statistical accuracy
- 📈 **Comparison Tools**: Compare gas usage between different profiling runs

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/somnia/gas-profiler.git
cd gas-profiler

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY
```

### Requirements

- Node.js >= 16.0.0
- Somnia testnet account with ETH for gas fees
- (Optional) OpenAI API key for natural language summaries

### Basic Usage

```bash
# Profile a simple function
npx somnia-gas-profiler analyze \
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \
  --abi ./contracts/SimpleStorage.json \
  --fn "set(uint256)" \
  --args '[42]' \
  --runs 5

# View results as a formatted table
npx somnia-gas-profiler report --format table

# Generate CSV report with AI summary
npx somnia-gas-profiler report \
  --format csv \
  --out gas-report.csv \
  --nl
```

## Commands

### `analyze` - Profile Gas Usage

Profile gas consumption of deployed smart contracts.

```bash
somnia-gas-profiler analyze [options]
```

**Options:**
- `--address <0x...>` - Target contract address (required)
- `--abi <path|json>` - ABI file path or inline JSON (required)
- `--fn <signature>` - Function signature(s) to profile (required, multiple allowed)
- `--args <json>` - Function arguments as JSON arrays
- `--runs <number>` - Number of iterations per function (default: 3)
- `--rpc <url>` - Custom RPC endpoint (default: Somnia testnet)
- `--out <path>` - Output file path (default: profiling_results.json)
- `--gasless` - Enable gasless simulation (experimental)
- `--verbose` - Enable verbose logging

**Examples:**

```bash
# Profile ERC20 transfer function
somnia-gas-profiler analyze \
  --address 0x123... \
  --abi ./ERC20.json \
  --fn "transfer(address,uint256)" \
  --args '["0xabc...", 1000]' \
  --runs 5

# Profile multiple functions with inline ABI
somnia-gas-profiler analyze \
  --address 0x456... \
  --abi '[{"inputs":[],"name":"get","outputs":[{"type":"uint256"}],"type":"function"}]' \
  --fn "get()" \
  --runs 3

# Profile with custom output file
somnia-gas-profiler analyze \
  --address 0x789... \
  --abi ./MyContract.json \
  --fn "mint(address,uint256)" "burn(uint256)" \
  --args '["0xdef...", 100]' '[50]' \
  --out my-analysis.json
```

### `report` - Generate Reports

Generate formatted reports from profiling results.

```bash
somnia-gas-profiler report [options]
```

**Options:**
- `--in <path>` - Input profiling results file (default: profiling_results.json)
- `--format <json|csv|table>` - Output format (default: table)
- `--out <path>` - Output file (optional, defaults to stdout for table)
- `--sort <avg|min|max|total>` - Sort results by metric (default: avg)
- `--nl` - Generate natural language summary (requires OPENAI_API_KEY)
- `--compare <path>` - Compare with another profiling results file
- `--verbose` - Enable verbose logging

**Examples:**

```bash
# Display results as formatted table
somnia-gas-profiler report --format table

# Export to CSV
somnia-gas-profiler report \
  --format csv \
  --out report.csv

# Generate AI-powered summary
somnia-gas-profiler report \
  --nl \
  --sort avg

# Compare two profiling runs
somnia-gas-profiler report \
  --in results1.json \
  --compare results2.json
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Testnet private key
PRIVATE_KEY=your_private_key_here

# Optional: Custom RPC endpoint
RPC_URL=https://dream-rpc.somnia.network

# Optional: OpenAI API key for summaries
OPENAI_API_KEY=your_openai_api_key_here
```

### Network Information

- **Network**: Somnia Shannon Testnet
- **Chain ID**: TBD
- **Default RPC**: `https://dream-rpc.somnia.network`
- **Explorer**: [Somnia Explorer](https://explorer.somnia.network)

## Output Formats

### JSON Format
Raw structured data suitable for programmatic processing:

```json
{
  "rpc": "https://dream-rpc.somnia.network",
  "address": "0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15",
  "network": "Somnia Testnet",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": {
    "transfer(address,uint256)": {
      "runs": [...],
      "aggregated": {
        "min": 41221,
        "max": 42110,
        "avg": 41778,
        "total": 125334,
        "callCount": 3
      }
    }
  }
}
```

### Table Format
Human-readable console output:

```
┌─────────────────────────┬──────┬─────────┬─────────┬─────────┬───────────┐
│ Function                │ Runs │ Min Gas │ Max Gas │ Avg Gas │ Total Gas │
├─────────────────────────┼──────┼─────────┼─────────┼─────────┼───────────┤
│ transfer(address,uint256)│   3  │ 41,221  │ 42,110  │ 41,778  │ 125,334  │
│ approve(address,uint256) │   3  │ 28,890  │ 29,100  │ 28,995  │  86,985  │
└─────────────────────────┴──────┴─────────┴─────────┴─────────┴───────────┘
```

### CSV Format
Spreadsheet-compatible format for detailed analysis.

## Advanced Features

### Gasless Simulation (Experimental)

Test Account Abstraction patterns with gasless transaction simulation:

```bash
somnia-gas-profiler analyze \
  --address 0x123... \
  --abi ./contract.json \
  --fn "myFunction()" \
  --gasless
```

### Comparison Analysis

Compare gas usage between different versions or configurations:

```bash
# Profile version 1
somnia-gas-profiler analyze --out v1-results.json [options]

# Profile version 2  
somnia-gas-profiler analyze --out v2-results.json [options]

# Compare results
somnia-gas-profiler report \
  --in v1-results.json \
  --compare v2-results.json
```

### AI-Powered Analysis

Get intelligent insights about your gas usage patterns:

```bash
# Set OpenAI API key
export OPENAI_API_KEY=your_key_here

# Generate summary with natural language analysis
somnia-gas-profiler report --nl
```

Example AI summary:
> "The `transfer(address,uint256)` function is relatively efficient at ~41k gas, while `mint(address,uint256)` is more expensive at ~53k. The `get()` read function is the cheapest at ~25k gas. Consider batching multiple transfers to optimize gas costs for frequent operations."

## Development

### Project Structure

```
somnia-gas-profiler/
├── cli/index.js          # CLI entry point
├── profiler/index.js     # Core profiling logic
├── reporter/index.js     # Report generation
├── test/                 # Test suites
├── examples/             # Example contracts and usage
└── docs/                 # Additional documentation
```

### Testing

```bash
# Run test suite
npm test

# Run with coverage
npm run test:coverage

# Test specific functionality
npm test -- --grep "profiler"
```

## Troubleshooting

### Common Issues

**"Failed to initialize Somnia connection"**
- Check your RPC endpoint is accessible
- Verify network connectivity
- Ensure Somnia testnet is operational

**"Contract validation failed"**
- Verify the contract address is correct
- Ensure the contract is deployed on Somnia testnet
- Check that the ABI matches the deployed contract

**"Function not found in ABI"**
- Verify function signature format: `functionName(param1Type,param2Type)`
- Ensure the function exists in the provided ABI
- Check for typos in function names or parameter types

**"Insufficient funds for gas"**
- Ensure your wallet has enough testnet ETH
- Get testnet ETH from [Somnia Faucet](https://faucet.somnia.network)

### Getting Help

- 📖 [Full Documentation](https://docs.somnia.network/tools/gas-profiler)
- 🐛 [Report Issues](https://github.com/somnia/gas-profiler/issues)
- 💬 [Discord Community](https://discord.gg/somnia)
- 📧 [Support Email](mailto:support@somnia.network)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the Somnia ecosystem