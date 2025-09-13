# Somnia Gas Profiler v1.0 - Usage Guide

The Somnia Gas Profiler provides powerful tools for analyzing smart contract gas usage with minimal input requirements and intelligent contract analysis.

## 🚀 Quick Start

### Installation
```
npm install -g somnia-gas-profiler
# or
git clone https://github.com/Codex-zero-source/Somnia-Gas-Profiler.git
cd Somnia-Gas-Profiler
npm install

```

### Environment Setup
```
cp .env.example .env
# Edit .env and add your configuration

```

**Required:**
- `PRIVATE_KEY`: Test wallet private key (for gasless simulation and deployment)

### Basic Usage
```
# Profile a deployed contract (auto-detect ABI)
somnia-gas-profiler quick-analyze --address 0x123...

# Profile from bytecode
somnia-gas-profiler profile --bytecode 0x608060...

# Compile and profile
somnia-gas-profiler compile-and-profile --source MyContract.sol

```


## 📋 Command Reference

### 1. Enhanced Profile Command

One-command profiling with automatic analysis for any input type.

```
somnia-gas-profiler profile [options]

```

**Input Options (choose one):**
- `--address <0x...>`: Deployed contract address
- `--bytecode <0x...>`: Contract bytecode
- `--source <file.sol>`: Solidity source file
- `--code <\"contract...\">`: Inline Solidity code

**Additional Options:**
- `--abi <file.json>`: ABI file (optional for bytecode/source)
- `--runs <number>`: Profiling iterations per function (default: 1)
- `--output <file>`: Output file path
- `--gasless`: Enable gasless simulation
- `--verbose`: Detailed logging

**Examples:**
```
# Profile deployed ERC20 token
somnia-gas-profiler profile \
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \
  --abi ./ERC20.json \
  --runs 5

# Profile from bytecode with auto-ABI detection
somnia-gas-profiler profile \
  --bytecode 0x608060405234801561001057600080fd5b50... \
  --runs 3

# Profile simple contract from source
somnia-gas-profiler profile \
  --source ./contracts/SimpleStorage.sol \
  --contract-name SimpleStorage

# Profile inline contract code
somnia-gas-profiler profile \
  --code \"contract Test { function get() public pure returns (uint256) { return 42; } }\"

```


### 2. Compile-and-Profile Command

Compile Solidity contracts and immediately profile them.

```
somnia-gas-profiler compile-and-profile [options]

```

**Required (choose one):**
- `--source <file.sol>`: Solidity source file
- `--code <\"contract...\">`: Inline Solidity code

**Compilation Options:**
- `--optimization-runs <number>`: Solidity optimizer runs (default: 200)
- `--solc-version <version>`: Solidity version (default: 0.8.19)
- `--via-ir`: Enable compilation via IR
- `--contract-name <name>`: Contract name (auto-detected)

**Profiling Options:**
- `--runs <number>`: Profiling iterations (default: 1)
- `--gasless`: Gasless simulation
- `--output <file>`: Output file path

**Examples:**
```
# Compile and profile with high optimization
somnia-gas-profiler compile-and-profile \
  --source ./contracts/OptimizedToken.sol \
  --optimization-runs 1000 \
  --runs 5

# Profile inline contract with IR compilation
somnia-gas-profiler compile-and-profile \
  --code \"contract Advanced { ... }\" \
  --via-ir \
  --solc-version 0.8.20

# Quick compilation and profiling
somnia-gas-profiler compile-and-profile \
  --source ./MyContract.sol

```


### 3. Quick-Analyze Command

Fast analysis of deployed contracts with intelligent defaults.

```
somnia-gas-profiler quick-analyze --address <0x...> [options]

```

**Required:**
- `--address <0x...>`: Contract address

**ABI Detection:**
- `--abi <file.json>`: Explicit ABI file
- `--standard <ERC20|ERC721|ERC1155>`: Use standard ABI
- `--allow-minimal`: Generate minimal ABI from bytecode

**Function Selection:**
- `--functions <sigs...>`: Specific functions to profile
- `--view-only`: Profile only view/pure functions
- `--state-only`: Profile only state-changing functions
- `--max-functions <number>`: Maximum functions to profile (default: 10)

**Speed Options:**
- `--quick`: Ultra-fast mode (fewer functions, fewer runs)
- `--runs <number>`: Iterations per function (default: 1)
- `--skip-ai`: Skip AI analysis

**Examples:**
```
# Quick ERC20 token analysis
somnia-gas-profiler quick-analyze \
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \
  --standard ERC20

# Ultra-fast analysis with specific functions
somnia-gas-profiler quick-analyze \
  --address 0x123... \
  --functions \"transfer(address,uint256)\" \"balanceOf(address)\" \
  --quick

# Analysis with custom ABI
somnia-gas-profiler quick-analyze \
  --address 0x456... \
  --abi ./custom-abi.json \
  --view-only

# Minimal ABI generation from bytecode
somnia-gas-profiler quick-analyze \
  --address 0x789... \
  --allow-minimal \
  --max-functions 5

```


### 4. Enhanced Report Command

Generate comprehensive reports with multiple output formats.

```
somnia-gas-profiler report --in <results.json> [options]

```

**Output Formats:**
- `--format table`: Console table (default)
- `--format csv`: CSV export
- `--format json`: JSON export
- `--out <file>`: Output file path

**Analysis Options:**
- `--sort <avg|min|max|total>`: Sort results
- `--compare <file2.json>`: Compare with another result

**Examples:**
```
# Generate table with developer analysis
somnia-gas-profiler report \
  --in profiling_results.json \
  --format table

# Export to Excel-compatible CSV
somnia-gas-profiler report \
  --in results.json \
  --format csv \
  --out analysis_report.csv

# Compare two profiling runs
somnia-gas-profiler report \
  --in before_optimization.json \
  --compare after_optimization.json

```


## 🔧 Advanced Features

### Automatic Contract Type Detection

The profiler automatically detects common contract patterns:
- **ERC20**: Token contracts
- **ERC721**: NFT contracts  
- **ERC1155**: Multi-token contracts
- **Proxy**: Upgradeable contracts
- **MultiSig**: Multi-signature wallets
- **DeFi**: DeFi protocols
- **Custom**: Other contracts

### Smart Argument Generation

Automatically generates realistic test arguments based on:
- Function parameter types
- Contract type patterns
- Common usage scenarios
- Solidity best practices

### Intelligent Contract Analysis

Provides automated contract analysis including:
- Contract type detection (ERC20, ERC721, DeFi, etc.)
- Smart argument generation based on contract state
- Gas optimization recommendations
- Cost analysis and projections
- Access control pattern recognition

### Multi-Format Output

**JSON Output:**
- Complete profiling data
- Aggregated statistics
- Cost calculations
- Metadata and timestamps

**CSV Output:**
- Excel-compatible format
- Per-transaction details
- Aggregated summaries
- Cost breakdown

**Enhanced Tables:**
- Color-coded efficiency ratings
- Cost information
- Optimization suggestions
- Comparative analysis

## 🎯 Best Practices

### Development Workflow

1. **Initial Analysis:**
   ```
   somnia-gas-profiler compile-and-profile --source MyContract.sol
   ```

2. **Optimization Testing:**
   ```
   somnia-gas-profiler compile-and-profile \
     --source MyContract.sol \
     --optimization-runs 1000 \
     --output optimized_results.json
   ```

3. **Comparison:**
   ```
   somnia-gas-profiler report \
     --in original_results.json \
     --compare optimized_results.json
   ```

4. **Production Check:**
   ```
   somnia-gas-profiler quick-analyze \
     --address 0x... \
     --abi production_abi.json
   ```

### Performance Tips

- Use `--quick` for rapid iteration
- Enable `--gasless` for expensive operations
- Set appropriate `--runs` based on gas variance
- Use `--max-functions` to focus on key functions
- Enable `--verbose` for debugging

### Cost Optimization

- Compare different optimization levels
- Test with various Solidity versions
- Use IR compilation (`--via-ir`) for complex contracts
- Monitor gas usage patterns over time
- Implement batch operations for repetitive calls

## 🔍 Troubleshooting

### Common Issues

**\"No ABI found\"**
- Provide explicit `--abi` file
- Use `--standard` for known contract types
- Enable `--allow-minimal` for bytecode analysis

**\"Compilation failed\"**
- Check Solidity version with `--solc-version`
- Verify contract syntax
- Install required compilation tools (Foundry/Hardhat)

**\"Analysis failed\"**
- Check contract address validity
- Verify ABI format and completeness
- Try using `--allow-minimal` for bytecode analysis

**\"Contract not found\"**
- Verify contract address
- Check network connection
- Ensure contract is deployed on Somnia testnet

### Debug Mode

```
# Enable verbose logging
somnia-gas-profiler profile --address 0x... --verbose

# Check available compilation tools
somnia-gas-profiler compile-and-profile --source test.sol --verbose

```


## 📊 Output Examples

See the `sample-outputs/` directory for:
- Enhanced CSV reports
- AI analysis examples
- Comparison reports
- Cost breakdown examples

---
*For more information, visit the [Somnia Documentation](https://docs.somnia.network/) or check the [GitHub repository](https://github.com/Codex-zero-source/Somnia-Gas-Profiler).*

