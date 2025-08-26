# IO.net Enhanced Somnia Gas Profiler v2.0-scalable
# Somnia Gas Profiler v2.0

A high-performance developer tool that takes **minimal input** (contract bytecode OR deployed address) and provides comprehensive gas profiling with **AI-powered insights** via IO.net Intelligence API.

## 🌟 What's New in v2.0

- **🤖 IO.net AI Integration**: Natural language analysis powered by DeepSeek-R1-0528
- **📝 Bytecode Processing**: Profile contracts directly from bytecode with auto-ABI detection
- **🔧 Source Compilation**: Compile and profile Solidity contracts in one command
- **⚡ Quick Analysis**: Ultra-fast analysis with intelligent defaults
- **📊 Enhanced CSV Output**: Comprehensive reports with aggregated statistics
- **🎯 Smart Arguments**: Automatic test argument generation for common patterns
- **🔍 Contract Detection**: Auto-detect ERC20, ERC721, DeFi, and other contract types

## ✨ Key Features

- **🚀 Minimal Input Requirements**: Just bytecode or address - everything else is automatic
- **🧠 AI-Powered Analysis**: Get optimization recommendations and cost insights
- **📦 Multiple Input Types**: Bytecode, deployed addresses, source files, or inline code
- **🎯 Automatic Detection**: Contract types, function signatures, and test arguments
- **📈 Enhanced Reporting**: CSV, JSON, and interactive table formats
- **⚡ Performance Optimized**: Built for speed with intelligent caching
- **🌐 Somnia Native**: Optimized for Somnia's high-performance network


## 🚀 Quick Start

### Installation

```bash
# Clone the enhanced repository
git clone https://github.com/Codex-zero-source/Somnia-Gas-Profiler.git
cd Somnia-Gas-Profiler

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY and IOINTELLIGENCE_API_KEY
```

### Requirements

- Node.js >= 16.0.0
- Somnia testnet account with ETH for gas fees
- **IO.net API key** for AI-powered analysis ([Get yours here](https://io.net))
- (Optional) Foundry/Hardhat for source compilation

### Ultra-Quick Usage

```bash
# Profile any deployed contract (auto-detects everything)
somnia-gas-profiler quick-analyze --address 0x742d35Cc... --standard ERC20

# Profile from bytecode
somnia-gas-profiler profile --bytecode 0x608060405234...

# Compile and profile in one command
somnia-gas-profiler compile-and-profile --source MyContract.sol

# Profile inline contract
somnia-gas-profiler profile --code "contract Test { function get() public pure returns (uint256) { return 42; } }"
```

## 🎯 Enhanced Commands

### `profile` - One-Command Profiling (NEW)

Profile any contract with minimal input and automatic analysis.

```bash
somnia-gas-profiler profile [input-option] [options]
```

**Input Options (choose one):**
- `--address <0x...>` - Deployed contract address
- `--bytecode <0x...>` - Contract bytecode (auto-deploys)
- `--source <file.sol>` - Solidity source file (auto-compiles)
- `--code <"contract...">` - Inline Solidity code

**Features:**
- 🤖 **Automatic ABI detection** from multiple sources
- 🎯 **Smart argument generation** based on contract type
- 📊 **Automatic CSV export** with aggregated statistics
- 🧠 **AI analysis** via IO.net (if configured)

**Examples:**
```bash
# Profile deployed ERC20 with auto-detection
somnia-gas-profiler profile --address 0x123... --runs 5

# Profile from bytecode
somnia-gas-profiler profile --bytecode 0x608060405234801561001...

# Compile and profile source
somnia-gas-profiler profile --source ./MyToken.sol
```

### `compile-and-profile` - Solidity Workflow (NEW)

Compile Solidity contracts and immediately profile them.

```bash
somnia-gas-profiler compile-and-profile [source-option] [options]
```

**Source Options:**
- `--source <file.sol>` - Solidity source file
- `--code <"contract...">` - Inline Solidity code

**Compilation Options:**
- `--optimization-runs <number>` - Optimizer runs (default: 200)
- `--solc-version <version>` - Solidity version (default: 0.8.19)
- `--via-ir` - Enable IR compilation

**Examples:**
```bash
# High optimization compilation
somnia-gas-profiler compile-and-profile \
  --source ./OptimizedContract.sol \
  --optimization-runs 1000 \
  --runs 10

# IR compilation for complex contracts
somnia-gas-profiler compile-and-profile \
  --source ./Advanced.sol \
  --via-ir \
  --solc-version 0.8.21
```

### `quick-analyze` - Fast Analysis (NEW)

Ultra-fast analysis of deployed contracts with intelligent defaults.

```bash
somnia-gas-profiler quick-analyze --address <0x...> [options]
```

**Smart Features:**
- 🕵️ **Auto-ABI detection** from multiple sources
- 🎯 **Contract type detection** (ERC20, ERC721, DeFi, etc.)
- ⚡ **Quick mode** for rapid iteration
- 🔍 **Function filtering** (view-only, state-only)

**Examples:**
```bash
# Quick ERC20 analysis
somnia-gas-profiler quick-analyze \
  --address 0x123... \
  --standard ERC20

# Ultra-fast mode
somnia-gas-profiler quick-analyze \
  --address 0x456... \
  --quick \
  --max-functions 5

# Focus on expensive operations
somnia-gas-profiler quick-analyze \
  --address 0x789... \
  --state-only \
  --runs 10
```

### `analyze` - Legacy Analysis (Enhanced)

Original command enhanced with new features.

```bash
somnia-gas-profiler analyze [options]
```

### `report` - Enhanced Reports

Generate comprehensive reports from profiling results.

```bash
somnia-gas-profiler report [options]
```

**New Features:**
- 🧠 **IO.net AI integration** with `--nl` option
- 📊 **Enhanced CSV format** with aggregated statistics
- 📈 **Comparison analysis** with efficiency ratings
- 💰 **Cost analysis** when STT cost data available

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# REQUIRED: Testnet private key
PRIVATE_KEY=your_private_key_here

# REQUIRED: IO.net Intelligence API key for AI analysis
IOINTELLIGENCE_API_KEY=your_io_net_api_key_here

# Optional: Custom RPC endpoint
RPC_URL=https://dream-rpc.somnia.network

# Optional: Compilation tool paths
FOUNDRY_PATH=/path/to/foundry
DEFAULT_OPTIMIZATION_RUNS=200

# Legacy: OpenAI API key (use IO.net instead)
OPENAI_API_KEY=your_openai_api_key_here
```

### IO.net Setup

1. Get your API key from [IO.net](https://io.net)
2. Add to `.env`: `IOINTELLIGENCE_API_KEY=your_key_here`
3. Verify: `somnia-gas-profiler quick-analyze --address 0x123... --standard ERC20`

See [docs/io-net-setup.md](docs/io-net-setup.md) for detailed setup instructions.

### Network Information

- **Network**: Somnia Shannon Testnet
- **Chain ID**: 50312
- **Default RPC**: `https://dream-rpc.somnia.network`
- **Explorer**: [Somnia Explorer](https://explorer.somnia.network)
- **Native Token**: STT (Somnia Test Token)
- **Current Gas Price**: ~6 gwei (live fetched)
- **Gas Price Source**: Real-time from blockchain via ethers.js

### Live Gas Price & STT Conversion

🔄 **Real-Time Pricing**: Gas prices are fetched live from the Somnia network
💰 **STT Cost Calculation**: `cost_in_stt = ethers.formatEther(gas_used * gas_price)`
📈 **Precision**: 8 decimal places for accurate cost tracking
⚡ **Live Updates**: Costs adjust automatically with network conditions

## 📊 Enhanced Output Formats

### AI-Powered Analysis

Get intelligent insights powered by IO.net Intelligence API:

```
🧠 AI Gas Analysis Summary
─────────────────────────────────────────────────────────
This ERC20 token contract demonstrates excellent gas efficiency 
with consistent performance patterns. The transferFrom function 
shows the highest gas usage due to additional allowance checks, 
while view functions are optimally implemented.

OPTIMIZATION OPPORTUNITIES:
1. Consider implementing batch transfer functionality
2. Review storage layout for gas-efficient access patterns
3. Optimize event emission for cost reduction

COST ANALYSIS:
- Average transaction cost: 0.00003456 STT
- Most expensive: transferFrom (0.00004123 STT)
- Most efficient: balanceOf (0.00001234 STT)
```

### Enhanced CSV Format

Comprehensive CSV output with aggregated statistics:

```csv
"function_signature","run_number","gas_used","cost_stt","efficiency_rating"
"transfer(address,uint256)","1","51234","0.00030740","Good"
"transfer(address,uint256)","2","51456","0.00030874","Good"

"=== AGGREGATED STATISTICS ==="
"function_signature","total_runs","avg_gas","avg_cost_stt","efficiency_rating"
"transfer(address,uint256)","3","51345","0.00030807","Good"
```

## 🤖 AI Features

### IO.net Intelligence Integration

Powered by DeepSeek-R1-0528 model for advanced analysis:

- **Gas Optimization Recommendations**: Specific code improvements
- **Cost Analysis**: STT token cost projections and budgeting
- **Best Practices**: Solidity optimization patterns
- **Production Readiness**: Deployment and scaling insights
- **Security Considerations**: Gas-related security patterns

### Analysis Types

- **Basic Analysis**: General efficiency assessment
- **Optimization Focus**: Specific improvement opportunities  
- **Cost Analysis**: Detailed STT cost breakdown
- **Comparison Analysis**: Before/after optimization insights
- **Deployment Analysis**: Production readiness assessment

### Automatic Features

- **Contract Type Detection**: ERC20, ERC721, DeFi, Proxy, MultiSig
- **Smart Argument Generation**: Realistic test data for functions
- **ABI Auto-Detection**: From bytecode metadata, verification services
- **Function Classification**: View vs state-changing operations
- **Gas Efficiency Rating**: Automatic performance scoring

## 🎯 Advanced Workflows

### Development Cycle

```bash
# 1. Initial analysis during development
somnia-gas-profiler compile-and-profile --source MyContract.sol --output initial.json

# 2. Optimize and recompile
somnia-gas-profiler compile-and-profile --source MyContract.sol --optimization-runs 1000 --output optimized.json

# 3. Compare results
somnia-gas-profiler report --in initial.json --compare optimized.json

# 4. Get AI recommendations
somnia-gas-profiler report --in optimized.json --nl
```

### Multi-Contract Analysis

```bash
# Analyze entire project
for contract in contracts/*.sol; do
  echo "Analyzing $contract"
  somnia-gas-profiler compile-and-profile --source "$contract" --output "analysis_$(basename $contract .sol).json"
done
```

### CI/CD Integration

```yaml
# .github/workflows/gas-analysis.yml
- name: Gas Analysis
  env:
    PRIVATE_KEY: ${{ secrets.TEST_PRIVATE_KEY }}
    IOINTELLIGENCE_API_KEY: ${{ secrets.IO_NET_API_KEY }}
  run: |
    somnia-gas-profiler compile-and-profile --source contracts/MyContract.sol
```

## 📚 Documentation

- **[USAGE.md](USAGE.md)** - Comprehensive usage guide
- **[EXAMPLES.md](EXAMPLES.md)** - Detailed examples for all scenarios
- **[docs/io-net-setup.md](docs/io-net-setup.md)** - IO.net API configuration
- **[sample-outputs/](sample-outputs/)** - Example CSV and analysis outputs

## 🔧 Development

### Project Structure

```
somnia-gas-profiler/
├── cli/
│   ├── index.js              # Main CLI entry
│   ├── profile.js            # Enhanced profile command
│   ├── compile-and-profile.js # Compilation workflow
│   └── quick-analyze.js      # Fast analysis
├── lib/
│   ├── io-net-client.js      # IO.net API integration
│   ├── bytecode-processor.js # Bytecode handling
│   ├── contract-compiler.js  # Solidity compilation
│   ├── abi-extractor.js      # ABI detection
│   ├── csv-exporter.js       # Enhanced CSV export
│   └── nl-analyzer.js        # Natural language analysis
├── profiler/index.js         # Core profiling logic
├── reporter/index.js         # Report generation
├── sample-outputs/           # Example outputs
└── docs/                     # Documentation
```

### Enhanced NPM Scripts

```bash
npm run profile              # Enhanced profile command
npm run compile-and-profile  # Compilation workflow
npm run quick-analyze        # Fast analysis
npm test                     # Run test suite
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

- 📖 [Enhanced Documentation](USAGE.md)
- 🤖 [IO.net Setup Guide](docs/io-net-setup.md) 
- 📝 [Examples & Recipes](EXAMPLES.md)
- 🐛 [Report Issues](https://github.com/Codex-zero-source/Somnia-Gas-Profiler/issues)
- 💬 [Somnia Discord](https://discord.gg/somnia)
- 📧 [Support Email](mailto:support@somnia.network)

## 🚀 Roadmap

- **Phase P5**: Comprehensive testing & benchmarks
- **Future**: Multi-network support, advanced AI models
- **Integration**: IDE plugins, browser extensions
- **Analytics**: Historical gas tracking, trend analysis

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Somnia Gas Profiler v2.0** - Built with ❤️ for developers, powered by AI, optimized for Somnia.

*Achieve gas optimization excellence with minimal effort.*