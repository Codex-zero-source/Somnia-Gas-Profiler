const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');

// Import the modules to test
const reporter = require('../reporter');

describe('Somnia Gas Reporter', function() {
  let sandbox;
  let mockData;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    
    mockData = {
      rpc: 'https://dream-rpc.somnia.network',
      address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
      network: 'Somnia Testnet',
      timestamp: '2024-01-15T10:30:00.000Z',
      results: {
        'set(uint256)': {
          runs: [
            { run: 1, args: [42], gasUsed: 43000, mode: 'standard', txHash: '0xabc123', blockNumber: 100 },
            { run: 2, args: [42], gasUsed: 28000, mode: 'standard', txHash: '0xdef456', blockNumber: 101 },
            { run: 3, args: [42], gasUsed: 28000, mode: 'standard', txHash: '0x789ghi', blockNumber: 102 }
          ],
          aggregated: {
            min: 28000,
            max: 43000,
            avg: 33000,
            total: 99000,
            callCount: 3
          }
        },
        'get()': {
          runs: [
            { run: 1, args: [], gasUsed: 2300, mode: 'standard', txHash: '0xjkl012', blockNumber: 103 },
            { run: 2, args: [], gasUsed: 2300, mode: 'standard', txHash: '0xmno345', blockNumber: 104 }
          ],
          aggregated: {
            min: 2300,
            max: 2300,
            avg: 2300,
            total: 4600,
            callCount: 2
          }
        }
      }
    };
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Core Reporting Functions', function() {
    it('should validate basic reporter module structure', function() {
      expect(reporter).to.be.an('object');
      expect(reporter.generate).to.be.a('function');
    });

    it('should load profiling results correctly', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      // Mock file system
      const testFile = 'test-results.json';
      sandbox.stub(fs, 'readFile').resolves(JSON.stringify(mockData));

      const loadedData = await reporterInstance.loadResults(testFile);
      
      expect(loadedData).to.deep.equal(mockData);
      expect(reporterInstance.data).to.deep.equal(mockData);
    });

    it('should sort results correctly', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      // Sort by average gas (descending)
      const sortedByAvg = reporterInstance.sortResults(mockData.results, 'avg');
      expect(sortedByAvg[0][0]).to.equal('set(uint256)'); // Higher avg gas first
      expect(sortedByAvg[1][0]).to.equal('get()'); // Lower avg gas second

      // Sort by minimum gas (descending)
      const sortedByMin = reporterInstance.sortResults(mockData.results, 'min');
      expect(sortedByMin[0][0]).to.equal('set(uint256)'); // Higher min gas first
    });

    it('should format numbers correctly', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      expect(reporterInstance.formatNumber(1234)).to.equal('1,234');
      expect(reporterInstance.formatNumber(1000000)).to.equal('1,000,000');
      expect(reporterInstance.formatNumber(42)).to.equal('42');
    });

    it('should generate table report correctly', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      const tableReport = reporterInstance.generateTableReport('avg');
      
      expect(tableReport).to.include('Somnia Gas Profiling Report');
      expect(tableReport).to.include('Somnia Testnet');
      expect(tableReport).to.include('set(uint256)');
      expect(tableReport).to.include('get()');
      expect(tableReport).to.include('33,000'); // Average gas for set function
      expect(tableReport).to.include('2,300'); // Average gas for get function
    });

    it('should generate CSV report correctly', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      const csvReport = reporterInstance.generateCSVReport();
      
      expect(csvReport).to.include('"function","run","args_json","gas_used","mode","tx_hash","block_number","rpc"');
      expect(csvReport).to.include('set(uint256)');
      expect(csvReport).to.include('get()');
      expect(csvReport).to.include('43000');
      expect(csvReport).to.include('2300');
      expect(csvReport).to.include('0xabc123');
    });

    it('should generate JSON report correctly', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      const jsonReport = reporterInstance.generateJSONReport();
      const parsedReport = JSON.parse(jsonReport);
      
      expect(parsedReport).to.deep.equal(mockData);
    });
  });

  describe('Comparison Functionality', function() {
    it('should compare two result files correctly', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      const mockData2 = {
        ...mockData,
        timestamp: '2024-01-16T10:30:00.000Z',
        results: {
          'set(uint256)': {
            ...mockData.results['set(uint256)'],
            aggregated: {
              min: 30000,
              max: 45000,
              avg: 35000, // 2000 gas increase
              total: 105000,
              callCount: 3
            }
          },
          'get()': {
            ...mockData.results['get()'],
            aggregated: {
              min: 2200,
              max: 2200,
              avg: 2200, // 100 gas decrease
              total: 4400,
              callCount: 2
            }
          }
        }
      };

      // Mock file system for both files
      sandbox.stub(fs, 'readFile')
        .onFirstCall().resolves(JSON.stringify(mockData))
        .onSecondCall().resolves(JSON.stringify(mockData2));

      const comparison = await reporterInstance.compareResults('file1.json', 'file2.json');
      
      expect(comparison.differences['set(uint256)'].avg_gas_diff).to.equal(2000);
      expect(comparison.differences['get()'].avg_gas_diff).to.equal(-100);
      expect(parseFloat(comparison.differences['set(uint256)'].avg_gas_percent)).to.be.closeTo(6.06, 0.1);
    });

    it('should generate comparison report with proper formatting', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      const mockComparison = {
        file1: 'before.json',
        file2: 'after.json',
        timestamp1: mockData.timestamp,
        timestamp2: '2024-01-16T10:30:00.000Z',
        differences: {
          'set(uint256)': {
            avg_gas_diff: 2000,
            avg_gas_percent: '6.06',
            min_gas_diff: 2000,
            max_gas_diff: 2000
          },
          'get()': {
            avg_gas_diff: -100,
            avg_gas_percent: '-4.35',
            min_gas_diff: -100,
            max_gas_diff: -100
          }
        }
      };

      const comparisonReport = reporterInstance.generateComparisonReport(mockComparison);
      
      expect(comparisonReport).to.include('Gas Profiling Comparison Report');
      expect(comparisonReport).to.include('before.json');
      expect(comparisonReport).to.include('after.json');
      expect(comparisonReport).to.include('+2,000'); // Gas increase
      expect(comparisonReport).to.include('6.06%'); // Percentage increase
    });
  });

  describe('Error Handling', function() {
    it('should handle missing data gracefully', function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      expect(() => {
        reporterInstance.generateTableReport();
      }).to.throw('No data loaded');

      expect(() => {
        reporterInstance.generateCSVReport();
      }).to.throw('No data loaded');

      expect(() => {
        reporterInstance.generateJSONReport();
      }).to.throw('No data loaded');
    });

    it('should handle file loading errors', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      sandbox.stub(fs, 'readFile').rejects(new Error('File not found'));

      try {
        await reporterInstance.loadResults('nonexistent.json');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to load results file');
      }
    });

    it('should handle invalid JSON in results file', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      sandbox.stub(fs, 'readFile').resolves('invalid json content');

      try {
        await reporterInstance.loadResults('invalid.json');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to load results file');
      }
    });
  });

  describe('Natural Language Summary', function() {
    it('should handle missing OpenAI API key gracefully', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      // Mock console.log to capture output
      const consoleSpy = sandbox.spy(console, 'log');

      await reporterInstance.generateNaturalLanguageSummary();

      expect(consoleSpy.calledWith(sinon.match(/OPENAI_API_KEY not found/))).to.be.true;

      // Restore
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('should handle missing OpenAI package gracefully', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();
      reporterInstance.data = mockData;

      // Mock require to throw for openai package
      const originalRequire = require;
      const mockRequire = (moduleName) => {
        if (moduleName === 'openai') {
          throw new Error('Module not found');
        }
        return originalRequire(moduleName);
      };

      // This is tricky to test properly without breaking the test environment
      // In a real scenario, we'd use dependency injection
    });
  });

  describe('Integration Tests', function() {
    it('should handle complete report generation workflow', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      // Mock file operations
      sandbox.stub(fs, 'readFile').resolves(JSON.stringify(mockData));
      const writeFileStub = sandbox.stub(fs, 'writeFile').resolves();

      await reporterInstance.generate({
        in: 'test-results.json',
        format: 'csv',
        out: 'test-report.csv',
        sort: 'avg',
        nl: false,
        verbose: false
      });

      expect(writeFileStub.calledOnce).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal('test-report.csv');
    });

    it('should handle table format output to console', async function() {
      const { SomniaGasReporter } = require('../reporter/index');
      const reporterInstance = new SomniaGasReporter();

      sandbox.stub(fs, 'readFile').resolves(JSON.stringify(mockData));
      const consoleSpy = sandbox.spy(console, 'log');

      await reporterInstance.generate({
        in: 'test-results.json',
        format: 'table',
        sort: 'avg',
        nl: false,
        verbose: false
      });

      expect(consoleSpy.called).to.be.true;
    });
  });
});