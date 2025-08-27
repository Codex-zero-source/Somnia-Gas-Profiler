# Somnia Gas Profiler

Professional gas profiling and analysis tool for Somnia blockchain smart contracts with advanced developer insights and automated ABI fetching.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/somnia/gas-profiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

## 🚀 Features

- **Automated ABI Fetching**: Automatically retrieves contract ABIs from Somnia Explorer
- **Comprehensive Gas Analysis**: Detailed gas consumption profiling for smart contract functions
- **Developer-Focused Insights**: Categorized analysis with optimization recommendations
- **Multiple Output Formats**: JSON, CSV, and table formats for different use cases
- **Gasless Profiling**: Analyze contracts without spending gas using static analysis
- **Cost Calculation**: Automatic STT (Somnia Test Token) cost calculations
- **Production Ready**: Clean, lightweight setup with professional documentation

## 📋 Prerequisites

- **Node.js**: Version 16.0.0 or higher
- **npm**: Latest version recommended
- **Git**: For cloning the repository

## ⚡ Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/somnia/gas-profiler.git
cd gas-profiler

# Install dependencies
npm install

# Verify installation
npm test
```

### Basic Usage

```bash
# Profile a contract by address (auto-fetches ABI)
npm run quick-analyze -- --address 0x1234567890123456789012345678901234567890

# Profile with custom ABI file
npm run analyze -- --address 0x1234... --abi ./path/to/contract.json

# Generate detailed reports
npm run report -- --in ./profiling_results.json --format csv
```

## 🛠️ CLI Commands

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `quick-analyze` | Fast analysis with auto ABI fetching | `npm run quick-analyze -- --address 0x123...` |
| `analyze` | Full contract analysis | `npm run analyze -- --address 0x123... --functions swap,mint` |
| `profile` | Gas profiling with custom parameters | `npm run profile -- --contract ./contract.json` |
| `report` | Generate reports from existing data | `npm run report -- --in results.json --format table` |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--address` | Contract address to analyze | Required |
| `--abi` | Path to ABI file | Auto-fetch |
| `--functions` | Specific functions to profile | All functions |
| `--network` | Network configuration | somnia |
| `--format` | Output format (json/csv/table) | json |
| `--out` | Output file path | Auto-generated |

## 📊 Analysis Features

### Function Categorization
- **Query Functions**: View and read operations
- **Administrative Functions**: Configuration and setup
- **Fee Management**: Fee-related operations
- **State Management**: State-changing operations
- **Other Functions**: Uncategorized functions

### Gas Efficiency Ratings
- **Excellent**: < 50,000 gas
- **Good**: 50,000 - 100,000 gas
- **Moderate**: 100,000 - 500,000 gas
- **High**: 500,000 - 1,000,000 gas
- **Very High**: > 1,000,000 gas

### Output Formats

#### JSON Output
```json
{
  "contract": "0x1234...",
  "network": "Somnia Testnet",
  "results": {
    "functionName": {
      "aggregated": {
        "avg": 85000,
        "min": 80000,
        "max": 90000,
        "total": 850000,
        "callCount": 10
      }
    }
  }
}
```

#### CSV Output
```csv
Function,Average Gas,Min Gas,Max Gas,Total Gas,Calls,Cost (STT)
swap(address,bool,int256,uint160,bytes),85000,80000,90000,850000,10,0.00051000
```

## 🏗️ Project Structure

```
somnia-gas-profiler/
├── cli/                    # Command-line interface
├── lib/                    # Core libraries
│   ├── somnia-abi-fetcher.js    # ABI fetching from Somnia Explorer
│   ├── developer-analyzer.js    # Developer-focused analysis
│   ├── gas-profiler.js          # Main profiling engine
│   └── abi-extractor.js         # ABI processing utilities
├── test/                   # Test suite (mocha/chai)
├── examples/               # Usage examples
├── docs/                   # Documentation
├── contracts/              # Sample contracts
└── scripts/                # Utility scripts
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx mocha test/profiler.spec.js
```

## 📈 Example Workflow

```bash
# 1. Quick analysis of a smart contract
npm run quick-analyze -- --address 0x0162e6f939C58ac4b4FEB4C65E15CB31bd178789

# 2. Generate detailed CSV report
npm run report -- --in profiling_*.json --format csv --out contract-analysis.csv

# 3. Focus on specific functions
npm run analyze -- --address 0x123... --functions "transfer,approve,mint"

# 4. Gasless analysis (no transactions)
npm run analyze -- --address 0x123... --gasless
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Somnia Network Configuration
SOMNIA_RPC_URL=https://somnia-devnet.io
SOMNIA_PRIVATE_KEY=your_private_key_here
SOMNIA_EXPLORER_URL=https://shannon-explorer.somnia.network

# Gas Configuration
DEFAULT_GAS_PRICE=6000000000
DEFAULT_GAS_LIMIT=8000000

# Analysis Configuration
MAX_FUNCTION_CALLS=10
ANALYSIS_TIMEOUT=300000
```

### Network Configuration

The tool supports multiple Somnia network configurations:

- **Somnia Devnet**: Default development network
- **Somnia Testnet**: Public test network
- **Custom RPC**: Configure your own endpoint

## 🔧 Advanced Usage

### Custom ABI Sources

```bash
# Use local ABI file
npm run analyze -- --address 0x123... --abi ./contracts/MyContract.json

# Force verified contract ABI only
npm run analyze -- --address 0x123... --require-verified

# Allow minimal ABI generation
npm run analyze -- --address 0x123... --allow-minimal
```

### Batch Analysis

```bash
# Analyze multiple contracts
npm run analyze -- --batch ./contract-list.json

# Generate comparative report
npm run report -- --compare --in profiling_*.json
```

## 📚 API Reference

### SomniaABIFetcher

```javascript
const { SomniaABIFetcher } = require('./lib/somnia-abi-fetcher');

const fetcher = new SomniaABIFetcher();
const result = await fetcher.fetchAndValidateABI(contractAddress);
```

### DeveloperAnalyzer

```javascript
const { DeveloperAnalyzer } = require('./lib/developer-analyzer');

const analyzer = new DeveloperAnalyzer();
const analysis = analyzer.analyzeGasProfile(profilingData, contractAddress);
```

## 🚨 Troubleshooting

### Common Issues

**ABI Fetch Failed**
```bash
# Check contract verification status
npm run analyze -- --address 0x123... --debug

# Use manual ABI file
npm run analyze -- --address 0x123... --abi ./contract.json
```

**High Gas Usage**
```bash
# Enable gasless mode for large contracts
npm run analyze -- --address 0x123... --gasless

# Limit function calls
npm run analyze -- --address 0x123... --max-calls 5
```

**Network Connection Issues**
```bash
# Check .env configuration
# Verify RPC endpoint accessibility
# Ensure private key has sufficient balance
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/somnia/gas-profiler.git
cd gas-profiler
npm install
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Examples**: [examples/](./examples/)
- **Issues**: [GitHub Issues](https://github.com/somnia/gas-profiler/issues)
- **Discord**: [Somnia Community](https://discord.gg/somnia)

## 🎯 Roadmap

- [ ] Multi-network support
- [ ] Gas optimization suggestions
- [ ] Integration with popular IDEs
- [ ] Historical gas trend analysis
- [ ] Automated CI/CD integration

---

**Made with ❤️ for the Somnia blockchain ecosystem**