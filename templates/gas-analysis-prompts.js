/**
 * Gas Analysis Prompt Templates for IO.net Integration
 * Provides various prompt templates for different analysis scenarios
 */

const GasAnalysisPrompts = {
  /**
   * System prompt for gas optimization expert
   */
  SYSTEM_PROMPT: "You are an expert Ethereum smart contract gas optimization analyst with deep knowledge of EVM internals, Solidity best practices, and cost-effective smart contract design. Analyze the provided gas profiling data and provide actionable insights for developers working on the Somnia network.",

  /**
   * Basic gas analysis prompt template
   * @param {Object} data - Profiling data context
   * @returns {string} Formatted prompt
   */
  BASIC_ANALYSIS: (data) => `Contract Address: ${data.address}
Network: Somnia Testnet
Functions Profiled: ${data.functionCount}
Total Transactions: ${data.totalTransactions}
Total Gas Consumed: ${data.totalGas.toLocaleString()}

Gas Profiling Results:
${data.functionsData}

Please provide:
1. Overall gas efficiency assessment
2. Most/least efficient functions
3. Optimization opportunities
4. Cost estimates for typical usage patterns
5. Best practices recommendations

Focus on actionable insights for Somnia developers.`,

  /**
   * Optimization-focused analysis prompt
   * @param {Object} data - Profiling data with optimization context
   * @returns {string} Formatted prompt
   */
  OPTIMIZATION_ANALYSIS: (data) => `Contract Address: ${data.address}
Network: Somnia Testnet
Contract Type: ${data.contractType || 'Unknown'}
Optimization Level: ${data.optimizationLevel || 'Default'}

Gas Profiling Results:
${data.functionsData}

Cost Analysis:
${data.costData || 'Cost data not available'}

Focus on optimization analysis:
1. Identify the most gas-inefficient functions
2. Suggest specific optimization techniques (storage packing, function ordering, etc.)
3. Estimate potential gas savings from optimizations
4. Recommend refactoring strategies
5. Highlight any anti-patterns or red flags

Provide specific, technical recommendations with estimated gas savings.`,

  /**
   * Comparison analysis prompt for before/after optimization
   * @param {Object} data - Comparison data
   * @returns {string} Formatted prompt
   */
  COMPARISON_ANALYSIS: (data) => `Gas Optimization Comparison Analysis
Contract: ${data.address}
Network: Somnia Testnet

BEFORE Optimization:
${data.beforeData}

AFTER Optimization:
${data.afterData}

Changes Summary:
${data.changesData}

Please analyze:
1. Overall optimization effectiveness
2. Function-by-function improvement analysis
3. Cost savings achieved
4. Any remaining optimization opportunities
5. Trade-offs or potential issues introduced

Provide a comprehensive optimization report with specific metrics.`,

  /**
   * Contract type detection and analysis prompt
   * @param {Object} data - Contract data for type detection
   * @returns {string} Formatted prompt
   */
  CONTRACT_TYPE_ANALYSIS: (data) => `Contract Bytecode Analysis
Network: Somnia Testnet
Functions Detected: ${data.functions.join(', ')}

Please analyze this contract and provide:
1. Contract type identification (ERC20, ERC721, DeFi protocol, etc.)
2. Standard compliance assessment
3. Gas efficiency compared to similar contracts
4. Common optimization patterns for this contract type
5. Specific recommendations based on contract category

Focus on identifying the contract purpose and type-specific optimizations.`,

  /**
   * Cost impact analysis prompt
   * @param {Object} data - Cost-focused analysis data
   * @returns {string} Formatted prompt
   */
  COST_IMPACT_ANALYSIS: (data) => `Transaction Cost Analysis
Contract: ${data.address}
Network: Somnia Testnet
Current Gas Price: ${data.gasPrice} gwei

Function Costs in STT:
${data.costBreakdown}

Usage Patterns:
${data.usagePatterns || 'Typical smart contract usage'}

Please analyze:
1. Cost implications for end users
2. Most expensive operations and their business justification
3. Recommendations for cost reduction
4. Alternative implementation strategies
5. User experience impact of current gas costs

Focus on the economic impact and user adoption implications.`,

  /**
   * Security and efficiency analysis prompt
   * @param {Object} data - Security-focused analysis data
   * @returns {string} Formatted prompt
   */
  SECURITY_EFFICIENCY_ANALYSIS: (data) => `Security & Efficiency Analysis
Contract: ${data.address}
Network: Somnia Testnet

Gas Patterns Detected:
${data.gasPatterns}

Function Analysis:
${data.functionsData}

Please analyze for:
1. Gas-related security vulnerabilities (DoS via gas limit, etc.)
2. Efficiency vs security trade-offs
3. Functions with unexpectedly high gas usage (potential issues)
4. Recommendations for secure optimization
5. Best practices for gas-efficient security

Focus on maintaining security while optimizing efficiency.`,

  /**
   * Generate appropriate prompt based on analysis type
   * @param {string} analysisType - Type of analysis to perform
   * @param {Object} data - Profiling data
   * @returns {string} Generated prompt
   */
  generatePrompt(analysisType, data) {
    switch (analysisType) {
      case 'basic':
        return this.BASIC_ANALYSIS(data);
      case 'optimization':
        return this.OPTIMIZATION_ANALYSIS(data);
      case 'comparison':
        return this.COMPARISON_ANALYSIS(data);
      case 'contract_type':
        return this.CONTRACT_TYPE_ANALYSIS(data);
      case 'cost_impact':
        return this.COST_IMPACT_ANALYSIS(data);
      case 'security':
        return this.SECURITY_EFFICIENCY_ANALYSIS(data);
      default:
        return this.BASIC_ANALYSIS(data);
    }
  },

  /**
   * Format function data for prompt inclusion
   * @param {Object} results - Profiling results
   * @returns {string} Formatted function data
   */
  formatFunctionData(results) {
    let output = '';
    
    const functions = Object.entries(results).map(([sig, data]) => ({
      signature: sig,
      ...data.aggregated
    }));

    // Sort by average gas consumption (highest first)
    functions.sort((a, b) => b.avg - a.avg);

    functions.forEach(func => {
      output += `- ${func.signature}: `;
      output += `${func.avg.toLocaleString()} gas avg `;
      output += `(${func.min.toLocaleString()}-${func.max.toLocaleString()}) `;
      output += `over ${func.callCount} runs`;
      
      if (func.avgCost) {
        output += `, ${func.avgCost.toFixed(8)} STT avg cost`;
      }
      
      output += '\\n';
    });

    return output;
  },

  /**
   * Format cost data for prompt inclusion
   * @param {Object} results - Profiling results with cost data
   * @returns {string} Formatted cost data
   */
  formatCostData(results) {
    let output = '';
    let totalCost = 0;
    let totalTransactions = 0;

    for (const [sig, data] of Object.entries(results)) {
      if (data.aggregated.avgCost) {
        output += `- ${sig}: ${data.aggregated.avgCost.toFixed(8)} STT avg, `;
        output += `${data.aggregated.totalCost.toFixed(8)} STT total\\n`;
        totalCost += data.aggregated.totalCost;
        totalTransactions += data.aggregated.callCount;
      }
    }

    if (totalCost > 0) {
      output += `\\nTotal Cost: ${totalCost.toFixed(8)} STT across ${totalTransactions} transactions\\n`;
      output += `Average Cost per Transaction: ${(totalCost / totalTransactions).toFixed(8)} STT`;
    }

    return output || 'Cost data not available (gasless mode)';
  }
};

module.exports = {
  GasAnalysisPrompts
};