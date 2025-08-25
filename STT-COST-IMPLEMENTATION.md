# STT Cost Calculation Implementation Summary

## Overview

The Somnia Gas Profiler has been enhanced to calculate and display transaction costs in STT (Somnia's native token) alongside gas usage metrics. This feature provides developers with real-world cost insights for optimizing smart contract interactions.

## Key Features Implemented

### 1. Automatic Gas Price Fetching
- **Implementation**: Uses `ethers.js` `provider.getFeeData()` to retrieve current gas prices from the Somnia network
- **Fallback**: Falls back to `maxFeePerGas` if `gasPrice` is not available
- **Display**: Shows gas price in gwei for user reference during analysis

### 2. Cost Calculation Engine
- **Formula**: `cost_in_wei = BigInt(gas_used) * gas_price`
- **Conversion**: `cost_in_stt = ethers.formatEther(cost_in_wei)`
- **Precision**: 8 decimal places for STT display
- **Accuracy**: Uses BigInt arithmetic to prevent overflow

### 3. Enhanced Console Output
- **Per-run costs**: Shows cost alongside gas usage for each transaction
- **Example**: `Run 1: 43,000 gas | 0.00004300 STT`
- **Summary stats**: Displays average cost and cost range after profiling
- **Gas price info**: Shows current gas price in gwei

### 4. Enhanced Table Reports
- **Additional columns**: Min/Max/Avg/Total Cost (STT) when cost data is available
- **Adaptive layout**: Only shows cost columns when cost data exists
- **Summary section**: Includes total cost and average cost per transaction
- **Sorting**: Maintains existing sorting capabilities

### 5. Enhanced CSV Export
- **New columns**: `cost_stt`, `cost_wei`, `gas_price_wei`
- **Detailed data**: Per-transaction cost information for analysis
- **Backward compatibility**: Only adds cost columns when data is available

### 6. Gasless Mode Compatibility
- **Smart handling**: Skips cost calculation for simulated transactions
- **Clear indication**: Mode is clearly marked in output
- **Cost-free testing**: Allows expensive operation testing without STT costs

## Technical Implementation Details

### Profiler Module (`profiler/index.js`)
- **Gas price fetching**: Added in `profileFunction()` method
- **Cost tracking**: Enhanced aggregated statistics with cost metrics
- **Run data**: Extended run objects with cost information
- **Error handling**: Graceful fallback when gas price unavailable

### Reporter Module (`reporter/index.js`)
- **Table generation**: Enhanced `generateTableReport()` with cost columns
- **CSV export**: Updated `generateCSVReport()` with cost data
- **Summary stats**: Added cost calculations to summary statistics
- **Adaptive display**: Cost columns only shown when data exists

### Data Structure Enhancements
```javascript
// Enhanced run object
{
  run: 1,
  args: [42],
  gasUsed: 43000,
  mode: "standard",
  txHash: "0xabc123",
  blockNumber: 100,
  costInSTT: "0.00004300",        // NEW
  costInWei: "43000000000000000", // NEW
  gasPrice: "1000000000"          // NEW
}

// Enhanced aggregated stats
{
  min: 28000,
  max: 43000,
  avg: 33000,
  total: 99000,
  callCount: 3,
  minCost: 0.00002800,    // NEW
  maxCost: 0.00004300,    // NEW
  avgCost: 0.00003300,    // NEW
  totalCost: 0.00009900   // NEW
}
```

## Usage Examples

### CLI Commands
```bash
# Analyze with cost calculation
somnia-gas-profiler analyze \
  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \
  --abi ./examples/SimpleStorage.json \
  --fn "set(uint256)" "get()" \
  --args '[42]' '[]' \
  --runs 5

# Generate cost report
somnia-gas-profiler report \
  --in profiling_results.json \
  --format table

# Export cost data to CSV
somnia-gas-profiler report \
  --in profiling_results.json \
  --format csv \
  --out gas-costs.csv
```

### Sample Output
```
📊 Somnia Gas Profiling Report
─────────────────────────────────────
🌐 Network: Somnia Testnet
📋 Contract: 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15

┌──────────────┬──────┬─────────┬─────────┬─────────┬───────────┬──────────────┬──────────────┬──────────────┬───────────────┐
│ Function     │ Runs │ Min Gas │ Max Gas │ Avg Gas │ Total Gas │ Min Cost(STT)│ Max Cost(STT)│ Avg Cost(STT)│ Total Cost(STT)│
├──────────────┼──────┼─────────┼─────────┼─────────┼───────────┼──────────────┼──────────────┼──────────────┼───────────────┤
│ set(uint256) │ 3    │ 28,123  │ 43,000  │ 34,119  │ 102,357   │ 0.00002812   │ 0.00004300   │ 0.00003412   │ 0.00010235    │
│ increment()  │ 2    │ 28,890  │ 29,123  │ 29,007  │ 58,013    │ 0.00002889   │ 0.00002912   │ 0.00002900   │ 0.00005801    │
│ get()        │ 2    │ 2,334   │ 2,334   │ 2,334   │ 4,668     │ 0.00000233   │ 0.00000233   │ 0.00000233   │ 0.00000467    │
└──────────────┴──────┴─────────┴─────────┴─────────┴───────────┴──────────────┴──────────────┴──────────────┴───────────────┘

📈 Summary Statistics
─────────────────────
Functions profiled: 3
Total transactions: 7
Total gas consumed: 165,038
Average per transaction: 23,577
Total cost: 0.00016503 STT
Average cost per transaction: 0.00002358 STT
```

## Benefits for Developers

### 1. Real-World Cost Insights
- **Optimization guidance**: Understand actual cost impact of gas optimizations
- **Budget planning**: Estimate transaction costs for dApp operations
- **Cost comparison**: Compare costs between different implementations

### 2. Enhanced Analysis Capabilities
- **Spreadsheet analysis**: Export detailed cost data to CSV for further analysis
- **Time series tracking**: Monitor cost changes over time
- **Optimization verification**: Quantify cost savings from optimizations

### 3. Development Workflow Integration
- **CI/CD integration**: Track cost regressions in development pipelines
- **Performance budgets**: Set cost thresholds for contract operations
- **User experience**: Estimate gas costs for user transactions

## Error Handling and Edge Cases

### 1. Gas Price Unavailable
- **Graceful fallback**: Analysis continues without cost calculation
- **Clear messaging**: User informed when gas price cannot be fetched
- **Data integrity**: Results remain valid for gas analysis

### 2. Gasless Mode
- **Appropriate handling**: Cost calculation skipped for simulated transactions
- **Clear indication**: Mode clearly marked in output
- **Consistent behavior**: Maintains existing gasless functionality

### 3. Network Issues
- **Robust error handling**: Network errors don't break analysis
- **Informative messages**: Clear error messages for troubleshooting
- **Continued operation**: Analysis proceeds with available data

## Backward Compatibility

### 1. Existing Data
- **Compatible**: Existing profiling results remain valid
- **Adaptive display**: Reports adapt based on available data
- **No breaking changes**: All existing functionality preserved

### 2. API Compatibility
- **No changes**: CLI interface remains unchanged
- **Optional features**: Cost display is automatic when data available
- **Seamless upgrade**: Users get enhanced features without changes

## Future Enhancements

### 1. Multi-Token Support
- **Potential**: Support for different gas tokens
- **Flexibility**: Configurable token for cost calculation
- **Extensibility**: Framework for additional token types

### 2. Historical Cost Tracking
- **Time series**: Track costs over multiple analysis runs
- **Trend analysis**: Identify cost patterns and trends
- **Reporting**: Enhanced reporting with historical context

### 3. Cost Optimization Recommendations
- **AI integration**: Smart recommendations based on cost analysis
- **Pattern recognition**: Identify high-cost operation patterns
- **Actionable insights**: Specific optimization suggestions

## Conclusion

The STT cost calculation feature significantly enhances the Somnia Gas Profiler by providing real-world cost insights alongside gas metrics. This implementation is robust, well-integrated, and provides immediate value to developers optimizing smart contracts on the Somnia network.

The feature maintains full backward compatibility while adding powerful new capabilities for cost analysis and optimization tracking. Developers can now make informed decisions about gas optimizations based on actual STT costs, leading to better user experiences and more efficient dApps.