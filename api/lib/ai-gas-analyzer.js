const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class AIGasAnalyzer {
  constructor(config = {}) {
    this.provider = config.provider || process.env.AI_PROVIDER || 'iointelligence';
    this.apiKey = this.getApiKey();
    this.apiEndpoint = process.env.IOINTELLIGENCE_API_ENDPOINT || 'https://api.intelligence.io.solutions/api/v1';
    this.model = process.env.IOINTELLIGENCE_MODEL || 'mistralai/Mistral-Large-Instruct-2411';
    this.enabled = process.env.AI_ANALYSIS_ENABLED === 'true';
    this.maxRetries = parseInt(process.env.AI_MAX_RETRIES) || 3;
    this.timeout = parseInt(process.env.AI_TIMEOUT) || 30000;
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.7;
    this.encryptSensitiveData = process.env.AI_ENCRYPT_SENSITIVE_DATA === 'true';
    this.anonymizeContractData = process.env.AI_ANONYMIZE_CONTRACT_DATA === 'true';
    this.secureTransmission = process.env.AI_SECURE_TRANSMISSION === 'true';
  }

  getApiKey() {
    switch (this.provider) {
      case 'iointelligence':
        return process.env.IOINTELLIGENCE_API_KEY;
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  getApiEndpoint() {
    switch (this.provider) {
      case 'iointelligence':
        return `${this.apiEndpoint}/chat/completions`;
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      case 'anthropic':
        return 'https://api.anthropic.com/v1/messages';
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  /**
   * Extract gas metrics from profiling results
   */
  extractGasMetrics(analysisData) {
    const metrics = {
      totalGasUsed: 0,
      averageGasPerFunction: 0,
      gasEfficiencyScore: 0,
      functionAnalysis: [],
      optimizationOpportunities: [],
      timestamp: new Date().toISOString()
    };

    // Handle different data structures
    let allFunctions = [];
    
    if (analysisData && analysisData.categories) {
      // Extract functions from categories structure (developer analyzer output)
      Object.values(analysisData.categories).forEach(category => {
        if (Array.isArray(category)) {
          allFunctions = allFunctions.concat(category);
        }
      });
    } else if (analysisData && analysisData.functions) {
      // Handle direct functions array
      allFunctions = analysisData.functions;
    } else {
      return metrics;
    }

    if (allFunctions.length === 0) {
      return metrics;
    }

    // Calculate total gas usage
    metrics.totalGasUsed = allFunctions.reduce((total, func) => {
      return total + (func.gasUsage || func.gasUsed || 0);
    }, 0);

    // Calculate average gas per function
    metrics.averageGasPerFunction = metrics.totalGasUsed / allFunctions.length;

    // Analyze each function
    metrics.functionAnalysis = allFunctions.map(func => ({
      name: func.function || func.name,
      gasUsed: func.gasUsage || func.gasUsed,
      complexity: this.calculateComplexity(func),
      efficiency: this.calculateEfficiency(func),
      recommendations: this.generateBasicRecommendations(func)
    }));

    // Calculate overall efficiency score (0-100)
    metrics.gasEfficiencyScore = this.calculateEfficiencyScore(metrics.functionAnalysis);

    return metrics;
  }

  /**
   * Main entry point for gas profile analysis
   */
  async analyzeGasProfile(analysisData, contractAddress, gasMetrics = null) {
    try {
      // Extract gas metrics from analysis data if not provided
      const extractedMetrics = gasMetrics || this.extractGasMetrics(analysisData);
      
      // Perform AI analysis
      return await this.analyzeWithAI(extractedMetrics, null);
    } catch (error) {
      console.error('Gas profile analysis failed:', error.message);
      return this.generateFallbackAnalysis(gasMetrics || {});
    }
  }

  /**
   * Analyze gas consumption using AI
   */
  async analyzeWithAI(gasMetrics, contractCode = null) {
    if (!this.enabled || !this.apiKey) {
      console.warn('AI analysis is disabled or API key is missing');
      return this.generateFallbackAnalysis(gasMetrics);
    }

    try {
      const analysisPrompt = this.buildAnalysisPrompt(gasMetrics, contractCode);
      const response = await this.callAIService(analysisPrompt);
      
      return this.parseAIResponse(response, gasMetrics);
    } catch (error) {
      console.error('AI analysis failed:', error.message);
      return this.generateFallbackAnalysis(gasMetrics);
    }
  }

  /**
   * Build analysis prompt for AI service
   */
  buildAnalysisPrompt(gasMetrics, contractCode) {
    const sanitizedCode = this.anonymizeContractData ? this.anonymizeCode(contractCode) : contractCode;
    
    return {
      role: 'system',
      content: `You are an expert Ethereum gas optimization analyst. Analyze the following gas consumption data and provide actionable recommendations.

Gas Metrics:
- Total Gas Used: ${gasMetrics.totalGasUsed}
- Average Gas Per Function: ${gasMetrics.averageGasPerFunction}
- Efficiency Score: ${gasMetrics.gasEfficiencyScore}
- Number of Functions: ${gasMetrics.functionAnalysis.length}

Function Analysis:
${gasMetrics.functionAnalysis.map(func => 
  `- ${func.name}: ${func.gasUsed} gas (Efficiency: ${func.efficiency})`
).join('\n')}

${contractCode ? `Contract Code (anonymized): ${sanitizedCode.substring(0, 2000)}...` : ''}

Please provide:
1. Top 3 optimization opportunities with specific gas savings estimates
2. Priority ranking (High/Medium/Low) for each recommendation
3. Implementation difficulty (Easy/Medium/Hard)
4. Expected gas savings percentage
5. Code-specific suggestions if contract code is provided

Respond in JSON format with the following structure:
{
  "confidence": 0.0-1.0,
  "recommendations": [
    {
      "title": "Optimization title",
      "description": "Detailed description",
      "priority": "High|Medium|Low",
      "difficulty": "Easy|Medium|Hard",
      "estimatedSavings": "percentage or gas amount",
      "implementation": "Step-by-step guide"
    }
  ],
  "summary": "Overall analysis summary",
  "riskAssessment": "Potential risks and considerations"
}`
    };
  }

  /**
   * Call AI service with retry logic
   */
  async callAIService(prompt, retryCount = 0) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.provider === 'anthropic') {
        headers['x-api-key'] = this.apiKey;
        delete headers['Authorization'];
      }

      const requestBody = this.buildRequestBody(prompt);
      
      const response = await axios.post(this.getApiEndpoint(), requestBody, {
        headers,
        timeout: this.timeout
      });

      return this.extractResponseContent(response.data);
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.warn(`AI service call failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.callAIService(prompt, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Build request body based on provider
   */
  buildRequestBody(prompt) {
    const baseBody = {
      model: this.getModel(),
      temperature: 0.3,
      max_tokens: 2000
    };

    if (this.provider === 'anthropic') {
      return {
        ...baseBody,
        messages: [prompt]
      };
    } else {
      return {
        ...baseBody,
        messages: [prompt]
      };
    }
  }

  getModel() {
    switch (this.provider) {
      case 'iointelligence':
        return this.model;
      case 'openai':
        return 'gpt-4';
      case 'anthropic':
        return 'claude-3-sonnet-20240229';
      default:
        return 'gpt-4';
    }
  }

  /**
   * Extract content from AI response
   */
  extractResponseContent(responseData) {
    if (this.provider === 'anthropic') {
      return responseData.content[0].text;
    } else {
      return responseData.choices[0].message.content;
    }
  }

  /**
   * Parse AI response and validate
   */
  parseAIResponse(aiResponse, originalMetrics) {
    try {
      const parsed = JSON.parse(aiResponse);
      
      // Validate confidence threshold
      if (parsed.confidence < this.confidenceThreshold) {
        console.warn(`AI confidence (${parsed.confidence}) below threshold (${this.confidenceThreshold})`);
        return this.generateFallbackAnalysis(originalMetrics);
      }

      return {
        ...originalMetrics,
        aiAnalysis: {
          confidence: parsed.confidence,
          recommendations: parsed.recommendations || [],
          summary: parsed.summary || 'No summary provided',
          riskAssessment: parsed.riskAssessment || 'No risk assessment provided',
          provider: this.provider,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      return this.generateFallbackAnalysis(originalMetrics);
    }
  }

  /**
   * Generate fallback analysis when AI is unavailable
   */
  generateFallbackAnalysis(gasMetrics) {
    const recommendations = [];

    // Basic heuristic recommendations
    if (gasMetrics.gasEfficiencyScore < 50) {
      recommendations.push({
        title: 'High Gas Consumption Detected',
        description: 'Your contract functions are consuming more gas than optimal. Consider optimizing storage operations and reducing computational complexity.',
        priority: 'High',
        difficulty: 'Medium',
        estimatedSavings: '15-30%',
        implementation: '1. Review storage operations\n2. Optimize loops and conditionals\n3. Use more efficient data types'
      });
    }

    if (gasMetrics.functionAnalysis.some(func => func.gasUsed > 100000)) {
      recommendations.push({
        title: 'Expensive Function Calls',
        description: 'Some functions are consuming excessive gas. Break down complex operations into smaller functions.',
        priority: 'Medium',
        difficulty: 'Easy',
        estimatedSavings: '10-20%',
        implementation: '1. Identify gas-heavy functions\n2. Split complex logic\n3. Cache frequently used values'
      });
    }

    return {
      ...gasMetrics,
      aiAnalysis: {
        confidence: 0.6,
        recommendations,
        summary: 'Basic heuristic analysis performed due to AI service unavailability.',
        riskAssessment: 'Recommendations are based on general best practices.',
        provider: 'fallback',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Helper methods
   */
  calculateComplexity(func) {
    // Simple complexity calculation based on gas usage
    const gasUsed = func.gasUsage || func.gasUsed || 0;
    if (gasUsed > 100000) return 'High';
    if (gasUsed > 50000) return 'Medium';
    return 'Low';
  }

  calculateEfficiency(func) {
    // Efficiency score based on gas usage (inverse relationship)
    const gasUsed = func.gasUsage || func.gasUsed || 0;
    const maxGas = 200000;
    return Math.max(0, Math.min(100, 100 - (gasUsed / maxGas) * 100));
  }

  calculateEfficiencyScore(functionAnalysis) {
    if (functionAnalysis.length === 0) return 0;
    const totalEfficiency = functionAnalysis.reduce((sum, func) => sum + func.efficiency, 0);
    return Math.round(totalEfficiency / functionAnalysis.length);
  }

  generateBasicRecommendations(func) {
    const recommendations = [];
    const gasUsed = func.gasUsage || func.gasUsed || 0;
    if (gasUsed > 100000) {
      recommendations.push('Consider optimizing this function for gas efficiency');
    }
    return recommendations;
  }

  anonymizeCode(code) {
    if (!code) return '';
    // Simple anonymization - replace addresses and sensitive data
    return code
      .replace(/0x[a-fA-F0-9]{40}/g, '0x[ADDRESS]')
      .replace(/\b\d{10,}\b/g, '[LARGE_NUMBER]')
      .replace(/"[^"]{20,}"/g, '"[LONG_STRING]"');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save analysis results to file
   */
  async saveAnalysis(analysis, contractAddress) {
    try {
      const filename = `${contractAddress}-ai-analysis-${Date.now()}.json`;
      const filepath = path.join(process.cwd(), 'api', filename);
      
      await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
      console.log(`AI analysis saved to: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error('Failed to save AI analysis:', error.message);
      return null;
    }
  }
}

module.exports = AIGasAnalyzer;