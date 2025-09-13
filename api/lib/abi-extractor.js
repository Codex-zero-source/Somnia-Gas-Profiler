const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * ABI Extractor for Somnia Gas Profiler
 * Handles ABI extraction from various sources
 */
class ABIExtractor {
  constructor() {
    this.commonABIs = new Map();
    this.loadCommonABIs();
  }

  /**
   * Load common contract ABIs (ERC20, ERC721, etc.)
   */
  loadCommonABIs() {
    // ERC20 Standard ABI
    this.commonABIs.set('ERC20', [
      {
        "type": "function",
        "name": "totalSupply",
        "inputs": [],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
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
        "inputs": [
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "allowance",
        "inputs": [
          {"type": "address", "name": "owner"},
          {"type": "address", "name": "spender"}
        ],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "approve",
        "inputs": [
          {"type": "address", "name": "spender"},
          {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "transferFrom",
        "inputs": [
          {"type": "address", "name": "from"},
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      }
    ]);

    // ERC721 Standard ABI (partial)
    this.commonABIs.set('ERC721', [
      {
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"type": "address", "name": "owner"}],
        "outputs": [{"type": "uint256", "name": "balance"}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "ownerOf",
        "inputs": [{"type": "uint256", "name": "tokenId"}],
        "outputs": [{"type": "address", "name": "owner"}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "approve",
        "inputs": [
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "tokenId"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "getApproved",
        "inputs": [{"type": "uint256", "name": "tokenId"}],
        "outputs": [{"type": "address", "name": "operator"}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "setApprovalForAll",
        "inputs": [
          {"type": "address", "name": "operator"},
          {"type": "bool", "name": "approved"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "isApprovedForAll",
        "inputs": [
          {"type": "address", "name": "owner"},
          {"type": "address", "name": "operator"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "transferFrom",
        "inputs": [
          {"type": "address", "name": "from"},
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "tokenId"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "safeTransferFrom",
        "inputs": [
          {"type": "address", "name": "from"},
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "tokenId"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      }
    ]);
  }

  /**
   * Extract ABI from file
   * @param {string} filePath - Path to ABI file (JSON)
   * @returns {Promise<Array>} ABI array
   */
  async extractFromFile(filePath) {
    try {
      console.log(chalk.blue(`📂 Loading ABI from ${filePath}...`));
      
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      // Handle different file formats
      let abi;
      if (Array.isArray(data)) {
        // Direct ABI array
        abi = data;
      } else if (data.abi) {
        // Artifact file with abi property
        abi = data.abi;
      } else if (data.output && data.output.abi) {
        // Truffle compilation output
        abi = data.output.abi;
      } else {
        throw new Error('Could not find ABI in file structure');
      }

      console.log(chalk.green(`✅ Loaded ABI with ${abi.length} entries`));
      return abi;

    } catch (error) {
      throw new Error(`Failed to extract ABI from file: ${error.message}`);
    }
  }

  /**
   * Extract ABI from bytecode metadata
   * @param {string} bytecode - Contract bytecode
   * @returns {Promise<Array|null>} ABI array or null if extraction fails
   */
  async extractFromBytecode(bytecode) {
    try {
      console.log(chalk.blue('🔍 Attempting to extract ABI from bytecode metadata...'));

      // Check if bytecode has metadata
      if (!this.hasMetadata(bytecode)) {
        console.log(chalk.gray('   No metadata found in bytecode'));
        return null;
      }

      // Extract metadata hash
      const metadataHash = this.extractMetadataHash(bytecode);
      if (!metadataHash) {
        console.log(chalk.gray('   Could not extract metadata hash'));
        return null;
      }

      console.log(chalk.gray(`   Metadata hash: ${metadataHash}`));
      
      // In a real implementation, you would:
      // 1. Fetch metadata from IPFS using the hash
      // 2. Parse the metadata JSON
      // 3. Extract the ABI
      
      // For now, return null as IPFS access requires additional setup
      console.log(chalk.yellow('⚠️  IPFS metadata fetching not implemented'));
      return null;

    } catch (error) {
      console.log(chalk.gray(`   Metadata extraction failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Get common ABI by standard type
   * @param {string} standard - Standard name (ERC20, ERC721, etc.)
   * @returns {Array|null} ABI array or null if not found
   */
  getCommonABI(standard) {
    const abi = this.commonABIs.get(standard.toUpperCase());
    if (abi) {
      console.log(chalk.green(`✅ Using ${standard} standard ABI`));
      return [...abi]; // Return copy
    }
    return null;
  }

  /**
   * Auto-detect ABI from multiple sources
   * @param {Object} options - Detection options
   * @returns {Promise<Array|null>} ABI array or null if detection fails
   */
  async autoDetectABI(options = {}) {
    const { bytecode, address, filePath, standard } = options;

    try {
      console.log(chalk.blue('🕵️  Auto-detecting ABI...'));

      // Try file path first
      if (filePath) {
        try {
          return await this.extractFromFile(filePath);
        } catch (error) {
          console.log(chalk.gray(`   File extraction failed: ${error.message}`));
        }
      }

      // Try common standards
      if (standard) {
        const abi = this.getCommonABI(standard);
        if (abi) return abi;
      }

      // Try bytecode metadata
      if (bytecode) {
        const abi = await this.extractFromBytecode(bytecode);
        if (abi) return abi;
      }

      // Try contract verification services (if address provided)
      if (address) {
        const abi = await this.fetchFromVerificationService(address);
        if (abi) return abi;
      }

      console.log(chalk.yellow('⚠️  Could not auto-detect ABI from any source'));
      return null;

    } catch (error) {
      console.log(chalk.red(`❌ ABI auto-detection failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Fetch ABI from contract verification services
   * @param {string} address - Contract address
   * @returns {Promise<Array|null>} ABI array or null if not found
   */
  async fetchFromVerificationService(address) {
    try {
      console.log(chalk.blue(`🌐 Checking verification services for ${address}...`));

      // Note: Somnia testnet may not have verification services yet
      // This is a placeholder for when they become available
      
      // For Ethereum mainnet, you would use:
      // - Etherscan API
      // - Sourcify
      // - Other verification services

      console.log(chalk.gray('   No verification services configured for Somnia testnet'));
      return null;

    } catch (error) {
      console.log(chalk.gray(`   Verification service lookup failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Generate minimal ABI from function signatures
   * @param {Array<string>} signatures - Function signatures
   * @returns {Array} Minimal ABI
   */
  generateMinimalABI(signatures) {
    console.log(chalk.blue(`🔧 Generating minimal ABI from ${signatures.length} signatures...`));

    const abi = signatures.map(sig => {
      const match = sig.match(/^(\w+)\((.*)\)$/);
      if (!match) {
        throw new Error(`Invalid function signature: ${sig}`);
      }

      const [, name, params] = match;
      const inputs = params ? params.split(',').map(param => {
        const trimmed = param.trim();
        return {
          type: trimmed || 'bytes',
          name: ''
        };
      }) : [];

      return {
        type: 'function',
        name: name,
        inputs: inputs,
        outputs: [],
        stateMutability: 'nonpayable'
      };
    });

    console.log(chalk.green(`✅ Generated minimal ABI with ${abi.length} functions`));
    return abi;
  }

  /**
   * Validate ABI structure
   * @param {Array} abi - ABI to validate
   * @returns {boolean} True if valid
   */
  validateABI(abi) {
    if (!Array.isArray(abi)) {
      return false;
    }

    return abi.every(entry => {
      return entry && 
             typeof entry === 'object' && 
             entry.type && 
             ['function', 'constructor', 'event', 'fallback', 'receive'].includes(entry.type);
    });
  }

  /**
   * Check if bytecode contains metadata
   * @param {string} bytecode - Contract bytecode
   * @returns {boolean} True if metadata is present
   */
  hasMetadata(bytecode) {
    // Solidity metadata is usually at the end of bytecode
    // It ends with the metadata length (2 bytes) and 0xa264
    return bytecode.length > 100 && bytecode.endsWith('64736f6c63430008130033');
  }

  /**
   * Extract metadata hash from bytecode
   * @param {string} bytecode - Contract bytecode
   * @returns {string|null} Metadata hash or null if not found
   */
  extractMetadataHash(bytecode) {
    try {
      // Look for IPFS hash in metadata
      // This is a simplified approach - real implementation would be more robust
      const metadataMatch = bytecode.match(/1220([a-f0-9]{64})/);
      return metadataMatch ? metadataMatch[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Filter ABI to only include functions
   * @param {Array} abi - Full ABI
   * @returns {Array} Functions only
   */
  extractFunctions(abi) {
    return abi.filter(entry => entry.type === 'function');
  }

  /**
   * Filter ABI to only include view/pure functions
   * @param {Array} abi - Full ABI
   * @returns {Array} View/pure functions only
   */
  extractViewFunctions(abi) {
    return abi.filter(entry => 
      entry.type === 'function' && 
      (entry.stateMutability === 'view' || entry.stateMutability === 'pure')
    );
  }

  /**
   * Filter ABI to only include state-changing functions
   * @param {Array} abi - Full ABI
   * @returns {Array} State-changing functions only
   */
  extractStateChangingFunctions(abi) {
    return abi.filter(entry => 
      entry.type === 'function' && 
      (!entry.stateMutability || 
       entry.stateMutability === 'nonpayable' || 
       entry.stateMutability === 'payable')
    );
  }

  /**
   * Get function signatures from ABI
   * @param {Array} abi - Contract ABI
   * @returns {Array<string>} Function signatures
   */
  getFunctionSignatures(abi) {
    return this.extractFunctions(abi).map(func => {
      const inputs = func.inputs.map(input => input.type).join(',');
      return `${func.name}(${inputs})`;
    });
  }

  /**
   * Display ABI summary
   * @param {Array} abi - Contract ABI
   */
  displaySummary(abi) {
    const functions = this.extractFunctions(abi);
    const viewFunctions = this.extractViewFunctions(abi);
    const stateChanging = this.extractStateChangingFunctions(abi);
    const events = abi.filter(entry => entry.type === 'event');

    console.log(chalk.cyan('\n📋 ABI Summary'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Total entries: ${abi.length}`);
    console.log(`Functions: ${functions.length}`);
    console.log(`  - View/Pure: ${viewFunctions.length}`);
    console.log(`  - State-changing: ${stateChanging.length}`);
    console.log(`Events: ${events.length}`);

    if (functions.length > 0) {
      console.log(chalk.gray('\nFunctions:'));
      functions.forEach(func => {
        const params = func.inputs.map(input => input.type).join(', ');
        const mutability = func.stateMutability ? ` [${func.stateMutability}]` : '';
        console.log(chalk.gray(`  - ${func.name}(${params})${mutability}`));
      });
    }
  }
}

module.exports = {
  ABIExtractor
};