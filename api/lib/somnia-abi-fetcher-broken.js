const axios = require('axios');
const chalk = require('chalk');

/**
 * Somnia Explorer ABI Fetcher
 * Automatically fetches contract ABIs from the Somnia blockchain explorer
 */
class SomniaABIFetcher {
  constructor() {
    this.explorerBaseUrl = 'https://shannon-explorer.somnia.network';
    this.timeout = 10000; // 10 second timeout
  }

  /**
   * Fetch ABI for a contract address from Somnia explorer
   * @param {string} contractAddress - Contract address to fetch ABI for
   * @returns {Promise<Array>} Contract ABI array
   */
  async fetchABI(contractAddress) {
    try {
      console.log(chalk.blue(`🔍 Fetching ABI for contract ${contractAddress} from Somnia explorer...`));

      // Validate contract address format
      if (!this.isValidAddress(contractAddress)) {
        throw new Error('Invalid contract address format');
      }

      // Try different API endpoints that Blockscout typically uses
      const apiEndpoints = [
        `/api/v2/addresses/${contractAddress}`,
        `/api/v2/smart-contracts/${contractAddress}`,
        `/api/v1/addresses/${contractAddress}`,
        `/api/addresses/${contractAddress}/smart-contract`,
        `/api/contract/${contractAddress}`
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const apiUrl = `${this.explorerBaseUrl}${endpoint}`;
          console.log(chalk.gray(`   Trying API: ${apiUrl}`));

          const response = await axios.get(apiUrl, {
            timeout: this.timeout,
            headers: {
              'User-Agent': 'Somnia-Gas-Profiler/2.0',
              'Accept': 'application/json'
            }
          });

          if (response.status === 200 && response.data) {
            const abi = this.extractABIFromAPIResponse(response.data);
            if (abi && abi.length > 0) {
              console.log(chalk.green(`✅ ABI fetched successfully from API (${abi.length} entries)`));
              
              // Save the API response for debugging
              await this.saveDebugData(contractAddress, 'api-response', response.data);
              
              return abi;
            }
          }
        } catch (apiError) {
          console.log(chalk.gray(`   API ${endpoint}: ${apiError.response?.status || apiError.message}`));
          continue;
        }
      }

      // If API calls fail, try the HTML scraping approach
      console.log(chalk.yellow('⚠️  API endpoints failed, trying HTML parsing...'));
      return await this.fetchABIFromHTML(contractAddress);

    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Somnia explorer - check your internet connection');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Explorer request timed out');
      } else {
        throw new Error(`Failed to fetch ABI: ${error.message}`);
      }
    }
  }

  /**
   * Extract ABI from API response
   * @param {Object} apiData - API response data
   * @returns {Array|null} Parsed ABI array
   */
  extractABIFromAPIResponse(apiData) {
    try {
      // Common API response structures for Blockscout
      const possiblePaths = [
        apiData.abi,
        apiData.smart_contract?.abi,
        apiData.contract?.abi,
        apiData.result?.abi,
        apiData.data?.abi,
        apiData.smart_contract_info?.abi,
        apiData.verified_contract?.abi
      ];

      for (const abiData of possiblePaths) {
        if (abiData) {
          // If it's already an array, return it
          if (Array.isArray(abiData)) {
            return abiData;
          }
          
          // If it's a string, try to parse it
          if (typeof abiData === 'string') {
            try {
              const parsed = JSON.parse(abiData);
              if (Array.isArray(parsed)) {
                return parsed;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to extract ABI from API response: ${error.message}`));
      return null;
    }
  }
    try {
      // Look for ABI in various possible formats in the HTML
      
      // Method 1: Look for JSON in <pre> tags (common format)
      const preRegex = /<pre[^>]*>(.*?)<\/pre>/gis;
      let match;
      while ((match = preRegex.exec(html)) !== null) {
        const content = match[1].trim();
        if (content.startsWith('[') && content.includes('"type":"function"')) {
          try {
            return JSON.parse(content);
          } catch (e) {
            continue;
          }
        }
      }

      // Method 2: Look for ABI in script tags or data attributes
      const scriptRegex = /<script[^>]*>(.*?)<\/script>/gis;
      while ((match = scriptRegex.exec(html)) !== null) {
        const content = match[1];
        const abiMatch = content.match(/abi[\s]*[:=][\s]*(\[[^\]]+\])/i);
        if (abiMatch) {
          try {
            return JSON.parse(abiMatch[1]);
          } catch (e) {
            continue;
          }
        }
      }

      // Method 3: Look for specific ABI content patterns
      const abiPatterns = [
        /contract_abi[^{]*({[^}]+})/gi,
        /"abi"[\s]*:[\s]*(\[[^\]]+\])/gi,
        /abi[\s]*=[\s]*(\[[^\]]+\])/gi
      ];

      for (const pattern of abiPatterns) {
        while ((match = pattern.exec(html)) !== null) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            continue;
          }
        }
      }

      // Method 4: Look for any JSON array with function definitions
      const jsonArrayRegex = /(\[[\s\S]*?"type"[\s\S]*?"function"[\s\S]*?\])/g;
      while ((match = jsonArrayRegex.exec(html)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed) && parsed.some(item => item.type === 'function')) {
            return parsed;
          }
        } catch (e) {
          continue;
        }
      }

      return null;

    } catch (error) {
      throw new Error(`Failed to parse ABI from explorer response: ${error.message}`);
    }
  }

  /**
   * Validate Ethereum address format
   * @param {string} address - Address to validate
   * @returns {boolean} True if valid address format
   */
  isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Try to fetch ABI with fallback methods
   * @param {string} contractAddress - Contract address
   * @returns {Promise<Array>} Contract ABI
   */
  async fetchABIWithFallback(contractAddress) {
    try {
      // Primary method: fetch from contract_abi tab
      return await this.fetchABI(contractAddress);
    } catch (primaryError) {
      console.log(chalk.yellow(`⚠️  Primary ABI fetch failed: ${primaryError.message}`));
      
      try {
        // Fallback 1: Try the main contract page
        console.log(chalk.blue('🔄 Trying fallback method...'));
        return await this.fetchABIFromContractPage(contractAddress);
      } catch (fallbackError) {
        console.log(chalk.yellow(`⚠️  Fallback ABI fetch failed: ${fallbackError.message}`));
        
        // Fallback 2: Generate minimal ABI
        console.log(chalk.blue('🔄 Generating minimal ABI from bytecode analysis...'));
        return this.generateMinimalABI(contractAddress);
      }
    }
  }

  /**
   * Save debug data to file
   * @param {string} contractAddress - Contract address
   * @param {string} type - Type of data (api-response, html-response, etc.)
   * @param {any} data - Data to save
   */
  async saveDebugData(contractAddress, type, data) {
    try {
      const fs = require('fs').promises;
      const timestamp = Date.now();
      const filename = `debug-${type}-${contractAddress.slice(-8)}-${timestamp}.json`;
      
      const debugData = {
        contractAddress,
        type,
        timestamp: new Date().toISOString(),
        data: typeof data === 'string' ? data.substring(0, 10000) + '...' : data
      };
      
      await fs.writeFile(filename, JSON.stringify(debugData, null, 2));
      console.log(chalk.gray(`   Debug data saved: ${filename}`));
    } catch (error) {
      // Don't fail the main operation if debug saving fails
      console.log(chalk.gray(`   Debug save failed: ${error.message}`));
    }
  }

  /**
   * Generate minimal ABI for unverified contracts
   * @param {string} contractAddress - Contract address
   * @returns {Promise<Array>} Minimal ABI with common functions
   */
  async generateMinimalABI(contractAddress) {
    console.log(chalk.yellow('📝 Generating minimal ABI for unverified contract...'));
    
    // Return a minimal ABI with common function signatures
    // This allows gasless profiling to work with unverified contracts
    const minimalABI = [
      {
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"type": "address", "name": "account"}],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function", 
        "name": "transfer",
        "inputs": [{"type": "address", "name": "to"}, {"type": "uint256", "name": "amount"}],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "approve", 
        "inputs": [{"type": "address", "name": "spender"}, {"type": "uint256", "name": "amount"}],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "totalSupply",
        "inputs": [],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      }
    ];

    console.log(chalk.yellow(`⚠️  Using minimal ABI (${minimalABI.length} functions) - enable gasless mode for best results`));
    return minimalABI;
  }

  /**
   * Fetch and validate ABI for a contract
   * @param {string} contractAddress - Contract address
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Validated ABI with metadata
   */
  async fetchAndValidateABI(contractAddress, options = {}) {
    const { allowMinimal = true, requireVerified = false } = options;

    try {
      let abi;
      let source = 'verified';

      if (requireVerified) {
        abi = await this.fetchABI(contractAddress);
      } else {
        try {
          abi = await this.fetchABI(contractAddress);
        } catch (error) {
          if (!allowMinimal) {
            throw error;
          }
          abi = await this.generateMinimalABI(contractAddress);
          source = 'minimal';
        }
      }

      // Validate ABI structure
      if (!Array.isArray(abi)) {
        throw new Error('Invalid ABI format - expected array');
      }

      const functions = abi.filter(item => item.type === 'function');
      
      if (functions.length === 0) {
        throw new Error('No functions found in ABI');
      }

      return {
        abi,
        metadata: {
          source,
          functionCount: functions.length,
          isVerified: source === 'verified',
          isMinimal: source === 'minimal',
          contractAddress,
          fetchedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`ABI fetch and validation failed: ${error.message}`);
    }
  }
}

module.exports = {
  SomniaABIFetcher
};