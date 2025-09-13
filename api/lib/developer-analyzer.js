const chalk = require('chalk');

/**
 * Developer-Focused Gas Analyzer for Somnia Gas Profiler
 * Provides structured, categorized analysis for smart contract developers
 */
class DeveloperAnalyzer {
  constructor() {
    this.gasThresholds = {
      excellent: 50000,
      good: 100000,
      moderate: 500000,
      high: 1000000
    };
  }

  /**
   * Generate comprehensive developer-focused analysis
   * @param {Object} profilingData - Gas profiling results
   * @param {string} contractAddress - Contract address being analyzed
   * @param {Object} contractAnalysis - Contract structure analysis from quick-analyze
   * @returns {Object} Structured analysis with categories and insights
   */
  analyzeGasProfile(profilingData, contractAddress, contractAnalysis) {
    const analysisResult = {
      contract: contractAddress,
      network: profilingData.network || 'Somnia Testnet',
      functionsAnalyzed: Object.keys(profilingData.results || {}).length,
      categories: this.categorizeAndAnalyzeFunctions(profilingData),
      insights: this.generateInsights(profilingData),
      recommendations: this.generateRecommendations(profilingData),
      summary: this.generateSummary(profilingData)
    };

    // Include contract analysis if provided
    if (contractAnalysis) {
      analysisResult.contractAnalysis = contractAnalysis;
    }

    return analysisResult;
  }

  /**
   * Categorize functions by usage patterns and analyze each category
   * @param {Object} profilingData - Gas profiling results
   * @returns {Object} Categorized functions with analysis
   */
  categorizeAndAnalyzeFunctions(profilingData) {
    const categories = {
      'Query Functions': [],
      'Administrative Functions': [],
      'Fee Management': [],
      'State Management': [],
      'Other Functions': []
    };

    // Categorize each function
    Object.entries(profilingData.results || {}).forEach(([func, result]) => {
      const category = this.categorizeFunction(func);
      const analysis = this.analyzeFunctionPerformance(func, result);
      
      categories[category].push({
        function: func,
        gasUsage: result.aggregated.avg,
        gasRange: {
          min: result.aggregated.min,
          max: result.aggregated.max
        },
        efficiency: this.getEfficiencyRating(result.aggregated.avg),
        costSTT: this.calculateCostSTT(result.aggregated.avg),
        calls: result.aggregated.callCount,
        analysis
      });
    });

    // Sort functions within each category by gas usage (highest first)
    Object.values(categories).forEach(category => {
      category.sort((a, b) => b.gasUsage - a.gasUsage);
    });

    return categories;
  }

  /**
   * Categorize a function based on its signature
   * @param {string} functionName - Function signature
   * @returns {string} Category name
   */
  categorizeFunction(functionName) {
    const name = functionName.toLowerCase();
    
    if (name.includes('get') || name.includes('view') || name.includes('read') || 
        name.includes('query') || name.includes('balance') || name.includes('total') ||
        name.includes('owner') || name.includes('approved') || name.includes('allowance')) {
      return 'Query Functions';
    }
    
    if (name.includes('set') || name.includes('initialize') || name.includes('config') ||
        name.includes('setup') || name.includes('admin') || name.includes('pause')) {
      return 'Administrative Functions';
    }
    
    if (name.includes('fee') || name.includes('payment') || name.includes('cost')) {
      return 'Fee Management';
    }
    
    if (name.includes('transfer') || name.includes('approve') || name.includes('mint') ||
        name.includes('burn') || name.includes('update') || name.includes('change')) {
      return 'State Management';
    }
    
    return 'Other Functions';
  }

  /**
   * Analyze individual function performance
   * @param {string} func - Function name
   * @param {Object} result - Function profiling result
   * @returns {Object} Function analysis
   */
  analyzeFunctionPerformance(func, result) {
    const variance = result.aggregated.max - result.aggregated.min;
    const isConsistent = variance < (result.aggregated.avg * 0.1); // Less than 10% variance
    const isExpensive = result.aggregated.avg > this.gasThresholds.high;
    
    return {
      consistent: isConsistent,
      expensive: isExpensive,
      variance: variance,
      variancePercentage: (variance / result.aggregated.avg) * 100
    };
  }

  /**
   * Get efficiency rating based on gas usage
   * @param {number} gasUsage - Gas consumption
   * @returns {Object} Efficiency rating with color
   */
  getEfficiencyRating(gasUsage) {
    if (gasUsage < this.gasThresholds.excellent) {
      return { rating: 'Excellent', color: 'green' };
    } else if (gasUsage < this.gasThresholds.good) {
      return { rating: 'Good', color: 'blue' };
    } else if (gasUsage < this.gasThresholds.moderate) {
      return { rating: 'Moderate', color: 'yellow' };
    } else if (gasUsage < this.gasThresholds.high) {
      return { rating: 'High', color: 'orange' };
    } else {
      return { rating: 'Very High', color: 'red' };
    }
  }

  /**
   * Calculate cost in STT (Somnia Test Token)
   * @param {number} gasUsage - Gas consumption
   * @param {number} gasPrice - Gas price in gwei (default 6.0)
   * @returns {string} Cost in STT formatted to 8 decimal places
   */
  calculateCostSTT(gasUsage, gasPrice = 6.0) {
    const costSTT = gasUsage * gasPrice * 1e-9; // Convert gwei to STT
    return costSTT.toFixed(8);
  }

  /**
   * Generate key insights from profiling data
   * @param {Object} profilingData - Gas profiling results
   * @returns {Object} Key insights
   */
  generateInsights(profilingData) {
    const functions = Object.entries(profilingData.results || {});
    
    if (functions.length === 0) {
      return { error: 'No functions analyzed' };
    }

    const gasValues = functions.map(([, result]) => result.aggregated.avg);
    const totalGas = functions.reduce((sum, [, result]) => sum + result.aggregated.total, 0);
    const totalCalls = functions.reduce((sum, [, result]) => sum + result.aggregated.callCount, 0);
    
    const avgGas = gasValues.reduce((sum, gas) => sum + gas, 0) / gasValues.length;
    const maxGas = Math.max(...gasValues);
    const minGas = Math.min(...gasValues);
    
    // Find most and least efficient functions
    const maxGasFunction = functions.find(([, result]) => result.aggregated.avg === maxGas);
    const minGasFunction = functions.find(([, result]) => result.aggregated.avg === minGas);
    
    // Calculate total cost
    const totalCostSTT = functions.reduce((sum, [, result]) => {
      return sum + (result.aggregated.total * 6e-9);
    }, 0);

    return {
      averageGasUsage: Math.round(avgGas),
      gasRange: { min: minGas, max: maxGas },
      mostExpensive: maxGasFunction ? maxGasFunction[0] : null,
      mostEfficient: minGasFunction ? minGasFunction[0] : null,
      totalAnalysisCostSTT: totalCostSTT.toFixed(8),
      totalGasConsumed: totalGas,
      totalCalls: totalCalls
    };
  }

  /**
   * Generate optimization recommendations
   * @param {Object} profilingData - Gas profiling results
   * @returns {Array} List of recommendations
   */
  generateRecommendations(profilingData) {
    const recommendations = [];
    const functions = Object.entries(profilingData.results || {});
    
    // Find high gas functions
    const expensiveFunctions = functions.filter(([, result]) => 
      result.aggregated.avg > this.gasThresholds.high
    );
    
    if (expensiveFunctions.length > 0) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'High Gas Functions Detected',
        description: `${expensiveFunctions.length} function(s) consume over 1M gas`,
        functions: expensiveFunctions.map(([func]) => func),
        suggestion: 'Consider optimizing these functions for production use'
      });
    }

    // Check for view functions with high gas usage
    const expensiveViewFunctions = functions.filter(([func, result]) => 
      this.isViewFunction(func) && result.aggregated.avg > 100000
    );
    
    if (expensiveViewFunctions.length > 0) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        title: 'Expensive View Functions',
        description: 'View functions should be gas-efficient for better UX',
        functions: expensiveViewFunctions.map(([func]) => func),
        suggestion: 'Review storage access patterns and consider caching'
      });
    }

    // Find most efficient patterns
    const efficientFunctions = functions.filter(([, result]) => 
      result.aggregated.avg < this.gasThresholds.excellent
    ).slice(0, 3);
    
    if (efficientFunctions.length > 0) {
      recommendations.push({
        type: 'best_practice',
        priority: 'info',
        title: 'Most Efficient Functions',
        description: 'These functions demonstrate excellent gas efficiency',
        functions: efficientFunctions.map(([func]) => func),
        suggestion: 'Use similar patterns in other functions'
      });
    }

    return recommendations;
  }

  /**
   * Generate summary statistics
   * @param {Object} profilingData - Gas profiling results
   * @returns {Object} Summary data
   */
  generateSummary(profilingData) {
    const functions = Object.entries(profilingData.results || {});
    const gasValues = functions.map(([, result]) => result.aggregated.avg);
    
    // Distribution analysis
    const excellentCount = gasValues.filter(gas => gas < this.gasThresholds.excellent).length;
    const goodCount = gasValues.filter(gas => 
      gas >= this.gasThresholds.excellent && gas < this.gasThresholds.good).length;
    const moderateCount = gasValues.filter(gas => 
      gas >= this.gasThresholds.good && gas < this.gasThresholds.moderate).length;
    const highCount = gasValues.filter(gas => 
      gas >= this.gasThresholds.moderate && gas < this.gasThresholds.high).length;
    const veryHighCount = gasValues.filter(gas => gas >= this.gasThresholds.high).length;

    return {
      totalFunctions: functions.length,
      efficiencyDistribution: {
        excellent: excellentCount,
        good: goodCount,
        moderate: moderateCount,
        high: highCount,
        veryHigh: veryHighCount
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if function is a view function
   * @param {string} functionName - Function signature
   * @returns {boolean} True if likely a view function
   */
  isViewFunction(functionName) {
    const viewKeywords = ['get', 'view', 'read', 'query', 'balance', 'total', 'owner', 
                         'approved', 'allowance', 'symbol', 'name', 'decimals'];
    const name = functionName.toLowerCase();
    return viewKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * Display formatted analysis output
   * @param {Object} analysisResult - Analysis result from analyzeGasProfile
   * @param {boolean} verbose - Whether to show verbose output
   * @returns {string} Returns the formatted output for potential file saving
   */
  displayAnalysis(analysisResult, verbose = false) {
    // Build output string for potential file saving
    const outputLines = [];
    
    // Add header
    outputLines.push('Somnia Gas Profiling Report');
    outputLines.push('==========================');
    
    // Add contract address and network info
    outputLines.push(`Contract: ${analysisResult.contract}`);
    outputLines.push(`Network: ${analysisResult.network}`);
    outputLines.push(`Functions Analyzed: ${analysisResult.functionsAnalyzed}`);
    outputLines.push(`Timestamp: ${new Date().toISOString()}`);
    
    if (!verbose) {
      // Show only the requested sections in terminal
      console.log('\nSomnia Gas Profiling Report');
      console.log('==========================');
      console.log(`Contract: ${analysisResult.contract}`);
      console.log(`Functions Analyzed: ${analysisResult.functionsAnalyzed}`);
    }
    
    // Add contract analysis info if available (merged with developer analysis)
    if (analysisResult.contractAnalysis) {
      outputLines.push('\nDeveloper Analysis');
      outputLines.push('-------------------');
      outputLines.push(`Contract Type: ${analysisResult.contractAnalysis.type}`);
      outputLines.push(`Complexity: ${analysisResult.contractAnalysis.complexity}`);
      outputLines.push(`Total Functions: ${analysisResult.contractAnalysis.totalFunctions}`);
      outputLines.push(`  - View/Pure: ${analysisResult.contractAnalysis.viewFunctions}`);
      outputLines.push(`  - State-changing: ${analysisResult.contractAnalysis.stateChangingFunctions}`);
      outputLines.push(`Events: ${analysisResult.contractAnalysis.events}`);
      outputLines.push(`Bytecode: ${analysisResult.contractAnalysis.bytecodeSize} bytes`);
      
      if (!verbose) {
        console.log('\nDeveloper Analysis');
        console.log('-------------------');
        console.log(`Contract Type: ${analysisResult.contractAnalysis.type}`);
        console.log(`Complexity: ${analysisResult.contractAnalysis.complexity}`);
        console.log(`Total Functions: ${analysisResult.contractAnalysis.totalFunctions}`);
        console.log(`  - View/Pure: ${analysisResult.contractAnalysis.viewFunctions}`);
        console.log(`  - State-changing: ${analysisResult.contractAnalysis.stateChangingFunctions}`);
        console.log(`Events: ${analysisResult.contractAnalysis.events}`);
        console.log(`Bytecode: ${analysisResult.contractAnalysis.bytecodeSize} bytes`);
      }
    }
    
    // Add gas analysis summary
    outputLines.push('\nSomnia Gas Profiling Results');
    outputLines.push('==============================');
    
    if (!verbose) {
      console.log('\nSomnia Gas Profiling Results');
      console.log('==============================');
    }
    
    // Categories
    if (analysisResult.categories) {
      for (const [categoryName, functions] of Object.entries(analysisResult.categories)) {
        if (functions.length === 0) continue;
        
        outputLines.push(`\n${categoryName}`);
        outputLines.push('-'.repeat(categoryName.length));
        
        if (!verbose) {
          console.log(`\n${categoryName}`);
          console.log('-'.repeat(categoryName.length));
        }
        
        functions.forEach(({ function: func, gasUsage, efficiency, costSTT }) => {
          outputLines.push(`  • ${func} - ${efficiency.rating} (${gasUsage.toLocaleString()} gas)`);
          
          if (!verbose) {
            console.log(`  • ${func} - ${efficiency.rating} (${gasUsage.toLocaleString()} gas)`);
          }
        });
      }
    }

    // Key insights
    outputLines.push('\nKey Developer Insights');
    outputLines.push('----------------------');
    outputLines.push(`• Average Gas Usage: ${analysisResult.insights.averageGasUsage.toLocaleString()}`);
    outputLines.push(`• Range: ${analysisResult.insights.gasRange.min.toLocaleString()} - ${analysisResult.insights.gasRange.max.toLocaleString()} gas`);
    outputLines.push(`• Most Expensive: ${analysisResult.insights.mostExpensive}`);
    outputLines.push(`• Most Efficient: ${analysisResult.insights.mostEfficient}`);
    outputLines.push(`• Total Analysis Cost: ${analysisResult.insights.totalAnalysisCostSTT} STT`);

    if (!verbose) {
      console.log('\nKey Developer Insights');
      console.log('----------------------');
      console.log(`• Average Gas Usage: ${analysisResult.insights.averageGasUsage.toLocaleString()}`);
      console.log(`• Most Expensive: ${analysisResult.insights.mostExpensive}`);
      console.log(`• Most Efficient: ${analysisResult.insights.mostEfficient}`);
      
      // Show only the first recommendation in terminal if any exist
      if (analysisResult.recommendations && Array.isArray(analysisResult.recommendations) && analysisResult.recommendations.length > 0) {
        console.log('\nOptimization Recommendations');
        console.log('--------------------------');
        
        const firstRec = analysisResult.recommendations[0];
        console.log(`${firstRec.title}:`);
        console.log(`  ${firstRec.suggestion}`);
        
        if (analysisResult.recommendations.length > 1) {
          console.log(`  ... and ${analysisResult.recommendations.length - 1} more recommendations`);
        }
      }
      
      console.log('\nFor full details, run with --verbose flag');
    }

    // Convert to string with newlines
    const output = outputLines.join('\n');
    
    return output;
  }
}

module.exports = {
  DeveloperAnalyzer
};