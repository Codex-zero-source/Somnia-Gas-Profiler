const chalk = require('chalk');
const fs = require('fs').promises;

const { IONetClient } = require('./io-net-client');

/**
 * Natural Language Analyzer for Somnia Gas Profiler
 * Integrates with IO.net Intelligence API for comprehensive analysis
 */
class NaturalLanguageAnalyzer {
  constructor() {
    this.ioNetClient = new IONetClient();
    this.analysisTemplates = {
      BASIC: 'basic_analysis',
      OPTIMIZATION: 'optimization_analysis',
      COMPARISON: 'comparison_analysis',
      DEPLOYMENT: 'deployment_analysis',
      COST_ANALYSIS: 'cost_analysis'
    };
  }

  /**
   * Generate comprehensive natural language analysis
   * @param {Object} profilingData - Raw profiling results
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result with sections
   */
  async generateAnalysis(profilingData, options = {}) {
    try {
      if (!this.ioNetClient.isConfigured()) {
        throw new Error('IO.net API not configured. Set IOINTELLIGENCE_API_KEY in environment.');
      }

      console.log(chalk.blue('🧠 Generating comprehensive AI analysis...\n'));

      const analysisType = options.type || this.analysisTemplates.BASIC;
      const analysis = await this.performAnalysis(profilingData, analysisType, options);

      return {
        type: analysisType,
        timestamp: new Date().toISOString(),
        contractAddress: profilingData.address,
        analysis: analysis,
        metadata: this.extractMetadata(profilingData),
        recommendations: await this.generateRecommendations(profilingData, analysis)
      };

    } catch (error) {
      throw new Error(`Natural language analysis failed: ${error.message}`);
    }
  }

  /**
   * Perform specific type of analysis
   * @param {Object} profilingData - Profiling results
   * @param {string} analysisType - Type of analysis to perform
   * @param {Object} options - Analysis options
   * @returns {Promise<string>} Analysis text
   */
  async performAnalysis(profilingData, analysisType, options) {
    const prompt = this.buildAnalysisPrompt(profilingData, analysisType, options);
    
    try {
      const analysis = await this.ioNetClient.analyzeGasProfile(profilingData, profilingData.address);
      return analysis;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  IO.net analysis failed: ${error.message}`));
      return this.generateFallbackAnalysis(profilingData, analysisType);
    }
  }

  /**
   * Build custom analysis prompt based on type and context
   * @param {Object} profilingData - Profiling results
   * @param {string} analysisType - Analysis type
   * @param {Object} options - Additional options
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(profilingData, analysisType, options) {
    const baseContext = this.extractAnalysisContext(profilingData);
    
    switch (analysisType) {
      case this.analysisTemplates.OPTIMIZATION:
        return this.buildOptimizationPrompt(baseContext, options);
      
      case this.analysisTemplates.COMPARISON:
        return this.buildComparisonPrompt(baseContext, options);
      
      case this.analysisTemplates.DEPLOYMENT:
        return this.buildDeploymentPrompt(baseContext, options);
      
      case this.analysisTemplates.COST_ANALYSIS:
        return this.buildCostAnalysisPrompt(baseContext, options);
      
      default:
        return this.buildBasicPrompt(baseContext, options);
    }
  }

  /**
   * Extract analysis context from profiling data
   * @param {Object} profilingData - Profiling results
   * @returns {Object} Analysis context
   */
  extractAnalysisContext(profilingData) {
    const functions = Object.entries(profilingData.results || {});
    const totalGas = functions.reduce((sum, [, result]) => sum + result.aggregated.total, 0);
    const avgGasPerFunction = totalGas / functions.length;
    
    // Identify high and low gas functions
    const sortedByGas = functions.sort((a, b) => b[1].aggregated.avg - a[1].aggregated.avg);
    const highestGas = sortedByGas.slice(0, 3);
    const lowestGas = sortedByGas.slice(-3);

    // Check for cost data
    const hasCostData = functions.some(([, result]) => 
      result.runs.some(run => run.costInSTT !== undefined)
    );

    return {
      contractAddress: profilingData.address,
      totalFunctions: functions.length,
      totalGas,
      avgGasPerFunction,
      highestGasFunctions: highestGas,
      lowestGasFunctions: lowestGas,
      hasCostData,
      timestamp: profilingData.timestamp,
      network: 'Somnia Testnet'
    };
  }

  /**
   * Build optimization-focused prompt
   * @param {Object} context - Analysis context
   * @param {Object} options - Options
   * @returns {string} Optimization prompt
   */
  buildOptimizationPrompt(context, options) {
    return `
Contract Gas Optimization Analysis Request:

Contract: ${context.contractAddress}
Network: ${context.network}
Functions Analyzed: ${context.totalFunctions}
Total Gas Consumption: ${context.totalGas.toLocaleString()}

HIGH GAS FUNCTIONS:
${context.highestGasFunctions.map(([sig, result]) => 
  `- ${sig}: ${result.aggregated.avg.toLocaleString()} gas average`
).join('\\n')}

LOW GAS FUNCTIONS:
${context.lowestGasFunctions.map(([sig, result]) => 
  `- ${sig}: ${result.aggregated.avg.toLocaleString()} gas average`
).join('\\n')}

Please provide:
1. Specific optimization opportunities for high-gas functions
2. Code patterns that could be improved
3. Solidity best practices recommendations
4. Potential gas savings estimates
5. Risk assessment for optimization strategies
6. Priority order for optimization implementation

Focus on actionable, specific recommendations with technical details.`;
  }

  /**
   * Build comparison-focused prompt
   * @param {Object} context - Analysis context
   * @param {Object} options - Options with comparison data
   * @returns {string} Comparison prompt
   */
  buildComparisonPrompt(context, options) {
    return `
Gas Profiling Comparison Analysis:

Primary Contract: ${context.contractAddress}
${options.comparisonData ? `Comparison Contract: ${options.comparisonData.address}` : ''}

Please analyze the gas efficiency differences between these implementations and provide:
1. Performance comparison summary
2. Functions with significant gas differences
3. Possible reasons for gas variations
4. Recommendations for the better-performing patterns
5. Deployment cost implications
6. Long-term cost efficiency analysis

Focus on practical insights for contract optimization decisions.`;
  }

  /**
   * Build deployment-focused prompt
   * @param {Object} context - Analysis context
   * @param {Object} options - Options
   * @returns {string} Deployment prompt
   */
  buildDeploymentPrompt(context, options) {
    return `
Smart Contract Deployment Analysis:

Contract: ${context.contractAddress}
Network: Somnia Testnet
Compilation Details: ${options.compilationData ? 
  `Optimizer: ${options.compilationData.optimizationRuns} runs, Compiler: ${options.compilationData.compiler}` : 
  'Standard compilation'}

Gas Analysis Summary:
- Total Functions: ${context.totalFunctions}
- Average Gas per Function: ${Math.round(context.avgGasPerFunction).toLocaleString()}
- Total Test Gas: ${context.totalGas.toLocaleString()}

Please provide deployment-focused analysis including:
1. Production readiness assessment
2. Expected user interaction costs
3. Scaling considerations for high usage
4. Gas price sensitivity analysis
5. Network-specific optimizations for Somnia
6. Monitoring recommendations for production

Consider real-world usage patterns and cost implications.`;
  }

  /**
   * Build cost-focused prompt
   * @param {Object} context - Analysis context
   * @param {Object} options - Options
   * @returns {string} Cost analysis prompt
   */
  buildCostAnalysisPrompt(context, options) {
    if (!context.hasCostData) {
      return this.buildBasicPrompt(context, options);
    }

    return `
Smart Contract Cost Analysis (Somnia Network):

Contract: ${context.contractAddress}
Cost Data Available: Yes (STT token costs calculated)

Please provide comprehensive cost analysis including:
1. User interaction cost estimates in STT
2. Cost-effectiveness compared to other networks
3. Gas price volatility impact
4. Cost optimization strategies
5. Break-even analysis for different usage patterns
6. Budget recommendations for dApp operators

Focus on practical cost implications for users and developers on Somnia network.`;
  }

  /**
   * Build basic analysis prompt
   * @param {Object} context - Analysis context
   * @param {Object} options - Options
   * @returns {string} Basic prompt
   */
  buildBasicPrompt(context, options) {
    return `
Smart Contract Gas Profiling Analysis:

Contract: ${context.contractAddress}
Network: ${context.network}
Functions Analyzed: ${context.totalFunctions}

Please provide comprehensive analysis including:
1. Overall gas efficiency assessment
2. Function-by-function efficiency evaluation
3. Potential optimization opportunities
4. Best practices compliance
5. Production deployment recommendations
6. Cost implications for end users

Provide actionable insights for smart contract optimization.`;
  }

  /**
   * Generate specific recommendations based on analysis
   * @param {Object} profilingData - Profiling results
   * @param {string} analysis - AI analysis text
   * @returns {Promise<Array>} Array of recommendations
   */
  async generateRecommendations(profilingData, analysis) {
    const recommendations = [];
    const functions = Object.entries(profilingData.results || {});

    // High gas usage recommendations
    const highGasFunctions = functions
      .filter(([, result]) => result.aggregated.avg > 100000)
      .sort((a, b) => b[1].aggregated.avg - a[1].aggregated.avg);

    if (highGasFunctions.length > 0) {
      recommendations.push({
        type: 'high_gas_usage',
        priority: 'high',
        title: 'Optimize High Gas Functions',
        description: `Functions ${highGasFunctions.map(([sig]) => sig).join(', ')} consume significant gas`,
        impact: 'High cost reduction potential',
        effort: 'Medium to High'
      });
    }

    // Gas variance recommendations
    const variableFunctions = functions.filter(([, result]) => {
      const variance = (result.aggregated.max - result.aggregated.min) / result.aggregated.avg;
      return variance > 0.1; // 10% variance
    });

    if (variableFunctions.length > 0) {
      recommendations.push({
        type: 'gas_variance',
        priority: 'medium',
        title: 'Investigate Gas Variance',
        description: 'Some functions show significant gas usage variation',
        impact: 'Improved predictability',
        effort: 'Low to Medium'
      });
    }

    // Add AI-derived recommendations
    const aiRecommendations = this.extractRecommendationsFromAnalysis(analysis);
    recommendations.push(...aiRecommendations);

    return recommendations;
  }

  /**
   * Extract recommendations from AI analysis text
   * @param {string} analysis - AI analysis text
   * @returns {Array} Extracted recommendations
   */
  extractRecommendationsFromAnalysis(analysis) {
    const recommendations = [];
    
    // Simple keyword-based extraction (could be enhanced with NLP)
    if (analysis.toLowerCase().includes('optimization')) {
      recommendations.push({
        type: 'ai_optimization',
        priority: 'medium',
        title: 'AI-Identified Optimization Opportunities',
        description: 'AI analysis identified specific optimization opportunities',
        impact: 'Variable',
        effort: 'Requires analysis'
      });
    }

    if (analysis.toLowerCase().includes('expensive') || analysis.toLowerCase().includes('high cost')) {
      recommendations.push({
        type: 'cost_reduction',
        priority: 'high',
        title: 'Cost Reduction Opportunity',
        description: 'AI identified high-cost operations that could be optimized',
        impact: 'Cost savings',
        effort: 'Medium'
      });
    }

    return recommendations;
  }

  /**
   * Generate fallback analysis when AI is not available
   * @param {Object} profilingData - Profiling results
   * @param {string} analysisType - Analysis type
   * @returns {string} Fallback analysis
   */
  generateFallbackAnalysis(profilingData, analysisType) {
    const functions = Object.entries(profilingData.results || {});
    const totalGas = functions.reduce((sum, [, result]) => sum + result.aggregated.total, 0);
    
    const highestGas = functions.sort((a, b) => b[1].aggregated.avg - a[1].aggregated.avg)[0];
    const lowestGas = functions.sort((a, b) => a[1].aggregated.avg - b[1].aggregated.avg)[0];

    return `
AUTOMATED ANALYSIS (AI service unavailable)

Contract: ${profilingData.address}
Functions Analyzed: ${functions.length}
Total Gas Consumed: ${totalGas.toLocaleString()}

PERFORMANCE OVERVIEW:
- Highest gas function: ${highestGas[0]} (${highestGas[1].aggregated.avg.toLocaleString()} gas avg)
- Lowest gas function: ${lowestGas[0]} (${lowestGas[1].aggregated.avg.toLocaleString()} gas avg)
- Average per function: ${Math.round(totalGas / functions.length).toLocaleString()} gas

RECOMMENDATIONS:
1. Review high-gas functions for optimization opportunities
2. Consider gas-efficient alternatives for expensive operations
3. Implement proper testing for gas usage validation
4. Monitor gas costs in production environment

Note: Enhanced AI analysis available when IOINTELLIGENCE_API_KEY is configured.
`;
  }

  /**
   * Extract metadata from profiling data
   * @param {Object} profilingData - Profiling results
   * @returns {Object} Extracted metadata
   */
  extractMetadata(profilingData) {
    const functions = Object.entries(profilingData.results || {});
    
    return {
      totalFunctions: functions.length,
      totalRuns: functions.reduce((sum, [, result]) => sum + result.runs.length, 0),
      totalGas: functions.reduce((sum, [, result]) => sum + result.aggregated.total, 0),
      avgGasPerFunction: functions.reduce((sum, [, result]) => sum + result.aggregated.avg, 0) / functions.length,
      network: 'Somnia Testnet',
      rpcEndpoint: profilingData.rpc,
      analysisTimestamp: new Date().toISOString()
    };
  }

  /**
   * Display formatted analysis results
   * @param {Object} analysisResult - Complete analysis result
   */
  displayAnalysis(analysisResult) {
    console.log(chalk.cyan('\\n🧠 Natural Language Analysis Report'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(chalk.white(`Contract: ${analysisResult.contractAddress}`));
    console.log(chalk.white(`Analysis Type: ${analysisResult.type}`));
    console.log(chalk.white(`Generated: ${new Date(analysisResult.timestamp).toLocaleString()}`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(analysisResult.analysis));
    
    if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
      console.log(chalk.cyan('\\n📋 Recommendations'));
      console.log(chalk.gray('─'.repeat(40)));
      
      analysisResult.recommendations.forEach((rec, index) => {
        const priorityColor = rec.priority === 'high' ? chalk.red : 
                            rec.priority === 'medium' ? chalk.yellow : chalk.green;
        
        console.log(`${index + 1}. ${chalk.bold(rec.title)} ${priorityColor(`[${rec.priority.toUpperCase()}]`)}`);
        console.log(`   ${chalk.gray(rec.description)}`);
        console.log(`   ${chalk.gray(`Impact: ${rec.impact} | Effort: ${rec.effort}`)}`);
        console.log('');
      });
    }
  }

  /**
   * Save analysis to file
   * @param {Object} analysisResult - Analysis result
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async saveAnalysis(analysisResult, outputPath) {
    try {
      const analysisJSON = JSON.stringify(analysisResult, null, 2);
      await fs.writeFile(outputPath, analysisJSON, 'utf8');
      console.log(chalk.green(`💾 Analysis saved to ${outputPath}`));
    } catch (error) {
      throw new Error(`Failed to save analysis: ${error.message}`);
    }
  }
}

module.exports = {
  NaturalLanguageAnalyzer
};