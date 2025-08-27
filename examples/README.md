# Somnia Gas Profiler Examples

This directory contains example contracts and usage scripts to demonstrate the gas profiler functionality.

## Example Contract: SimpleStorage

A basic storage contract with various function types to showcase different gas usage patterns.

### Contract Features
- **`set(uint256)`**: Simple storage write operation
- **`get()`**: Storage read operation  
- **`increment()`**: Read + write operation
- **`add(uint256)`**: Parameterized read + write
- **`setUserValue(uint256)`**: Mapping storage operation
- **`getUserValue(address)`**: Mapping read operation

## Usage Examples

### Basic Gas Profiling

```bash
# Profile multiple functions with different gas patterns
npx somnia-gas-profiler analyze \
  --address 0xYourContractAddress \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" "get()" "increment()" \
  --args '[42]' '[]' '[]' \
  --runs 5

# View results as a formatted table
npx somnia-gas-profiler report --format table
```

### Detailed Analysis

```bash
# Profile with more iterations for statistical accuracy
npx somnia-gas-profiler analyze \
  --address 0xYourContractAddress \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" "add(uint256)" "setUserValue(uint256)" \
  --args '[100]' '[50]' '[123]' \
  --runs 10 \
  --out detailed-analysis.json \
  --verbose

# Generate CSV report for analysis
npx somnia-gas-profiler report \
  --in detailed-analysis.json \
  --format csv \
  --out gas-report.csv
```

### Comparison Analysis

```bash
# Profile with different parameters
npx somnia-gas-profiler analyze \
  --address 0xYourContractAddress \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" \
  --args '[1]' \
  --out small-value.json

npx somnia-gas-profiler analyze \
  --address 0xYourContractAddress \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" \
  --args '[999999999]' \
  --out large-value.json

# Compare gas usage between small and large values
npx somnia-gas-profiler report \
  --in small-value.json \
  --compare large-value.json
```

### Enhanced Analysis

```bash
# Generate developer analysis with optimization insights
npx somnia-gas-profiler analyze \
  --address 0xYourContractAddress \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" "get()" "increment()" "add(uint256)" \
  --args '[42]' '[]' '[]' '[10]' \
  --runs 5 \
  --verbose

npx somnia-gas-profiler report --format table
```

### Intelligent Gasless Simulation

```bash
# Test with enhanced gasless patterns
npx somnia-gas-profiler analyze \
  --address 0xYourContractAddress \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" \
  --gasless \
  --runs 3 \
  --verbose
```

## Expected Gas Usage Patterns

Based on typical EVM behavior, you should see:

- **`get()`**: ~2,300 gas (SLOAD operation)
- **`set(uint256)`**: ~43,000+ gas (SSTORE from zero to non-zero)
- **`increment()`**: ~28,000+ gas (SLOAD + SSTORE with existing value)
- **`add(uint256)`**: Similar to increment
- **`setUserValue(uint256)`**: ~43,000+ gas (mapping SSTORE)
- **`getUserValue(address)`**: ~2,600+ gas (mapping SLOAD)

*Note: Actual gas costs may vary based on Somnia's optimizations and EVM version.*

## Deployment Instructions

To deploy the SimpleStorage contract to Somnia testnet:

1. **Using Foundry** (recommended):
```bash
# Install Foundry if not already installed
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Initialize Foundry project
forge init my-somnia-project
cd my-somnia-project

# Copy the contract
cp ../examples/SimpleStorage.sol src/

# Deploy to Somnia testnet
forge create --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  src/SimpleStorage.sol:SimpleStorage
```

2. **Using Hardhat**:
```bash
# Initialize Hardhat project
npx hardhat init

# Add Somnia network to hardhat.config.js
# Deploy using your preferred method
```

3. **Using Remix**:
   - Open [Remix IDE](https://remix.ethereum.org)
   - Create new file with SimpleStorage.sol content
   - Compile with Solidity 0.8.19+
   - Connect to Somnia testnet via MetaMask
   - Deploy the contract

## Getting Testnet ETH

Visit the [Somnia Faucet](https://faucet.somnia.network) to get testnet ETH for deployment and testing.

## Tips for Effective Gas Profiling

1. **Multiple Runs**: Use 5-10 runs for statistical accuracy
2. **Function Variants**: Test with different parameter values
3. **State Changes**: Profile both cold and warm storage operations
4. **Batch Operations**: Compare single vs batch operations
5. **Gas Optimization**: Use comparisons to validate optimizations