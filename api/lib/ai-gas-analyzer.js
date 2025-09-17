const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const CacheManager = require('./cache-manager');

class AIGasAnalyzer {
  constructor(config = {}) {
    this.provider = config.provider || process.env.AI_PROVIDER || 'iointelligence';
    this.apiKey = this.getApiKey();
    this.apiEndpoint = process.env.IOINTELLIGENCE_API_ENDPOINT || 'https://api.intelligence.io.solutions/api/v1';
    this.model = process.env.IOINTELLIGENCE_MODEL || 'mistralai/Mistral-Large-Instruct-2411';
    this.enabled = process.env.AI_ANALYSIS_ENABLED === 'true';
    this.maxRetries = parseInt(process.env.AI_MAX_RETRIES) || 3;
    this.timeout = parseInt(process.env.AI_TIMEOUT) || 60000; // Increased timeout for Mistral Large
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.7;
    this.encryptSensitiveData = process.env.AI_ENCRYPT_SENSITIVE_DATA === 'true';
    this.anonymizeContractData = process.env.AI_ANONYMIZE_CONTRACT_DATA === 'true';
    this.secureTransmission = process.env.AI_SECURE_TRANSMISSION === 'true';
    // Cache configuration
    this.cacheTTL = parseInt(process.env.AI_CACHE_TTL) || 300000; // 5 minutes default for development
    this.enableCache = process.env.AI_ENABLE_CACHE !== 'false'; // Cache enabled by default
    this.cacheManager = new CacheManager();
    this.models = {
      'iointelligence': 'meta-llama/Llama-3.3-70B-Instruct',
      'openai': 'gpt-4o-mini',
      'anthropic': 'claude-3-haiku-20240307'
    };
    // Initialize cache directory structure
    this.cacheManager.initialize().catch(error => {
      console.warn('Cache initialization failed:', error.message);
    });
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
  async analyzeGasProfile(analysisData, contractAddress, gasMetrics = null, options = {}, abi = null) {
    try {
      // Check cache first for existing analysis (unless force refresh is requested)
      if (this.enableCache && !options.forceRefresh) {
        const cachedAnalysis = await this.cacheManager.getAnalysisResults(contractAddress, this.cacheTTL);
        
        if (cachedAnalysis.found) {
          console.log(`Returning cached AI analysis result (age: ${Math.round(cachedAnalysis.age / 1000)}s, TTL: ${Math.round(this.cacheTTL / 1000)}s)`);
          return cachedAnalysis.analysis;
        }
      } else if (options.forceRefresh) {
        console.log('Force refresh requested, bypassing cache');
      }
      
      // Save contract profile data to cache
      const profileCacheResult = await this.cacheManager.saveContractProfile(contractAddress, analysisData);
      if (profileCacheResult.success) {
        console.log(`Contract profile cached: ${profileCacheResult.filename}`);
      }
      
      // Extract gas metrics from analysis data if not provided
      const extractedMetrics = gasMetrics || this.extractGasMetrics(analysisData);
      
      // Perform AI analysis
      const result = await this.analyzeWithAI(extractedMetrics, contractAddress, abi);
      
      // Cache the analysis result
      const analysisCacheResult = await this.cacheManager.saveAnalysisResults(contractAddress, result);
      if (analysisCacheResult.success) {
        console.log(`AI analysis cached: ${analysisCacheResult.filename}`);
      }
      
      return result;
    } catch (error) {
      console.error('Gas profile analysis failed:', error.message);
      return this.generateFallbackAnalysis(gasMetrics || {});
    }
  }

  /**
   * Analyze gas consumption using AI
   */
  async analyzeWithAI(gasMetrics, contractCode = null, abi = null) {
    if (!this.enabled || !this.apiKey) {
      console.warn('AI analysis is disabled or API key is missing');
      return this.generateFallbackAnalysis(gasMetrics);
    }

    try {
      const analysisPrompt = this.buildAnalysisPrompt(gasMetrics, contractCode, abi);
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
  buildAnalysisPrompt(gasMetrics, contractCode, abi = null) {
    const sanitizedCode = this.anonymizeContractData ? this.anonymizeCode(contractCode) : contractCode;
    
    // Build profiling data from gas metrics
    const profiling = [];
    if (gasMetrics.functionAnalysis && Array.isArray(gasMetrics.functionAnalysis)) {
      gasMetrics.functionAnalysis.forEach(func => {
        profiling.push({
          function: func.name || func.signature || 'unknown',
          avgGasUsed: func.gasUsed || func.gasUsage || 0,
          minGasUsed: func.minGas || func.gasUsed || 0,
          maxGasUsed: func.maxGas || func.gasUsed || 0,
          callsSampled: func.calls || func.samples || 1
        });
      });
    }
    
    const promptText = `Analyze this smart contract for gas optimization opportunities.

Contract ABI: ${JSON.stringify(abi || [], null, 2)}

Gas Profiling Data: ${JSON.stringify(profiling, null, 2)}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "confidence": 0.8,
  "recommendations": [
    {
      "function": "functionName",
      "issue": "Short description of inefficiency",
      "suggestion": "Specific optimization recommendation",
      "priority": "High",
      "estimatedSavings": "Approx gas savings if possible",
      "riskNotes": "Potential trade-offs or risks"
    }
  ],
  "summary": "One-paragraph summary of main findings",
  "riskAssessment": "List of risks from applying optimizations"
}

Do not include any text before or after the JSON. Only return valid JSON.`;
    
    return {
      role: 'user',
      content: promptText
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
      
      console.log('🤖 Making AI service call to:', this.getApiEndpoint());
      console.log('🤖 Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(this.getApiEndpoint(), requestBody, {
        headers,
        timeout: this.timeout
      });

      console.log('🤖 AI service response status:', response.status);
      console.log('🤖 AI service response data:', JSON.stringify(response.data, null, 2));
      
      const content = this.extractResponseContent(response.data);
      console.log('🤖 Extracted content:', content);
      
      return content;
    } catch (error) {
      console.error('🤖 AI service call error:', error.message);
      console.error('🤖 Error details:', error.response?.data || error);
      
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
      // Clean the AI response to handle markdown formatting
      let cleanedResponse = aiResponse.trim();
      
      // More aggressive markdown cleaning
      // Remove code block markers with any language identifier
      cleanedResponse = cleanedResponse.replace(/^```[a-zA-Z]*\s*\n?/, '');
      cleanedResponse = cleanedResponse.replace(/\n?\s*```\s*$/, '');
      
      // Remove any remaining backticks at start/end
      cleanedResponse = cleanedResponse.replace(/^`+|`+$/g, '');
      
      // Clean up extra whitespace and newlines
      cleanedResponse = cleanedResponse.trim();
      
      // If it still starts with non-JSON characters, try to find JSON content
      if (!cleanedResponse.startsWith('{') && !cleanedResponse.startsWith('[')) {
        const jsonMatch = cleanedResponse.match(/({[\s\S]*})/); 
        if (jsonMatch) {
          cleanedResponse = jsonMatch[1];
        }
      }
      
      const parsed = JSON.parse(cleanedResponse);
      
      // Note: Confidence threshold validation removed - always use AI response
      console.log(`AI confidence: ${parsed.confidence || 'not provided'}`);

      return {
        ...originalMetrics,
        aiAnalysis: {
          confidence: parsed.confidence || 1.0,
          recommendations: parsed.recommendations || [],
          summary: parsed.summary || 'No summary provided',
          riskAssessment: parsed.riskAssessment || 'No risk assessment provided',
          provider: this.provider,
          timestamp: new Date().toISOString(),
          rawResponse: parsed // Store the full AI response for debugging
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      console.error('Raw AI response:', aiResponse.substring(0, 200) + '...');
      return this.generateFallbackAnalysis(originalMetrics);
    }
  }

  /**
   * Generate fallback analysis when AI is unavailable
   */
  generateFallbackAnalysis(gasMetrics) {
    const recommendations = [];
    
    // Ensure gasMetrics has required properties with defaults
    const safeMetrics = {
      gasEfficiencyScore: 0,
      functionAnalysis: [],
      totalGasUsed: 0,
      averageGasPerFunction: 0,
      optimizationOpportunities: [],
      timestamp: new Date().toISOString(),
      ...gasMetrics
    };

    // Basic heuristic recommendations
    if (safeMetrics.gasEfficiencyScore < 50) {
      recommendations.push({
        title: 'High Gas Consumption Detected',
        description: 'Your contract functions are consuming more gas than optimal. Consider optimizing storage operations and reducing computational complexity.',
        priority: 'High',
        difficulty: 'Medium',
        estimatedSavings: '15-30%',
        implementation: '1. Review storage operations\n2. Optimize loops and conditionals\n3. Use more efficient data types'
      });
    }

    if (Array.isArray(safeMetrics.functionAnalysis) && safeMetrics.functionAnalysis.some(func => (func.gasUsed || func.gasUsage || 0) > 100000)) {
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
      ...safeMetrics,
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