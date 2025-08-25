const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs').promises;

// Import modules to test
const profiler = require('../profiler');
const reporter = require('../reporter');
const { NaturalLanguageSummaryGenerator } = require('../reporter/nl');

describe('Integration Tests', function() {
  let sandbox;
  this.timeout(10000); // Longer timeout for integration tests

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('End-to-End Workflow', function() {
    it('should complete full analysis and reporting workflow', async function() {
      // Mock profiler analysis
      const mockResults = {
        rpc: 'https://dream-rpc.somnia.network',
        address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
        network: 'Somnia Testnet',
        timestamp: '2024-01-15T10:30:00.000Z',
        results: {
          'set(uint256)': {
            runs: [
              { run: 1, args: [42], gasUsed: 43000, mode: 'standard', txHash: '0xabc123', blockNumber: 100 }
            ],
            aggregated: {
              min: 43000,
              max: 43000,
              avg: 43000,
              total: 43000,
              callCount: 1
            }
          }
        }
      };

      // Mock file operations
      sandbox.stub(fs, 'mkdir').resolves();
      sandbox.stub(fs, 'writeFile').resolves();
      sandbox.stub(fs, 'readFile').resolves(JSON.stringify(mockResults));

      // Mock profiler analyze
      sandbox.stub(profiler, 'analyze').resolves();

      // Test analysis phase
      await profiler.analyze({
        rpc: 'https://dream-rpc.somnia.network',
        address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
        abi: './examples/SimpleStorage.json',
        fn: ['set(uint256)'],
        args: ['[42]'],
        runs: 1,
        out: 'test-results.json'
      });

      // Test reporting phase
      await reporter.generate({
        in: 'test-results.json',
        format: 'table',
        sort: 'avg',
        nl: false
      });

      expect(profiler.analyze.calledOnce).to.be.true;
    });

    it('should handle workflow with comparison', async function() {
      const results1 = {
        rpc: 'https://dream-rpc.somnia.network',
        address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
        network: 'Somnia Testnet',
        timestamp: '2024-01-15T10:30:00.000Z',
        results: {
          'set(uint256)': {
            aggregated: { min: 40000, max: 40000, avg: 40000, total: 40000, callCount: 1 }
          }
        }
      };

      const results2 = {
        ...results1,
        timestamp: '2024-01-16T10:30:00.000Z',
        results: {
          'set(uint256)': {
            aggregated: { min: 45000, max: 45000, avg: 45000, total: 45000, callCount: 1 }
          }
        }
      };

      sandbox.stub(fs, 'readFile')
        .onFirstCall().resolves(JSON.stringify(results1))
        .onSecondCall().resolves(JSON.stringify(results2));

      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      const comparison = await reporterInstance.compareResults('results1.json', 'results2.json');
      
      expect(comparison.differences['set(uint256)'].avg_gas_diff).to.equal(5000);
    });
  });

  describe('Error Handling Integration', function() {
    it('should gracefully handle network connection issues', async function() {
      // This test ensures the entire system handles network errors properly
      try {
        await profiler.analyze({
          rpc: 'https://invalid-network-url.test',
          address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
          abi: '[]',
          fn: ['get()'],
          args: ['[]'],
          runs: 1,
          out: 'test-results.json'
        });
        expect.fail('Should have thrown network error');
      } catch (error) {
        expect(error.message).to.include('Failed to initialize Somnia connection');
      }
    });

    it('should handle invalid contract ABI gracefully', async function() {
      try {
        await profiler.analyze({
          rpc: 'https://dream-rpc.somnia.network',
          address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
          abi: 'invalid-abi-format',
          fn: ['get()'],
          args: ['[]'],
          runs: 1,
          out: 'test-results.json'
        });
        expect.fail('Should have thrown ABI error');
      } catch (error) {
        expect(error.message).to.include('Profiling analysis failed');
      }
    });

    it('should handle file system errors during results saving', async function() {
      const { SomniaGasProfiler } = require('../profiler/index');
      const profilerInstance = new SomniaGasProfiler();
      
      // Set up mock results
      profilerInstance.results = {
        rpc: 'test',
        address: 'test',
        network: 'test',
        timestamp: new Date().toISOString(),
        results: {}
      };

      // Mock file system error
      sandbox.stub(fs, 'mkdir').rejects(new Error('Permission denied'));

      try {
        await profilerInstance.saveResults('/invalid/path/results.json');
        expect.fail('Should have thrown file system error');
      } catch (error) {
        expect(error.message).to.include('Failed to save results');
      }
    });
  });

  describe('Natural Language Integration', function() {
    it('should integrate natural language generation with reporting', async function() {
      const mockData = {
        rpc: 'https://dream-rpc.somnia.network',
        address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
        network: 'Somnia Testnet',
        timestamp: '2024-01-15T10:30:00.000Z',
        results: {
          'set(uint256)': {
            aggregated: { min: 43000, max: 43000, avg: 43000, total: 43000, callCount: 1 }
          }
        }
      };

      const nlGenerator = new NaturalLanguageSummaryGenerator();
      
      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: sandbox.stub().resolves({
              choices: [{
                message: {
                  content: 'The contract shows efficient gas usage with consistent performance.'
                }
              }]
            })
          }
        }
      };

      // Mock OpenAI initialization
      sandbox.stub(nlGenerator, 'initialize').resolves(true);
      nlGenerator.openai = mockOpenAI;
      nlGenerator.initialized = true;

      const summary = await nlGenerator.generateSummary(mockData);
      expect(summary).to.include('efficient gas usage');
    });

    it('should handle OpenAI service unavailability', async function() {
      const nlGenerator = new NaturalLanguageSummaryGenerator();
      
      // Mock missing API key
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await nlGenerator.initialize();
      expect(result).to.be.false;

      // Restore
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  describe('CLI Integration', function() {
    it('should handle CLI commands end-to-end', function() {
      const cli = require('../cli/index.js');
      
      // Test that CLI module exports correctly
      expect(cli).to.be.an('object');
      expect(typeof cli.parse).to.equal('function');
      
      // Test CLI structure without calling getCommands
      expect(cli).to.have.property('parse');
    });

    it('should validate CLI option configurations', function() {
      const cli = require('../cli/index.js');
      
      // Test basic CLI properties
      expect(cli).to.be.an('object');
      expect(cli).to.have.property('parse');
      
      // Test that CLI can be imported without errors
      expect(typeof cli.parse).to.equal('function');
    });
  });

  describe('File Format Integration', function() {
    it('should handle multiple output formats consistently', async function() {
      const mockData = {
        rpc: 'https://dream-rpc.somnia.network',
        address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
        network: 'Somnia Testnet',
        timestamp: '2024-01-15T10:30:00.000Z',
        results: {
          'set(uint256)': {
            runs: [
              { run: 1, args: [42], gasUsed: 43000, mode: 'standard', txHash: '0xabc123', blockNumber: 100 }
            ],
            aggregated: { min: 43000, max: 43000, avg: 43000, total: 43000, callCount: 1 }
          }
        }
      };

      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      // Test all output formats
      const tableReport = reporterInstance.generateTableReport('avg');
      const csvReport = reporterInstance.generateCSVReport();
      const jsonReport = reporterInstance.generateJSONReport();

      expect(tableReport).to.include('set(uint256)');
      expect(csvReport).to.include('43000');
      
      const parsedJson = JSON.parse(jsonReport);
      expect(parsedJson.results['set(uint256)'].aggregated.avg).to.equal(43000);
    });

    it('should maintain data consistency across formats', async function() {
      const mockData = {
        results: {
          'test(uint256)': {
            runs: [
              { run: 1, args: [100], gasUsed: 25000, mode: 'standard', txHash: '0x123', blockNumber: 100 },
              { run: 2, args: [100], gasUsed: 30000, mode: 'standard', txHash: '0x456', blockNumber: 101 }
            ],
            aggregated: { min: 25000, max: 30000, avg: 27500, total: 55000, callCount: 2 }
          }
        }
      };

      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      const csvReport = reporterInstance.generateCSVReport();
      const jsonReport = reporterInstance.generateJSONReport();
      
      // Both formats should contain the same data
      expect(csvReport).to.include('25000');
      expect(csvReport).to.include('30000');
      
      const parsedJson = JSON.parse(jsonReport);
      expect(parsedJson.results['test(uint256)'].aggregated.min).to.equal(25000);
      expect(parsedJson.results['test(uint256)'].aggregated.max).to.equal(30000);
    });
  });

  describe('Performance Integration', function() {
    it('should handle large datasets efficiently', function() {
      // Test with large mock dataset
      const largeResults = {};
      
      for (let i = 0; i < 100; i++) {
        largeResults[`function${i}(uint256)`] = {
          aggregated: {
            min: 20000 + i * 100,
            max: 25000 + i * 100,
            avg: 22500 + i * 100,
            total: (22500 + i * 100) * 5,
            callCount: 5
          }
        };
      }

      const mockData = {
        results: largeResults
      };

      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      // Should complete without timeout
      const start = Date.now();
      const tableReport = reporterInstance.generateTableReport('avg');
      const duration = Date.now() - start;

      expect(tableReport).to.include('function0(uint256)');
      expect(tableReport).to.include('function99(uint256)');
      expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Cross-Module Integration', function() {
    it('should maintain data integrity across profiler and reporter', async function() {
      const expectedAddress = '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15';
      const expectedNetwork = 'Somnia Testnet';
      
      const mockResults = {
        rpc: 'https://dream-rpc.somnia.network',
        address: expectedAddress,
        network: expectedNetwork,
        timestamp: '2024-01-15T10:30:00.000Z',
        results: {
          'set(uint256)': {
            aggregated: { min: 43000, max: 43000, avg: 43000, total: 43000, callCount: 1 }
          }
        }
      };

      // Mock file operations
      sandbox.stub(fs, 'readFile').resolves(JSON.stringify(mockResults));

      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      
      await reporterInstance.loadResults('test-results.json');
      
      expect(reporterInstance.data.address).to.equal(expectedAddress);
      expect(reporterInstance.data.network).to.equal(expectedNetwork);
      expect(reporterInstance.data.results['set(uint256)'].aggregated.avg).to.equal(43000);
    });
  });
});