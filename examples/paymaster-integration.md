# Paymaster Integration Examples

## 🎯 Quick Start Examples

### 1. Basic Contract Analysis

```bash
# Analyze contract with intelligent argument generation
somnia-gas-profiler quick-analyze --address 0x123... --gasless

# Detailed contract analysis with verbose output
somnia-gas-profiler analyze --address 0x1234... --gasless --verbose
```

### 2. Enhanced Gasless Simulation

```bash
# Profile with enhanced gasless simulation
somnia-gas-profiler analyze \
  --address 0xContract123... \
  --abi './contract.json' \
  --fn "transfer(address,uint256)" \
  --gasless \
  --verbose
```

### 3. Intelligent Argument Generation

The profiler now includes intelligent contract state analysis for better argument generation:

```bash
# The profiler automatically analyzes contract state to generate optimal arguments
somnia-gas-profiler quick-analyze \
  --address 0xERC20Contract... \
  --functions "transfer(address,uint256)" \
  --gasless
```

## 🧠 Enhanced Features

### Contract State Analysis
- **Automatic Type Detection**: ERC20, ERC721, DeFi protocols, etc.
- **Smart Arguments**: Context-aware test data generation
- **Access Control Detection**: Identifies permission patterns
- **Multi-Sender Testing**: Tests with different addresses
- **Fallback Strategies**: Multiple simulation modes

### Advanced Simulation Modes
```bash
# Different simulation modes for enhanced accuracy
--simulation-mode estimate      # Fast gas estimation
--simulation-mode staticCall   # For view functions
--simulation-mode trace        # Detailed execution trace
--simulation-mode accessControlBypass  # Bypass access controls
--simulation-mode multiSenderTest     # Test with multiple senders
```

## 💰 Paymaster Types

### Sponsorship Paymaster
```javascript
// Free transaction sponsorship
const analysis = await paymasterUtils.analyzePaymasterCosts(sponsorshipAddress);
if (analysis.paymasterType.primaryType === 'sponsorship-paymaster') {
  console.log('Sponsorship overhead:', analysis.costBreakdown.totalPerOperation);
}
```

### Token Paymaster
```javascript
// ERC-20 token payment analysis
const tokenPaymaster = '0xTokenPaymaster...';
const analysis = await paymasterUtils.analyzePaymasterCosts(tokenPaymaster);
console.log('Token operation gas:', analysis.costBreakdown.typeCosts.tokenOperations);
```

### Verifying Paymaster
```javascript
// Signature-based access control
const verifyingPaymaster = '0xVerifying...';
const typeAnalysis = await paymasterUtils.detectPaymasterType(verifyingPaymaster);
console.log('Verification features:', typeAnalysis.supportedFeatures);
```

## 🔄 Multi-Paymaster Comparison

```javascript
class PaymasterComparison {
  async comparePaymasters(paymasterAddresses) {
    const results = [];
    
    for (const address of paymasterAddresses) {
      const validation = await this.paymasterUtils.validatePaymasterInterface(address);
      const costAnalysis = await this.paymasterUtils.analyzePaymasterCosts(address);
      
      results.push({
        address,
        valid: validation.valid,
        gasEfficiency: costAnalysis.metrics.gasEfficiency,
        costStability: costAnalysis.metrics.costStability,
        type: costAnalysis.paymasterType.primaryType
      });
    }
    
    return results.sort((a, b) => b.gasEfficiency - a.gasEfficiency);
  }
}
```

## 📦 Batch Processing

```json
// batch-config.json
{
  \"contracts\": [
    {
      \"name\": \"ERC20Token\",
      \"address\": \"0x123...\",
      \"abi\": \"./ERC20.json\",
      \"functions\": [\"transfer(address,uint256)\"],
      \"gasless\": true,
      \"paymaster\": \"0x456...\"
    }
  ]
}
```

```bash
somnia-gas-profiler batch-gasless \\n  --config ./batch-config.json \\n  --parallel 3
```

## 🔧 Production Patterns

### Environment Configuration
```javascript
const config = {
  development: {
    paymaster: '0xDevPaymaster...',
    gasLimits: { validation: 50000 }
  },
  production: {
    paymaster: '0xProdPaymaster...',
    gasLimits: { validation: 75000 }
  }
};
```

### Error Handling
```javascript
try {
  const result = await paymasterUtils.simulateSponsoredTransaction(paymaster, userOp);
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    // Switch to fallback paymaster
    await useFallbackPaymaster();
  }
}
```

### Monitoring
```javascript
class PaymasterMonitor {
  async checkPaymasterHealth(address) {
    const status = await this.paymasterUtils.getPaymasterStatus(address);
    const alerts = [];
    
    if (parseFloat(status.balance) < 0.1) {
      alerts.push('Low balance warning');
    }
    
    return { healthy: alerts.length === 0, alerts };
  }
}
```

## 📊 Cost Optimization

### Gas Analysis
```bash
# Compare different simulation modes
for mode in estimate staticCall paymaster; do
  somnia-gas-profiler analyze \\n    --address 0x123... \\n    --abi ./contract.json \\n    --fn \"transfer(address,uint256)\" \\n    --gasless \\n    --simulation-mode $mode \\n    --output \"analysis-$mode.json\"
done
```

### Optimization Recommendations
```javascript
const analysis = await paymasterUtils.analyzePaymasterCosts(paymaster, {
  includePredictions: true,
  compareAlternatives: true
});

analysis.optimization.recommendations.forEach(rec => {
  console.log(`${rec.type}: ${rec.description}`);
  console.log(`Potential savings: ${rec.potentialSavings}`);
});
```

## 🚀 Advanced Examples

### Custom Paymaster Validation
```javascript
class CustomPaymasterValidator {
  async validateCustomRules(paymasterAddress) {
    const validation = await this.paymasterUtils.validatePaymasterInterface(paymasterAddress);
    const status = await this.paymasterUtils.getPaymasterStatus(paymasterAddress);
    
    // Custom validation rules
    const customChecks = {
      hasMinimumBalance: parseFloat(status.balance) >= 1.0,
      isHighEfficiency: validation.gasEstimate?.validateGas < 60000,
      supportsEIP4337: validation.eip4337Compliant
    };
    
    return {
      ...validation,
      customChecks,
      overallScore: Object.values(customChecks).filter(Boolean).length * 33
    };
  }
}
```

### Dynamic Paymaster Selection
```javascript
class SmartPaymasterSelector {
  async selectOptimalPaymaster(paymasters, transactionType) {
    const analyses = await Promise.all(
      paymasters.map(p => this.paymasterUtils.analyzePaymasterCosts(p.address))
    );
    
    // Select based on transaction type
    if (transactionType === 'high-frequency') {
      return analyses.find(a => a.metrics.gasEfficiency > 85);
    }
    
    if (transactionType === 'cost-sensitive') {
      return analyses.sort((a, b) => 
        a.costBreakdown.totalPerOperation - b.costBreakdown.totalPerOperation
      )[0];
    }
    
    return analyses[0]; // Default
  }
}
```

## 📚 Resources

- [EIP-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Somnia Documentation](https://docs.somnia.network/)
- [Gasless Tutorial](./gasless-tutorial.md)
- [GitHub Examples](https://github.com/somnia-network/gas-profiler/examples)

---

**Quick Reference Commands:**

```bash
# Discovery
somnia-gas-profiler discover-paymasters --limit 5

# Validation
somnia-gas-profiler validate-paymaster 0x123... --detailed

# Analysis
somnia-gas-profiler analyze --address 0x123... --gasless --paymaster 0x456...

# Batch
somnia-gas-profiler batch-gasless --config batch.json

# Help
somnia-gas-profiler help-gasless
```