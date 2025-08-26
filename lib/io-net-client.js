const axios = require('axios');
const chalk = require('chalk');

/**
 * IO.net Intelligence API Client
 * Provides natural language analysis for gas profiling data
 */
class IONetClient {
  constructor() {
    this.apiEndpoint = 'https://api.intelligence.io.solutions/api/v1/chat/completions';
    this.model = 'deepseek-ai/DeepSeek-R1-0528';
    this.apiKey = process.env.IOINTELLIGENCE_API_KEY;
  }

  /**
   * Check if IO.net API key is configured
   * @returns {boolean} True if API key is available
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Send gas profiling data to IO.net for natural language analysis
   * @param {Object} profilingData - Structured gas profiling results
   * @param {string} contractAddress - Contract address being analyzed
   * @returns {Promise<string>} Natural language analysis
   */
  async analyzeGasProfile(profilingData, contractAddress) {
    if (!this.isConfigured()) {
      throw new Error('IOINTELLIGENCE_API_KEY not configured. Set in .env file to enable AI analysis.');
    }

    try {
      console.log(chalk.blue('🤖 Generating AI-powered gas analysis via IO.net...'));

      const systemPrompt = "You are an expert Ethereum smart contract gas optimization analyst. Analyze the provided gas profiling data and provide actionable insights for developers.";
      
      const userPrompt = this.formatProfilingData(profilingData, contractAddress);

      const response = await axios.post(this.apiEndpoint, {
        model: this.model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 30000 // 30 second timeout
      });

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const analysis = response.data.choices[0].message.content;
        
        // Log usage statistics
        if (response.data.usage) {
          console.log(chalk.gray(`📊 Tokens used: ${response.data.usage.total_tokens} (prompt: ${response.data.usage.prompt_tokens}, completion: ${response.data.usage.completion_tokens})`));
        }

        return analysis;
      } else {
        throw new Error('Invalid response format from IO.net API');
      }

    } catch (error) {
      if (error.response) {
        // API returned an error response
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.response.statusText;
        throw new Error(`IO.net API error (${status}): ${message}`);
      } else if (error.request) {
        // Network error
        throw new Error('Failed to connect to IO.net API. Check your internet connection.');
      } else {
        // Other error
        throw new Error(`IO.net analysis failed: ${error.message}`);
      }
    }
  }

  /**
   * Format profiling data for IO.net analysis
   * @param {Object} profilingData - Raw profiling results
   * @param {string} contractAddress - Contract address
   * @returns {string} Formatted prompt for analysis
   */
  formatProfilingData(profilingData, contractAddress) {
    const functionCount = Object.keys(profilingData.results || {}).length;
    let formattedData = '';

    // Build summary of profiling results
    const functions = [];
    for (const [funcSig, result] of Object.entries(profilingData.results || {})) {
      functions.push({
        signature: funcSig,
        avgGas: result.aggregated.avg,
        minGas: result.aggregated.min,
        maxGas: result.aggregated.max,
        totalGas: result.aggregated.total,
        runs: result.aggregated.callCount,
        avgCost: result.aggregated.avgCost || null,
        totalCost: result.aggregated.totalCost || null
      });
    }

    // Sort by average gas consumption
    functions.sort((a, b) => b.avgGas - a.avgGas);

    // Format function data
    formattedData += 'Function Gas Analysis:\\n';
    functions.forEach(func => {
      formattedData += `- ${func.signature}: ${func.avgGas.toLocaleString()} gas avg (${func.minGas.toLocaleString()}-${func.maxGas.toLocaleString()}) over ${func.runs} runs`;
      if (func.avgCost) {
        formattedData += `, ${func.avgCost.toFixed(8)} STT avg cost`;
      }
      formattedData += '\\n';
    });

    // Calculate totals
    const totalGas = functions.reduce((sum, f) => sum + f.totalGas, 0);
    const totalCost = functions.reduce((sum, f) => sum + (f.totalCost || 0), 0);

    formattedData += `\\nTotals: ${totalGas.toLocaleString()} gas across ${functions.reduce((sum, f) => sum + f.runs, 0)} transactions`;
    if (totalCost > 0) {
      formattedData += `, ${totalCost.toFixed(8)} STT total cost`;
    }

    const prompt = `Contract Address: ${contractAddress}
Network: Somnia Testnet
Functions Profiled: ${functionCount}

Gas Profiling Results:
${formattedData}

Please provide:
1. Overall gas efficiency assessment
2. Most/least efficient functions
3. Optimization opportunities
4. Cost estimates for typical usage
5. Best practices recommendations

Focus on actionable insights for smart contract developers working on the Somnia network.`;

    return prompt;
  }

  /**
   * Format analysis output for CLI display
   * @param {string} analysis - Raw analysis from IO.net
   * @returns {string} Formatted output for console
   */
  formatAnalysisOutput(analysis) {
    return `
${chalk.cyan('🧠 AI Gas Analysis Summary')}
${chalk.gray('─'.repeat(60))}
${chalk.white(analysis)}
`;
  }

  /**
   * Display configuration status
   */
  displayStatus() {
    if (this.isConfigured()) {
      console.log(chalk.green('✅ IO.net Intelligence API configured'));
      console.log(chalk.gray(`   Model: ${this.model}`));
      console.log(chalk.gray(`   Endpoint: ${this.apiEndpoint}`));
    } else {
      console.log(chalk.yellow('⚠️  IO.net Intelligence API not configured'));
      console.log(chalk.gray('   Set IOINTELLIGENCE_API_KEY in .env to enable AI analysis'));
    }
  }
}

module.exports = {
  IONetClient
};