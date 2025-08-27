const { expect } = require('chai');
const sinon = require('sinon');
const { ethers } = require('ethers');

// Import modules to test
const { PaymasterUtils } = require('../utils/paymaster');
const { GaslessSimulator } = require('../profiler/gasless-simulator');
const { SomniaGasProfiler } = require('../profiler/index');

describe('Paymaster Integration Tests', function() {
  let sandbox;
  let mockProvider;
  let mockWallet;
  let paymasterUtils;
  let gaslessSimulator;
  let gasProfiler;

  // Mock paymaster contracts
  const mockPaymasters = {
    sponsorship: {
      address: '0x1000000000000000000000000000000000000001',
      type: 'sponsorship-paymaster',
      valid: true,
      balance: ethers.parseEther('10.0')
    },
    token: {
      address: '0x2000000000000000000000000000000000000002', 
      type: 'token-paymaster',
      valid: true,
      balance: ethers.parseEther('5.0')
    },
    verifying: {
      address: '0x3000000000000000000000000000000000000003',
      type: 'verifying-paymaster', 
      valid: true,
      balance: ethers.parseEther('8.0')
    },
    invalid: {
      address: '0x0000000000000000000000000000000000000000',
      type: 'invalid',
      valid: false,
      balance: ethers.parseEther('0')
    }
  };

  // Mock test contract
  const mockContract = {
    target: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    interface: {
      encodeFunctionData: sinon.stub(),
      getFunction: sinon.stub()
    }
  };

  beforeEach(function() {
    sandbox = sinon.createSandbox();

    // Mock provider with realistic responses
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
      address: '0x7890123456789012345678901234567890123456'
    };

    // Setup default provider responses
    setupProviderMocks();

    // Initialize components
    paymasterUtils = new PaymasterUtils(mockProvider, { enableReputationTracking: false });
    gaslessSimulator = new GaslessSimulator(mockProvider);
    gasProfiler = new SomniaGasProfiler();
    gasProfiler.provider = mockProvider;
    gasProfiler.wallet = mockWallet;
    gasProfiler.gaslessSimulator = gaslessSimulator;
    gasProfiler.paymasterUtils = paymasterUtils;
  });

  afterEach(function() {
    sandbox.restore();
  });

  function setupProviderMocks() {
    // Network info
    mockProvider.getNetwork.resolves({ name: 'somnia-testnet', chainId: 2648 });
    mockProvider.getBlockNumber.resolves(12345);
    
    // Fee data
    mockProvider.getFeeData.resolves({
      gasPrice: ethers.parseUnits('20', 'gwei'),
      maxFeePerGas: ethers.parseUnits('25', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
    });

    // Setup paymaster-specific responses
    Object.values(mockPaymasters).forEach(paymaster => {
      // Balance
      mockProvider.getBalance.withArgs(paymaster.address).resolves(paymaster.balance);
      
      // Contract code
      if (paymaster.valid) {
        const mockCode = generateMockPaymasterCode(paymaster.type);
        mockProvider.getCode.withArgs(paymaster.address).resolves(mockCode);
      } else {
        mockProvider.getCode.withArgs(paymaster.address).resolves('0x');
      }
    });

    // Default contract code for test contract
    mockProvider.getCode.withArgs(mockContract.target).resolves(
      '0x608060405234801561001057600080fd5b50600436106100415760003560e01c8063'
    );

    // Mock contract interactions
    mockContract.interface.encodeFunctionData.returns('0x12345678');
    mockContract.interface.getFunction.returns({
      selector: '0x12345678',
      stateMutability: 'nonpayable',
      name: 'testFunction',
      inputs: []
    });
  }

  function generateMockPaymasterCode(type) {
    const baseCode = '0x608060405234801561001057600080fd5b50';
    const typeSpecificCode = {
      'sponsorship-paymaster': 'validatePaymasterUserOppostOp',
      'token-paymaster': 'validatePaymasterUserOppostOptokenerc20transfer',
      'verifying-paymaster': 'validatePaymasterUserOppostOpverifyingsignerecdsa',
      'staking-paymaster': 'validatePaymasterUserOppostOpstakestaking'
    };
    
    return baseCode + (typeSpecificCode[type] || 'validatePaymasterUserOppostOp');
  }

  describe('Paymaster Type Detection and Validation', function() {
    it('should correctly detect sponsorship paymaster', async function() {
      const paymaster = mockPaymasters.sponsorship;
      
      const typeAnalysis = await paymasterUtils.detectPaymasterType(paymaster.address);
      const validation = await paymasterUtils.validatePaymasterInterface(paymaster.address);
      
      expect(typeAnalysis.primaryType).to.equal('sponsorship-paymaster');
      expect(validation.valid).to.be.true;
      expect(validation.balance).to.equal('10.0');
    });

    it('should correctly detect token paymaster with enhanced features', async function() {
      const paymaster = mockPaymasters.token;
      
      const typeAnalysis = await paymasterUtils.detectPaymasterType(paymaster.address);
      
      expect(typeAnalysis.primaryType).to.equal('token-paymaster');
      expect(typeAnalysis.characteristics.isTokenBased).to.be.true;
      expect(typeAnalysis.supportedFeatures).to.include('Token-based payments');
      expect(typeAnalysis.gasComplexity).to.be.oneOf(['medium', 'high']);
    });

    it('should correctly detect verifying paymaster', async function() {
      const paymaster = mockPaymasters.verifying;
      
      const typeAnalysis = await paymasterUtils.detectPaymasterType(paymaster.address);
      
      expect(typeAnalysis.primaryType).to.equal('verifying-paymaster');
      expect(typeAnalysis.characteristics.isVerifying).to.be.true;
      expect(typeAnalysis.supportedFeatures).to.include('Signature verification');
    });

    it('should reject invalid paymaster', async function() {
      const paymaster = mockPaymasters.invalid;
      
      const validation = await paymasterUtils.validatePaymasterInterface(paymaster.address);
      
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('No contract found at address');
    });
  });

  describe('Gas Overhead Calculation Integration', function() {
    it('should calculate different overhead for different paymaster types', async function() {
      const results = {};
      
      for (const [name, paymaster] of Object.entries(mockPaymasters)) {
        if (!paymaster.valid) continue;
        
        const overhead = await paymasterUtils.calculatePaymasterOverhead(
          paymaster.address, 
          { callGasLimit: 50000 }
        );
        
        results[name] = overhead;
      }
      
      // Sponsorship should have lowest overhead
      expect(results.sponsorship.totalOverhead).to.be.below(results.token.totalOverhead);
      
      // Token paymaster should have higher overhead due to token operations
      expect(results.token.totalOverhead).to.be.above(results.sponsorship.totalOverhead);
      
      // All should have reasonable confidence scores
      Object.values(results).forEach(result => {
        expect(result.confidence).to.be.above(50);
        expect(result.totalOverhead).to.be.above(20000);
        expect(result.breakdown).to.be.an('object');
      });
    });

    it('should provide detailed breakdown for token paymaster', async function() {
      const paymaster = mockPaymasters.token;
      
      const overhead = await paymasterUtils.calculatePaymasterOverhead(
        paymaster.address,
        { callGasLimit: 50000 }
      );
      
      expect(overhead.breakdown).to.have.property('paymasterType');
      expect(overhead.breakdown.paymasterType.details.type).to.equal('token-paymaster');
      expect(overhead.breakdown.paymasterType.details.features).to.include('Token-based payments');
    });
  });

  describe('Gasless Simulation Integration', function() {
    beforeEach(function() {
      // Mock contract functions for simulation
      mockContract.testFunction = {
        estimateGas: sandbox.stub().resolves(ethers.toBigInt(50000)),
        staticCall: sandbox.stub().resolves('0x')
      };
    });

    it('should simulate gasless transaction without paymaster', async function() {
      const result = await gaslessSimulator.simulate({
        contract: mockContract,
        functionName: 'testFunction',
        args: [],
        mode: 'estimate',
        useCache: false
      });

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.equal(50000);
      expect(result.paymasterOverhead).to.equal(0);
      expect(result.mode).to.equal('estimate');
    });

    it('should simulate with sponsorship paymaster', async function() {
      const paymaster = mockPaymasters.sponsorship;
      
      // Mock paymaster validation for simulator
      gaslessSimulator.paymasterUtils.validatePaymasterInterface = sandbox.stub().resolves({
        valid: true,
        errors: []
      });

      gaslessSimulator.paymasterUtils.createUserOperationFromCall = sandbox.stub().resolves({
        sender: mockWallet.address,
        callData: '0x12345678'
      });

      gaslessSimulator.paymasterUtils.simulateSponsoredTransaction = sandbox.stub().resolves({
        success: true,
        totalGas: 65000,
        paymasterOverhead: 15000,
        sponsoredGas: 50000
      });

      const result = await gaslessSimulator.simulate({
        contract: mockContract,
        functionName: 'testFunction',
        args: [],
        mode: 'paymaster',
        paymasterAddress: paymaster.address,
        sender: mockWallet.address
      });

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.equal(65000);
      expect(result.paymasterOverhead).to.equal(15000);
      expect(result.details.method).to.equal('paymaster_simulation');
    });

    it('should handle paymaster simulation failure with fallback', async function() {
      const paymaster = mockPaymasters.token;
      
      // Mock paymaster validation failure
      gaslessSimulator.paymasterUtils.validatePaymasterInterface = sandbox.stub().resolves({
        valid: false,
        errors: ['Invalid paymaster interface']
      });

      const result = await gaslessSimulator.simulate({
        contract: mockContract,
        functionName: 'testFunction',
        args: [],
        mode: 'paymaster',
        paymasterAddress: paymaster.address,
        fallbackOnError: true
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid paymaster');
    });

    it('should use caching for repeated simulations', async function() {
      const options = {
        contract: mockContract,
        functionName: 'testFunction',
        args: [],
        mode: 'estimate',
        useCache: true
      };

      // First simulation
      const result1 = await gaslessSimulator.simulate(options);
      expect(result1.fromCache).to.be.undefined;

      // Second simulation should use cache
      const result2 = await gaslessSimulator.simulate(options);
      expect(result2.fromCache).to.be.true;

      // Results should be identical
      expect(result1.gasUsed).to.equal(result2.gasUsed);
      expect(mockContract.testFunction.estimateGas.callCount).to.equal(1);
    });
  });

  describe('Full Integration with SomniaGasProfiler', function() {
    it('should run complete gasless profiling workflow', async function() {
      const paymaster = mockPaymasters.sponsorship;
      
      // Mock contract validation
      mockContract.get = {
        estimateGas: sandbox.stub().resolves(ethers.toBigInt(25000))
      };

      // Mock profiler methods
      gasProfiler.validateContract = sandbox.stub().resolves(mockContract);
      gasProfiler.parseFunctionSignatures = sandbox.stub().returns([{
        signature: 'get()',
        fragment: { name: 'get', inputs: [] },
        fullSignature: 'get()'
      }]);
      gasProfiler.parseArguments = sandbox.stub().returns([[]]);

      // Mock enhanced paymaster simulation
      gasProfiler.simulatePaymasterTransaction = sandbox.stub().resolves(75000);
      gasProfiler.validatePaymaster = sandbox.stub().resolves({
        valid: true,
        address: paymaster.address,
        balance: '10.0'
      });

      // Simulate profiling a simple function
      const result = await gasProfiler.profileFunction(
        mockContract,
        { fragment: { name: 'get' }, fullSignature: 'get()' },
        [],
        3, // runs
        true, // gasless mode
        paymaster.address
      );

      expect(result).to.have.property('runs');
      expect(result.runs).to.have.length(3);
      expect(result.aggregated.avg).to.equal(75000);
      
      // All runs should be in paymaster simulation mode
      result.runs.forEach(run => {
        expect(run.paymasterUsed).to.be.true;
        expect(run.paymasterAddress).to.equal(paymaster.address);
        expect(run.mode).to.include('paymaster');
      });
    });

    it('should handle mixed success/failure scenarios', async function() {
      const paymaster = mockPaymasters.token;
      
      // Mock contract that sometimes fails
      mockContract.complexFunction = {
        estimateGas: sandbox.stub()
      };

      // First call succeeds, second fails, third succeeds
      mockContract.complexFunction.estimateGas
        .onFirstCall().resolves(ethers.toBigInt(80000))
        .onSecondCall().rejects(new Error('Simulation failed'))
        .onThirdCall().resolves(ethers.toBigInt(82000));

      gasProfiler.validateContract = sandbox.stub().resolves(mockContract);
      gasProfiler.parseFunctionSignatures = sandbox.stub().returns([{
        signature: 'complexFunction()',
        fragment: { name: 'complexFunction', inputs: [] },
        fullSignature: 'complexFunction()'
      }]);
      gasProfiler.parseArguments = sandbox.stub().returns([[]]);

      // Mock fallback to conservative estimate on failure
      gasProfiler._getConservativeGasEstimate = sandbox.stub().returns(85000);

      const result = await gasProfiler.profileFunction(
        mockContract,
        { fragment: { name: 'complexFunction' }, fullSignature: 'complexFunction()' },
        [],
        3, // runs  
        true, // gasless mode
        null // no paymaster
      );

      expect(result.runs).to.have.length(3);
      
      // Check that different modes were used due to failures
      const modes = result.runs.map(run => run.mode);
      expect(modes).to.include.members(['gasless_estimate', 'conservative_fallback']);
    });
  });

  describe('Cost Analysis Integration', function() {
    it('should generate comprehensive cost analysis for paymaster', async function() {
      const paymaster = mockPaymasters.token;
      
      const costAnalysis = await paymasterUtils.analyzePaymasterCosts(paymaster.address, {
        sampleUserOps: 50,
        timeframe: '24h',
        includePredictions: true,
        compareAlternatives: true
      });

      expect(costAnalysis).to.have.property('paymaster', paymaster.address);
      expect(costAnalysis).to.have.property('costBreakdown');
      expect(costAnalysis).to.have.property('optimization');
      expect(costAnalysis).to.have.property('metrics');
      expect(costAnalysis).to.have.property('predictions');

      // Cost breakdown should include all major components
      expect(costAnalysis.costBreakdown).to.have.property('baseCosts');
      expect(costAnalysis.costBreakdown).to.have.property('typeCosts');
      expect(costAnalysis.costBreakdown).to.have.property('totalPerOperation');

      // Optimization should provide recommendations
      expect(costAnalysis.optimization.recommendations).to.be.an('array');
      expect(costAnalysis.optimization).to.have.property('potentialSavings');

      // Metrics should be calculated
      expect(costAnalysis.metrics.averageCostPerTx).to.be.above(0);
      expect(costAnalysis.metrics.gasEfficiency).to.be.between(0, 100);

      // Predictions should include scenarios
      expect(costAnalysis.predictions.scenarios).to.have.property('conservative');
      expect(costAnalysis.predictions.scenarios).to.have.property('moderate');
      expect(costAnalysis.predictions.scenarios).to.have.property('aggressive');
    });

    it('should provide different recommendations for different paymaster types', async function() {
      const tokenAnalysis = await paymasterUtils.analyzePaymasterCosts(
        mockPaymasters.token.address,
        { sampleUserOps: 20 }
      );

      const sponsorshipAnalysis = await paymasterUtils.analyzePaymasterCosts(
        mockPaymasters.sponsorship.address,
        { sampleUserOps: 20 }
      );

      // Token paymaster should have token-specific recommendations
      const tokenRecommendations = tokenAnalysis.optimization.recommendations
        .map(rec => rec.type);
      
      const sponsorshipRecommendations = sponsorshipAnalysis.optimization.recommendations
        .map(rec => rec.type);

      // Token paymaster likely has more complex optimization opportunities
      expect(tokenAnalysis.optimization.recommendations.length).to.be.at.least(
        sponsorshipAnalysis.optimization.recommendations.length
      );

      // Should have different cost structures
      expect(tokenAnalysis.costBreakdown.totalPerOperation).to.not.equal(
        sponsorshipAnalysis.costBreakdown.totalPerOperation
      );
    });
  });

  describe('Error Handling and Edge Cases', function() {
    it('should handle provider connection failures gracefully', async function() {
      // Mock provider that fails randomly
      const failingProvider = {
        ...mockProvider,
        getCode: sandbox.stub().rejects(new Error('Connection timeout')),
        getBalance: sandbox.stub().rejects(new Error('Connection timeout'))
      };

      const failingUtils = new PaymasterUtils(failingProvider);
      
      const validation = await failingUtils.validatePaymasterInterface(
        mockPaymasters.sponsorship.address
      );

      expect(validation.valid).to.be.false;
      expect(validation.error).to.include('Connection timeout');
    });

    it('should handle malformed paymaster contracts', async function() {
      const malformedAddress = '0x4444444444444444444444444444444444444444';
      
      // Mock malformed contract (has code but wrong interface)
      mockProvider.getCode.withArgs(malformedAddress).resolves('0x608060405234801561001057600080fd5b50');
      mockProvider.getBalance.withArgs(malformedAddress).resolves(ethers.parseEther('1.0'));

      const validation = await paymasterUtils.validatePaymasterInterface(malformedAddress);
      
      expect(validation.valid).to.be.false;
      expect(validation.hasValidateMethod).to.be.false;
      expect(validation.hasPostOpMethod).to.be.false;
    });

    it('should handle insufficient paymaster balance', async function() {
      const poorPaymaster = '0x5555555555555555555555555555555555555555';
      
      // Mock paymaster with valid interface but insufficient balance
      mockProvider.getCode.withArgs(poorPaymaster).resolves(
        generateMockPaymasterCode('sponsorship-paymaster')
      );
      mockProvider.getBalance.withArgs(poorPaymaster).resolves(ethers.parseEther('0.001')); // Very low

      const status = await paymasterUtils.getPaymasterStatus(poorPaymaster);
      
      expect(status.hasCode).to.be.true;
      expect(status.canSponsor).to.be.false; // Insufficient balance
      expect(parseFloat(status.balance)).to.be.below(0.01);
    });

    it('should handle simulation timeout scenarios', async function() {
      this.timeout(5000);
      
      // Mock very slow contract interaction
      mockContract.slowFunction = {
        estimateGas: sandbox.stub().callsFake(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve(ethers.toBigInt(100000)), 2000);
          });
        })
      };

      const startTime = Date.now();
      
      const result = await gaslessSimulator.simulate({
        contract: mockContract,
        functionName: 'slowFunction',
        args: [],
        mode: 'estimate',
        fallbackOnError: true
      });

      const duration = Date.now() - startTime;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.above(1500); // Should have waited for slow operation
      expect(result.gasUsed).to.equal(100000);
    });
  });
});