const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { ContractStateAnalyzer } = require('./contract-state-analyzer');

/**
 * Bytecode Processor for Somnia Gas Profiler
 * Handles bytecode loading, validation, and deployment
 */
class BytecodeProcessor {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.stateAnalyzer = new ContractStateAnalyzer(provider, wallet);
  }

  /**
   * Load contract from raw bytecode hex string
   * @param {string} bytecode - Raw bytecode hex string (0x prefixed)
   * @param {Array} abi - Optional ABI array
   * @returns {Promise<Object>} Contract instance and metadata
   */
  async loadFromBytecode(bytecode, abi = null) {
    try {
      console.log(chalk.blue('📝 Processing raw bytecode...'));
      
      // Validate bytecode format
      if (!this.isValidBytecode(bytecode)) {
        throw new Error('Invalid bytecode format. Must be hex string starting with 0x');
      }

      console.log(chalk.gray(`   Bytecode length: ${bytecode.length} characters`));

      // Try to extract ABI from bytecode metadata if not provided
      if (!abi) {
        console.log(chalk.yellow('⚠️  No ABI provided, attempting to extract from bytecode metadata...'));
        abi = this.extractABIFromBytecode(bytecode);
        
        if (!abi || abi.length === 0) {
          console.log(chalk.yellow('⚠️  Could not extract ABI from bytecode. Using minimal interface.'));
          abi = this.generateMinimalABI(bytecode);
        }
      }

      // Deploy bytecode to get contract instance
      const deployedContract = await this.deployBytecode(bytecode, abi);
      
      return {
        contract: deployedContract.contract,
        address: deployedContract.address,
        abi: abi,
        bytecode: bytecode,
        source: 'bytecode',
        functions: this.extractFunctionSignatures(abi)
      };

    } catch (error) {
      throw new Error(`Failed to load from bytecode: ${error.message}`);
    }
  }

  /**
   * Load contract from artifact file (Hardhat/Foundry output)
   * @param {string} artifactPath - Path to artifact JSON file
   * @returns {Promise<Object>} Contract instance and metadata
   */
  async loadFromArtifact(artifactPath) {
    try {
      console.log(chalk.blue(`📂 Loading contract artifact from ${artifactPath}...`));
      
      const artifactContent = await fs.readFile(artifactPath, 'utf8');
      const artifact = JSON.parse(artifactContent);

      // Extract bytecode and ABI from artifact
      let bytecode = artifact.bytecode || artifact.data?.bytecode?.object;
      let abi = artifact.abi;

      if (!bytecode) {
        throw new Error('No bytecode found in artifact file');
      }

      if (!abi) {
        throw new Error('No ABI found in artifact file');
      }

      // Ensure bytecode has 0x prefix
      if (!bytecode.startsWith('0x')) {
        bytecode = '0x' + bytecode;
      }

      console.log(chalk.green(`✅ Loaded artifact: ${artifact.contractName || 'Unknown'}`));
      
      return await this.loadFromBytecode(bytecode, abi);

    } catch (error) {
      throw new Error(`Failed to load from artifact: ${error.message}`);
    }
  }

  /**
   * Deploy bytecode to Somnia testnet
   * @param {string} bytecode - Contract bytecode
   * @param {Array} abi - Contract ABI
   * @param {Array} constructorArgs - Constructor arguments
   * @returns {Promise<Object>} Deployed contract details
   */
  async deployBytecode(bytecode, abi, constructorArgs = []) {
    try {
      console.log(chalk.blue('🚀 Deploying contract to Somnia testnet...'));

      // Create contract factory
      const factory = new ethers.ContractFactory(abi, bytecode, this.wallet);

      // Deploy contract
      const contract = await factory.deploy(...constructorArgs);
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      console.log(chalk.green(`✅ Contract deployed at: ${address}`));

      return {
        contract: contract,
        address: address,
        deploymentTx: contract.deploymentTransaction()
      };

    } catch (error) {
      throw new Error(`Failed to deploy bytecode: ${error.message}`);
    }
  }

  /**
   * Validate bytecode format
   * @param {string} bytecode - Bytecode to validate
   * @returns {boolean} True if valid
   */
  isValidBytecode(bytecode) {
    if (!bytecode || typeof bytecode !== 'string') {
      return false;
    }

    // Must start with 0x and contain only hex characters
    const hexPattern = /^0x[a-fA-F0-9]+$/;
    return hexPattern.test(bytecode) && bytecode.length > 2;
  }

  /**
   * Extract ABI from bytecode metadata (if available)
   * @param {string} bytecode - Contract bytecode
   * @returns {Array|null} Extracted ABI or null
   */
  extractABIFromBytecode(bytecode) {
    try {
      // Look for metadata hash at the end of bytecode
      // Solidity embeds metadata hash in last 53 bytes
      if (bytecode.length < 106) { // 53 bytes * 2 + 2 for 0x
        return null;
      }

      // Extract potential metadata hash
      const metadataLength = parseInt(bytecode.slice(-4), 16) * 2;
      if (metadataLength > bytecode.length - 4) {
        return null;
      }

      // For now, return null as full metadata extraction requires IPFS
      // In a real implementation, you would fetch metadata from IPFS
      console.log(chalk.gray('   Metadata hash detected but ABI extraction requires IPFS access'));
      return null;

    } catch (error) {
      console.log(chalk.gray('   No extractable metadata found'));
      return null;
    }
  }

  /**
   * Generate minimal ABI from bytecode analysis
   * @param {string} bytecode - Contract bytecode
   * @returns {Array} Minimal ABI with detected functions
   */
  generateMinimalABI(bytecode) {
    console.log(chalk.gray('   Generating minimal ABI from bytecode analysis...'));
    
    // Extract function selectors from bytecode
    const selectors = this.extractFunctionSelectors(bytecode);
    
    // Generate basic ABI entries for detected selectors
    const abi = selectors.map(selector => ({
      type: 'function',
      name: `function_${selector}`,
      inputs: [], // Cannot determine inputs from bytecode alone
      outputs: [],
      stateMutability: 'nonpayable'
    }));

    console.log(chalk.gray(`   Generated minimal ABI with ${abi.length} function entries`));
    return abi;
  }

  /**
   * Extract function selectors from bytecode
   * @param {string} bytecode - Contract bytecode
   * @returns {Array<string>} Array of function selectors
   */
  extractFunctionSelectors(bytecode) {
    const selectors = new Set();
    
    // Look for PUSH4 instructions followed by function selectors
    // This is a simplified approach - real implementation would be more sophisticated
    const push4Pattern = /63([a-fA-F0-9]{8})/g;
    let match;
    
    while ((match = push4Pattern.exec(bytecode)) !== null) {
      selectors.add(match[1]);
    }

    return Array.from(selectors);
  }

  /**
   * Extract function signatures from ABI
   * @param {Array} abi - Contract ABI
   * @returns {Array<string>} Function signatures
   */
  extractFunctionSignatures(abi) {
    return abi
      .filter(item => item.type === 'function')
      .map(func => {
        const inputs = func.inputs.map(input => input.type).join(',');
        return `${func.name}(${inputs})`;
      });
  }

  /**
   * Detect contract type based on function signatures
   * @param {Array} abi - Contract ABI
   * @returns {string} Detected contract type
   */
  detectContractType(abi) {
    const functions = abi.filter(item => item.type === 'function').map(f => f.name);
    const functionSet = new Set(functions);

    // ERC20 detection
    const erc20Functions = ['transfer', 'transferFrom', 'approve', 'balanceOf', 'totalSupply'];
    if (erc20Functions.every(fn => functionSet.has(fn))) {
      return 'ERC20';
    }

    // ERC721 detection
    const erc721Functions = ['safeTransferFrom', 'transferFrom', 'approve', 'ownerOf', 'tokenURI'];
    if (erc721Functions.some(fn => functionSet.has(fn))) {
      return 'ERC721';
    }

    // ERC1155 detection
    if (functionSet.has('safeTransferFrom') && functionSet.has('balanceOfBatch')) {
      return 'ERC1155';
    }

    // Proxy detection
    if (functionSet.has('implementation') || functionSet.has('upgrade')) {
      return 'Proxy';
    }

    // MultiSig detection
    if (functionSet.has('submitTransaction') && functionSet.has('confirmTransaction')) {
      return 'MultiSig';
    }

    // DeFi patterns
    if (functionSet.has('swap') || functionSet.has('addLiquidity')) {
      return 'DeFi';
    }

    return 'Custom';
  }

  /**
   * Generate realistic test arguments for common contract types with intelligent analysis
   * @param {Array} abi - Contract ABI
   * @param {string} contractType - Detected contract type
   * @param {string} contractAddress - Contract address for state analysis
   * @param {Array} functionSignatures - Functions to generate args for
   * @returns {Promise<Object>} Function signatures with generated arguments and metadata
   */
  async generateTestArguments(abi, contractType, contractAddress = null, functionSignatures = null) {
    // If we have a contract address, use intelligent state analysis
    if (contractAddress && functionSignatures) {
      try {
        console.log(chalk.blue('🧠 Using intelligent argument generation...'));
        const analysis = await this.stateAnalyzer.analyzeContractForArguments(
          contractAddress, 
          abi, 
          functionSignatures
        );
        
        if (analysis.optimizedArgs && Object.keys(analysis.optimizedArgs).length > 0) {
          console.log(chalk.green(`✅ Generated optimized arguments for ${Object.keys(analysis.optimizedArgs).length} functions`));
          
          // Display recommendations if any
          if (analysis.recommendations.length > 0) {
            console.log(chalk.yellow('💡 Recommendations:'));
            analysis.recommendations.forEach(rec => {
              console.log(chalk.gray(`   • ${rec}`));
            });
          }
          
          return {
            testArgs: analysis.optimizedArgs,
            senderOptions: analysis.senderOptions,
            contractInfo: analysis.contractInfo,
            intelligent: true
          };
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Intelligent analysis failed: ${error.message}`));
        console.log(chalk.gray('   Falling back to basic argument generation...'));
      }
    }
    
    // Fallback to basic argument generation
    console.log(chalk.gray('📝 Using basic argument generation...'));
    const testArgs = {};
    
    const funcsToProcess = functionSignatures || 
      abi.filter(item => item.type === 'function').map(func => 
        `${func.name}(${func.inputs.map(input => input.type).join(',')})`
      );
    
    for (const signature of funcsToProcess) {
      const func = abi.find(item => {
        if (item.type !== 'function') return false;
        const sig = `${item.name}(${item.inputs.map(input => input.type).join(',')})`;
        return sig === signature;
      });
      
      if (func) {
        testArgs[signature] = {
          args: this.generateArgsForFunction(func, contractType),
          sender: this.wallet.address,
          confidence: 20,
          rationale: ['Basic argument generation']
        };
      }
    }

    return {
      testArgs,
      senderOptions: { user: this.wallet.address },
      contractInfo: { type: contractType },
      intelligent: false
    };
  }

  /**
   * Generate arguments for a specific function
   * @param {Object} funcABI - Function ABI entry
   * @param {string} contractType - Contract type
   * @returns {Array} Generated arguments
   */
  generateArgsForFunction(funcABI, contractType) {
    const args = [];

    for (const input of funcABI.inputs) {
      args.push(this.generateValueForType(input.type, input.name, contractType));
    }

    return args;
  }

  /**
   * Generate realistic value for a specific type
   * @param {string} type - Solidity type
   * @param {string} name - Parameter name
   * @param {string} contractType - Contract type for context
   * @returns {any} Generated value
   */
  generateValueForType(type, name, contractType) {
    // Address types
    if (type === 'address') {
      if (name.includes('to') || name.includes('recipient')) {
        return '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15'; // Test address
      }
      return ethers.ZeroAddress;
    }

    // Boolean types
    if (type === 'bool') {
      return true;
    }

    // String types
    if (type === 'string') {
      if (contractType === 'ERC721' && name.includes('uri')) {
        return 'https://example.com/token/1';
      }
      return 'test string';
    }

    // Bytes types
    if (type.startsWith('bytes')) {
      if (type === 'bytes') {
        return '0x1234';
      }
      const size = parseInt(type.replace('bytes', ''));
      return '0x' + '12'.repeat(size);
    }

    // Uint types
    if (type.startsWith('uint')) {
      if (contractType === 'ERC20' && (name.includes('amount') || name.includes('value'))) {
        return '1000000000000000000'; // 1 token (18 decimals)
      }
      if (name.includes('id') || name.includes('tokenId')) {
        return '1';
      }
      return '100';
    }

    // Int types
    if (type.startsWith('int')) {
      return '100';
    }

    // Array types
    if (type.endsWith('[]')) {
      const baseType = type.slice(0, -2);
      return [this.generateValueForType(baseType, name, contractType)];
    }

    // Default fallback
    return '0';
  }
}

module.exports = {
  BytecodeProcessor
};