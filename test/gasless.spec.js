const { expect } = require('chai');
const sinon = require('sinon');
const { ethers } = require('ethers');

// Import modules to test
const { PaymasterUtils } = require('../utils/paymaster');
const { GaslessSimulator } = require('../profiler/gasless-simulator');
const { PaymasterReputationTracker } = require('../lib/paymaster-reputation');

describe('Enhanced Gasless Functionality', function() {
  let sandbox;
  let mockProvider;
  let mockWallet;
  let mockContract;

  beforeEach(function() {
    sandbox = sinon.createSandbox();

    // Mock provider
    mockProvider = {
      getCode: sandbox.stub(),
      getBalance: sandbox.stub(),
      getFeeData: sandbox.stub(),
      getNetwork: sandbox.stub(),
      send: sandbox.stub(),
      getBlockNumber: sandbox.stub()
    };

    // Mock wallet
    mockWallet = {
      address: '0x1234567890123456789012345678901234567890'
    };

    // Mock contract
    mockContract = {
      target: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      interface: {
        encodeFunctionData: sandbox.stub(),
        getFunction: sandbox.stub()
      },
      testFunction: {
        estimateGas: sandbox.stub(),
        staticCall: sandbox.stub()
      }
    };

    // Default mock returns
    mockProvider.getCode.resolves('0x608060405234801561001057600080fd5b50600436106100415760003560e01c8063');
    mockProvider.getBalance.resolves(ethers.parseEther('1.0'));
    mockProvider.getFeeData.resolves({
      gasPrice: ethers.parseUnits('20', 'gwei'),
      maxFeePerGas: ethers.parseUnits('25', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
    });
    mockProvider.getNetwork.resolves({ name: 'somnia-testnet', chainId: 2648 });
    mockProvider.getBlockNumber.resolves(12345);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('PaymasterUtils', function() {
    let paymasterUtils;

    beforeEach(function() {
      paymasterUtils = new PaymasterUtils(mockProvider, { enableReputationTracking: false });
    });

    describe('validatePaymasterInterface', function() {
      it('should validate a compliant paymaster interface', async function() {
        const paymasterAddress = '0x9876543210987654321098765432109876543210';
        
        // Mock paymaster contract with required methods
        const mockPaymasterCode = '0x608060405234801561001057600080fd5b50validatePaymasterUserOppostOp';
        mockProvider.getCode.withArgs(paymasterAddress).resolves(mockPaymasterCode);
        
        const result = await paymasterUtils.validatePaymasterInterface(paymasterAddress);
        
        expect(result).to.be.an('object');
        expect(result.address).to.equal(paymasterAddress);
        expect(result.hasValidateMethod).to.be.true;
        expect(result.hasPostOpMethod).to.be.true;
        expect(result.codeSize).to.be.above(0);
      });

      it('should reject invalid paymaster (no contract)', async function() {
        const paymasterAddress = '0x0000000000000000000000000000000000000000';
        mockProvider.getCode.withArgs(paymasterAddress).resolves('0x');
        
        const result = await paymasterUtils.validatePaymasterInterface(paymasterAddress);
        
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('No contract found at address');
      });

      it('should handle provider errors gracefully', async function() {
        const paymasterAddress = '0x1111111111111111111111111111111111111111';
        mockProvider.getCode.withArgs(paymasterAddress).rejects(new Error('Network error'));
        
        const result = await paymasterUtils.validatePaymasterInterface(paymasterAddress);
        
        expect(result.valid).to.be.false;
        expect(result.error).to.include('Network error');
      });
    });

    describe('createUserOperation', function() {
      it('should create valid UserOperation with required fields', function() {
        const options = {
          sender: mockWallet.address,
          callData: '0x1234',
          callGasLimit: 50000,
          maxFeePerGas: ethers.parseUnits('20', 'gwei'),
          maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
        };

        const userOp = paymasterUtils.createUserOperation(options);

        expect(userOp).to.have.property('sender', options.sender);
        expect(userOp).to.have.property('callData', options.callData);
        expect(userOp).to.have.property('callGasLimit');
        expect(userOp).to.have.property('_metadata');
        expect(userOp._metadata.hasPaymaster).to.be.false;
      });

      it('should validate required fields', function() {
        const invalidOptions = {
          // Missing sender
          callData: '0x1234',
          callGasLimit: 50000
        };

        expect(() => paymasterUtils.createUserOperation(invalidOptions))
          .to.throw('Valid sender address is required');
      });

      it('should create UserOperation with paymaster data', function() {
        const options = {
          sender: mockWallet.address,
          callData: '0x1234',
          callGasLimit: 50000,
          maxFeePerGas: ethers.parseUnits('20', 'gwei'),
          maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
          paymasterAndData: '0x9876543210987654321098765432109876543210'
        };

        const userOp = paymasterUtils.createUserOperation(options);

        expect(userOp.paymasterAndData).to.equal(options.paymasterAndData);
        expect(userOp._metadata.hasPaymaster).to.be.true;
      });
    });

    describe('bundleUserOperations', function() {
      it('should bundle multiple valid UserOperations', function() {
        const userOps = [
          paymasterUtils.createUserOperation({
            sender: mockWallet.address,
            callData: '0x1234',
            callGasLimit: 50000,
            maxFeePerGas: ethers.parseUnits('20', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
          }),
          paymasterUtils.createUserOperation({
            sender: mockWallet.address,
            callData: '0x5678',
            callGasLimit: 60000,
            maxFeePerGas: ethers.parseUnits('25', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
          })
        ];

        const bundle = paymasterUtils.bundleUserOperations(userOps);

        expect(bundle).to.have.property('userOperations');
        expect(bundle.userOperations).to.have.length(2);
        expect(bundle).to.have.property('bundleId');
        expect(bundle).to.have.property('totalGasLimit');
        expect(bundle).to.have.property('operationCount', 2);
      });

      it('should handle empty UserOperation array', function() {
        expect(() => paymasterUtils.bundleUserOperations([]))
          .to.throw('UserOps array is required and must not be empty');
      });

      it('should filter invalid UserOperations', function() {
        const userOps = [
          paymasterUtils.createUserOperation({
            sender: mockWallet.address,
            callData: '0x1234',
            callGasLimit: 50000,
            maxFeePerGas: ethers.parseUnits('20', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
          }),
          {
            // Invalid UserOperation - missing required fields
            sender: 'invalid',
            callData: '0x5678'
          }
        ];

        const bundle = paymasterUtils.bundleUserOperations(userOps);

        expect(bundle.userOperations).to.have.length(1); // Only valid UserOp
        expect(bundle.operationCount).to.equal(1);
      });
    });

    describe('detectPaymasterType', function() {
      it('should detect token paymaster type', async function() {
        const paymasterAddress = '0x1111111111111111111111111111111111111111';
        const mockCode = '0x608060405234801561001057600080fd5b50token657263323074';
        mockProvider.getCode.withArgs(paymasterAddress).resolves(mockCode);

        const analysis = await paymasterUtils.detectPaymasterType(paymasterAddress);

        expect(analysis.primaryType).to.equal('token-paymaster');
        expect(analysis.characteristics.isTokenBased).to.be.true;
        expect(analysis.supportedFeatures).to.include('Token-based payments');
      });

      it('should detect verifying paymaster type', async function() {
        const paymasterAddress = '0x2222222222222222222222222222222222222222';
        const mockCode = '0x608060405234801561001057600080fd5b50verifyingsigner';
        mockProvider.getCode.withArgs(paymasterAddress).resolves(mockCode);

        const analysis = await paymasterUtils.detectPaymasterType(paymasterAddress);

        expect(analysis.primaryType).to.equal('verifying-paymaster');
        expect(analysis.characteristics.isVerifying).to.be.true;
        expect(analysis.supportedFeatures).to.include('Signature verification');
      });

      it('should handle detection errors gracefully', async function() {
        const paymasterAddress = '0x3333333333333333333333333333333333333333';
        mockProvider.getCode.withArgs(paymasterAddress).rejects(new Error('Network error'));

        const analysis = await paymasterUtils.detectPaymasterType(paymasterAddress);

        expect(analysis.primaryType).to.equal('unknown');
        expect(analysis.confidence).to.equal(0);
        expect(analysis.error).to.include('Network error');
      });
    });

    describe('calculatePaymasterOverhead', function() {
      it('should calculate overhead for token paymaster', async function() {
        const paymasterAddress = '0x4444444444444444444444444444444444444444';
        const userOp = { callGasLimit: 50000 };

        // Mock validation result
        sandbox.stub(paymasterUtils, 'validatePaymasterInterface').resolves({
          valid: true,
          hasValidateMethod: true,
          hasPostOpMethod: true,
          gasEstimate: { validateGas: 45000, postOpGas: 15000 }
        });

        // Mock type detection
        sandbox.stub(paymasterUtils, 'detectPaymasterType').resolves({
          primaryType: 'token-paymaster',
          gasComplexity: 'medium',
          characteristics: { isTokenBased: true }
        });

        const overhead = await paymasterUtils.calculatePaymasterOverhead(paymasterAddress, userOp);

        expect(overhead).to.have.property('totalOverhead');
        expect(overhead.totalOverhead).to.be.above(0);
        expect(overhead).to.have.property('breakdown');
        expect(overhead.confidence).to.be.above(50);
      });

      it('should provide fallback overhead on error', async function() {
        const paymasterAddress = '0x5555555555555555555555555555555555555555';
        const userOp = { callGasLimit: 50000 };

        // Mock validation failure
        sandbox.stub(paymasterUtils, 'validatePaymasterInterface').rejects(new Error('Validation failed'));

        const overhead = await paymasterUtils.calculatePaymasterOverhead(paymasterAddress, userOp);

        expect(overhead.fallback).to.be.true;
        expect(overhead.totalOverhead).to.equal(96000); // Conservative fallback
        expect(overhead.confidence).to.equal(25);
      });
    });
  });

  describe('GaslessSimulator', function() {
    let gaslessSimulator;

    beforeEach(function() {
      gaslessSimulator = new GaslessSimulator(mockProvider);
    });

    describe('simulate', function() {
      it('should simulate gas usage in estimate mode', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'estimate'
        };

        mockContract.testFunction.estimateGas.resolves(ethers.toBigInt(50000));

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.true;
        expect(result.gasUsed).to.equal(50000);
        expect(result.mode).to.equal('estimate');
        expect(result.confidence).to.be.above(80);
      });

      it('should use fallback strategies on primary failure', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'estimate',
          fallbackOnError: true
        };

        // Primary estimation fails
        mockContract.testFunction.estimateGas.rejects(new Error('Estimation failed'));
        
        // But static call succeeds
        mockContract.testFunction.staticCall.resolves('0x');
        mockContract.testFunction.estimateGas.onSecondCall().resolves(ethers.toBigInt(45000));

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.true;
        expect(result.fallback).to.be.true;
        expect(result.attempts).to.be.an('array');
      });

      it('should handle complete simulation failure', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'estimate',
          fallbackOnError: true
        };

        // All estimation methods fail
        mockContract.testFunction.estimateGas.rejects(new Error('All failed'));
        mockContract.testFunction.staticCall.rejects(new Error('All failed'));

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.false;
        expect(result.fallback).to.be.true;
        expect(result.gasUsed).to.be.above(0); // Should provide default estimate
      });

      it('should cache results when enabled', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'estimate',
          useCache: true
        };

        mockContract.testFunction.estimateGas.resolves(ethers.toBigInt(50000));

        // First call
        const result1 = await gaslessSimulator.simulate(options);
        expect(result1.fromCache).to.be.undefined;

        // Second call should use cache
        const result2 = await gaslessSimulator.simulate(options);
        expect(result2.fromCache).to.be.true;

        // estimateGas should only be called once due to caching
        expect(mockContract.testFunction.estimateGas.callCount).to.equal(1);
      });
    });

    describe('trace mode', function() {
      it('should use debug_traceCall when available', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'trace',
          sender: mockWallet.address
        };

        mockContract.interface.encodeFunctionData.returns('0x1234');
        mockProvider.send.withArgs('debug_traceCall').resolves({
          gasUsed: '0xc350', // 50000 in hex
          type: 'CALL',
          output: '0x'
        });

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.true;
        expect(result.gasUsed).to.equal(50000);
        expect(result.details.method).to.equal('debug_traceCall');
        expect(mockProvider.send.calledWith('debug_traceCall')).to.be.true;
      });

      it('should fallback to estimate when trace fails', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'trace'
        };

        mockProvider.send.withArgs('debug_traceCall').rejects(new Error('Trace not supported'));
        mockContract.testFunction.estimateGas.resolves(ethers.toBigInt(45000));

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.true;
        expect(result.gasUsed).to.equal(45000);
        // Should still succeed with fallback
      });
    });

    describe('paymaster mode', function() {
      it('should simulate with paymaster integration', async function() {
        const paymasterAddress = '0x9999999999999999999999999999999999999999';
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'paymaster',
          paymasterAddress,
          sender: mockWallet.address
        };

        // Mock paymaster validation
        gaslessSimulator.paymasterUtils.validatePaymasterInterface = sandbox.stub().resolves({
          valid: true,
          errors: []
        });

        // Mock UserOperation creation
        gaslessSimulator.paymasterUtils.createUserOperationFromCall = sandbox.stub().resolves({
          sender: mockWallet.address,
          callData: '0x1234'
        });

        // Mock sponsored transaction simulation
        gaslessSimulator.paymasterUtils.simulateSponsoredTransaction = sandbox.stub().resolves({
          success: true,
          totalGas: 75000,
          paymasterOverhead: 25000,
          sponsoredGas: 50000
        });

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.true;
        expect(result.gasUsed).to.equal(75000);
        expect(result.paymasterOverhead).to.equal(25000);
        expect(result.details.method).to.equal('paymaster_simulation');
      });

      it('should fail when paymaster is required but invalid', async function() {
        const options = {
          contract: mockContract,
          functionName: 'testFunction',
          args: [42],
          mode: 'paymaster'
          // Missing paymasterAddress
        };

        const result = await gaslessSimulator.simulate(options);

        expect(result.success).to.be.false;
        expect(result.error).to.include('Paymaster address required');
      });
    });
  });

  describe('PaymasterReputationTracker', function() {
    let reputationTracker;
    const testDataPath = './test-reputation-data';

    beforeEach(function() {
      reputationTracker = new PaymasterReputationTracker({
        provider: mockProvider,
        dataPath: testDataPath,
        trackingEnabled: true
      });
    });

    afterEach(async function() {
      // Clean up test data
      try {
        await reputationTracker.clearAllData();
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('trackInteraction', function() {
      it('should track successful interaction', async function() {
        const paymasterAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const interaction = {
          type: 'simulation',
          success: true,
          gasUsed: 50000,
          cost: 1000000000000000, // 0.001 ETH in wei
          duration: 150
        };

        await reputationTracker.trackInteraction(paymasterAddress, interaction);

        const reputation = await reputationTracker.getReputation(paymasterAddress);
        expect(reputation.interactions).to.have.length(1);
        expect(reputation.interactions[0].success).to.be.true;
        expect(reputation.interactions[0].gasUsed).to.equal(50000);
      });

      it('should track failed interaction', async function() {
        const paymasterAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        const interaction = {
          type: 'simulation',
          success: false,
          gasUsed: 0,
          cost: 0,
          duration: 500,
          error: 'Validation failed'
        };

        await reputationTracker.trackInteraction(paymasterAddress, interaction);

        const reputation = await reputationTracker.getReputation(paymasterAddress);
        expect(reputation.interactions).to.have.length(1);
        expect(reputation.interactions[0].success).to.be.false;
        expect(reputation.interactions[0].error).to.equal('Validation failed');
      });

      it('should update reputation metrics after interactions', async function() {
        const paymasterAddress = '0xcccccccccccccccccccccccccccccccccccccccc';
        
        // Track multiple successful interactions
        for (let i = 0; i < 5; i++) {
          await reputationTracker.trackInteraction(paymasterAddress, {
            type: 'simulation',
            success: true,
            gasUsed: 45000 + i * 1000,
            cost: 1000000000000000,
            duration: 100 + i * 10
          });
        }

        // Track one failed interaction
        await reputationTracker.trackInteraction(paymasterAddress, {
          type: 'simulation',
          success: false,
          gasUsed: 0,
          cost: 0,
          duration: 1000,
          error: 'Failed'
        });

        const reputation = await reputationTracker.getReputation(paymasterAddress);
        expect(reputation.metrics.reliability).to.be.approximately(83.33, 1); // 5/6 success rate
        expect(reputation.score).to.be.above(40); // Should have reasonable score
      });
    });

    describe('generateReputationReport', function() {
      it('should generate comprehensive report', async function() {
        const paymasterAddress = '0xdddddddddddddddddddddddddddddddddddddddd';
        
        // Add some interaction history
        for (let i = 0; i < 10; i++) {
          await reputationTracker.trackInteraction(paymasterAddress, {
            type: 'simulation',
            success: i < 8, // 80% success rate
            gasUsed: 50000,
            cost: 1000000000000000,
            duration: 200
          });
        }

        const report = await reputationTracker.generateReputationReport(paymasterAddress);

        expect(report).to.have.property('address', paymasterAddress);
        expect(report).to.have.property('reputation');
        expect(report).to.have.property('grade');
        expect(report).to.have.property('reliability');
        expect(report).to.have.property('performance');
        expect(report).to.have.property('compliance');
        expect(report).to.have.property('recommendations');
        expect(report.totalInteractions).to.equal(10);
        expect(report.reliability.successRate).to.equal(80);
      });
    });

    describe('comparePaymasters', function() {
      it('should compare multiple paymasters', async function() {
        const addresses = [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          '0x3333333333333333333333333333333333333333'
        ];

        // Create different reputation levels
        for (let i = 0; i < addresses.length; i++) {
          const successRate = (i + 1) * 0.3; // 30%, 60%, 90%
          const totalInteractions = 10;
          
          for (let j = 0; j < totalInteractions; j++) {
            await reputationTracker.trackInteraction(addresses[i], {
              type: 'simulation',
              success: j < (totalInteractions * successRate),
              gasUsed: 50000 - i * 5000, // Different efficiency levels
              cost: 1000000000000000,
              duration: 200
            });
          }
        }

        const comparison = await reputationTracker.comparePaymasters(addresses);

        expect(comparison).to.have.property('rankings');
        expect(comparison.rankings).to.have.length(3);
        expect(comparison.rankings[0].rank).to.equal(1);
        expect(comparison.rankings).to.be.sortedBy('rank');
        expect(comparison).to.have.property('analysis');
        expect(comparison.analysis).to.have.property('topPerformer');
        expect(comparison.analysis).to.have.property('averageReputation');
      });
    });
  });

  describe('Integration Tests', function() {
    it('should integrate gasless simulation with reputation tracking', async function() {
      const paymasterAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      
      // Create PaymasterUtils with reputation tracking
      const paymasterUtils = new PaymasterUtils(mockProvider, {
        enableReputationTracking: true,
        reputationOptions: { dataPath: './test-integration-reputation' }
      });

      // Mock successful simulation
      mockContract.testFunction.estimateGas.resolves(ethers.toBigInt(50000));
      
      // Mock paymaster validation
      sandbox.stub(paymasterUtils, 'validatePaymasterInterface').resolves({
        valid: true,
        gasEstimate: { validateGas: 45000, postOpGas: 15000 }
      });

      // Simulate sponsored transaction
      const result = await paymasterUtils.simulateSponsoredTransaction({
        contract: mockContract,
        functionName: 'testFunction',
        args: [42],
        paymasterAddress,
        sender: mockWallet.address
      });

      expect(result.success).to.be.true;
      
      // Check that interaction was tracked
      const reputation = await paymasterUtils.reputationTracker.getReputation(paymasterAddress);
      expect(reputation.interactions).to.have.length(1);
      expect(reputation.interactions[0].success).to.be.true;

      // Clean up
      await paymasterUtils.reputationTracker.clearAllData();
    });

    it('should handle gasless simulation with complete workflow', async function() {
      const gaslessSimulator = new GaslessSimulator(mockProvider);
      const paymasterAddress = '0xffffffffffffffffffffffffffffffffffffffff';

      // Mock all required methods
      mockContract.interface.getFunction.returns({
        selector: '0x12345678',
        stateMutability: 'nonpayable'
      });
      mockContract.testFunction.estimateGas.resolves(ethers.toBigInt(50000));
      
      // Mock paymaster validation
      gaslessSimulator.paymasterUtils.validatePaymasterInterface = sandbox.stub().resolves({
        valid: true,
        errors: []
      });

      const options = {
        contract: mockContract,
        functionName: 'testFunction',
        args: [42],
        mode: 'auto',
        paymasterAddress,
        useCache: true,
        fallbackOnError: true
      };

      const result = await gaslessSimulator.simulate(options);

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.be.above(0);
      expect(result).to.have.property('mode');
      expect(result).to.have.property('confidence');
    });
  });
});