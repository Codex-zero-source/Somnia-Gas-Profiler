const { ethers } = require('ethers');
const chalk = require('chalk');

/**
 * Contract State Analyzer for Somnia Gas Profiler
 * Analyzes contract state to generate intelligent arguments for function profiling
 */
class ContractStateAnalyzer {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.contractCache = new Map();
    this.stateCache = new Map();
  }

  /**
   * Analyze contract and generate intelligent arguments for functions
   * @param {string} contractAddress - Contract address
   * @param {Array} abi - Contract ABI
   * @param {Array} functionSignatures - Functions to analyze
   * @returns {Promise<Object>} Analysis results with optimized arguments
   */
  async analyzeContractForArguments(contractAddress, abi, functionSignatures) {
    try {
      console.log(chalk.blue('🔍 Analyzing contract state for intelligent argument generation...'));
      
      const contract = new ethers.Contract(contractAddress, abi, this.provider);
      
      // Analyze contract metadata
      const contractInfo = await this.analyzeContractMetadata(contract, abi);
      
      // Get contract state information
      const stateInfo = await this.gatherContractState(contract, abi, contractInfo);
      
      // Generate optimized arguments for each function
      const optimizedArgs = {};
      const senderOptions = await this.determineSenderOptions(contract, abi, contractInfo, stateInfo);
      
      for (const signature of functionSignatures) {
        const funcInfo = this.parseFunctionSignature(signature, abi);
        if (funcInfo) {
          optimizedArgs[signature] = await this.generateOptimizedArguments(
            funcInfo, 
            contractInfo, 
            stateInfo, 
            senderOptions
          );
        }
      }
      
      return {
        contractInfo,
        stateInfo,
        senderOptions,
        optimizedArgs,
        recommendations: this.generateRecommendations(contractInfo, stateInfo)
      };
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️  State analysis failed: ${error.message}`));
      return this.getFallbackAnalysis(functionSignatures, abi);
    }
  }

  /**
   * Analyze contract metadata and patterns
   * @param {Contract} contract - Contract instance
   * @param {Array} abi - Contract ABI
   * @returns {Promise<Object>} Contract metadata
   */
  async analyzeContractMetadata(contract, abi) {
    const info = {
      type: 'Unknown',
      hasOwner: false,
      hasRoles: false,
      isToken: false,
      tokenInfo: null,
      accessPatterns: [],
      adminFunctions: [],
      userFunctions: []
    };

    // Detect contract type and patterns
    const functions = abi.filter(item => item.type === 'function');
    const functionNames = functions.map(f => f.name);
    
    // ERC20 detection
    if (this.hasERC20Pattern(functionNames)) {
      info.type = 'ERC20';
      info.isToken = true;
      info.tokenInfo = await this.getERC20Info(contract);
    }
    
    // ERC721 detection
    else if (this.hasERC721Pattern(functionNames)) {
      info.type = 'ERC721';
      info.isToken = true;
      info.tokenInfo = await this.getERC721Info(contract);
    }
    
    // DeFi detection
    else if (this.hasDeFiPattern(functionNames)) {
      info.type = 'DeFi';
    }
    
    // Access control analysis
    info.hasOwner = functionNames.includes('owner') || 
                   functions.some(f => f.name.includes('onlyOwner') || 
                   f.inputs.some(input => input.name === 'owner'));
    
    info.hasRoles = functionNames.some(name => 
      name.includes('Role') || name.includes('grantRole') || name.includes('hasRole'));
    
    // Categorize functions by access patterns
    for (const func of functions) {
      if (this.isAdminFunction(func)) {
        info.adminFunctions.push(func.name);
      } else {
        info.userFunctions.push(func.name);
      }
    }
    
    return info;
  }

  /**
   * Gather current contract state information
   * @param {Contract} contract - Contract instance
   * @param {Array} abi - Contract ABI
   * @param {Object} contractInfo - Contract metadata
   * @returns {Promise<Object>} State information
   */
  async gatherContractState(contract, abi, contractInfo) {
    const state = {
      owner: null,
      totalSupply: null,
      balances: new Map(),
      allowances: new Map(),
      roles: new Map(),
      paused: false,
      initialized: false
    };

    try {
      // Get owner if available
      if (contractInfo.hasOwner) {
        try {
          state.owner = await contract.owner();
        } catch (error) {
          // Try alternative owner getters
          try {
            state.owner = await contract.getOwner();
          } catch (e) {
            // Owner function not available or different pattern
          }
        }
      }

      // Get token information if it's a token
      if (contractInfo.isToken && contractInfo.type === 'ERC20') {
        try {
          state.totalSupply = await contract.totalSupply();
          
          // Get some sample balances
          const sampleAddresses = [
            state.owner,
            this.wallet.address,
            '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
            '0x8ba1f109551bD432803012645Hac136c4C0532925a'
          ].filter(Boolean);
          
          for (const addr of sampleAddresses) {
            try {
              const balance = await contract.balanceOf(addr);
              if (balance > 0) {
                state.balances.set(addr, balance);
              }
            } catch (e) {
              // Address doesn't exist or function failed
            }
          }
        } catch (error) {
          // Token functions not available
        }
      }

      // Check if contract is paused
      try {
        state.paused = await contract.paused();
      } catch (error) {
        // Paused function not available
      }

      // Check initialization status
      try {
        state.initialized = await contract.initialized();
      } catch (error) {
        // Initialized function not available
      }

    } catch (error) {
      console.log(chalk.gray(`   State gathering partially failed: ${error.message}`));
    }

    return state;
  }

  /**
   * Determine optimal sender addresses for different function types
   * @param {Contract} contract - Contract instance
   * @param {Array} abi - Contract ABI
   * @param {Object} contractInfo - Contract metadata
   * @param {Object} stateInfo - State information
   * @returns {Promise<Object>} Sender options
   */
  async determineSenderOptions(contract, abi, contractInfo, stateInfo) {
    const options = {
      admin: stateInfo.owner || this.wallet.address,
      user: this.wallet.address,
      tokenHolder: null,
      zeroAddress: ethers.ZeroAddress,
      alternatives: []
    };

    // Find token holders if it's a token contract
    if (contractInfo.isToken && stateInfo.balances.size > 0) {
      const holders = Array.from(stateInfo.balances.keys());
      options.tokenHolder = holders[0];
      options.alternatives.push(...holders);
    }

    // Add some common test addresses
    options.alternatives.push(
      '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
      '0x8ba1f109551bD432803012645Hac136c4C0532925a',
      '0x1234567890123456789012345678901234567890'
    );

    return options;
  }

  /**
   * Generate optimized arguments for a specific function
   * @param {Object} funcInfo - Function information
   * @param {Object} contractInfo - Contract metadata
   * @param {Object} stateInfo - State information
   * @param {Object} senderOptions - Available sender addresses
   * @returns {Promise<Object>} Optimized arguments and sender
   */
  async generateOptimizedArguments(funcInfo, contractInfo, stateInfo, senderOptions) {
    const result = {
      args: [],
      sender: senderOptions.user,
      confidence: 50,
      rationale: []
    };

    // Determine optimal sender based on function type
    if (contractInfo.adminFunctions.includes(funcInfo.name)) {
      result.sender = senderOptions.admin;
      result.confidence += 20;
      result.rationale.push('Using admin sender for admin function');
    } else if (this.isTokenTransferFunction(funcInfo.name)) {
      result.sender = senderOptions.tokenHolder || senderOptions.user;
      result.confidence += 15;
      result.rationale.push('Using token holder for transfer function');
    }

    // Generate arguments based on function signature and context
    for (const input of funcInfo.inputs) {
      const arg = await this.generateContextualArgument(
        input, 
        funcInfo, 
        contractInfo, 
        stateInfo, 
        senderOptions
      );
      result.args.push(arg.value);
      result.confidence += arg.confidence;
      if (arg.rationale) {
        result.rationale.push(arg.rationale);
      }
    }

    // Normalize confidence to 0-100 range
    result.confidence = Math.min(100, Math.max(0, result.confidence));

    return result;
  }

  /**
   * Generate contextual argument for a specific parameter
   * @param {Object} input - Parameter information
   * @param {Object} funcInfo - Function information
   * @param {Object} contractInfo - Contract metadata
   * @param {Object} stateInfo - State information
   * @param {Object} senderOptions - Available sender addresses
   * @returns {Promise<Object>} Generated argument with metadata
   */
  async generateContextualArgument(input, funcInfo, contractInfo, stateInfo, senderOptions) {
    const { type, name } = input;
    
    // Address arguments
    if (type === 'address') {
      return this.generateAddressArgument(name, funcInfo, contractInfo, stateInfo, senderOptions);
    }
    
    // Amount/value arguments for tokens
    if (this.isAmountParameter(type, name) && contractInfo.isToken) {
      return this.generateAmountArgument(name, funcInfo, contractInfo, stateInfo);
    }
    
    // ID arguments (tokenId, etc.)
    if (this.isIdParameter(type, name)) {
      return this.generateIdArgument(name, funcInfo, contractInfo, stateInfo);
    }
    
    // Boolean arguments
    if (type === 'bool') {
      return { value: true, confidence: 10, rationale: 'Default boolean value' };
    }
    
    // String arguments
    if (type === 'string') {
      if (name.includes('uri') || name.includes('URI')) {
        return { value: 'https://example.com/metadata/1', confidence: 15, rationale: 'URI pattern detected' };
      }
      return { value: 'test string', confidence: 5, rationale: 'Default string value' };
    }
    
    // Bytes arguments
    if (type.startsWith('bytes')) {
      if (name.includes('data') || name.includes('calldata')) {
        return { value: '0x', confidence: 15, rationale: 'Empty calldata for data parameter' };
      }
      const size = type === 'bytes' ? 4 : parseInt(type.replace('bytes', ''));
      return { value: '0x' + '12'.repeat(size), confidence: 10, rationale: 'Default bytes value' };
    }
    
    // Numeric arguments
    if (type.startsWith('uint') || type.startsWith('int')) {
      return { value: '100', confidence: 5, rationale: 'Default numeric value' };
    }
    
    // Array arguments
    if (type.endsWith('[]')) {
      return { value: [], confidence: 5, rationale: 'Empty array for array parameter' };
    }
    
    return { value: '0', confidence: 0, rationale: 'Fallback default value' };
  }

  /**
   * Generate address argument with context
   */
  generateAddressArgument(name, funcInfo, contractInfo, stateInfo, senderOptions) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('to') || lowerName.includes('recipient')) {
      return { 
        value: senderOptions.alternatives[0], 
        confidence: 20, 
        rationale: 'Using alternative address for recipient' 
      };
    }
    
    if (lowerName.includes('from') || lowerName.includes('sender')) {
      const addr = senderOptions.tokenHolder || senderOptions.user;
      return { 
        value: addr, 
        confidence: 25, 
        rationale: 'Using token holder address for from parameter' 
      };
    }
    
    if (lowerName.includes('owner')) {
      return { 
        value: stateInfo.owner || senderOptions.admin, 
        confidence: 30, 
        rationale: 'Using contract owner address' 
      };
    }
    
    return { 
      value: senderOptions.user, 
      confidence: 10, 
      rationale: 'Default user address' 
    };
  }

  /**
   * Generate amount argument for token operations
   */
  generateAmountArgument(name, funcInfo, contractInfo, stateInfo) {
    if (contractInfo.type === 'ERC20') {
      const decimals = contractInfo.tokenInfo?.decimals || 18;
      const amount = ethers.parseUnits('1', decimals);
      return { 
        value: amount.toString(), 
        confidence: 25, 
        rationale: `Using 1 token amount with ${decimals} decimals` 
      };
    }
    
    return { 
      value: '1000000000000000000', 
      confidence: 15, 
      rationale: 'Default 1 token amount (18 decimals)' 
    };
  }

  /**
   * Generate ID argument (tokenId, etc.)
   */
  generateIdArgument(name, funcInfo, contractInfo, stateInfo) {
    if (contractInfo.type === 'ERC721') {
      return { 
        value: '1', 
        confidence: 20, 
        rationale: 'Using tokenId 1 for NFT operation' 
      };
    }
    
    return { 
      value: '1', 
      confidence: 15, 
      rationale: 'Default ID value' 
    };
  }

  // Helper methods for pattern detection
  hasERC20Pattern(functionNames) {
    const required = ['transfer', 'balanceOf', 'totalSupply'];
    return required.every(fn => functionNames.includes(fn));
  }

  hasERC721Pattern(functionNames) {
    return functionNames.includes('ownerOf') && functionNames.includes('tokenURI');
  }

  hasDeFiPattern(functionNames) {
    const defiKeywords = ['swap', 'addLiquidity', 'removeLiquidity', 'mint', 'burn', 'stake'];
    return defiKeywords.some(keyword => functionNames.some(fn => fn.includes(keyword)));
  }

  isAdminFunction(func) {
    const adminPatterns = ['onlyOwner', 'onlyAdmin', 'set', 'withdraw', 'pause', 'unpause'];
    return adminPatterns.some(pattern => 
      func.name.includes(pattern) || 
      func.inputs.some(input => input.name.includes('owner'))
    );
  }

  isTokenTransferFunction(name) {
    return ['transfer', 'transferFrom', 'approve'].includes(name);
  }

  isAmountParameter(type, name) {
    return (type.startsWith('uint') && 
           (name.includes('amount') || name.includes('value') || name.includes('balance')));
  }

  isIdParameter(type, name) {
    return (type.startsWith('uint') && 
           (name.includes('id') || name.includes('Id') || name.includes('ID')));
  }

  async getERC20Info(contract) {
    try {
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => 'Unknown'),
        contract.symbol().catch(() => 'UNK'),
        contract.decimals().catch(() => 18)
      ]);
      return { name, symbol, decimals };
    } catch (error) {
      return { name: 'Unknown', symbol: 'UNK', decimals: 18 };
    }
  }

  async getERC721Info(contract) {
    try {
      const [name, symbol] = await Promise.all([
        contract.name().catch(() => 'Unknown'),
        contract.symbol().catch(() => 'UNK')
      ]);
      return { name, symbol };
    } catch (error) {
      return { name: 'Unknown', symbol: 'UNK' };
    }
  }

  parseFunctionSignature(signature, abi) {
    const func = abi.find(item => {
      if (item.type !== 'function') return false;
      const sig = `${item.name}(${item.inputs.map(i => i.type).join(',')})`;
      return sig === signature;
    });
    return func;
  }

  generateRecommendations(contractInfo, stateInfo) {
    const recommendations = [];
    
    if (contractInfo.hasOwner && !stateInfo.owner) {
      recommendations.push('Could not determine contract owner - some admin functions may fail');
    }
    
    if (contractInfo.isToken && stateInfo.balances.size === 0) {
      recommendations.push('No token holders found - transfer functions may fail');
    }
    
    if (stateInfo.paused) {
      recommendations.push('Contract appears to be paused - most functions may fail');
    }
    
    return recommendations;
  }

  getFallbackAnalysis(functionSignatures, abi) {
    const optimizedArgs = {};
    
    for (const signature of functionSignatures) {
      const func = this.parseFunctionSignature(signature, abi);
      if (func) {
        optimizedArgs[signature] = {
          args: func.inputs.map(input => this.getBasicDefault(input.type)),
          sender: this.wallet.address,
          confidence: 10,
          rationale: ['Using fallback argument generation']
        };
      }
    }
    
    return {
      contractInfo: { type: 'Unknown' },
      stateInfo: {},
      senderOptions: { user: this.wallet.address },
      optimizedArgs,
      recommendations: ['State analysis failed - using basic defaults']
    };
  }

  getBasicDefault(type) {
    if (type === 'address') return ethers.ZeroAddress;
    if (type === 'bool') return true;
    if (type === 'string') return 'test';
    if (type.startsWith('bytes')) return '0x';
    if (type.startsWith('uint') || type.startsWith('int')) return '100';
    if (type.endsWith('[]')) return [];
    return '0';
  }
}

module.exports = {
  ContractStateAnalyzer
};