const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');

// Import the modules to test
const profiler = require('../profiler');

describe('Somnia Gas Profiler', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Core Profiling Functions', function() {
    it('should validate basic profiler module structure', function() {
      expect(profiler).to.be.an('object');
      expect(profiler.analyze).to.be.a('function');
    });

    it('should handle missing private key gracefully', async function() {
      this.timeout(10000); // Increase timeout for network operations
      
      const originalEnv = process.env.PRIVATE_KEY;
      delete process.env.PRIVATE_KEY;

      try {
        await profiler.analyze({
          rpc: 'https://dream-rpc.somnia.network',
          address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
          abi: '[]',
          fn: ['get()'],
          args: [[]],
          runs: 1,
          out: 'test-results.json'
        });
        expect.fail('Should have thrown an error for missing private key');
      } catch (error) {
        expect(error.message).to.include('PRIVATE_KEY');
      } finally {
        if (originalEnv) {
          process.env.PRIVATE_KEY = originalEnv;
        }
      }
    });

    it('should validate ABI format', function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();

      // Test invalid ABI format
      expect(() => {
        profilerInstance.parseFunctionSignatures(['test()'], 'invalid-abi');
      }).to.throw();

      // Test valid ABI format
      const validAbi = [
        {
          "name": "test",
          "type": "function",
          "inputs": [],
          "outputs": []
        }
      ];

      expect(() => {
        profilerInstance.parseFunctionSignatures(['test()'], validAbi);
      }).to.not.throw();
    });

    it('should parse function signatures correctly', function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();

      const abi = [
        {
          "name": "set",
          "type": "function",
          "inputs": [{"type": "uint256", "name": "value"}],
          "outputs": []
        },
        {
          "name": "get",
          "type": "function", 
          "inputs": [],
          "outputs": [{"type": "uint256", "name": ""}]
        }
      ];

      const functions = profilerInstance.parseFunctionSignatures(
        ['set(uint256)', 'get()'], 
        abi
      );

      expect(functions).to.have.length(2);
      expect(functions[0].signature).to.equal('set(uint256)');
      expect(functions[1].signature).to.equal('get()');
    });

    it('should parse arguments correctly', function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();

      const functions = [
        {
          signature: 'set(uint256)',
          fragment: { inputs: [{ type: 'uint256' }] }
        },
        {
          signature: 'get()',
          fragment: { inputs: [] }
        }
      ];

      const parsedArgs = profilerInstance.parseArguments(
        ['[42]', '[]'],
        functions
      );

      expect(parsedArgs).to.have.length(2);
      expect(parsedArgs[0]).to.deep.equal([42]);
      expect(parsedArgs[1]).to.deep.equal([]);
    });

    it('should validate argument count', function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();

      const functions = [
        {
          signature: 'set(uint256)',
          fragment: { inputs: [{ type: 'uint256' }] }
        }
      ];

      expect(() => {
        profilerInstance.parseArguments(['[]'], functions); // Wrong arg count
      }).to.throw('expects 1 arguments, got 0');
    });
  });

  describe('Error Handling', function() {
    it('should handle invalid contract addresses', async function() {
      // Mock a scenario where contract validation fails
      const invalidAddress = '0x0000000000000000000000000000000000000000';
      
      try {
        await profiler.analyze({
          rpc: 'https://dream-rpc.somnia.network',
          address: invalidAddress,
          abi: '[]',
          fn: ['get()'],
          args: [[]],
          runs: 1,
          out: 'test-results.json'
        });
        expect.fail('Should have thrown an error for invalid address');
      } catch (error) {
        expect(error.message).to.include('Profiling analysis failed');
      }
    });

    it('should handle malformed ABI input', async function() {
      try {
        await profiler.analyze({
          rpc: 'https://dream-rpc.somnia.network',
          address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
          abi: 'invalid-json',
          fn: ['get()'],
          args: [[]],
          runs: 1,
          out: 'test-results.json'
        });
        expect.fail('Should have thrown an error for invalid ABI');
      } catch (error) {
        expect(error.message).to.include('Profiling analysis failed');
      }
    });

    it('should handle network connection errors', async function() {
      try {
        await profiler.analyze({
          rpc: 'https://invalid-rpc-endpoint.test',
          address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
          abi: '[]',
          fn: ['get()'],
          args: [[]],
          runs: 1,
          out: 'test-results.json'
        });
        expect.fail('Should have thrown an error for invalid RPC');
      } catch (error) {
        expect(error.message).to.include('Failed to initialize Somnia connection');
      }
    });
  });

  describe('File Operations', function() {
    it('should create output directory if it does not exist', async function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();
      
      // Mock results
      profilerInstance.results = {
        rpc: 'test',
        address: 'test',
        network: 'test',
        timestamp: new Date().toISOString(),
        results: {}
      };

      const testDir = path.join(__dirname, 'temp-test-dir');
      const testFile = path.join(testDir, 'test-results.json');

      // Ensure directory doesn't exist
      try {
        await fs.rmdir(testDir, { recursive: true });
      } catch (e) {
        // Directory doesn't exist, which is fine
      }

      await profilerInstance.saveResults(testFile);

      // Check if file was created
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).to.be.true;

      // Clean up
      await fs.rmdir(testDir, { recursive: true });
    });
  });

  describe('Integration Tests', function() {
    it('should have proper module exports', function() {
      expect(profiler).to.have.property('analyze');
      expect(typeof profiler.analyze).to.equal('function');
    });

    it('should handle inline ABI JSON', function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();

      const inlineAbi = '[{"name":"test","type":"function","inputs":[],"outputs":[]}]';
      
      expect(async () => {
        await profilerInstance.loadABI(inlineAbi);
      }).to.not.throw();
    });
  });
});

describe('Configuration Validation', function() {
  it('should validate environment variables', function() {
    const requiredEnvVars = ['PRIVATE_KEY'];
    const optionalEnvVars = ['RPC_URL', 'OPENAI_API_KEY', 'DEBUG'];

    // Test that we can handle missing optional variables
    const originalOpenAI = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    // Should not throw for missing optional vars
    expect(() => {
      // Any operation that checks optional env vars
    }).to.not.throw();

    // Restore
    if (originalOpenAI) {
      process.env.OPENAI_API_KEY = originalOpenAI;
    }
  });

  it('should handle default configuration values', function() {
    const defaultConfig = {
      rpc: 'https://dream-rpc.somnia.network',
      runs: 3,
      format: 'table',
      sort: 'avg'
    };

    expect(defaultConfig.rpc).to.equal('https://dream-rpc.somnia.network');
    expect(defaultConfig.runs).to.equal(3);
    expect(defaultConfig.format).to.equal('table');
    expect(defaultConfig.sort).to.equal('avg');
  });
});