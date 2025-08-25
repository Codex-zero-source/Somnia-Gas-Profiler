const chalk = require('chalk');

/**
 * Natural Language Summary Generator for Gas Profiling Results
 * Provides AI-powered insights and optimization recommendations
 */
class NaturalLanguageSummaryGenerator {
  constructor() {
    this.openai = null;
    this.initialized = false;
  }

  /**
   * Initialize OpenAI client
   * @returns {boolean} Success status
   */
  async initialize() {
    try {
      // Check for API key
      if (!process.env.OPENAI_API_KEY) {
        console.log(chalk.yellow('⚠️  OPENAI_API_KEY not found. Natural language summaries will be unavailable.'));
        console.log(chalk.gray('   Set OPENAI_API_KEY environment variable to enable AI summaries.'));
        return false;
      }

      // Try to load OpenAI
      let OpenAI;
      try {
        OpenAI = require('openai');
      } catch (error) {
        console.log(chalk.yellow('⚠️  OpenAI package not available. Install with: npm install openai'));
        return false;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      this.initialized = true;
      return true;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to initialize AI services: ${error.message}`));
      return false;
    }
  }

  /**
   * Generate natural language summary from profiling data
   * @param {Object} profilingData - The gas profiling results
   * @returns {Promise<string>} Natural language summary
   */
  async generateSummary(profilingData) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        return null;
      }
    }

    try {
      console.log(chalk.blue('\n🤖 Generating AI-powered summary...\n'));

      // Prepare data for analysis
      const functionsData = Object.entries(profilingData.results).map(([func, result]) => ({
        function: func,
        avgGas: result.aggregated.avg,
        minGas: result.aggregated.min,
        maxGas: result.aggregated.max,
        totalGas: result.aggregated.total,
        calls: result.aggregated.callCount,
        variance: result.aggregated.max - result.aggregated.min
      }));

      // Sort by average gas consumption
      functionsData.sort((a, b) => b.avgGas - a.avgGas);

      const prompt = this.buildAnalysisPrompt(profilingData, functionsData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3
      });

      const summary = response.choices[0].message.content.trim();
      
      console.log(chalk.cyan('🧠 AI Analysis Summary'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.white(summary));
      console.log('\n');

      return summary;

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to generate AI summary: ${error.message}`));
      return null;
    }
  }

  /**
   * Build analysis prompt for OpenAI
   * @param {Object} profilingData - Complete profiling data
   * @param {Array} functionsData - Processed function data
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(profilingData, functionsData) {
    const totalGas = functionsData.reduce((sum, f) => sum + f.totalGas, 0);
    const totalCalls = functionsData.reduce((sum, f) => sum + f.calls, 0);
    const avgGasPerTx = Math.round(totalGas / totalCalls);

    return `Analyze this Somnia blockchain gas profiling data and provide actionable insights (max 250 words):

**Contract Analysis:**
- Contract: ${profilingData.address}
- Network: ${profilingData.network}
- Total Transactions: ${totalCalls}
- Average Gas per Transaction: ${avgGasPerTx.toLocaleString()}

**Function Gas Usage:**
${functionsData.map(f => `- ${f.function}: ${f.avgGas.toLocaleString()} gas avg (${f.minGas.toLocaleString()}-${f.maxGas.toLocaleString()} range, ${f.calls} calls)`).join('\n')}

**Focus Areas:**
1. **Gas Efficiency Patterns**: Identify most/least efficient functions
2. **Optimization Opportunities**: Specific recommendations for gas reduction
3. **Cost Analysis**: Relative expense of different operations
4. **Variance Analysis**: Functions with high gas variance (>${functionsData.filter(f => f.variance > f.avgGas * 0.1).length} functions show >10% variance)

Provide technical, actionable insights for smart contract developers. Include specific optimization strategies and highlight any unusual gas patterns.`;
  }

  /**
   * Generate comparison insights between two profiling results
   * @param {Object} comparison - Comparison data from reporter
   * @returns {Promise<string>} Natural language comparison analysis
   */
  async generateComparisonSummary(comparison) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        return null;
      }
    }

    try {
      console.log(chalk.blue('\n🔍 Generating AI comparison analysis...\n'));

      const improvements = [];
      const regressions = [];

      Object.entries(comparison.differences).forEach(([func, diff]) => {
        if (diff.avg_gas_diff < 0) {
          improvements.push({ func, diff: Math.abs(diff.avg_gas_diff), percent: Math.abs(parseFloat(diff.avg_gas_percent)) });
        } else if (diff.avg_gas_diff > 0) {
          regressions.push({ func, diff: diff.avg_gas_diff, percent: parseFloat(diff.avg_gas_percent) });
        }
      });

      const prompt = `Analyze this gas usage comparison between two Somnia smart contract versions:

**Comparison Overview:**
- Before: ${comparison.file1}
- After: ${comparison.file2}

**Improvements (${improvements.length} functions):**
${improvements.map(i => `- ${i.func}: -${i.diff.toLocaleString()} gas (-${i.percent.toFixed(1)}%)`).join('\n') || 'None'}

**Regressions (${regressions.length} functions):**
${regressions.map(r => `- ${r.func}: +${r.diff.toLocaleString()} gas (+${r.percent.toFixed(1)}%)`).join('\n') || 'None'}

Provide insights on:
1. Overall optimization success
2. Potential causes of improvements/regressions
3. Recommendations for further optimization
4. Impact assessment of changes

Keep response under 200 words, focus on actionable insights.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.3
      });

      const summary = response.choices[0].message.content.trim();
      
      console.log(chalk.cyan('🔍 AI Comparison Analysis'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.white(summary));
      console.log('\n');

      return summary;

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to generate comparison analysis: ${error.message}`));
      return null;
    }
  }

  /**
   * Generate optimization recommendations based on gas patterns
   * @param {Object} profilingData - The gas profiling results
   * @returns {Promise<Array>} Array of optimization recommendations
   */
  async generateOptimizationRecommendations(profilingData) {
    const functionsData = Object.entries(profilingData.results).map(([func, result]) => ({
      function: func,
      avgGas: result.aggregated.avg,
      variance: result.aggregated.max - result.aggregated.min
    }));

    const recommendations = [];

    // High gas consumption functions
    const highGasFunctions = functionsData.filter(f => f.avgGas > 50000);
    if (highGasFunctions.length > 0) {
      recommendations.push({
        type: 'high_gas',
        priority: 'HIGH',
        title: 'High Gas Consumption Functions',
        description: `Functions consuming >50k gas: ${highGasFunctions.map(f => f.function).join(', ')}`,
        suggestion: 'Consider optimizing storage operations, loops, and external calls'
      });
    }

    // High variance functions
    const highVarianceFunctions = functionsData.filter(f => f.variance > f.avgGas * 0.2);
    if (highVarianceFunctions.length > 0) {
      recommendations.push({
        type: 'high_variance',
        priority: 'MEDIUM',
        title: 'Inconsistent Gas Usage',
        description: `Functions with >20% gas variance: ${highVarianceFunctions.map(f => f.function).join(', ')}`,
        suggestion: 'Review conditional logic and dynamic operations for optimization opportunities'
      });
    }

    return recommendations;
  }
}

module.exports = {
  NaturalLanguageSummaryGenerator,
  createSummaryGenerator: () => new NaturalLanguageSummaryGenerator()
};