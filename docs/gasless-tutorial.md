# Gasless Mode Tutorial and Best Practices Guide

## 🚀 Introduction to Gasless Mode

Gasless mode in the Somnia Gas Profiler enables transaction simulation without actual blockchain execution. This powerful feature allows you to:

- **Analyze gas costs** without spending actual tokens
- **Test contract interactions** with intelligent argument generation
- **Optimize contract functions** before deployment
- **Analyze smart contracts** with enhanced state analysis
- **Batch process multiple contracts** efficiently

### Enhanced Analysis Features

The profiler provides advanced contract analysis including:
- **Contract State Analysis**: Intelligent examination of contract storage
- **Argument Generation**: Context-aware test data creation
- **Access Control Detection**: Identifies permission patterns
- **Multi-Sender Testing**: Tests with different caller addresses
- **Fallback Strategies**: Multiple simulation approaches

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Gasless Simulation](#basic-gasless-simulation)
3. [Auto-Detection Features](#auto-detection-features)
4. [Paymaster Integration](#paymaster-integration)
5. [Advanced Simulation Modes](#advanced-simulation-modes)
6. [Batch Processing](#batch-processing)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Real-World Examples](#real-world-examples)

## 🎯 Getting Started

### Prerequisites

```bash
# Install the Somnia Gas Profiler
npm install -g somnia-gas-profiler

# Set up environment variables
export RPC_URL=\"https://dream-rpc.somnia.network\"
export PRIVATE_KEY=\"your_private_key_here\"  # Optional for gasless mode
```

### Quick Start

```bash
# Basic gasless simulation
somnia-gas-profiler analyze \\n  --address 0xYourContract123... \\n  --abi ./contract.json \\n  --fn \"transfer(address,uint256)\" \\n  --gasless
```

## 🔄 Basic Gasless Simulation

### When to Use Gasless Mode

Gasless mode is automatically enabled when:
- ABIs have fewer than 5 functions
- Function names are generic (e.g., `function_0`, `unknown_method`)
- Type information is missing or incomplete
- You're working with bytecode-derived ABIs

### Manual Gasless Activation

```bash
# Force gasless mode
somnia-gas-profiler analyze \\n  --address 0xContract123... \\n  --abi '[{\"type\":\"function\",\"name\":\"get\",\"outputs\":[{\"type\":\"uint256\"}]}]' \\n  --fn \"get()\" \\n  --force-gasless
```

### Understanding Simulation Results

```json
{
  \"functionSignature\": \"transfer(address,uint256)\",
  \"runs\": [
    {
      \"run\": 1,
      \"gasUsed\": 65432,
      \"mode\": \"gasless_estimate\",
      \"paymasterUsed\": false,
      \"confidence\": 85
    }
  ],
  \"aggregated\": {
    \"avg\": 65432,
    \"min\": 65000,
    \"max\": 66000
  }
}
```

## 🤖 Auto-Detection Features

### Minimal ABI Detection

The profiler automatically detects when gasless mode would be beneficial:

```javascript
// This ABI triggers auto-gasless mode
const minimalABI = [
  {\"type\": \"function\", \"name\": \"get\"},  // Missing inputs/outputs
  {\"type\": \"function\", \"name\": \"function_0\"}  // Generic name
];
```

### Confidence Scoring

Simulation results include confidence scores:
- **90-100%**: High confidence, results very reliable
- **70-89%**: Good confidence, minor uncertainties
- **50-69%**: Moderate confidence, use with caution
- **<50%**: Low confidence, consider alternative methods

## 💰 Paymaster Integration

### Discovering Paymasters

```bash
# Find available paymasters on Somnia
somnia-gas-profiler discover-paymasters \\n  --limit 10 \\n  --validate \\n  --output paymasters.json
```

### Validating Paymasters

```bash
# Detailed paymaster validation
somnia-gas-profiler validate-paymaster 0xPaymaster123... \\n  --detailed \\n  --test-gas \\n  --output validation-report.json
```

### Paymaster-Sponsored Simulation

```bash
# Simulate with paymaster sponsorship
somnia-gas-profiler analyze \\n  --address 0xContract123... \\n  --abi ./contract.json \\n  --fn \"mint(uint256)\" \\n  --args '[1000]' \\n  --gasless \\n  --paymaster 0xPaymaster456... \\n  --simulation-mode paymaster
```

### Understanding Paymaster Types

1. **Sponsorship Paymaster**: Pays gas for all users
2. **Token Paymaster**: Users pay with ERC-20 tokens
3. **Verifying Paymaster**: Requires signature verification
4. **Conditional Paymaster**: Pays based on conditions
5. **Staking Paymaster**: Requires user staking

## ⚙️ Advanced Simulation Modes

### Available Modes

```bash
# Different simulation modes
--simulation-mode auto        # Automatically choose best method
--simulation-mode estimate     # Use estimateGas calls
--simulation-mode staticCall   # Static calls for view functions
--simulation-mode trace        # Debug tracing (requires node support)
--simulation-mode debug        # Enhanced debugging
--simulation-mode paymaster    # Paymaster-specific simulation
```

### Mode Selection Guidelines

- **`auto`**: Best for most use cases, adapts automatically
- **`estimate`**: Fastest, good for simple functions
- **`staticCall`**: Perfect for view/pure functions
- **`trace`**: Most accurate but requires debug-enabled node
- **`paymaster`**: Required for paymaster cost analysis

### Fallback Strategies

The profiler implements intelligent fallbacks:

```
Primary Mode → Fallback 1 → Fallback 2 → Conservative Estimate
     ↓              ↓             ↓              ↓
  trace         estimate    staticCall    fixed_values
```

## 📦 Batch Processing

### Configuration File

Create a batch configuration file `batch-config.json`:

```json
{
  \"contracts\": [
    {
      \"name\": \"ERC20Token\",
      \"address\": \"0x123...\",
      \"abi\": \"./ERC20.json\",
      \"functions\": [\"transfer(address,uint256)\", \"balanceOf(address)\"],
      \"runs\": 5,
      \"gasless\": true,
      \"paymaster\": \"0x456...\"
    },
    {
      \"name\": \"NFTContract\",
      \"address\": \"0x789...\",
      \"abi\": \"./ERC721.json\",
      \"functions\": [\"mint(address,uint256)\", \"transferFrom(address,address,uint256)\"],
      \"runs\": 3,
      \"gasless\": true
    }
  ]
}
```

### Running Batch Processing

```bash
# Process multiple contracts in parallel
somnia-gas-profiler batch-gasless \\n  --config ./batch-config.json \\n  --parallel 5 \\n  --output-dir ./batch-results \\n  --continue-on-error
```

### Batch Results Analysis

```bash
# Results are saved to individual files and summary
./batch-results/
├── batch-results.json        # Summary of all results
├── erc20token_results.json   # Individual contract results
├── nftcontract_results.json
└── failed-contracts.log      # Any failures (if any)
```

## 🎯 Best Practices

### 1. ABI Preparation

```javascript
// ✅ Good: Complete ABI with all necessary information
{
  \"type\": \"function\",
  \"name\": \"transfer\",
  \"inputs\": [
    {\"name\": \"to\", \"type\": \"address\"},
    {\"name\": \"amount\", \"type\": \"uint256\"}
  ],
  \"outputs\": [{\"name\": \"\", \"type\": \"bool\"}],
  \"stateMutability\": \"nonpayable\"
}

// ❌ Poor: Minimal ABI (will trigger gasless auto-detection)
{
  \"type\": \"function\",
  \"name\": \"transfer\"
}
```

### 2. Function Argument Handling

```bash
# ✅ Proper argument formatting
--args '[\"0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13\", \"1000000000000000000\"]'

# ❌ Incorrect (will cause errors)
--args '[0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13, 1000000000000000000]'
```

### 3. Simulation Mode Selection

```bash
# For view functions
--simulation-mode staticCall

# For state-changing functions
--simulation-mode estimate

# For paymaster analysis
--simulation-mode paymaster

# When unsure
--simulation-mode auto
```

### 4. Performance Optimization

```bash
# Use caching for repeated calls
--gasless --use-cache

# Reduce runs for quick analysis
--runs 1

# Batch process for multiple contracts
batch-gasless --parallel 3
```

### 5. Error Handling

```bash
# Continue processing despite errors
--continue-on-error

# Enable verbose logging for debugging
--verbose

# Save results even if some fail
--output results.json
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. \"Function not found\" Error

```bash
# Problem: Function signature doesn't match ABI
# Solution: Check function signature format

# ❌ Wrong
--fn \"transfer\"

# ✅ Correct
--fn \"transfer(address,uint256)\"
```

#### 2. Low Confidence Scores

```bash
# Problem: Simulation uncertainty
# Solutions:

# Try different simulation mode
--simulation-mode trace

# Use more detailed ABI
--abi ./complete-abi.json

# Increase gas limit estimate
--gas-limit 500000
```

#### 3. Paymaster Validation Failures

```bash
# Check paymaster status first
somnia-gas-profiler validate-paymaster 0xPaymaster123... --detailed

# Common issues:
# - Insufficient paymaster balance
# - Non-EIP-4337 compliant contract
# - Network connectivity issues
```

#### 4. Batch Processing Failures

```bash
# Enable error continuation
--continue-on-error

# Check individual contract results
cat ./batch-results/failed-contracts.log

# Reduce parallel workers
--parallel 1
```

### Debug Mode

```bash
# Enable maximum debugging
somnia-gas-profiler analyze \\n  --address 0xContract123... \\n  --abi ./contract.json \\n  --fn \"problematicFunction()\" \\n  --gasless \\n  --simulation-mode debug \\n  --verbose
```

## 🌟 Real-World Examples

### Example 1: ERC-20 Token Analysis

```bash
# Analyze popular ERC-20 token functions
somnia-gas-profiler analyze \\n  --address 0xA0b86a33E6441b4aC029B3a0a8efb0bb8f2EaBFc \\n  --standard ERC20 \\n  --fn \"transfer(address,uint256)\" \"approve(address,uint256)\" \"transferFrom(address,address,uint256)\" \\n  --args '[\"0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13\", \"1000000000000000000\"]' \\n       '[\"0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13\", \"1000000000000000000\"]' \\n       '[\"0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13\", \"0x123...\", \"1000000000000000000\"]' \\n  --gasless \\n  --runs 5 \\n  --output erc20-analysis.json
```

### Example 2: NFT Contract with Paymaster

```bash
# Simulate NFT minting with paymaster sponsorship
somnia-gas-profiler analyze \\n  --address 0xNFTContract789... \\n  --abi './NFT.json' \\n  --fn \"mint(address,uint256)\" \"setApprovalForAll(address,bool)\" \\n  --args '[\"0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13\", 1]' \\n       '[\"0x742E5eaD7ABCE964A3c8a80a50Ef5b3cD5c4BD13\", true]' \\n  --gasless \\n  --paymaster 0xNFTPaymaster456... \\n  --simulation-mode paymaster \\n  --output nft-paymaster-analysis.json
```

### Example 3: DeFi Protocol Analysis

```bash
# Analyze complex DeFi operations
somnia-gas-profiler analyze \\n  --address 0xDeFiProtocol123... \\n  --abi './DeFiProtocol.json' \\n  --fn \"stake(uint256)\" \"unstake(uint256)\" \"claimRewards()\" \\n  --args '[\"1000000000000000000\"]' '[\"500000000000000000\"]' '[]' \\n  --gasless \\n  --simulation-mode trace \\n  --runs 3 \\n  --output defi-analysis.json
```

### Example 4: Batch Analysis of Multiple DEXs

Create `dex-batch.json`:
```json
{
  \"contracts\": [
    {
      \"name\": \"Uniswap_V2_Router\",
      \"address\": \"0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D\",
      \"abi\": \"./uniswap-v2-router.json\",
      \"functions\": [\"swapExactTokensForTokens(uint256,uint256,address[],address,uint256)\"],
      \"runs\": 3,
      \"gasless\": true
    },
    {
      \"name\": \"SushiSwap_Router\",
      \"address\": \"0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F\",
      \"abi\": \"./sushiswap-router.json\",
      \"functions\": [\"swapExactTokensForTokens(uint256,uint256,address[],address,uint256)\"],
      \"runs\": 3,
      \"gasless\": true
    }
  ]
}
```

```bash
# Compare gas costs across DEXs
somnia-gas-profiler batch-gasless \\n  --config ./dex-batch.json \\n  --parallel 2 \\n  --output-dir ./dex-comparison
```

### Example 5: Paymaster Cost Analysis

```bash
# Comprehensive paymaster cost analysis
somnia-gas-profiler analyze \\n  --address 0xContract123... \\n  --abi './contract.json' \\n  --fn \"expensiveFunction(uint256,bytes)\" \\n  --args '[1000, \"0x1234567890abcdef\"]' \\n  --gasless \\n  --paymaster 0xPaymaster456... \\n  --runs 10

# Then analyze paymaster costs
node -e \"
const { PaymasterUtils } = require('./utils/paymaster');
const { ethers } = require('ethers');

async function analyzeCosts() {
  const provider = new ethers.JsonRpcProvider('https://dream-rpc.somnia.network');
  const utils = new PaymasterUtils(provider);
  
  const analysis = await utils.analyzePaymasterCosts('0xPaymaster456...', {
    sampleUserOps: 100,
    timeframe: '24h',
    includePredictions: true,
    compareAlternatives: true
  });
  
  console.log(JSON.stringify(analysis, null, 2));
}

analyzeCosts().catch(console.error);
\"
```

## 📈 Advanced Cost Optimization

### 1. Multi-Paymaster Comparison

```bash
#!/bin/bash
# Script to compare multiple paymasters

PAYMASTERS=(\"0xPaymaster1...\" \"0xPaymaster2...\" \"0xPaymaster3...\")
CONTRACT=\"0xYourContract...\"
FUNCTION=\"expensiveFunction(uint256)\"

for paymaster in \"${PAYMASTERS[@]}\"; do
  echo \"Testing paymaster: $paymaster\"
  
  somnia-gas-profiler analyze \\n    --address $CONTRACT \\n    --abi ./contract.json \\n    --fn \"$FUNCTION\" \\n    --args '[1000]' \\n    --gasless \\n    --paymaster $paymaster \\n    --output \"paymaster-${paymaster:0:8}-results.json\"
done
```

### 2. Gas Optimization Recommendations

```bash
# Enable optimization suggestions
somnia-gas-profiler analyze \\n  --address 0xContract123... \\n  --abi ./contract.json \\n  --fn \"optimizeMe(uint256[],bytes32)\" \\n  --gasless \\n  --simulation-mode trace \\n  --verbose \\n  --output detailed-analysis.json

# The output will include:
# - Gas breakdown by operation
# - Optimization suggestions
# - Cost projections
# - Alternative implementation recommendations
```

## 🔮 Future Features

### Planned Enhancements

1. **MEV Analysis**: Integration with MEV simulation
2. **Cross-Chain Support**: Gasless simulation across different networks
3. **AI-Powered Optimization**: Machine learning gas optimization suggestions
4. **Real-Time Monitoring**: Continuous gas cost monitoring
5. **Advanced Paymaster Features**: Support for more paymaster types

### Contributing

We welcome contributions! Areas for improvement:
- New simulation modes
- Additional paymaster types
- Performance optimizations
- Documentation improvements

## 📚 Additional Resources

### Documentation
- [Somnia Network Documentation](https://docs.somnia.network/)
- [EIP-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Ethers.js Documentation](https://docs.ethers.org/)

### Community
- [GitHub Repository](https://github.com/somnia-network/gas-profiler)
- [Discord Community](https://discord.gg/somnia)
- [Developer Forum](https://forum.somnia.network/)

### Support

If you encounter issues:
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Create a new issue with:
   - Command used
   - Error messages
   - Expected vs actual behavior
   - Environment details

---

**Happy gas profiling! 🚀**

*This guide is continuously updated. Check the GitHub repository for the latest version.*