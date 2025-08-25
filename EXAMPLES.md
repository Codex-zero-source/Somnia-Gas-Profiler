# Somnia Gas Profiler - Examples

This document provides comprehensive examples for using the Somnia Gas Profiler across various scenarios and use cases.

## Table of Contents

- [Basic Examples](#basic-examples)
- [ERC20 Token Analysis](#erc20-token-analysis)
- [Optimization Comparisons](#optimization-comparisons)
- [Loop Performance Analysis](#loop-performance-analysis)
- [Gasless Simulation](#gasless-simulation)
- [Batch Operations](#batch-operations)
- [CI/CD Integration](#cicd-integration)
- [Advanced Scenarios](#advanced-scenarios)

## Basic Examples

### Simple Storage Contract

Deploy and analyze the SimpleStorage example contract:

```bash
# 1. Deploy the contract
npm run deploy:somnia

# 2. Profile setter function
somnia-gas-profiler analyze \\
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \\
  --abi ./examples/SimpleStorage.json \\
  --fn "set(uint256)" \\
  --args '[42]' \\
  --runs 5 \\
  --out simple-storage-set.json

# 3. Profile getter function
somnia-gas-profiler analyze \\
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \\
  --abi ./examples/SimpleStorage.json \\
  --fn "get()" \\
  --args '[]' \\
  --runs 3 \\
  --out simple-storage-get.json

# 4. Generate combined report
somnia-gas-profiler report --in simple-storage-set.json --format table
```

### Multiple Functions Analysis

Analyze multiple functions in a single run:

```bash
somnia-gas-profiler analyze \\
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \\
  --abi ./examples/SimpleStorage.json \\
  --fn "set(uint256)" "get()" "increment()" \\
  --args '[100]' '[]' '[]' \\
  --runs 5 \\
  --out multi-function-analysis.json

# View results with AI insights
somnia-gas-profiler report \\
  --in multi-function-analysis.json \\
  --format table \\
  --nl \\
  --sort avg
```

Expected Output:
```
📊 Somnia Gas Profiling Report
─────────────────────────────────────
🌐 Network: Somnia Testnet
🔗 RPC: https://dream-rpc.somnia.network
📋 Contract: 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15
📈 Sorted by: avg gas

┌─────────────┬──────┬─────────┬─────────┬─────────┬───────────┐
│ Function    │ Runs │ Min Gas │ Max Gas │ Avg Gas │ Total Gas │
├─────────────┼──────┼─────────┼─────────┼─────────┼───────────┤
│ set(uint256)│ 5    │ 28,123  │ 43,456  │ 31,234  │ 156,170   │
│ increment() │ 5    │ 28,890  │ 29,123  │ 29,001  │ 145,005   │
│ get()       │ 5    │ 2,334   │ 2,334   │ 2,334   │ 11,670    │
└─────────────┴──────┴─────────┴─────────┴─────────┴───────────┘
```

## ERC20 Token Analysis

### Basic ERC20 Operations

```bash
# Deploy ERC20Mock (requires compilation)
npm run compile
npm run deploy:somnia

# Profile standard ERC20 functions
somnia-gas-profiler analyze \\
  --address $ERC20_ADDRESS \\
  --abi ./examples/ERC20Mock.json \\
  --fn "transfer(address,uint256)" "balanceOf(address)" "approve(address,uint256)" \\
  --args '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 1000]' '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15"]' '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 5000]' \\
  --runs 5 \\
  --out erc20-basic.json
```

### Batch Transfer Analysis

Analyze gas efficiency of batch operations:

```bash
# Single transfers vs batch transfer
somnia-gas-profiler analyze \\
  --address $ERC20_ADDRESS \\
  --abi ./examples/ERC20Mock.json \\
  --fn "transfer(address,uint256)" "batchTransfer(address[],uint256[])" \\
  --args '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 100]' '[["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", "0x456...def"], [100, 200]]' \\
  --runs 3 \\
  --out erc20-batch.json

# Generate comparison report
somnia-gas-profiler report \\
  --in erc20-batch.json \\
  --format table \\
  --nl
```

### Gas-Intensive ERC20 Operations

```bash
# Profile heavy computation function
somnia-gas-profiler analyze \\
  --address $ERC20_ADDRESS \\
  --abi ./examples/ERC20Mock.json \\
  --fn "heavyComputation(uint256)" \\
  --args '[100]' \\
  --runs 5 \\
  --gasless \\
  --out erc20-heavy.json
```

## Optimization Comparisons

### Memory vs Storage Optimization

Compare optimized and unoptimized implementations:

```bash
# Profile both versions
somnia-gas-profiler analyze \\
  --address $ERC20_ADDRESS \\
  --abi ./examples/ERC20Mock.json \\
  --fn "updateBalanceMemory(address,uint256)" "updateBalanceOptimized(address,uint256)" \\
  --args '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 5000]' '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 5000]' \\
  --runs 10 \\
  --out optimization-comparison.json

# Generate optimization report
somnia-gas-profiler report \\
  --in optimization-comparison.json \\
  --format table \\
  --sort avg \\
  --nl
```

### Before/After Contract Optimization

```bash
# 1. Profile original contract
somnia-gas-profiler analyze \\
  --address $ORIGINAL_CONTRACT \\
  --abi ./contract-v1.json \\
  --fn "expensiveFunction(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --out before-optimization.json

# 2. Deploy optimized contract
# ... deploy process ...

# 3. Profile optimized contract
somnia-gas-profiler analyze \\
  --address $OPTIMIZED_CONTRACT \\
  --abi ./contract-v2.json \\
  --fn "expensiveFunction(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --out after-optimization.json

# 4. Generate comparison
somnia-gas-profiler report \\
  --in before-optimization.json \\
  --compare after-optimization.json \\
  --nl
```

Expected Output:
```
🔍 Gas Profiling Comparison Report
═══════════════════════════════════════
📊 File 1: before-optimization.json
📊 File 2: after-optimization.json

┌─────────────────────┬─────────────┬──────────┬──────────┬──────────┐
│ Function            │ Avg Gas Diff│ Change % │ Min Diff │ Max Diff │
├─────────────────────┼─────────────┼──────────┼──────────┼──────────┤
│ expensiveFunction() │ -12,500     │ -15.2%   │ -12,000  │ -13,000  │
└─────────────────────┴─────────────┴──────────┴──────────┴──────────┘

💡 Green = Gas savings, Red = Gas increase
```

## Loop Performance Analysis

### Optimized vs Unoptimized Loops

```bash
# Deploy HeavyLoop contract
npm run compile
npm run deploy:somnia

# Compare loop implementations
somnia-gas-profiler analyze \\
  --address $HEAVYLOOP_ADDRESS \\
  --abi ./examples/HeavyLoop.json \\
  --fn "optimizedLoop(uint256)" "unoptimizedLoop(uint256)" \\
  --args '[20]' '[20]' \\
  --runs 5 \\
  --out loop-comparison.json

# Analyze with different iteration counts
for iterations in 10 20 50 100; do
  somnia-gas-profiler analyze \\
    --address $HEAVYLOOP_ADDRESS \\
    --abi ./examples/HeavyLoop.json \\
    --fn "optimizedLoop(uint256)" "unoptimizedLoop(uint256)" \\
    --args "[$iterations]" "[$iterations]" \\
    --runs 3 \\
    --out "loop-analysis-$iterations.json"
done
```

### Nested Loop Analysis

```bash
# Profile nested loops with different parameters
somnia-gas-profiler analyze \\
  --address $HEAVYLOOP_ADDRESS \\
  --abi ./examples/HeavyLoop.json \\
  --fn "nestedLoops(uint256,uint256)" \\
  --args '[10, 10]' \\
  --runs 3 \\
  --gasless \\
  --out nested-loops.json
```

### Array Operations

```bash
# Compare array operation efficiency
somnia-gas-profiler analyze \\
  --address $HEAVYLOOP_ADDRESS \\
  --abi ./examples/HeavyLoop.json \\
  --fn "inefficientArrayOperation()" "efficientArrayOperation()" \\
  --args '[]' '[]' \\
  --runs 5 \\
  --out array-operations.json

somnia-gas-profiler report \\
  --in array-operations.json \\
  --format table \\
  --nl
```

## Gasless Simulation

### Large-Scale Analysis Without Costs

```bash
# Simulate expensive operations without spending gas
somnia-gas-profiler analyze \\
  --address $HEAVYLOOP_ADDRESS \\
  --abi ./examples/HeavyLoop.json \\
  --fn "complexStateTransition(uint256)" \\
  --args '[1000]' \\
  --runs 50 \\
  --gasless \\
  --out gasless-simulation.json

# Analyze memory-intensive operations
somnia-gas-profiler analyze \\
  --address $HEAVYLOOP_ADDRESS \\
  --abi ./examples/HeavyLoop.json \\
  --fn "memoryIntensiveOperation(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --gasless \\
  --out memory-intensive.json
```

### Hash Computation Benchmarking

```bash
# Profile hash computation with different parameters
for iterations in 100 500 1000 5000; do
  somnia-gas-profiler analyze \\
    --address $HEAVYLOOP_ADDRESS \\
    --abi ./examples/HeavyLoop.json \\
    --fn "hashComputation(uint256,bytes32)" \\
    --args "[$iterations, \"0x123...\"]" \\
    --runs 5 \\
    --gasless \\
    --out "hash-computation-$iterations.json"
done
```

## Batch Operations

### Batch Analysis Script

Create a script for analyzing multiple contracts:

```bash
#!/bin/bash
# batch-analysis.sh

CONTRACTS=(
  "0x123...abc:./abi/ContractA.json:mainFunction(uint256):[100]"
  "0x456...def:./abi/ContractB.json:processData(uint256[]):[\"[1,2,3,4,5]\"]"
  "0x789...ghi:./abi/ContractC.json:complexOperation():[\"[]\"]"
)

for contract_data in "${CONTRACTS[@]}"; do
  IFS=':' read -r address abi function args <<< "$contract_data"
  
  echo "Analyzing: $address - $function"
  
  somnia-gas-profiler analyze \\
    --address "$address" \\
    --abi "$abi" \\
    --fn "$function" \\
    --args "$args" \\
    --runs 5 \\
    --out "batch_$(basename $address).json"
done

# Generate combined report
echo "Generating combined analysis..."
somnia-gas-profiler report --in batch_*.json --format csv --out batch-analysis.csv
```

### Automated Testing Pipeline

```bash
#!/bin/bash
# test-pipeline.sh

# Deploy contracts
echo "Deploying test contracts..."
npm run deploy:somnia

# Run comprehensive analysis
echo "Running gas profiling..."

# ERC20 Analysis
somnia-gas-profiler analyze \\
  --address $ERC20_ADDRESS \\
  --abi ./examples/ERC20Mock.json \\
  --fn "transfer(address,uint256)" "approve(address,uint256)" "balanceOf(address)" \\
  --args '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 1000]' '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 5000]' '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15"]' \\
  --runs 5 \\
  --out erc20-comprehensive.json

# Loop Analysis
somnia-gas-profiler analyze \\
  --address $HEAVYLOOP_ADDRESS \\
  --abi ./examples/HeavyLoop.json \\
  --fn "optimizedLoop(uint256)" "unoptimizedLoop(uint256)" \\
  --args '[50]' '[50]' \\
  --runs 5 \\
  --out loop-comprehensive.json

# Generate reports
echo "Generating reports..."
somnia-gas-profiler report --in erc20-comprehensive.json --format table --nl
somnia-gas-profiler report --in loop-comprehensive.json --format table --nl
somnia-gas-profiler report --in erc20-comprehensive.json --compare loop-comprehensive.json
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/gas-analysis.yml
name: Gas Analysis

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  gas-profiling:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Compile contracts
      run: npm run compile
      
    - name: Deploy contracts
      run: npm run deploy:somnia
      env:
        PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
        RPC_URL: ${{ secrets.RPC_URL }}
        
    - name: Run gas profiling
      run: |
        somnia-gas-profiler analyze \\
          --address $CONTRACT_ADDRESS \\
          --abi ./artifacts/contracts/MyContract.sol/MyContract.json \\
          --fn "criticalFunction(uint256)" \\
          --args '[1000]' \\
          --runs 5 \\
          --out current-analysis.json
      env:
        PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
        
    - name: Download baseline
      uses: actions/download-artifact@v3
      with:
        name: baseline-analysis
        path: ./baseline/
      continue-on-error: true
        
    - name: Compare with baseline
      run: |
        if [ -f "./baseline/baseline-analysis.json" ]; then
          echo "Comparing with baseline..."
          somnia-gas-profiler report \\
            --in ./baseline/baseline-analysis.json \\
            --compare current-analysis.json \\
            --nl > gas-comparison.txt
          cat gas-comparison.txt
        else
          echo "No baseline found, generating initial report..."
          somnia-gas-profiler report \\
            --in current-analysis.json \\
            --format table \\
            --nl > gas-report.txt
          cat gas-report.txt
        fi
        
    - name: Upload current analysis as baseline
      uses: actions/upload-artifact@v3
      with:
        name: baseline-analysis
        path: current-analysis.json
        
    - name: Comment PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          let comment = '## Gas Analysis Report\\n\\n';
          
          if (fs.existsSync('gas-comparison.txt')) {
            const comparison = fs.readFileSync('gas-comparison.txt', 'utf8');
            comment += '### Comparison with Baseline\\n\\n```\\n' + comparison + '\\n```';
          } else if (fs.existsSync('gas-report.txt')) {
            const report = fs.readFileSync('gas-report.txt', 'utf8');
            comment += '### Current Analysis\\n\\n```\\n' + report + '\\n```';
          }
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        PRIVATE_KEY = credentials('somnia-private-key')
        RPC_URL = 'https://dream-rpc.somnia.network'
        OPENAI_API_KEY = credentials('openai-api-key')
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
                sh 'npm run compile'
            }
        }
        
        stage('Deploy') {
            steps {
                sh 'npm run deploy:somnia'
            }
        }
        
        stage('Gas Analysis') {
            parallel {
                stage('Core Functions') {
                    steps {
                        sh '''
                            somnia-gas-profiler analyze \\
                              --address $CONTRACT_ADDRESS \\
                              --abi ./artifacts/Contract.json \\
                              --fn "coreFunction(uint256)" \\
                              --args '[1000]' \\
                              --runs 10 \\
                              --out core-analysis.json
                        '''
                    }
                }
                
                stage('Optimization Test') {
                    steps {
                        sh '''
                            somnia-gas-profiler analyze \\
                              --address $CONTRACT_ADDRESS \\
                              --abi ./artifacts/Contract.json \\
                              --fn "optimizedFunction(uint256)" \\
                              --args '[1000]' \\
                              --runs 10 \\
                              --out optimization-analysis.json
                        '''
                    }
                }
            }
        }
        
        stage('Report Generation') {
            steps {
                sh '''
                    # Generate individual reports
                    somnia-gas-profiler report --in core-analysis.json --format csv --out core-report.csv
                    somnia-gas-profiler report --in optimization-analysis.json --format csv --out optimization-report.csv
                    
                    # Generate comparison
                    somnia-gas-profiler report --in core-analysis.json --compare optimization-analysis.json --nl > comparison-report.txt
                '''
                
                archiveArtifacts artifacts: '*.csv,*.txt,*.json', allowEmptyArchive: false
                
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'comparison-report.txt',
                    reportName: 'Gas Analysis Report'
                ])
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        
        success {
            slackSend(
                channel: '#development',
                color: 'good',
                message: "Gas analysis completed successfully for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
        
        failure {
            slackSend(
                channel: '#development',
                color: 'danger',
                message: "Gas analysis failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

## Advanced Scenarios

### Dynamic Function Analysis

```bash
# Function that takes complex data structures
somnia-gas-profiler analyze \\
  --address $CONTRACT_ADDRESS \\
  --abi ./complex-contract.json \\
  --fn "processStruct((uint256,string,address[]))" \\
  --args '[{"components": [1000, "test", ["0x123...abc", "0x456...def"]]}]' \\
  --runs 3 \\
  --out complex-struct.json
```

### State-Dependent Analysis

```bash
# Analyze functions that depend on contract state
# First call (cold storage)
somnia-gas-profiler analyze \\
  --address $CONTRACT_ADDRESS \\
  --abi ./contract.json \\
  --fn "stateDependent(uint256)" \\
  --args '[1]' \\
  --runs 1 \\
  --out cold-state.json

# Subsequent calls (warm storage)
somnia-gas-profiler analyze \\
  --address $CONTRACT_ADDRESS \\
  --abi ./contract.json \\
  --fn "stateDependent(uint256)" \\
  --args '[2]' \\
  --runs 5 \\
  --out warm-state.json

# Compare cold vs warm state costs
somnia-gas-profiler report \\
  --in cold-state.json \\
  --compare warm-state.json
```

### Cross-Contract Analysis

```bash
# Analyze interactions between contracts
somnia-gas-profiler analyze \\
  --address $PROXY_CONTRACT \\
  --abi ./proxy.json \\
  --fn "delegateCall(address,bytes)" \\
  --args '["0x123...implementation", "0x456...calldata"]' \\
  --runs 5 \\
  --out cross-contract.json
```

### Performance Regression Testing

```bash
#!/bin/bash
# regression-test.sh

# Git hook for performance regression testing
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASELINE_BRANCH="main"

# Deploy current version
npm run deploy:somnia
CURRENT_ADDRESS=$CONTRACT_ADDRESS

# Switch to baseline and deploy
git checkout $BASELINE_BRANCH
npm run deploy:somnia
BASELINE_ADDRESS=$CONTRACT_ADDRESS

# Switch back to current branch
git checkout $CURRENT_BRANCH

# Run comparative analysis
somnia-gas-profiler analyze \\
  --address $BASELINE_ADDRESS \\
  --abi ./contract.json \\
  --fn "criticalPath(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --out baseline-performance.json

somnia-gas-profiler analyze \\
  --address $CURRENT_ADDRESS \\
  --abi ./contract.json \\
  --fn "criticalPath(uint256)" \\
  --args '[1000]' \\
  --runs 10 \\
  --out current-performance.json

# Generate regression report
somnia-gas-profiler report \\
  --in baseline-performance.json \\
  --compare current-performance.json \\
  --nl > regression-report.txt

# Check for significant regressions (>5% increase)
if grep -q "+[5-9]\|+[0-9][0-9]" regression-report.txt; then
    echo "❌ Performance regression detected!"
    cat regression-report.txt
    exit 1
else
    echo "✅ No significant performance regression"
fi
```

---

These examples demonstrate the versatility and power of the Somnia Gas Profiler for comprehensive smart contract analysis. Adapt them to your specific use cases and integrate them into your development workflow for continuous gas optimization.