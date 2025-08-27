const { ethers } = require('ethers');
const chalk = require('chalk');
const { PaymasterReputationTracker } = require('../lib/paymaster-reputation');

/**
 * Paymaster Utility for Somnia Gas Profiler
 * Provides EIP-4337 Account Abstraction support
 */
class PaymasterUtils {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.reputationTracker = options.enableReputationTracking !== false ? 
      new PaymasterReputationTracker({ 
        provider, 
        trackingEnabled: true,
        ...options.reputationOptions 
      }) : null;
  }

  /**
   * Create a comprehensive UserOperation for EIP-4337 compatibility
   * @param {Object} options - UserOperation options
   * @returns {Object} Complete UserOperation object
   */
  createUserOperation(options) {
    const {
      sender,
      nonce = 0,
      initCode = '0x',
      callData,
      callGasLimit,
      verificationGasLimit = 150000,
      preVerificationGas = 21000,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData = '0x',
      signature = '0x'
    } = options;

    // Validate required fields
    if (!sender || !ethers.isAddress(sender)) {
      throw new Error('Valid sender address is required');
    }
    if (!callData) {
      throw new Error('Call data is required');
    }
    if (!callGasLimit || callGasLimit <= 0) {
      throw new Error('Valid call gas limit is required');
    }

    const userOp = {
      sender: ethers.getAddress(sender), // Ensure proper checksum
      nonce: ethers.toBeHex(nonce),
      initCode,
      callData,
      callGasLimit: ethers.toBeHex(callGasLimit),
      verificationGasLimit: ethers.toBeHex(verificationGasLimit),
      preVerificationGas: ethers.toBeHex(preVerificationGas),
      maxFeePerGas: ethers.toBeHex(maxFeePerGas),
      maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
      paymasterAndData,
      signature
    };

    // Add metadata for internal tracking
    userOp._metadata = {
      created: Date.now(),
      totalGasLimit: Number(callGasLimit) + Number(verificationGasLimit) + Number(preVerificationGas),
      hasPaymaster: paymasterAndData !== '0x',
      version: '0.6.0' // EIP-4337 version
    };

    return userOp;
  }

  /**
   * Create UserOperation from contract call parameters
   * @param {Object} params - Contract call parameters
   * @returns {Promise<Object>} UserOperation with estimated gas
   */
  async createUserOperationFromCall(params) {
    const {
      contract,
      functionName,
      args = [],
      sender,
      paymasterAddress,
      overrides = {}
    } = params;

    try {
      // Generate call data
      const callData = contract.interface.encodeFunctionData(functionName, args);
      
      // Estimate gas for the call
      const callGasLimit = await contract[functionName].estimateGas(...args);
      
      // Get current fee data
      const feeData = await this.provider.getFeeData();
      
      // Create base UserOperation
      const userOpParams = {
        sender,
        callData,
        callGasLimit: Number(callGasLimit),
        maxFeePerGas: overrides.maxFeePerGas || feeData.maxFeePerGas || feeData.gasPrice,
        maxPriorityFeePerGas: overrides.maxPriorityFeePerGas || feeData.maxPriorityFeePerGas || 1000000000,
        ...overrides
      };

      // Add paymaster data if provided
      if (paymasterAddress) {
        userOpParams.paymasterAndData = this.generatePaymasterData(paymasterAddress, {
          validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          validAfter: 0
        });
      }

      return this.createUserOperation(userOpParams);

    } catch (error) {
      throw new Error(`Failed to create UserOperation from call: ${error.message}`);
    }
  }

  /**
   * Bundle multiple UserOperations for batch processing
   * @param {Array} userOps - Array of UserOperation objects
   * @param {Object} options - Bundling options
   * @returns {Object} UserOperation bundle
   */
  bundleUserOperations(userOps, options = {}) {
    const {
      maxBundleSize = 10,
      gasLimitBuffer = 1.1, // 10% buffer
      prioritizeByGas = true
    } = options;

    if (!Array.isArray(userOps) || userOps.length === 0) {
      throw new Error('UserOps array is required and must not be empty');
    }

    // Validate and filter UserOperations
    const validUserOps = userOps.filter(userOp => this._validateUserOperation(userOp));
    
    if (validUserOps.length === 0) {
      throw new Error('No valid UserOperations found in bundle');
    }

    // Sort by gas priority if requested
    if (prioritizeByGas) {
      validUserOps.sort((a, b) => {
        const aMaxFee = parseInt(a.maxFeePerGas, 16);
        const bMaxFee = parseInt(b.maxFeePerGas, 16);
        return bMaxFee - aMaxFee; // Descending order
      });
    }

    // Split into bundles if exceeding max size
    const bundles = [];
    for (let i = 0; i < validUserOps.length; i += maxBundleSize) {
      const bundleOps = validUserOps.slice(i, i + maxBundleSize);
      
      // Calculate bundle metrics
      const totalGasLimit = bundleOps.reduce((sum, op) => {
        return sum + parseInt(op.callGasLimit, 16) + 
                     parseInt(op.verificationGasLimit, 16) + 
                     parseInt(op.preVerificationGas, 16);
      }, 0);

      const bundleGasLimit = Math.ceil(totalGasLimit * gasLimitBuffer);
      
      bundles.push({
        userOperations: bundleOps,
        bundleId: ethers.keccak256(ethers.toUtf8Bytes(`bundle_${Date.now()}_${i}`)),
        totalGasLimit: bundleGasLimit,
        operationCount: bundleOps.length,
        estimatedCost: this._estimateBundleCost(bundleOps),
        paymasterOperations: bundleOps.filter(op => op.paymasterAndData !== '0x').length,
        timestamp: Date.now()
      });
    }

    return bundles.length === 1 ? bundles[0] : bundles;
  }

  /**
   * Validate UserOperation structure and data
   * @param {Object} userOp - UserOperation to validate
   * @returns {boolean} Validation result
   */
  _validateUserOperation(userOp) {
    const requiredFields = [
      'sender', 'nonce', 'initCode', 'callData',
      'callGasLimit', 'verificationGasLimit', 'preVerificationGas',
      'maxFeePerGas', 'maxPriorityFeePerGas', 'paymasterAndData', 'signature'
    ];

    // Check required fields
    for (const field of requiredFields) {
      if (!(field in userOp)) {
        console.warn(`UserOperation missing required field: ${field}`);
        return false;
      }
    }

    // Validate sender address
    try {
      ethers.getAddress(userOp.sender);
    } catch {
      console.warn(`Invalid sender address: ${userOp.sender}`);
      return false;
    }

    // Validate gas limits are positive
    const gasFields = ['callGasLimit', 'verificationGasLimit', 'preVerificationGas'];
    for (const field of gasFields) {
      const gasValue = parseInt(userOp[field], 16);
      if (isNaN(gasValue) || gasValue <= 0) {
        console.warn(`Invalid ${field}: ${userOp[field]}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Estimate the total cost of a bundle
   * @param {Array} userOps - UserOperations in the bundle
   * @returns {Object} Cost estimation
   */
  _estimateBundleCost(userOps) {
    const totalGas = userOps.reduce((sum, op) => {
      return sum + parseInt(op.callGasLimit, 16) + 
                   parseInt(op.verificationGasLimit, 16) + 
                   parseInt(op.preVerificationGas, 16);
    }, 0);

    const avgMaxFeePerGas = userOps.reduce((sum, op) => {
      return sum + parseInt(op.maxFeePerGas, 16);
    }, 0) / userOps.length;

    const estimatedCostWei = BigInt(totalGas) * BigInt(Math.round(avgMaxFeePerGas));

    return {
      totalGas,
      avgMaxFeePerGas: Math.round(avgMaxFeePerGas),
      estimatedCostWei: estimatedCostWei.toString(),
      estimatedCostEth: ethers.formatEther(estimatedCostWei)
    };
  }

  /**
   * Estimate gas for a UserOperation
   * @param {Object} userOp - UserOperation object
   * @returns {Promise<Object>} Gas estimates
   */
  async estimateUserOperationGas(userOp) {
    try {
      // Simulate the UserOperation to get gas estimates
      // This is a simplified implementation
      const estimates = {
        preVerificationGas: 21000,
        verificationGasLimit: 150000,
        callGasLimit: parseInt(userOp.callGasLimit, 16),
        paymasterGas: userOp.paymasterAndData !== '0x' ? 50000 : 0
      };

      estimates.totalGas = estimates.preVerificationGas + 
                          estimates.verificationGasLimit + 
                          estimates.callGasLimit + 
                          estimates.paymasterGas;

      return estimates;
    } catch (error) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }

  /**
   * Generate paymaster data for sponsored transactions
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {Object} options - Paymaster options
   * @returns {string} Encoded paymaster data
   */
  generatePaymasterData(paymasterAddress, options = {}) {
    const {
      validUntil = Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      validAfter = 0,
      sponsorshipData = '0x'
    } = options;

    // Simple paymaster data encoding
    // Real implementation would depend on specific paymaster contract
    const paymasterData = ethers.concat([
      paymasterAddress,
      ethers.toBeHex(validUntil, 6),
      ethers.toBeHex(validAfter, 6),
      sponsorshipData
    ]);

    return paymasterData;
  }

  /**
   * Comprehensive paymaster contract interface validation (EIP-4337 compliant)
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Detailed validation result
   */
  async validatePaymasterInterface(paymasterAddress) {
    try {
      const result = {
        address: paymasterAddress,
        valid: false,
        eip4337Compliant: false,
        hasValidateMethod: false,
        hasPostOpMethod: false,
        hasDepositMethod: false,
        supportsInterface: false,
        codeSize: 0,
        balance: '0',
        gasEstimate: {
          validateGas: 0,
          postOpGas: 0
        },
        validation: {
          interfaceCheck: false,
          functionalTest: false,
          gasTest: false
        },
        errors: []
      };

      // 1. Basic contract existence check
      const code = await this.provider.getCode(paymasterAddress);
      if (code === '0x') {
        result.errors.push('No contract found at address');
        return result;
      }
      result.codeSize = code.length;

      // 2. Check contract balance
      const balance = await this.provider.getBalance(paymasterAddress);
      result.balance = ethers.formatEther(balance);

      // 3. Interface detection via bytecode analysis
      result.hasValidateMethod = this._checkMethodInBytecode(code, 'validatePaymasterUserOp');
      result.hasPostOpMethod = this._checkMethodInBytecode(code, 'postOp');
      result.hasDepositMethod = this._checkMethodInBytecode(code, 'deposit') || 
                               this._checkMethodInBytecode(code, 'addStake');

      // 4. ERC-165 interface support check
      try {
        const paymasterContract = new ethers.Contract(
          paymasterAddress,
          [
            'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
            'function validatePaymasterUserOp(tuple(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 maxCost) external view returns (bytes context, uint256 validationData)',
            'function postOp(uint8 mode, bytes context, uint256 actualGasCost) external',
            'function deposit() external payable',
            'function withdrawTo(address payable withdrawAddress, uint256 amount) external',
            'function addStake(uint32 unstakeDelaySec) external payable'
          ],
          this.provider
        );

        // Check EIP-4337 IPaymaster interface (0x01ffc9a7 for ERC-165, 0x3a55235d for IPaymaster)
        try {
          result.supportsInterface = await paymasterContract.supportsInterface('0x3a55235d');
        } catch {
          // supportsInterface not implemented, continue with other checks
        }

        result.validation.interfaceCheck = true;

        // 5. Functional validation with dummy UserOperation
        if (result.hasValidateMethod) {
          try {
            const dummyUserOp = this._createDummyUserOperation();
            const dummyUserOpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'uint256', 'bytes32'],
              [dummyUserOp.sender, dummyUserOp.nonce, ethers.keccak256('0x')]
            ));

            // Estimate gas for validatePaymasterUserOp
            const validateGas = await paymasterContract.validatePaymasterUserOp.estimateGas(
              dummyUserOp, dummyUserOpHash, ethers.parseEther('0.01')
            );
            result.gasEstimate.validateGas = Number(validateGas);
            result.validation.functionalTest = true;
          } catch (error) {
            result.errors.push(`Functional validation failed: ${error.message.substring(0, 100)}`);
          }
        }

        // 6. Gas estimation for postOp
        if (result.hasPostOpMethod) {
          try {
            const postOpGas = await paymasterContract.postOp.estimateGas(
              0, // mode: opSucceeded
              '0x', // empty context
              ethers.parseEther('0.001') // 1000000000000000 wei
            );
            result.gasEstimate.postOpGas = Number(postOpGas);
            result.validation.gasTest = true;
          } catch (error) {
            result.errors.push(`PostOp gas estimation failed: ${error.message.substring(0, 100)}`);
          }
        }

      } catch (error) {
        result.errors.push(`Contract interaction failed: ${error.message}`);
      }

      // 7. Final validation scoring
      result.eip4337Compliant = result.hasValidateMethod && result.hasPostOpMethod && 
                               result.validation.interfaceCheck;
      result.valid = result.eip4337Compliant && 
                    (result.supportsInterface || result.validation.functionalTest) &&
                    parseFloat(result.balance) > 0.001; // At least 0.001 ETH for operations

      return result;

    } catch (error) {
      return {
        address: paymasterAddress,
        valid: false,
        error: error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Check if a method exists in contract bytecode
   * @param {string} bytecode - Contract bytecode
   * @param {string} methodName - Method name to search for
   * @returns {boolean} Whether method exists
   */
  _checkMethodInBytecode(bytecode, methodName) {
    // Calculate method selector (first 4 bytes of keccak256 hash)
    const methodHash = ethers.keccak256(ethers.toUtf8Bytes(methodName));
    const selector = methodHash.slice(0, 10); // 0x + 8 hex chars
    return bytecode.toLowerCase().includes(selector.slice(2).toLowerCase());
  }

  /**
   * Create a dummy UserOperation for testing
   * @returns {Object} Dummy UserOperation
   */
  _createDummyUserOperation() {
    return {
      sender: '0x0000000000000000000000000000000000000001',
      nonce: '0x00',
      initCode: '0x',
      callData: '0x',
      callGasLimit: '0x5208', // 21000
      verificationGasLimit: '0x249F0', // 150000
      preVerificationGas: '0x5208', // 21000
      maxFeePerGas: '0x59682F00', // 1.5 gwei
      maxPriorityFeePerGas: '0x3B9ACA00', // 1 gwei
      paymasterAndData: '0x',
      signature: '0x'
    };
  }

  /**
   * Calculate dynamic paymaster gas overhead based on contract complexity
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {Object} userOp - UserOperation object
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Detailed gas overhead analysis
   */
  async calculatePaymasterOverhead(paymasterAddress, userOp, options = {}) {
    try {
      const {
        includeValidation = true,
        includePostOp = true,
        useDetailedAnalysis = true,
        cacheResults = true
      } = options;

      const overhead = {
        baseOverhead: 0,
        validationOverhead: 0,
        postOpOverhead: 0,
        storageOverhead: 0,
        complexityOverhead: 0,
        totalOverhead: 0,
        confidence: 0, // 0-100 confidence in estimation
        breakdown: {},
        cacheHit: false
      };

      // Check cache first
      const cacheKey = `${paymasterAddress}_${ethers.keccak256(JSON.stringify(userOp))}`;
      if (cacheResults && this._gasOverheadCache && this._gasOverheadCache[cacheKey]) {
        const cached = this._gasOverheadCache[cacheKey];
        if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
          cached.result.cacheHit = true;
          return cached.result;
        }
      }

      // Get paymaster validation results
      const validation = await this.validatePaymasterInterface(paymasterAddress);
      if (!validation.valid) {
        throw new Error(`Invalid paymaster: ${validation.errors?.join(', ') || 'Unknown error'}`);
      }

      // Base overhead for EIP-4337 operations
      overhead.baseOverhead = 21000; // Base transaction cost

      // 1. Validation overhead analysis
      if (includeValidation && validation.hasValidateMethod) {
        if (validation.gasEstimate && validation.gasEstimate.validateGas > 0) {
          // Use actual gas estimate if available
          overhead.validationOverhead = validation.gasEstimate.validateGas;
          overhead.confidence += 30;
        } else {
          // Estimate based on contract complexity
          overhead.validationOverhead = await this._estimateValidationGas(
            paymasterAddress, userOp, validation.codeSize
          );
          overhead.confidence += 15;
        }
      }

      // 2. PostOp overhead analysis
      if (includePostOp && validation.hasPostOpMethod) {
        if (validation.gasEstimate && validation.gasEstimate.postOpGas > 0) {
          overhead.postOpOverhead = validation.gasEstimate.postOpGas;
          overhead.confidence += 20;
        } else {
          overhead.postOpOverhead = await this._estimatePostOpGas(
            paymasterAddress, validation.codeSize
          );
          overhead.confidence += 10;
        }
      }

      // 3. Storage access overhead
      overhead.storageOverhead = await this._estimateStorageOverhead(
        paymasterAddress, userOp
      );
      overhead.confidence += 10;

      // 4. Contract complexity overhead
      if (useDetailedAnalysis) {
        overhead.complexityOverhead = await this._analyzeContractComplexity(
          paymasterAddress, validation.codeSize
        );
        overhead.confidence += 15;
      }

      // 5. Additional overhead based on enhanced paymaster type detection
      const paymasterTypeAnalysis = await this.detectPaymasterType(paymasterAddress);
      const typeOverhead = this._getEnhancedTypeSpecificOverhead(paymasterTypeAnalysis);
      overhead.complexityOverhead += typeOverhead.overhead;
      overhead.confidence += 15;
      
      // Store type analysis in breakdown
      overhead.breakdown.paymasterType = {
        gas: typeOverhead.overhead,
        description: `${paymasterTypeAnalysis.primaryType} (${paymasterTypeAnalysis.gasComplexity} complexity)`,
        details: {
          type: paymasterTypeAnalysis.primaryType,
          subTypes: paymasterTypeAnalysis.subTypes,
          features: paymasterTypeAnalysis.supportedFeatures,
          confidence: paymasterTypeAnalysis.confidence
        }
      };

      // Calculate total overhead
      overhead.totalOverhead = Math.ceil(
        overhead.baseOverhead +
        overhead.validationOverhead +
        overhead.postOpOverhead +
        overhead.storageOverhead +
        overhead.complexityOverhead
      );

      // Create detailed breakdown
      overhead.breakdown = {
        base: { gas: overhead.baseOverhead, description: 'Base EIP-4337 overhead' },
        validation: { gas: overhead.validationOverhead, description: 'Paymaster validation logic' },
        postOp: { gas: overhead.postOpOverhead, description: 'Post-operation processing' },
        storage: { gas: overhead.storageOverhead, description: 'Storage access operations' },
        complexity: { gas: overhead.complexityOverhead, description: `Contract complexity (${paymasterType})` }
      };

      // Ensure confidence doesn't exceed 100
      overhead.confidence = Math.min(overhead.confidence, 100);

      // Cache the result
      if (cacheResults) {
        if (!this._gasOverheadCache) this._gasOverheadCache = {};
        this._gasOverheadCache[cacheKey] = {
          result: { ...overhead },
          timestamp: Date.now()
        };
      }

      return overhead;

    } catch (error) {
      // Return conservative fallback estimate
      return {
        baseOverhead: 21000,
        validationOverhead: 45000,
        postOpOverhead: 15000,
        storageOverhead: 5000,
        complexityOverhead: 10000,
        totalOverhead: 96000,
        confidence: 25,
        error: error.message,
        fallback: true,
        breakdown: {
          fallback: { gas: 96000, description: 'Conservative fallback estimate' }
        }
      };
    }
  }

  /**
   * Estimate validation gas based on contract analysis
   * @param {string} paymasterAddress - Paymaster address
   * @param {Object} userOp - UserOperation
   * @param {number} codeSize - Contract code size
   * @returns {Promise<number>} Estimated validation gas
   */
  async _estimateValidationGas(paymasterAddress, userOp, codeSize) {
    let estimatedGas = 25000; // Base validation cost

    // Adjust based on code size (larger contracts typically have more complex validation)
    if (codeSize > 50000) estimatedGas += 20000;
    else if (codeSize > 20000) estimatedGas += 10000;
    else if (codeSize > 10000) estimatedGas += 5000;

    // Check for known patterns that increase gas usage
    try {
      const code = await this.provider.getCode(paymasterAddress);
      const lowercaseCode = code.toLowerCase();
      
      // Look for expensive operations
      if (lowercaseCode.includes('sstore')) estimatedGas += 20000; // Storage writes
      if (lowercaseCode.includes('call') || lowercaseCode.includes('delegatecall')) {
        estimatedGas += 10000; // External calls
      }
      if (lowercaseCode.includes('create') || lowercaseCode.includes('create2')) {
        estimatedGas += 30000; // Contract creation
      }
    } catch {
      // If code analysis fails, use conservative estimate
      estimatedGas += 15000;
    }

    return estimatedGas;
  }

  /**
   * Estimate postOp gas based on contract analysis
   * @param {string} paymasterAddress - Paymaster address
   * @param {number} codeSize - Contract code size
   * @returns {Promise<number>} Estimated postOp gas
   */
  async _estimatePostOpGas(paymasterAddress, codeSize) {
    let estimatedGas = 10000; // Base postOp cost

    // PostOp is typically simpler than validation
    if (codeSize > 30000) estimatedGas += 10000;
    else if (codeSize > 15000) estimatedGas += 5000;

    return estimatedGas;
  }

  /**
   * Estimate storage access overhead
   * @param {string} paymasterAddress - Paymaster address
   * @param {Object} userOp - UserOperation
   * @returns {Promise<number>} Storage overhead estimate
   */
  async _estimateStorageOverhead(paymasterAddress, userOp) {
    // Base storage operations: reading paymaster state, updating nonces, etc.
    let storageGas = 5000;

    // Additional overhead for operations with higher storage requirements
    if (userOp.paymasterAndData && userOp.paymasterAndData.length > 42) {
      // Complex paymaster data suggests more storage operations
      storageGas += 3000;
    }

    return storageGas;
  }

  /**
   * Analyze contract complexity and estimate associated overhead
   * @param {string} paymasterAddress - Paymaster address
   * @param {number} codeSize - Contract code size
   * @returns {Promise<number>} Complexity overhead
   */
  async _analyzeContractComplexity(paymasterAddress, codeSize) {
    let complexityGas = 0;

    try {
      const code = await this.provider.getCode(paymasterAddress);
      const complexity = this._calculateComplexityScore(code);
      
      // Convert complexity score to gas overhead
      complexityGas = Math.min(complexity * 1000, 25000); // Cap at 25k gas
      
    } catch {
      // Fallback based on code size
      complexityGas = Math.min(codeSize / 100, 15000);
    }

    return complexityGas;
  }

  /**
   * Calculate a complexity score for contract bytecode
   * @param {string} bytecode - Contract bytecode
   * @returns {number} Complexity score (0-25)
   */
  _calculateComplexityScore(bytecode) {
    let score = 0;
    const code = bytecode.toLowerCase();

    // Count expensive opcodes
    const expensiveOps = {
      'sstore': 5,    // Storage writes
      'sload': 2,     // Storage reads
      'call': 3,      // External calls
      'delegatecall': 4,
      'staticcall': 2,
      'create': 8,    // Contract creation
      'create2': 8,
      'selfdestruct': 10,
      'log': 1        // Event logs
    };

    for (const [op, weight] of Object.entries(expensiveOps)) {
      const matches = (code.match(new RegExp(op, 'g')) || []).length;
      score += matches * weight;
    }

    return Math.min(score, 25); // Cap score at 25
  }

  /**
   * Detect and analyze paymaster type with detailed characteristics
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Detailed paymaster type analysis
   */
  async detectPaymasterType(paymasterAddress) {
    try {
      const code = await this.provider.getCode(paymasterAddress);
      const lowercaseCode = code.toLowerCase();
      
      const analysis = {
        address: paymasterAddress,
        primaryType: 'unknown',
        subTypes: [],
        characteristics: {
          isTokenBased: false,
          requiresDeposit: false,
          hasConditionalLogic: false,
          supportsMultipleTokens: false,
          hasTimeRestrictions: false,
          hasWhitelist: false,
          isVerifying: false,
          isStaking: false
        },
        supportedFeatures: [],
        confidence: 0,
        gasComplexity: 'medium',
        recommendedUse: []
      };

      // Create contract instance for detailed analysis
      const paymasterContract = new ethers.Contract(
        paymasterAddress,
        [
          // Standard IPaymaster interface
          'function validatePaymasterUserOp(tuple(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 maxCost) external view returns (bytes context, uint256 validationData)',
          'function postOp(uint8 mode, bytes context, uint256 actualGasCost) external',
          
          // Common paymaster extensions
          'function deposit() external payable',
          'function withdrawTo(address payable withdrawAddress, uint256 amount) external',
          'function addStake(uint32 unstakeDelaySec) external payable',
          
          // Token paymaster methods
          'function token() external view returns (address)',
          'function acceptedTokens(address) external view returns (bool)',
          'function tokenToWei(address token, uint256 tokenAmount) external view returns (uint256)',
          
          // Verifying paymaster methods
          'function verifyingSigner() external view returns (address)',
          'function owner() external view returns (address)',
          
          // Conditional paymaster methods
          'function isValidUser(address user) external view returns (bool)',
          'function userAllowance(address user) external view returns (uint256)',
          
          // Staking paymaster methods
          'function stakingToken() external view returns (address)',
          'function minimumStake() external view returns (uint256)'
        ],
        this.provider
      );

      // 1. Token-based paymaster detection
      analysis.characteristics.isTokenBased = await this._detectTokenBasedPaymaster(paymasterContract, lowercaseCode);
      
      // 2. Verifying paymaster detection
      analysis.characteristics.isVerifying = await this._detectVerifyingPaymaster(paymasterContract, lowercaseCode);
      
      // 3. Staking paymaster detection
      analysis.characteristics.isStaking = await this._detectStakingPaymaster(paymasterContract, lowercaseCode);
      
      // 4. Conditional logic detection
      analysis.characteristics.hasConditionalLogic = await this._detectConditionalLogic(paymasterContract, lowercaseCode);
      
      // 5. Deposit requirements
      analysis.characteristics.requiresDeposit = await this._detectDepositRequirements(paymasterContract, lowercaseCode);
      
      // 6. Additional features
      analysis.characteristics.hasTimeRestrictions = this._detectTimeRestrictions(lowercaseCode);
      analysis.characteristics.hasWhitelist = this._detectWhitelist(lowercaseCode);
      analysis.characteristics.supportsMultipleTokens = await this._detectMultipleTokenSupport(paymasterContract, lowercaseCode);

      // Determine primary type based on characteristics
      analysis.primaryType = this._determinePrimaryType(analysis.characteristics);
      analysis.subTypes = this._determineSubTypes(analysis.characteristics);
      
      // Calculate gas complexity
      analysis.gasComplexity = this._calculateGasComplexity(analysis.characteristics, code.length);
      
      // Generate supported features list
      analysis.supportedFeatures = this._generateSupportedFeatures(analysis.characteristics);
      
      // Calculate confidence score
      analysis.confidence = this._calculateTypeConfidence(analysis.characteristics, analysis.primaryType);
      
      // Generate recommendations
      analysis.recommendedUse = this._generateRecommendations(analysis.primaryType, analysis.characteristics);
      
      return analysis;
      
    } catch (error) {
      return {
        address: paymasterAddress,
        primaryType: 'unknown',
        error: error.message,
        confidence: 0,
        gasComplexity: 'high' // Conservative estimate
      };
    }
  }

  /**
   * Detect token-based paymaster characteristics
   */
  async _detectTokenBasedPaymaster(contract, bytecode) {
    try {
      // Check for token() method
      const tokenAddress = await contract.token();
      if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
        return true;
      }
    } catch {}
    
    // Check bytecode for token-related patterns
    return bytecode.includes('token') || 
           bytecode.includes('erc20') || 
           bytecode.includes('transfer');
  }

  /**
   * Detect verifying paymaster characteristics
   */
  async _detectVerifyingPaymaster(contract, bytecode) {
    try {
      // Check for verifyingSigner() method
      const signer = await contract.verifyingSigner();
      if (signer && signer !== ethers.ZeroAddress) {
        return true;
      }
    } catch {}
    
    // Check bytecode for signature verification patterns
    return bytecode.includes('verifying') || 
           bytecode.includes('signer') || 
           bytecode.includes('ecdsa') ||
           bytecode.includes('signature');
  }

  /**
   * Detect staking paymaster characteristics
   */
  async _detectStakingPaymaster(contract, bytecode) {
    try {
      // Check for staking-related methods
      const stakingToken = await contract.stakingToken();
      if (stakingToken && stakingToken !== ethers.ZeroAddress) {
        return true;
      }
    } catch {}
    
    // Check bytecode for staking patterns
    return bytecode.includes('stake') || 
           bytecode.includes('staking') || 
           bytecode.includes('unstake');
  }

  /**
   * Detect conditional logic in paymaster
   */
  async _detectConditionalLogic(contract, bytecode) {
    try {
      // Check for user validation methods
      const isValid = await contract.isValidUser(ethers.ZeroAddress);
      return true; // If method exists and doesn't revert
    } catch {}
    
    // Check bytecode for conditional patterns
    return bytecode.includes('allowance') || 
           bytecode.includes('whitelist') || 
           bytecode.includes('blacklist') ||
           bytecode.includes('permission');
  }

  /**
   * Detect deposit requirements
   */
  async _detectDepositRequirements(contract, bytecode) {
    try {
      // Check if deposit method exists and is payable
      await contract.deposit.estimateGas();
      return true;
    } catch {}
    
    return bytecode.includes('deposit') || 
           bytecode.includes('addstake');
  }

  /**
   * Detect time restrictions
   */
  _detectTimeRestrictions(bytecode) {
    return bytecode.includes('timestamp') || 
           bytecode.includes('block.timestamp') || 
           bytecode.includes('validuntil') ||
           bytecode.includes('validafter');
  }

  /**
   * Detect whitelist functionality
   */
  _detectWhitelist(bytecode) {
    return bytecode.includes('whitelist') || 
           bytecode.includes('allowlist') || 
           bytecode.includes('authorized');
  }

  /**
   * Detect multiple token support
   */
  async _detectMultipleTokenSupport(contract, bytecode) {
    try {
      // Check if acceptedTokens mapping exists
      const isAccepted = await contract.acceptedTokens(ethers.ZeroAddress);
      return true; // Method exists
    } catch {}
    
    return bytecode.includes('acceptedtokens') || 
           bytecode.includes('supportedtokens');
  }

  /**
   * Determine primary paymaster type
   */
  _determinePrimaryType(characteristics) {
    if (characteristics.isTokenBased) {
      return 'token-paymaster';
    }
    if (characteristics.isVerifying) {
      return 'verifying-paymaster';
    }
    if (characteristics.isStaking) {
      return 'staking-paymaster';
    }
    if (characteristics.hasConditionalLogic) {
      return 'conditional-paymaster';
    }
    if (characteristics.requiresDeposit) {
      return 'deposit-paymaster';
    }
    
    return 'sponsorship-paymaster'; // Default/simple sponsorship
  }

  /**
   * Determine sub-types
   */
  _determineSubTypes(characteristics) {
    const subTypes = [];
    
    if (characteristics.hasTimeRestrictions) subTypes.push('time-restricted');
    if (characteristics.hasWhitelist) subTypes.push('whitelisted');
    if (characteristics.supportsMultipleTokens) subTypes.push('multi-token');
    if (characteristics.hasConditionalLogic) subTypes.push('conditional');
    
    return subTypes;
  }

  /**
   * Calculate gas complexity based on features
   */
  _calculateGasComplexity(characteristics, codeSize) {
    let complexityScore = 0;
    
    if (characteristics.isTokenBased) complexityScore += 3;
    if (characteristics.isVerifying) complexityScore += 2;
    if (characteristics.isStaking) complexityScore += 3;
    if (characteristics.hasConditionalLogic) complexityScore += 2;
    if (characteristics.supportsMultipleTokens) complexityScore += 2;
    if (characteristics.hasTimeRestrictions) complexityScore += 1;
    if (characteristics.hasWhitelist) complexityScore += 1;
    
    // Factor in code size
    if (codeSize > 50000) complexityScore += 2;
    else if (codeSize > 20000) complexityScore += 1;
    
    if (complexityScore >= 6) return 'high';
    if (complexityScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generate supported features list
   */
  _generateSupportedFeatures(characteristics) {
    const features = [];
    
    if (characteristics.isTokenBased) features.push('Token-based payments');
    if (characteristics.isVerifying) features.push('Signature verification');
    if (characteristics.isStaking) features.push('Staking requirements');
    if (characteristics.hasConditionalLogic) features.push('Conditional sponsorship');
    if (characteristics.requiresDeposit) features.push('Deposit funding');
    if (characteristics.hasTimeRestrictions) features.push('Time-based restrictions');
    if (characteristics.hasWhitelist) features.push('User whitelisting');
    if (characteristics.supportsMultipleTokens) features.push('Multiple token support');
    
    return features;
  }

  /**
   * Calculate confidence in type detection
   */
  _calculateTypeConfidence(characteristics, primaryType) {
    let confidence = 30; // Base confidence
    
    // Specific type indicators
    if (primaryType === 'token-paymaster' && characteristics.isTokenBased) confidence += 40;
    if (primaryType === 'verifying-paymaster' && characteristics.isVerifying) confidence += 40;
    if (primaryType === 'staking-paymaster' && characteristics.isStaking) confidence += 40;
    
    // Supporting characteristics
    if (characteristics.hasConditionalLogic) confidence += 10;
    if (characteristics.requiresDeposit) confidence += 10;
    if (characteristics.hasTimeRestrictions) confidence += 5;
    if (characteristics.hasWhitelist) confidence += 5;
    
    return Math.min(confidence, 100);
  }

  /**
   * Generate usage recommendations
   */
  _generateRecommendations(primaryType, characteristics) {
    const recommendations = [];
    
    switch (primaryType) {
      case 'token-paymaster':
        recommendations.push('Suitable for applications accepting token payments');
        recommendations.push('Users pay gas fees in supported tokens');
        if (characteristics.supportsMultipleTokens) {
          recommendations.push('Supports multiple token types for flexibility');
        }
        break;
        
      case 'verifying-paymaster':
        recommendations.push('Ideal for applications with centralized control');
        recommendations.push('Requires off-chain signature for sponsorship');
        recommendations.push('Good for private applications or MVPs');
        break;
        
      case 'staking-paymaster':
        recommendations.push('Perfect for DeFi applications with staking');
        recommendations.push('Users must stake tokens to receive sponsorship');
        recommendations.push('Aligns user incentives with protocol success');
        break;
        
      case 'conditional-paymaster':
        recommendations.push('Suitable for applications with usage restrictions');
        recommendations.push('Can implement custom sponsorship logic');
        if (characteristics.hasWhitelist) {
          recommendations.push('Restricted to whitelisted users');
        }
        break;
        
      case 'sponsorship-paymaster':
        recommendations.push('Simple gas sponsorship for all users');
        recommendations.push('Ideal for onboarding and user acquisition');
        recommendations.push('Lowest complexity and gas overhead');
        break;
        
      default:
        recommendations.push('Unknown paymaster type - use with caution');
        recommendations.push('Test thoroughly before production use');
    }
    
    return recommendations;
  }

  /**
   * Get enhanced type-specific overhead based on detailed paymaster analysis
   * @param {Object} paymasterAnalysis - Detailed paymaster type analysis
   * @returns {Object} Overhead calculation with breakdown
   */
  _getEnhancedTypeSpecificOverhead(paymasterAnalysis) {
    const { primaryType, characteristics, gasComplexity, subTypes } = paymasterAnalysis;
    
    let baseOverhead = 0;
    const breakdown = {};
    
    // Base overhead by primary type
    switch (primaryType) {
      case 'token-paymaster':
        baseOverhead = 25000; // Token validation, price conversion, transfers
        breakdown.tokenOperations = 15000;
        breakdown.priceCalculation = 5000;
        breakdown.transferLogic = 5000;
        
        if (characteristics.supportsMultipleTokens) {
          baseOverhead += 8000; // Additional token lookup and validation
          breakdown.multiTokenSupport = 8000;
        }
        break;
        
      case 'verifying-paymaster':
        baseOverhead = 12000; // Signature verification
        breakdown.signatureVerification = 8000;
        breakdown.signerValidation = 4000;
        break;
        
      case 'staking-paymaster':
        baseOverhead = 20000; // Staking validation and calculations
        breakdown.stakingValidation = 12000;
        breakdown.rewardCalculation = 5000;
        breakdown.stakingStorage = 3000;
        break;
        
      case 'conditional-paymaster':
        baseOverhead = 15000; // Conditional logic evaluation
        breakdown.conditionEvaluation = 10000;
        breakdown.userValidation = 5000;
        
        if (characteristics.hasWhitelist) {
          baseOverhead += 5000; // Whitelist checking
          breakdown.whitelistCheck = 5000;
        }
        break;
        
      case 'deposit-paymaster':
        baseOverhead = 18000; // Deposit management
        breakdown.depositManagement = 12000;
        breakdown.balanceTracking = 6000;
        break;
        
      case 'sponsorship-paymaster':
      default:
        baseOverhead = 8000; // Simple sponsorship
        breakdown.basicSponsorship = 8000;
        break;
    }
    
    // Additional overhead for sub-types and features
    let featureOverhead = 0;
    
    if (characteristics.hasTimeRestrictions) {
      featureOverhead += 3000;
      breakdown.timeValidation = 3000;
    }
    
    if (characteristics.hasConditionalLogic && primaryType !== 'conditional-paymaster') {
      featureOverhead += 5000;
      breakdown.additionalConditionals = 5000;
    }
    
    if (characteristics.requiresDeposit && primaryType !== 'deposit-paymaster') {
      featureOverhead += 4000;
      breakdown.depositChecks = 4000;
    }
    
    // Gas complexity multiplier
    let complexityMultiplier = 1.0;
    switch (gasComplexity) {
      case 'high':
        complexityMultiplier = 1.3;
        break;
      case 'medium':
        complexityMultiplier = 1.1;
        break;
      case 'low':
        complexityMultiplier = 0.9;
        break;
    }
    
    const totalOverhead = Math.ceil((baseOverhead + featureOverhead) * complexityMultiplier);
    
    return {
      overhead: totalOverhead,
      baseOverhead,
      featureOverhead,
      complexityMultiplier,
      breakdown,
      analysis: {
        primaryType,
        gasComplexity,
        subTypes,
        features: characteristics
      }
    };
  }

  /**
   * Simulate sponsored transaction with reputation tracking
   * @param {Object} options - Simulation options
   * @returns {Promise<Object>} Simulation result with reputation tracking
   */
  async simulateSponsoredTransaction(options) {
    const {
      contract,
      functionName,
      args,
      paymasterAddress,
      sender
    } = options;

    const startTime = Date.now();
    let trackingData = {
      type: 'simulation',
      success: false,
      gasUsed: 0,
      cost: 0,
      duration: 0,
      error: null
    };

    try {
      // Create call data
      const callData = contract.interface.encodeFunctionData(functionName, args);

      // Estimate base gas
      const baseGasEstimate = await contract[functionName].estimateGas(...args);

      // Calculate paymaster overhead
      const paymasterOverhead = await this.calculatePaymasterOverhead(paymasterAddress, {});

      // Create UserOperation
      const feeData = await this.provider.getFeeData();
      const userOp = this.createUserOperation({
        sender,
        callData,
        callGasLimit: Number(baseGasEstimate),
        maxFeePerGas: feeData.maxFeePerGas || feeData.gasPrice,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 1000000000,
        paymasterAndData: this.generatePaymasterData(paymasterAddress)
      });

      // Estimate total gas
      const gasEstimates = await this.estimateUserOperationGas(userOp);
      
      const result = {
        success: true,
        userOperation: userOp,
        gasEstimates,
        totalGas: gasEstimates.totalGas,
        paymasterOverhead: paymasterOverhead.totalOverhead,
        sponsoredGas: gasEstimates.callGasLimit
      };
      
      // Update tracking data
      trackingData.success = true;
      trackingData.gasUsed = gasEstimates.totalGas;
      trackingData.cost = gasEstimates.totalGas * Number(feeData.gasPrice || feeData.maxFeePerGas || 0);
      trackingData.duration = Date.now() - startTime;
      
      // Track interaction if reputation tracking is enabled
      if (this.reputationTracker) {
        await this.reputationTracker.trackInteraction(paymasterAddress, trackingData);
      }
      
      return result;

    } catch (error) {
      trackingData.error = error.message;
      trackingData.duration = Date.now() - startTime;
      
      // Track failed interaction
      if (this.reputationTracker) {
        await this.reputationTracker.trackInteraction(paymasterAddress, trackingData);
      }
      
      return {
        success: false,
        error: error.message,
        fallbackGas: Number(await contract[functionName].estimateGas(...args)) + 50000
      };
    }
  }

  /**
   * Enhanced paymaster status with reputation integration
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Enhanced paymaster status with reputation
   */
  async getPaymasterStatus(paymasterAddress) {
    try {
      const balance = await this.provider.getBalance(paymasterAddress);
      const code = await this.provider.getCode(paymasterAddress);
      const validation = await this.validatePaymasterInterface(paymasterAddress);
      
      const status = {
        address: paymasterAddress,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        hasCode: code !== '0x',
        codeSize: code.length,
        isValidPaymaster: validation.valid,
        canSponsor: validation.valid && balance > ethers.parseEther('0.01') // At least 0.01 ETH
      };
      
      // Add reputation data if tracking is enabled
      if (this.reputationTracker) {
        try {
          const reputationReport = await this.reputationTracker.generateReputationReport(paymasterAddress);
          status.reputation = {
            score: reputationReport.reputation,
            grade: reputationReport.grade,
            reliability: reputationReport.reliability.successRate,
            gasEfficiency: reputationReport.performance.gasEfficiency,
            riskLevel: reputationReport.riskAssessment.level,
            totalInteractions: reputationReport.totalInteractions,
            trackingPeriod: reputationReport.trackingPeriod
          };
        } catch (reputationError) {
          status.reputation = {
            error: 'Reputation data unavailable',
            message: reputationError.message
          };
        }
      }
      
      return status;
    } catch (error) {
      return {
        address: paymasterAddress,
        error: error.message,
        canSponsor: false
      };
    }
  }

  /**
   * Generate paymaster usage report
   * @param {Array} results - Profiling results with paymaster data
   * @returns {Object} Paymaster usage report
   */
  generatePaymasterReport(results) {
    const report = {
      totalRuns: 0,
      paymasterRuns: 0,
      standardRuns: 0,
      gaslessRuns: 0,
      totalGasSaved: 0,
      paymasterAddresses: new Set(),
      averageOverhead: 0
    };

    let totalOverhead = 0;
    let overheadCount = 0;

    results.forEach(result => {
      if (result.runs) {
        result.runs.forEach(run => {
          report.totalRuns++;
          
          switch (run.mode) {
            case 'paymaster_sponsored':
            case 'paymaster_simulation':
              report.paymasterRuns++;
              if (run.paymasterAddress) {
                report.paymasterAddresses.add(run.paymasterAddress);
              }
              break;
            case 'gasless_simulation':
              report.gaslessRuns++;
              break;
            case 'standard':
              report.standardRuns++;
              break;
          }

          // Calculate overhead if available
          if (run.paymasterUsed && run.gasUsed && result.baseGas) {
            const overhead = run.gasUsed - result.baseGas;
            totalOverhead += overhead;
            overheadCount++;
          }
        });
      }
    });

    if (overheadCount > 0) {
      report.averageOverhead = Math.round(totalOverhead / overheadCount);
    }

    report.paymasterAddresses = Array.from(report.paymasterAddresses);

    return report;
  }

  /**
   * Comprehensive paymaster cost analysis and optimization suggestions
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Cost analysis and optimization report
   */
  async analyzePaymasterCosts(paymasterAddress, options = {}) {
    const {
      sampleUserOps = 100,
      timeframe = '24h',
      includePredictions = true,
      compareAlternatives = true,
      detailedBreakdown = true
    } = options;

    try {
      console.log(chalk.blue('💰 Analyzing paymaster costs and generating optimization suggestions...'));
      
      const analysis = {
        paymaster: paymasterAddress,
        timestamp: new Date().toISOString(),
        timeframe,
        costBreakdown: {},
        optimization: {
          recommendations: [],
          potentialSavings: {},
          alternatives: [],
          riskAssessment: {}
        },
        metrics: {
          averageCostPerTx: 0,
          gasEfficiency: 0,
          costStability: 0,
          sponsorshipCapacity: 0
        },
        predictions: {},
        confidence: 0
      };

      // 1. Get paymaster type and characteristics
      const typeAnalysis = await this.detectPaymasterType(paymasterAddress);
      const validation = await this.validatePaymasterInterface(paymasterAddress);
      const status = await this.getPaymasterStatus(paymasterAddress);
      
      analysis.paymasterType = typeAnalysis;
      analysis.status = status;

      // 2. Analyze current costs
      console.log(chalk.gray('   Analyzing current cost structure...'));
      analysis.costBreakdown = await this._analyzeCostStructure(
        paymasterAddress, typeAnalysis, validation, sampleUserOps
      );

      // 3. Calculate metrics
      console.log(chalk.gray('   Calculating efficiency metrics...'));
      analysis.metrics = await this._calculateCostMetrics(
        analysis.costBreakdown, typeAnalysis, status
      );

      // 4. Generate optimization recommendations
      console.log(chalk.gray('   Generating optimization recommendations...'));
      analysis.optimization = await this._generateOptimizationSuggestions(
        typeAnalysis, analysis.costBreakdown, analysis.metrics, status
      );

      // 5. Predict future costs (if enabled)
      if (includePredictions) {
        console.log(chalk.gray('   Predicting future costs...'));
        analysis.predictions = await this._predictFutureCosts(
          analysis.costBreakdown, typeAnalysis, timeframe
        );
      }

      // 6. Compare with alternatives (if enabled)
      if (compareAlternatives) {
        console.log(chalk.gray('   Comparing with alternative approaches...'));
        analysis.optimization.alternatives = await this._compareAlternatives(
          typeAnalysis, analysis.costBreakdown
        );
      }

      // 7. Calculate overall confidence
      analysis.confidence = this._calculateAnalysisConfidence(
        validation, typeAnalysis, analysis.costBreakdown
      );

      return analysis;

    } catch (error) {
      throw new Error(`Cost analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze cost structure of paymaster operations
   */
  async _analyzeCostStructure(paymasterAddress, typeAnalysis, validation, sampleSize) {
    const costBreakdown = {
      baseCosts: {
        validation: 0,
        postOp: 0,
        storage: 0
      },
      typeCosts: {},
      featureCosts: {},
      totalPerOperation: 0,
      costDistribution: {},
      gasPriceImpact: {},
      volumeScaling: {}
    };

    // Use validation gas estimates if available
    if (validation.gasEstimate) {
      costBreakdown.baseCosts.validation = validation.gasEstimate.validateGas || 45000;
      costBreakdown.baseCosts.postOp = validation.gasEstimate.postOpGas || 15000;
    } else {
      // Use defaults based on paymaster type
      costBreakdown.baseCosts.validation = this._getDefaultValidationGas(typeAnalysis.primaryType);
      costBreakdown.baseCosts.postOp = this._getDefaultPostOpGas(typeAnalysis.primaryType);
    }

    // Storage costs based on paymaster characteristics
    costBreakdown.baseCosts.storage = this._estimateStorageCosts(typeAnalysis.characteristics);

    // Type-specific costs
    costBreakdown.typeCosts = this._calculateTypeSpecificCosts(typeAnalysis);

    // Feature-specific costs
    costBreakdown.featureCosts = this._calculateFeatureCosts(typeAnalysis.characteristics);

    // Calculate total per operation
    costBreakdown.totalPerOperation = 
      costBreakdown.baseCosts.validation +
      costBreakdown.baseCosts.postOp +
      costBreakdown.baseCosts.storage +
      Object.values(costBreakdown.typeCosts).reduce((sum, cost) => sum + cost, 0) +
      Object.values(costBreakdown.featureCosts).reduce((sum, cost) => sum + cost, 0);

    // Analyze cost distribution
    costBreakdown.costDistribution = this._analyzeCostDistribution(costBreakdown);

    // Gas price impact analysis
    costBreakdown.gasPriceImpact = await this._analyzeGasPriceImpact(
      costBreakdown.totalPerOperation
    );

    // Volume scaling analysis
    costBreakdown.volumeScaling = this._analyzeVolumeScaling(
      costBreakdown, typeAnalysis, sampleSize
    );

    return costBreakdown;
  }

  /**
   * Calculate cost efficiency metrics
   */
  async _calculateCostMetrics(costBreakdown, typeAnalysis, status) {
    const metrics = {
      averageCostPerTx: 0,
      gasEfficiency: 0,
      costStability: 0,
      sponsorshipCapacity: 0,
      competitiveness: 0,
      scalability: 0
    };

    // Average cost per transaction
    const gasPrice = await this._getCurrentGasPrice();
    metrics.averageCostPerTx = costBreakdown.totalPerOperation * gasPrice;

    // Gas efficiency (lower gas usage = higher efficiency)
    const baselineGas = 50000; // Baseline for comparison
    metrics.gasEfficiency = Math.max(0, 100 - (costBreakdown.totalPerOperation / baselineGas * 100));

    // Cost stability based on paymaster type
    metrics.costStability = this._calculateCostStability(typeAnalysis.primaryType);

    // Sponsorship capacity based on balance
    const balance = parseFloat(status.balance);
    metrics.sponsorshipCapacity = Math.min(100, (balance / 0.1) * 100); // Scale: 0.1 ETH = 100%

    // Competitiveness vs alternatives
    metrics.competitiveness = this._calculateCompetitiveness(
      costBreakdown.totalPerOperation, typeAnalysis.primaryType
    );

    // Scalability score
    metrics.scalability = this._calculateScalability(typeAnalysis, costBreakdown);

    return metrics;
  }

  /**
   * Generate optimization suggestions
   */
  async _generateOptimizationSuggestions(typeAnalysis, costBreakdown, metrics, status) {
    const optimization = {
      recommendations: [],
      potentialSavings: {
        gasOptimization: 0,
        typeOptimization: 0,
        featureOptimization: 0,
        totalPotential: 0
      },
      alternatives: [],
      riskAssessment: {
        implementation: 'low',
        compatibility: 'low',
        maintenance: 'low'
      },
      priorityActions: []
    };

    // Gas optimization recommendations
    if (costBreakdown.totalPerOperation > 60000) {
      optimization.recommendations.push({
        type: 'gas-optimization',
        priority: 'high',
        title: 'Reduce Gas Consumption',
        description: 'Current gas usage is above optimal range (>60k gas)',
        suggestions: [
          'Optimize validation logic to reduce computational complexity',
          'Minimize storage operations in validatePaymasterUserOp',
          'Consider batching operations in postOp',
          'Remove unnecessary external calls'
        ],
        potentialSaving: Math.min(20000, costBreakdown.totalPerOperation * 0.3)
      });
      optimization.potentialSavings.gasOptimization = Math.min(20000, costBreakdown.totalPerOperation * 0.3);
    }

    // Type-specific optimizations
    switch (typeAnalysis.primaryType) {
      case 'token-paymaster':
        if (costBreakdown.typeCosts.tokenOperations > 20000) {
          optimization.recommendations.push({
            type: 'type-optimization',
            priority: 'medium',
            title: 'Optimize Token Operations',
            description: 'Token-related operations are consuming excessive gas',
            suggestions: [
              'Cache token price data to reduce oracle calls',
              'Use more efficient token transfer methods',
              'Implement token allowance pre-approval',
              'Consider using permit() for gasless approvals'
            ],
            potentialSaving: Math.min(8000, costBreakdown.typeCosts.tokenOperations * 0.4)
          });
          optimization.potentialSavings.typeOptimization += 8000;
        }
        break;

      case 'verifying-paymaster':
        optimization.recommendations.push({
          type: 'type-optimization',
          priority: 'low',
          title: 'Signature Verification Efficiency',
          description: 'Consider signature verification optimizations',
          suggestions: [
            'Use ecrecover directly instead of ECDSA library',
            'Implement signature caching for repeated verifications',
            'Consider using EIP-1271 for contract signatures'
          ],
          potentialSaving: 3000
        });
        optimization.potentialSavings.typeOptimization += 3000;
        break;

      case 'staking-paymaster':
        if (costBreakdown.typeCosts.stakingValidation > 15000) {
          optimization.recommendations.push({
            type: 'type-optimization',
            priority: 'medium',
            title: 'Optimize Staking Validation',
            description: 'Staking validation is consuming high gas',
            suggestions: [
              'Pre-compute staking eligibility off-chain',
              'Use merkle proofs for large staker sets',
              'Implement staking snapshots to reduce storage reads'
            ],
            potentialSaving: 6000
          });
          optimization.potentialSavings.typeOptimization += 6000;
        }
        break;
    }

    // Feature optimizations
    if (typeAnalysis.characteristics.hasTimeRestrictions && costBreakdown.featureCosts.timeValidation > 4000) {
      optimization.recommendations.push({
        type: 'feature-optimization',
        priority: 'low',
        title: 'Optimize Time Restrictions',
        description: 'Time validation logic can be optimized',
        suggestions: [
          'Use block.timestamp directly instead of complex time logic',
          'Pre-validate time restrictions off-chain'
        ],
        potentialSaving: 2000
      });
      optimization.potentialSavings.featureOptimization += 2000;
    }

    // Balance optimization
    const balance = parseFloat(status.balance);
    if (balance < 0.05) {
      optimization.recommendations.push({
        type: 'operational',
        priority: 'critical',
        title: 'Insufficient Balance',
        description: 'Paymaster balance is critically low',
        suggestions: [
          'Deposit additional funds to ensure continued operation',
          'Implement balance monitoring and alerts',
          'Consider automatic balance top-up mechanisms'
        ],
        potentialSaving: 0
      });
    }

    // Calculate total potential savings
    optimization.potentialSavings.totalPotential = 
      optimization.potentialSavings.gasOptimization +
      optimization.potentialSavings.typeOptimization +
      optimization.potentialSavings.featureCosts;

    // Risk assessment
    optimization.riskAssessment = this._assessOptimizationRisks(typeAnalysis, optimization.recommendations);

    // Priority actions
    optimization.priorityActions = optimization.recommendations
      .filter(rec => rec.priority === 'critical' || rec.priority === 'high')
      .map(rec => `${rec.title}: ${rec.description}`);

    return optimization;
  }

  /**
   * Predict future costs based on current trends
   */
  async _predictFutureCosts(costBreakdown, typeAnalysis, timeframe) {
    const predictions = {
      timeframe,
      scenarios: {
        conservative: {},
        moderate: {},
        aggressive: {}
      },
      factors: {
        gasPrice: { current: 0, trend: 'stable' },
        networkUsage: { impact: 'medium' },
        paymasterOptimization: { potential: 0 }
      }
    };

    // Get current gas price
    const currentGasPrice = await this._getCurrentGasPrice();
    predictions.factors.gasPrice.current = currentGasPrice;

    // Predict gas price trends (simplified)
    const gasPriceTrend = this._predictGasPriceTrend(timeframe);
    predictions.factors.gasPrice.trend = gasPriceTrend.direction;

    // Generate scenarios
    const baseCost = costBreakdown.totalPerOperation * currentGasPrice;
    
    predictions.scenarios.conservative = {
      gasPriceChange: gasPriceTrend.conservative,
      totalCostChange: gasPriceTrend.conservative,
      estimatedCost: baseCost * (1 + gasPriceTrend.conservative)
    };
    
    predictions.scenarios.moderate = {
      gasPriceChange: gasPriceTrend.moderate,
      totalCostChange: gasPriceTrend.moderate,
      estimatedCost: baseCost * (1 + gasPriceTrend.moderate)
    };
    
    predictions.scenarios.aggressive = {
      gasPriceChange: gasPriceTrend.aggressive,
      totalCostChange: gasPriceTrend.aggressive,
      estimatedCost: baseCost * (1 + gasPriceTrend.aggressive)
    };

    return predictions;
  }

  /**
   * Compare with alternative paymaster approaches
   */
  async _compareAlternatives(typeAnalysis, costBreakdown) {
    const alternatives = [];

    // Simple sponsorship alternative
    if (typeAnalysis.primaryType !== 'sponsorship-paymaster') {
      alternatives.push({
        type: 'sponsorship-paymaster',
        description: 'Simple gas sponsorship',
        estimatedGas: 35000,
        costComparison: {
          gasSaving: costBreakdown.totalPerOperation - 35000,
          complexityReduction: 'high',
          featureLoss: typeAnalysis.supportedFeatures
        },
        pros: ['Lower gas costs', 'Simpler implementation', 'Higher reliability'],
        cons: ['No advanced features', 'No user restrictions', 'Higher sponsorship burden']
      });
    }

    // Token paymaster alternative
    if (typeAnalysis.primaryType !== 'token-paymaster') {
      alternatives.push({
        type: 'token-paymaster',
        description: 'User pays with tokens',
        estimatedGas: 55000,
        costComparison: {
          gasSaving: costBreakdown.totalPerOperation - 55000,
          complexityReduction: 'medium',
          featureGain: ['Token-based payments', 'Reduced sponsorship burden']
        },
        pros: ['Users pay their own costs', 'Sustainable model', 'Token utility'],
        cons: ['Higher gas usage', 'Token price volatility', 'User experience complexity']
      });
    }

    // Verifying paymaster alternative
    if (typeAnalysis.primaryType !== 'verifying-paymaster') {
      alternatives.push({
        type: 'verifying-paymaster',
        description: 'Signature-based sponsorship',
        estimatedGas: 42000,
        costComparison: {
          gasSaving: costBreakdown.totalPerOperation - 42000,
          complexityReduction: 'low',
          featureGain: ['Controlled access', 'Flexible sponsorship']
        },
        pros: ['Controlled sponsorship', 'Moderate gas costs', 'Flexible policies'],
        cons: ['Centralized control', 'Off-chain infrastructure needed']
      });
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  // Helper methods for cost analysis
  
  _getDefaultValidationGas(paymasterType) {
    const defaults = {
      'token-paymaster': 50000,
      'verifying-paymaster': 35000,
      'staking-paymaster': 55000,
      'conditional-paymaster': 45000,
      'deposit-paymaster': 40000,
      'sponsorship-paymaster': 30000
    };
    return defaults[paymasterType] || 45000;
  }
  
  _getDefaultPostOpGas(paymasterType) {
    const defaults = {
      'token-paymaster': 25000,
      'verifying-paymaster': 10000,
      'staking-paymaster': 20000,
      'conditional-paymaster': 15000,
      'deposit-paymaster': 18000,
      'sponsorship-paymaster': 8000
    };
    return defaults[paymasterType] || 15000;
  }
  
  _estimateStorageCosts(characteristics) {
    let storageCost = 5000; // Base storage cost
    
    if (characteristics.requiresDeposit) storageCost += 3000;
    if (characteristics.hasWhitelist) storageCost += 2000;
    if (characteristics.isStaking) storageCost += 4000;
    if (characteristics.isTokenBased) storageCost += 2000;
    
    return storageCost;
  }
  
  _calculateTypeSpecificCosts(typeAnalysis) {
    const costs = {};
    
    switch (typeAnalysis.primaryType) {
      case 'token-paymaster':
        costs.tokenOperations = 15000;
        costs.priceConversion = 5000;
        if (typeAnalysis.characteristics.supportsMultipleTokens) {
          costs.multiTokenLogic = 8000;
        }
        break;
        
      case 'verifying-paymaster':
        costs.signatureVerification = 8000;
        costs.signerValidation = 3000;
        break;
        
      case 'staking-paymaster':
        costs.stakingValidation = 12000;
        costs.rewardCalculation = 5000;
        break;
        
      case 'conditional-paymaster':
        costs.conditionLogic = 10000;
        break;
    }
    
    return costs;
  }
  
  _calculateFeatureCosts(characteristics) {
    const costs = {};
    
    if (characteristics.hasTimeRestrictions) costs.timeValidation = 3000;
    if (characteristics.hasWhitelist) costs.whitelistCheck = 4000;
    if (characteristics.hasConditionalLogic) costs.conditionalChecks = 6000;
    
    return costs;
  }
  
  _analyzeCostDistribution(costBreakdown) {
    const total = costBreakdown.totalPerOperation;
    
    return {
      validation: Math.round((costBreakdown.baseCosts.validation / total) * 100),
      postOp: Math.round((costBreakdown.baseCosts.postOp / total) * 100),
      storage: Math.round((costBreakdown.baseCosts.storage / total) * 100),
      typeSpecific: Math.round((Object.values(costBreakdown.typeCosts).reduce((sum, cost) => sum + cost, 0) / total) * 100),
      features: Math.round((Object.values(costBreakdown.featureCosts).reduce((sum, cost) => sum + cost, 0) / total) * 100)
    };
  }
  
  async _analyzeGasPriceImpact(totalGas) {
    const currentGasPrice = await this._getCurrentGasPrice();
    
    return {
      current: {
        gasPrice: currentGasPrice,
        costInWei: totalGas * currentGasPrice,
        costInEth: ethers.formatEther(BigInt(totalGas) * BigInt(currentGasPrice))
      },
      scenarios: {
        low: {
          gasPrice: currentGasPrice * 0.5,
          costInEth: ethers.formatEther(BigInt(totalGas) * BigInt(Math.round(currentGasPrice * 0.5)))
        },
        high: {
          gasPrice: currentGasPrice * 2,
          costInEth: ethers.formatEther(BigInt(totalGas) * BigInt(Math.round(currentGasPrice * 2)))
        }
      }
    };
  }
  
  _analyzeVolumeScaling(costBreakdown, typeAnalysis, sampleSize) {
    const baseGas = costBreakdown.totalPerOperation;
    
    return {
      current: { volume: sampleSize, gasPerTx: baseGas },
      projections: {
        '1k': { volume: 1000, gasPerTx: baseGas, totalGas: baseGas * 1000 },
        '10k': { volume: 10000, gasPerTx: baseGas, totalGas: baseGas * 10000 },
        '100k': { volume: 100000, gasPerTx: baseGas, totalGas: baseGas * 100000 }
      },
      scalabilityNotes: this._getScalabilityNotes(typeAnalysis.primaryType)
    };
  }
  
  _getScalabilityNotes(paymasterType) {
    const notes = {
      'token-paymaster': 'Consider token price caching at high volumes',
      'verifying-paymaster': 'Signature verification scales linearly',
      'staking-paymaster': 'May need staking snapshot optimizations',
      'conditional-paymaster': 'Condition evaluation may become bottleneck',
      'sponsorship-paymaster': 'Most scalable option'
    };
    return notes[paymasterType] || 'Standard scaling characteristics';
  }
  
  async _getCurrentGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      return Number(feeData.gasPrice || feeData.maxFeePerGas || 1000000000); // 1 gwei fallback
    } catch {
      return 1000000000; // 1 gwei fallback
    }
  }
  
  _calculateCostStability(paymasterType) {
    const stability = {
      'sponsorship-paymaster': 95,
      'verifying-paymaster': 90,
      'deposit-paymaster': 85,
      'conditional-paymaster': 80,
      'staking-paymaster': 75,
      'token-paymaster': 60 // Variable due to token prices
    };
    return stability[paymasterType] || 70;
  }
  
  _calculateCompetitiveness(gasUsage, paymasterType) {
    const benchmarks = {
      'sponsorship-paymaster': 35000,
      'verifying-paymaster': 42000,
      'token-paymaster': 55000,
      'conditional-paymaster': 48000,
      'staking-paymaster': 60000
    };
    
    const benchmark = benchmarks[paymasterType] || 50000;
    return Math.max(0, 100 - ((gasUsage - benchmark) / benchmark * 100));
  }
  
  _calculateScalability(typeAnalysis, costBreakdown) {
    let score = 70; // Base score
    
    // Lower score for complex operations
    if (costBreakdown.totalPerOperation > 70000) score -= 20;
    else if (costBreakdown.totalPerOperation > 50000) score -= 10;
    
    // Type-specific adjustments
    switch (typeAnalysis.primaryType) {
      case 'sponsorship-paymaster': score += 20; break;
      case 'verifying-paymaster': score += 10; break;
      case 'token-paymaster': score -= 10; break;
      case 'staking-paymaster': score -= 15; break;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  _calculateAnalysisConfidence(validation, typeAnalysis, costBreakdown) {
    let confidence = 30; // Base
    
    if (validation.valid) confidence += 30;
    if (validation.gasEstimate?.validateGas) confidence += 20;
    if (typeAnalysis.confidence > 70) confidence += 15;
    if (costBreakdown.totalPerOperation > 0) confidence += 5;
    
    return Math.min(confidence, 100);
  }
  
  _predictGasPriceTrend(timeframe) {
    // Simplified gas price prediction
    const trends = {
      '1h': { conservative: 0.05, moderate: 0.1, aggressive: 0.2 },
      '24h': { conservative: 0.1, moderate: 0.2, aggressive: 0.4 },
      '7d': { conservative: 0.2, moderate: 0.4, aggressive: 0.8 },
      '30d': { conservative: 0.4, moderate: 0.8, aggressive: 1.5 }
    };
    
    return trends[timeframe] || trends['24h'];
  }
  
  _assessOptimizationRisks(typeAnalysis, recommendations) {
    let implementationRisk = 'low';
    let compatibilityRisk = 'low';
    let maintenanceRisk = 'low';
    
    // Assess risks based on paymaster complexity
    if (typeAnalysis.gasComplexity === 'high') {
      implementationRisk = 'medium';
      maintenanceRisk = 'medium';
    }
    
    // Assess risks based on number of recommendations
    if (recommendations.length > 3) {
      implementationRisk = 'medium';
    }
    
    // Type-specific risks
    if (typeAnalysis.primaryType === 'token-paymaster') {
      compatibilityRisk = 'medium'; // Token integration complexity
    }
    
    return {
      implementation: implementationRisk,
      compatibility: compatibilityRisk,
      maintenance: maintenanceRisk
    };
  }
}

module.exports = {
  PaymasterUtils,
  createPaymasterUtils: (provider) => new PaymasterUtils(provider)
};