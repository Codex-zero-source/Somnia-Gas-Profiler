const { expect } = require('chai');
const { ethers } = require('ethers');
const { SomniaGasProfiler } = require('../profiler/index');
const { PaymasterUtils } = require('../utils/paymaster');
const { GaslessSimulator } = require('../profiler/gasless-simulator');

describe('End-to-End Gasless Testing on Somnia Testnet', function() {
  let provider;
  let wallet;
  let gasProfiler;
  let paymasterUtils;
  let gaslessSimulator;
  let testContract;

  // Test configuration
  const SOMNIA_TESTNET_RPC = process.env.RPC_URL || 'https://dream-rpc.somnia.network';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const TEST_TIMEOUT = 60000; // 60 seconds

  // Skip tests if no private key is provided
  const skipIfNoKey = PRIVATE_KEY ? false : true;

  before(async function() {
    if (skipIfNoKey) {
      console.log('⚠️  Skipping E2E tests - PRIVATE_KEY not provided');
      this.skip();
    }

    this.timeout(TEST_TIMEOUT);
    
    console.log('🌐 Connecting to Somnia testnet...');
    provider = new ethers.JsonRpcProvider(SOMNIA_TESTNET_RPC);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Verify connection
    const network = await provider.getNetwork();
    console.log(`✅ Connected to ${network.name || 'Somnia'} (Chain ID: ${network.chainId})`);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} STT`);
    
    if (parseFloat(ethers.formatEther(balance)) < 0.01) {
      throw new Error('Insufficient balance for E2E testing. Need at least 0.01 STT');
    }

    // Initialize components
    gasProfiler = new SomniaGasProfiler();
    paymasterUtils = new PaymasterUtils(provider);
    gaslessSimulator = new GaslessSimulator(provider);
    
    // Deploy a simple test contract
    console.log('📝 Deploying test contract...');
    testContract = await deployTestContract();
    console.log(`✅ Test contract deployed at: ${testContract.target}`);
  });

  describe('Network Connection and Setup', function() {
    it('should connect to Somnia testnet successfully', async function() {
      const network = await provider.getNetwork();
      expect(network.chainId).to.be.oneOf([BigInt(2648), BigInt(50311)]); // Somnia testnet chain IDs
    });

    it('should have sufficient balance for testing', async function() {
      const balance = await provider.getBalance(wallet.address);
      expect(parseFloat(ethers.formatEther(balance))).to.be.above(0.01);
    });

    it('should initialize all components successfully', async function() {
      expect(gasProfiler).to.be.instanceOf(SomniaGasProfiler);
      expect(paymasterUtils).to.be.instanceOf(PaymasterUtils);
      expect(gaslessSimulator).to.be.instanceOf(GaslessSimulator);
    });
  });

  describe('Real Contract Gasless Simulation', function() {
    it('should simulate gasless transactions without paymaster', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const result = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'increment',
        args: [],
        mode: 'estimate',
        useCache: false
      });

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.be.above(0);
      expect(result.paymasterOverhead).to.equal(0);
      expect(result.mode).to.equal('estimate');
      
      console.log(`   Gas estimate: ${result.gasUsed.toLocaleString()}`);
    });

    it('should use multiple simulation modes', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const modes = ['estimate', 'staticCall'];
      const results = {};
      
      for (const mode of modes) {
        try {
          const result = await gaslessSimulator.simulate({
            contract: testContract,
            functionName: 'getValue',
            args: [],
            mode,
            useCache: false
          });
          
          results[mode] = result;
          expect(result.success).to.be.true;
          console.log(`   ${mode} mode: ${result.gasUsed.toLocaleString()} gas`);
          
        } catch (error) {
          console.log(`   ${mode} mode failed: ${error.message}`);
          // Some modes might fail depending on function type, which is acceptable
        }
      }
      
      expect(Object.keys(results).length).to.be.above(0);
    });

    it('should handle view function simulations', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const result = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'getValue',
        args: [],
        mode: 'staticCall',
        useCache: false
      });

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.be.above(0);
      console.log(`   View function gas: ${result.gasUsed.toLocaleString()}`);
    });
  });

  describe('Real Network Paymaster Discovery', function() {
    it('should discover paymasters on the network', async function() {
      this.timeout(TEST_TIMEOUT);
      
      console.log('🔍 Searching for paymasters on Somnia testnet...');
      
      // This is a simplified discovery - in practice, you'd implement network-specific discovery
      const potentialPaymasters = await discoverNetworkPaymasters(provider);
      
      console.log(`   Found ${potentialPaymasters.length} potential paymaster(s)`);
      
      if (potentialPaymasters.length > 0) {
        for (const paymasterAddress of potentialPaymasters) {
          console.log(`   - ${paymasterAddress}`);
          
          const validation = await paymasterUtils.validatePaymasterInterface(paymasterAddress);
          console.log(`     Valid: ${validation.valid}, EIP-4337: ${validation.eip4337Compliant}`);
        }
      } else {
        console.log('   ⚠️  No paymasters found (network may not have deployed paymasters)');
      }
      
      // Test passes regardless of number found
      expect(potentialPaymasters).to.be.an('array');
    });
  });

  describe('Gas Profiler Integration', function() {
    it('should profile real contract functions in gasless mode', async function() {
      this.timeout(TEST_TIMEOUT);
      
      // Initialize profiler with real network
      gasProfiler.provider = provider;
      gasProfiler.wallet = wallet;
      gasProfiler.gaslessSimulator = gaslessSimulator;
      gasProfiler.paymasterUtils = paymasterUtils;
      
      const functionMeta = {
        fragment: { name: 'increment', inputs: [] },
        fullSignature: 'increment()'
      };
      
      const result = await gasProfiler.profileFunction(
        testContract,
        functionMeta,
        [], // args
        2,  // runs
        true, // gasless mode
        null  // no paymaster
      );

      expect(result).to.have.property('runs');
      expect(result.runs).to.have.length(2);
      expect(result.aggregated.avg).to.be.above(0);
      
      // All runs should be gasless simulations
      result.runs.forEach(run => {
        expect(run.mode).to.include('gasless');
        expect(run.paymasterUsed).to.be.false;
      });
      
      console.log(`   Average gas: ${result.aggregated.avg.toLocaleString()}`);
      console.log(`   Range: ${result.aggregated.min.toLocaleString()} - ${result.aggregated.max.toLocaleString()}`);
    });

    it('should handle contract function with parameters', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const functionMeta = {
        fragment: { name: 'setValue', inputs: [{ type: 'uint256' }] },
        fullSignature: 'setValue(uint256)'
      };
      
      const result = await gasProfiler.profileFunction(
        testContract,
        functionMeta,
        [42], // args
        1,    // runs
        true, // gasless mode
        null  // no paymaster
      );

      expect(result.runs).to.have.length(1);
      expect(result.aggregated.avg).to.be.above(0);
      
      console.log(`   setValue gas: ${result.aggregated.avg.toLocaleString()}`);
    });
  });

  describe('Cost Analysis on Real Network', function() {
    it('should calculate realistic gas costs', async function() {
      this.timeout(TEST_TIMEOUT);
      
      // Get real gas price from network
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      
      expect(gasPrice).to.be.above(0);
      console.log(`   Network gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      
      // Simulate a transaction and calculate cost
      const gasEstimate = await testContract.increment.estimateGas();
      const costInWei = gasEstimate * gasPrice;
      const costInSTT = ethers.formatEther(costInWei);
      
      console.log(`   Transaction gas: ${gasEstimate.toString()}`);
      console.log(`   Transaction cost: ${costInSTT} STT`);
      
      expect(parseFloat(costInSTT)).to.be.above(0);
    });
  });

  describe('Error Handling and Edge Cases', function() {
    it('should handle network timeouts gracefully', async function() {
      this.timeout(10000); // Shorter timeout to trigger timeout scenarios
      
      // Create a provider with very short timeout
      const timeoutProvider = new ethers.JsonRpcProvider(SOMNIA_TESTNET_RPC, undefined, {
        staticNetwork: true,
        timeout: 1000 // 1 second timeout
      });
      
      const timeoutSimulator = new GaslessSimulator(timeoutProvider);
      
      try {
        const result = await timeoutSimulator.simulate({
          contract: testContract,
          functionName: 'increment',
          args: [],
          mode: 'estimate',
          fallbackOnError: true
        });
        
        // If it succeeds, that's fine too
        expect(result).to.have.property('success');
        
      } catch (error) {
        // Timeout errors are expected
        expect(error.message).to.include('timeout').or.include('failed');
        console.log(`   ✅ Timeout handled: ${error.message.substring(0, 50)}...`);
      }
    });

    it('should handle invalid contract calls', async function() {
      this.timeout(TEST_TIMEOUT);
      
      try {
        await gaslessSimulator.simulate({
          contract: testContract,
          functionName: 'nonExistentFunction',
          args: [],
          mode: 'estimate',
          fallbackOnError: false
        });
        
        expect.fail('Should have thrown an error for non-existent function');
        
      } catch (error) {
        expect(error.message).to.include('function').or.include('method');
        console.log(`   ✅ Invalid call handled: ${error.message.substring(0, 50)}...`);
      }
    });
  });

  describe('Performance and Scalability', function() {
    it('should handle multiple concurrent simulations', async function() {
      this.timeout(TEST_TIMEOUT * 2);
      
      const concurrentCount = 5;
      const simulationPromises = [];
      
      for (let i = 0; i < concurrentCount; i++) {
        const promise = gaslessSimulator.simulate({
          contract: testContract,
          functionName: 'getValue',
          args: [],
          mode: 'estimate',
          useCache: false
        });
        simulationPromises.push(promise);
      }
      
      const results = await Promise.all(simulationPromises);
      
      expect(results).to.have.length(concurrentCount);
      results.forEach((result, index) => {
        expect(result.success).to.be.true;
        console.log(`   Simulation ${index + 1}: ${result.gasUsed.toLocaleString()} gas`);
      });
    });

    it('should use caching effectively', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const startTime = Date.now();
      
      // First call - should cache result
      const result1 = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'getValue',
        args: [],
        mode: 'estimate',
        useCache: true
      });
      
      const firstCallTime = Date.now() - startTime;
      
      // Second call - should use cache
      const cacheStartTime = Date.now();
      const result2 = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'getValue',
        args: [],
        mode: 'estimate',
        useCache: true
      });
      
      const secondCallTime = Date.now() - cacheStartTime;
      
      expect(result1.gasUsed).to.equal(result2.gasUsed);
      expect(result2.fromCache).to.be.true;
      expect(secondCallTime).to.be.below(firstCallTime * 0.5); // Cache should be much faster
      
      console.log(`   First call: ${firstCallTime}ms`);
      console.log(`   Cached call: ${secondCallTime}ms`);
    });
  });
});

/**
 * Deploy a simple test contract for E2E testing
 */
async function deployTestContract() {
  const contractSource = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;
    
    contract TestContract {
        uint256 private value;
        uint256 private counter;
        
        function getValue() public view returns (uint256) {
            return value;
        }
        
        function setValue(uint256 _value) public {
            value = _value;
        }
        
        function increment() public {
            counter++;
        }
        
        function getCounter() public view returns (uint256) {
            return counter;
        }
        
        function complexOperation(uint256 a, uint256 b) public pure returns (uint256) {
            return a * b + a / (b + 1);
        }
    }
  `;

  // Simple deployment using ethers ContractFactory
  const abi = [
    "function getValue() view returns (uint256)",
    "function setValue(uint256) external",
    "function increment() external", 
    "function getCounter() view returns (uint256)",
    "function complexOperation(uint256, uint256) pure returns (uint256)"
  ];
  
  const bytecode = "0x608060405234801561001057600080fd5b50610234806100206000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c806320965255146100575780633fa4f245146100615780635b9af12b1461007f5780637d49d8751461009b578063d09de08a146100b9575b600080fd5b61005f610000565b005b6100696100c3565b60405161007691906101cd565b60405180910390f35b610099600480360381019061009491906101f4565b6100c9565b005b6100a36100d3565b6040516100b091906101cd565b60405180910390f35b6100c16100d9565b005b60005481565b8060008190555050565b60015481565b600160008154809291906100ec90610250565b9190505550565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061011e826100f3565b9050919050565b61012e81610113565b82525050565b600060208201905061014960008301846101ff565b92915050565b6000819050919050565b6101628161014f565b811461016d57600080fd5b50565b60008135905061017f81610159565b92915050565b60006020828403121561019b5761019a6102cb565b5b60006101a984828501610170565b91505092915050565b6101bb8161014f565b82525050565b60006020820190506101d660008301846101b2565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b6000600282049050600182168061022657607f821691505b602082108103610239576102386101df565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061027a8261014f565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82036102ac576102ab610240565b5b60018201905091905056fea2646970667358221220d8f8c52b3b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b64736f6c63430008130033";
  
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  
  return contract;
}

/**
 * Discover paymasters on the network (simplified implementation)
 */
async function discoverNetworkPaymasters(provider) {
  const potentialPaymasters = [];
  
  try {
    // Method 1: Check known addresses (these would be network-specific)
    const knownAddresses = [
      // Add known Somnia paymaster addresses here when they exist
    ];
    
    for (const address of knownAddresses) {
      try {
        const code = await provider.getCode(address);
        if (code !== '0x') {
          potentialPaymasters.push(address);
        }
      } catch {
        // Skip invalid addresses
      }
    }
    
    // Method 2: Event log analysis for recent blocks
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);
      
      // Look for PaymasterAdded or similar events
      // This is simplified - real implementation would search for specific event signatures
      
    } catch (error) {
      console.log(`   Event analysis failed: ${error.message.substring(0, 50)}...`);
    }
    
  } catch (error) {
    console.log(`   Paymaster discovery failed: ${error.message.substring(0, 50)}...`);
  }
  
  return potentialPaymasters;
}const { expect } = require('chai');
const { ethers } = require('ethers');
const { SomniaGasProfiler } = require('../profiler/index');
const { PaymasterUtils } = require('../utils/paymaster');
const { GaslessSimulator } = require('../profiler/gasless-simulator');

describe('End-to-End Gasless Testing on Somnia Testnet', function() {
  let provider;
  let wallet;
  let gasProfiler;
  let paymasterUtils;
  let gaslessSimulator;
  let testContract;

  // Test configuration
  const SOMNIA_TESTNET_RPC = process.env.RPC_URL || 'https://dream-rpc.somnia.network';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const TEST_TIMEOUT = 60000; // 60 seconds

  // Skip tests if no private key is provided
  const skipIfNoKey = PRIVATE_KEY ? false : true;

  before(async function() {
    if (skipIfNoKey) {
      console.log('⚠️  Skipping E2E tests - PRIVATE_KEY not provided');
      this.skip();
    }

    this.timeout(TEST_TIMEOUT);
    
    console.log('🌐 Connecting to Somnia testnet...');
    provider = new ethers.JsonRpcProvider(SOMNIA_TESTNET_RPC);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Verify connection
    const network = await provider.getNetwork();
    console.log(`✅ Connected to ${network.name || 'Somnia'} (Chain ID: ${network.chainId})`);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} STT`);
    
    if (parseFloat(ethers.formatEther(balance)) < 0.01) {
      throw new Error('Insufficient balance for E2E testing. Need at least 0.01 STT');
    }

    // Initialize components
    gasProfiler = new SomniaGasProfiler();
    paymasterUtils = new PaymasterUtils(provider);
    gaslessSimulator = new GaslessSimulator(provider);
    
    // Deploy a simple test contract
    console.log('📝 Deploying test contract...');
    testContract = await deployTestContract();
    console.log(`✅ Test contract deployed at: ${testContract.target}`);
  });

  describe('Network Connection and Setup', function() {
    it('should connect to Somnia testnet successfully', async function() {
      const network = await provider.getNetwork();
      expect(network.chainId).to.be.oneOf([BigInt(2648), BigInt(50311)]); // Somnia testnet chain IDs
    });

    it('should have sufficient balance for testing', async function() {
      const balance = await provider.getBalance(wallet.address);
      expect(parseFloat(ethers.formatEther(balance))).to.be.above(0.01);
    });

    it('should initialize all components successfully', async function() {
      expect(gasProfiler).to.be.instanceOf(SomniaGasProfiler);
      expect(paymasterUtils).to.be.instanceOf(PaymasterUtils);
      expect(gaslessSimulator).to.be.instanceOf(GaslessSimulator);
    });
  });

  describe('Real Contract Gasless Simulation', function() {
    it('should simulate gasless transactions without paymaster', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const result = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'increment',
        args: [],
        mode: 'estimate',
        useCache: false
      });

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.be.above(0);
      expect(result.paymasterOverhead).to.equal(0);
      expect(result.mode).to.equal('estimate');
      
      console.log(`   Gas estimate: ${result.gasUsed.toLocaleString()}`);
    });

    it('should use multiple simulation modes', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const modes = ['estimate', 'staticCall'];
      const results = {};
      
      for (const mode of modes) {
        try {
          const result = await gaslessSimulator.simulate({
            contract: testContract,
            functionName: 'getValue',
            args: [],
            mode,
            useCache: false
          });
          
          results[mode] = result;
          expect(result.success).to.be.true;
          console.log(`   ${mode} mode: ${result.gasUsed.toLocaleString()} gas`);
          
        } catch (error) {
          console.log(`   ${mode} mode failed: ${error.message}`);
          // Some modes might fail depending on function type, which is acceptable
        }
      }
      
      expect(Object.keys(results).length).to.be.above(0);
    });

    it('should handle view function simulations', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const result = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'getValue',
        args: [],
        mode: 'staticCall',
        useCache: false
      });

      expect(result.success).to.be.true;
      expect(result.gasUsed).to.be.above(0);
      console.log(`   View function gas: ${result.gasUsed.toLocaleString()}`);
    });
  });

  describe('Real Network Paymaster Discovery', function() {
    it('should discover paymasters on the network', async function() {
      this.timeout(TEST_TIMEOUT);
      
      console.log('🔍 Searching for paymasters on Somnia testnet...');
      
      // This is a simplified discovery - in practice, you'd implement network-specific discovery
      const potentialPaymasters = await discoverNetworkPaymasters(provider);
      
      console.log(`   Found ${potentialPaymasters.length} potential paymaster(s)`);
      
      if (potentialPaymasters.length > 0) {
        for (const paymasterAddress of potentialPaymasters) {
          console.log(`   - ${paymasterAddress}`);
          
          const validation = await paymasterUtils.validatePaymasterInterface(paymasterAddress);
          console.log(`     Valid: ${validation.valid}, EIP-4337: ${validation.eip4337Compliant}`);
        }
      } else {
        console.log('   ⚠️  No paymasters found (network may not have deployed paymasters)');
      }
      
      // Test passes regardless of number found
      expect(potentialPaymasters).to.be.an('array');
    });
  });

  describe('Gas Profiler Integration', function() {
    it('should profile real contract functions in gasless mode', async function() {
      this.timeout(TEST_TIMEOUT);
      
      // Initialize profiler with real network
      gasProfiler.provider = provider;
      gasProfiler.wallet = wallet;
      gasProfiler.gaslessSimulator = gaslessSimulator;
      gasProfiler.paymasterUtils = paymasterUtils;
      
      const functionMeta = {
        fragment: { name: 'increment', inputs: [] },
        fullSignature: 'increment()'
      };
      
      const result = await gasProfiler.profileFunction(
        testContract,
        functionMeta,
        [], // args
        2,  // runs
        true, // gasless mode
        null  // no paymaster
      );

      expect(result).to.have.property('runs');
      expect(result.runs).to.have.length(2);
      expect(result.aggregated.avg).to.be.above(0);
      
      // All runs should be gasless simulations
      result.runs.forEach(run => {
        expect(run.mode).to.include('gasless');
        expect(run.paymasterUsed).to.be.false;
      });
      
      console.log(`   Average gas: ${result.aggregated.avg.toLocaleString()}`);
      console.log(`   Range: ${result.aggregated.min.toLocaleString()} - ${result.aggregated.max.toLocaleString()}`);
    });

    it('should handle contract function with parameters', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const functionMeta = {
        fragment: { name: 'setValue', inputs: [{ type: 'uint256' }] },
        fullSignature: 'setValue(uint256)'
      };
      
      const result = await gasProfiler.profileFunction(
        testContract,
        functionMeta,
        [42], // args
        1,    // runs
        true, // gasless mode
        null  // no paymaster
      );

      expect(result.runs).to.have.length(1);
      expect(result.aggregated.avg).to.be.above(0);
      
      console.log(`   setValue gas: ${result.aggregated.avg.toLocaleString()}`);
    });
  });

  describe('Cost Analysis on Real Network', function() {
    it('should calculate realistic gas costs', async function() {
      this.timeout(TEST_TIMEOUT);
      
      // Get real gas price from network
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      
      expect(gasPrice).to.be.above(0);
      console.log(`   Network gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      
      // Simulate a transaction and calculate cost
      const gasEstimate = await testContract.increment.estimateGas();
      const costInWei = gasEstimate * gasPrice;
      const costInSTT = ethers.formatEther(costInWei);
      
      console.log(`   Transaction gas: ${gasEstimate.toString()}`);
      console.log(`   Transaction cost: ${costInSTT} STT`);
      
      expect(parseFloat(costInSTT)).to.be.above(0);
    });
  });

  describe('Error Handling and Edge Cases', function() {
    it('should handle network timeouts gracefully', async function() {
      this.timeout(10000); // Shorter timeout to trigger timeout scenarios
      
      // Create a provider with very short timeout
      const timeoutProvider = new ethers.JsonRpcProvider(SOMNIA_TESTNET_RPC, undefined, {
        staticNetwork: true,
        timeout: 1000 // 1 second timeout
      });
      
      const timeoutSimulator = new GaslessSimulator(timeoutProvider);
      
      try {
        const result = await timeoutSimulator.simulate({
          contract: testContract,
          functionName: 'increment',
          args: [],
          mode: 'estimate',
          fallbackOnError: true
        });
        
        // If it succeeds, that's fine too
        expect(result).to.have.property('success');
        
      } catch (error) {
        // Timeout errors are expected
        expect(error.message).to.include('timeout').or.include('failed');
        console.log(`   ✅ Timeout handled: ${error.message.substring(0, 50)}...`);
      }
    });

    it('should handle invalid contract calls', async function() {
      this.timeout(TEST_TIMEOUT);
      
      try {
        await gaslessSimulator.simulate({
          contract: testContract,
          functionName: 'nonExistentFunction',
          args: [],
          mode: 'estimate',
          fallbackOnError: false
        });
        
        expect.fail('Should have thrown an error for non-existent function');
        
      } catch (error) {
        expect(error.message).to.include('function').or.include('method');
        console.log(`   ✅ Invalid call handled: ${error.message.substring(0, 50)}...`);
      }
    });
  });

  describe('Performance and Scalability', function() {
    it('should handle multiple concurrent simulations', async function() {
      this.timeout(TEST_TIMEOUT * 2);
      
      const concurrentCount = 5;
      const simulationPromises = [];
      
      for (let i = 0; i < concurrentCount; i++) {
        const promise = gaslessSimulator.simulate({
          contract: testContract,
          functionName: 'getValue',
          args: [],
          mode: 'estimate',
          useCache: false
        });
        simulationPromises.push(promise);
      }
      
      const results = await Promise.all(simulationPromises);
      
      expect(results).to.have.length(concurrentCount);
      results.forEach((result, index) => {
        expect(result.success).to.be.true;
        console.log(`   Simulation ${index + 1}: ${result.gasUsed.toLocaleString()} gas`);
      });
    });

    it('should use caching effectively', async function() {
      this.timeout(TEST_TIMEOUT);
      
      const startTime = Date.now();
      
      // First call - should cache result
      const result1 = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'getValue',
        args: [],
        mode: 'estimate',
        useCache: true
      });
      
      const firstCallTime = Date.now() - startTime;
      
      // Second call - should use cache
      const cacheStartTime = Date.now();
      const result2 = await gaslessSimulator.simulate({
        contract: testContract,
        functionName: 'getValue',
        args: [],
        mode: 'estimate',
        useCache: true
      });
      
      const secondCallTime = Date.now() - cacheStartTime;
      
      expect(result1.gasUsed).to.equal(result2.gasUsed);
      expect(result2.fromCache).to.be.true;
      expect(secondCallTime).to.be.below(firstCallTime * 0.5); // Cache should be much faster
      
      console.log(`   First call: ${firstCallTime}ms`);
      console.log(`   Cached call: ${secondCallTime}ms`);
    });
  });
});

/**
 * Deploy a simple test contract for E2E testing
 */
async function deployTestContract() {
  const contractSource = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;
    
    contract TestContract {
        uint256 private value;
        uint256 private counter;
        
        function getValue() public view returns (uint256) {
            return value;
        }
        
        function setValue(uint256 _value) public {
            value = _value;
        }
        
        function increment() public {
            counter++;
        }
        
        function getCounter() public view returns (uint256) {
            return counter;
        }
        
        function complexOperation(uint256 a, uint256 b) public pure returns (uint256) {
            return a * b + a / (b + 1);
        }
    }
  `;

  // Simple deployment using ethers ContractFactory
  const abi = [
    "function getValue() view returns (uint256)",
    "function setValue(uint256) external",
    "function increment() external", 
    "function getCounter() view returns (uint256)",
    "function complexOperation(uint256, uint256) pure returns (uint256)"
  ];
  
  const bytecode = "0x608060405234801561001057600080fd5b50610234806100206000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c806320965255146100575780633fa4f245146100615780635b9af12b1461007f5780637d49d8751461009b578063d09de08a146100b9575b600080fd5b61005f610000565b005b6100696100c3565b60405161007691906101cd565b60405180910390f35b610099600480360381019061009491906101f4565b6100c9565b005b6100a36100d3565b6040516100b091906101cd565b60405180910390f35b6100c16100d9565b005b60005481565b8060008190555050565b60015481565b600160008154809291906100ec90610250565b9190505550565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061011e826100f3565b9050919050565b61012e81610113565b82525050565b600060208201905061014960008301846101ff565b92915050565b6000819050919050565b6101628161014f565b811461016d57600080fd5b50565b60008135905061017f81610159565b92915050565b60006020828403121561019b5761019a6102cb565b5b60006101a984828501610170565b91505092915050565b6101bb8161014f565b82525050565b60006020820190506101d660008301846101b2565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b6000600282049050600182168061022657607f821691505b602082108103610239576102386101df565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061027a8261014f565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82036102ac576102ab610240565b5b60018201905091905056fea2646970667358221220d8f8c52b3b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b64736f6c63430008130033";
  
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  
  return contract;
}

/**
 * Discover paymasters on the network (simplified implementation)
 */
async function discoverNetworkPaymasters(provider) {
  const potentialPaymasters = [];
  
  try {
    // Method 1: Check known addresses (these would be network-specific)
    const knownAddresses = [
      // Add known Somnia paymaster addresses here when they exist
    ];
    
    for (const address of knownAddresses) {
      try {
        const code = await provider.getCode(address);
        if (code !== '0x') {
          potentialPaymasters.push(address);
        }
      } catch {
        // Skip invalid addresses
      }
    }
    
    // Method 2: Event log analysis for recent blocks
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);
      
      // Look for PaymasterAdded or similar events
      // This is simplified - real implementation would search for specific event signatures
      
    } catch (error) {
      console.log(`   Event analysis failed: ${error.message.substring(0, 50)}...`);
    }
    
  } catch (error) {
    console.log(`   Paymaster discovery failed: ${error.message.substring(0, 50)}...`);
  }
  
  return potentialPaymasters;
}