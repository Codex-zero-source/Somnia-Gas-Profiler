const { ethers } = require('ethers');
const chalk = require('chalk');

/**
 * Paymaster Utility for Somnia Gas Profiler
 * Provides EIP-4337 Account Abstraction support
 */
class PaymasterUtils {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create a UserOperation for EIP-4337 compatibility
   * @param {Object} options - UserOperation options
   * @returns {Object} UserOperation object
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

    return {
      sender,
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
   * Validate paymaster contract interface
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Validation result
   */
  async validatePaymasterInterface(paymasterAddress) {
    try {
      // Check if contract implements IPaymaster interface
      const paymasterContract = new ethers.Contract(
        paymasterAddress,
        [
          'function validatePaymasterUserOp(tuple(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes context, uint256 validationData)',
          'function postOp(uint8 mode, bytes context, uint256 actualGasCost) external'
        ],
        this.provider
      );

      // Try to call the interface detection (this might fail for some paymasters)
      const code = await this.provider.getCode(paymasterAddress);
      const hasValidateMethod = code.includes('validatePaymasterUserOp'.slice(2));
      const hasPostOpMethod = code.includes('postOp'.slice(2));

      return {
        valid: hasValidateMethod && hasPostOpMethod,
        hasValidateMethod,
        hasPostOpMethod,
        codeSize: code.length
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate paymaster gas overhead
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {Object} userOp - UserOperation object
   * @returns {Promise<number>} Gas overhead estimate
   */
  async calculatePaymasterOverhead(paymasterAddress, userOp) {
    try {
      // Base overhead for paymaster operations
      let overhead = 0;

      // Validation gas (validatePaymasterUserOp)
      overhead += 45000;

      // Post-operation gas (postOp)
      overhead += 15000;

      // Storage access overhead
      overhead += 5000;

      // Additional overhead based on paymaster complexity
      const validation = await this.validatePaymasterInterface(paymasterAddress);
      if (validation.valid && validation.codeSize > 10000) {
        overhead += 10000; // Additional overhead for complex paymasters
      }

      return overhead;
    } catch (error) {
      // Default overhead if calculation fails
      return 50000;
    }
  }

  /**
   * Simulate sponsored transaction
   * @param {Object} options - Simulation options
   * @returns {Promise<Object>} Simulation result
   */
  async simulateSponsoredTransaction(options) {
    const {
      contract,
      functionName,
      args,
      paymasterAddress,
      sender
    } = options;

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

      return {
        success: true,
        userOperation: userOp,
        gasEstimates,
        totalGas: gasEstimates.totalGas,
        paymasterOverhead,
        sponsoredGas: gasEstimates.callGasLimit
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallbackGas: Number(await contract[functionName].estimateGas(...args)) + 50000
      };
    }
  }

  /**
   * Get paymaster balance and status
   * @param {string} paymasterAddress - Paymaster contract address
   * @returns {Promise<Object>} Paymaster status
   */
  async getPaymasterStatus(paymasterAddress) {
    try {
      const balance = await this.provider.getBalance(paymasterAddress);
      const code = await this.provider.getCode(paymasterAddress);
      const validation = await this.validatePaymasterInterface(paymasterAddress);

      return {
        address: paymasterAddress,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        hasCode: code !== '0x',
        codeSize: code.length,
        isValidPaymaster: validation.valid,
        canSponsor: validation.valid && balance > ethers.parseEther('0.01') // At least 0.01 ETH
      };
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
}

module.exports = {
  PaymasterUtils,
  createPaymasterUtils: (provider) => new PaymasterUtils(provider)
};