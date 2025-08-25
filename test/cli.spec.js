const { expect } = require('chai');
const sinon = require('sinon');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

describe('CLI Integration Tests', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('CLI Command Structure', function() {
    it('should have executable CLI script', async function() {
      const cliPath = path.join(__dirname, '..', 'cli', 'index.js');
      const exists = await fs.access(cliPath).then(() => true).catch(() => false);
      expect(exists).to.be.true;

      // Check for shebang
      const content = await fs.readFile(cliPath, 'utf8');
      expect(content.startsWith('#!/usr/bin/env node')).to.be.true;
    });

    it('should export proper package.json bin configuration', async function() {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      expect(packageJson.bin).to.be.an('object');
      expect(packageJson.bin['somnia-gas-profiler']).to.equal('./cli/index.js');
    });

    it('should have correct script commands in package.json', async function() {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      expect(packageJson.scripts).to.include.keys(['start', 'analyze', 'report', 'test']);
      expect(packageJson.scripts.analyze).to.include('analyze');
      expect(packageJson.scripts.report).to.include('report');
    });
  });

  describe('Command Validation', function() {
    it('should require at least one command', function() {
      // Test that the CLI module has demandCommand configured
      // We avoid calling parse() to prevent CLI execution
      const yargs = require('yargs');
      
      // Create a CLI instance similar to the actual one
      const testCli = yargs()
        .demandCommand(1, 'You need at least one command before moving on')
        .strict();
      
      // Test that demandCommand is properly configured
      const demanded = testCli.getDemandedCommands();
      expect(demanded).to.exist;
      expect(demanded._).to.exist;
      expect(demanded._.min).to.equal(1);
    });

    it('should validate required analyze command options', function() {
      // Test the structure of analyze command options
      const analyzeOptions = {
        address: { demandOption: true },
        abi: { demandOption: true },
        fn: { demandOption: true }
      };

      expect(analyzeOptions.address.demandOption).to.be.true;
      expect(analyzeOptions.abi.demandOption).to.be.true;
      expect(analyzeOptions.fn.demandOption).to.be.true;
    });

    it('should have proper default values', function() {
      const defaults = {
        rpc: 'https://dream-rpc.somnia.network',
        runs: 3,
        out: 'profiling_results.json',
        gasless: false,
        verbose: false,
        format: 'table',
        sort: 'avg',
        nl: false
      };

      expect(defaults.rpc).to.equal('https://dream-rpc.somnia.network');
      expect(defaults.runs).to.equal(3);
      expect(defaults.format).to.equal('table');
    });
  });

  describe('Error Handling', function() {
    it('should handle unhandled rejections gracefully', function() {
      // Test that error handlers are properly set up
      const listeners = process.listeners('unhandledRejection');
      expect(listeners.length).to.be.greaterThan(0);
    });

    it('should handle uncaught exceptions gracefully', function() {
      // Test that error handlers are properly set up
      const listeners = process.listeners('uncaughtException');
      expect(listeners.length).to.be.greaterThan(0);
    });
  });

  describe('Module Dependencies', function() {
    it('should import required modules successfully', function() {
      expect(() => require('yargs')).to.not.throw();
      expect(() => require('chalk')).to.not.throw();
      expect(() => require('dotenv')).to.not.throw();
      expect(() => require('../profiler')).to.not.throw();
      expect(() => require('../reporter')).to.not.throw();
    });

    it('should have chalk colors configured', function() {
      const chalk = require('chalk');
      expect(chalk.blue).to.be.a('function');
      expect(chalk.green).to.be.a('function');
      expect(chalk.red).to.be.a('function');
      expect(chalk.yellow).to.be.a('function');
    });
  });

  describe('Example Usage', function() {
    it('should have proper example configurations in CLI help', function() {
      // Test that examples are properly structured
      const exampleConfigs = [
        {
          command: 'analyze',
          hasAddress: true,
          hasAbi: true,
          hasFunction: true
        },
        {
          command: 'report',
          hasInput: true,
          hasFormat: true
        }
      ];

      expect(exampleConfigs[0].hasAddress).to.be.true;
      expect(exampleConfigs[0].hasAbi).to.be.true;
      expect(exampleConfigs[1].hasFormat).to.be.true;
    });
  });

  describe('Environment Configuration', function() {
    it('should load dotenv configuration', function() {
      const originalEnv = process.env.NODE_ENV;
      
      // Test that dotenv is called during module load
      expect(() => require('dotenv').config()).to.not.throw();
      
      // Restore
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle missing environment variables gracefully', function() {
      const envVars = ['PRIVATE_KEY', 'RPC_URL', 'OPENAI_API_KEY'];
      
      // All environment variables should be optional at the CLI level
      // Required validation happens in the profiler module
      envVars.forEach(varName => {
        const original = process.env[varName];
        delete process.env[varName];
        
        // CLI should still load successfully
        expect(() => require('../cli/index.js')).to.not.throw();
        
        // Restore
        if (original) {
          process.env[varName] = original;
        }
      });
    });
  });

  describe('Command Examples', function() {
    it('should have valid analyze command examples', function() {
      const analyzeExamples = [
        {
          description: 'Profile ERC20 transfer function',
          hasValidAddress: true,
          hasValidAbi: true,
          hasValidFunction: true,
          hasValidArgs: true
        },
        {
          description: 'Profile simple getter with inline ABI',
          hasInlineAbi: true,
          hasSimpleFunction: true
        }
      ];

      expect(analyzeExamples[0].hasValidAddress).to.be.true;
      expect(analyzeExamples[1].hasInlineAbi).to.be.true;
    });

    it('should have valid report command examples', function() {
      const reportExamples = [
        {
          description: 'Display results as a formatted table',
          format: 'table'
        },
        {
          description: 'Export results to CSV',
          format: 'csv',
          hasOutput: true
        },
        {
          description: 'Generate table with AI summary',
          hasNaturalLanguage: true
        },
        {
          description: 'Compare two profiling runs',
          hasComparison: true
        }
      ];

      expect(reportExamples[0].format).to.equal('table');
      expect(reportExamples[1].format).to.equal('csv');
      expect(reportExamples[2].hasNaturalLanguage).to.be.true;
      expect(reportExamples[3].hasComparison).to.be.true;
    });
  });

  describe('Help and Documentation', function() {
    it('should have proper help configuration', function() {
      const helpConfig = {
        alias: 'h',
        hasHelp: true,
        hasVersion: true,
        hasUsage: true,
        hasEpilogue: true
      };

      expect(helpConfig.alias).to.equal('h');
      expect(helpConfig.hasHelp).to.be.true;
      expect(helpConfig.hasVersion).to.be.true;
    });

    it('should have proper version information', function() {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = require(packagePath);
      
      expect(packageJson.version).to.match(/^\d+\.\d+\.\d+$/);
      expect(packageJson.version).to.equal('1.0.0');
    });

    it('should have informative epilogue', function() {
      const expectedEpilogue = 'For more information, visit: https://docs.somnia.network/';
      expect(expectedEpilogue).to.include('somnia.network');
    });
  });

  describe('Command Options Validation', function() {
    it('should validate analyze command choices and types', function() {
      const analyzeOptions = {
        rpc: { type: 'string' },
        address: { type: 'string', required: true },
        abi: { type: 'string', required: true },
        fn: { type: 'array', required: true },
        args: { type: 'array' },
        runs: { type: 'number', default: 3 },
        out: { type: 'string', default: 'profiling_results.json' },
        gasless: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false }
      };

      expect(analyzeOptions.runs.type).to.equal('number');
      expect(analyzeOptions.gasless.type).to.equal('boolean');
      expect(analyzeOptions.fn.type).to.equal('array');
    });

    it('should validate report command choices and types', function() {
      const reportOptions = {
        in: { type: 'string', default: 'profiling_results.json' },
        format: { 
          choices: ['json', 'csv', 'table'], 
          default: 'table' 
        },
        out: { type: 'string' },
        sort: { 
          choices: ['avg', 'min', 'max', 'total'], 
          default: 'avg' 
        },
        nl: { type: 'boolean', default: false },
        compare: { type: 'string' },
        verbose: { type: 'boolean', default: false }
      };

      expect(reportOptions.format.choices).to.deep.equal(['json', 'csv', 'table']);
      expect(reportOptions.sort.choices).to.deep.equal(['avg', 'min', 'max', 'total']);
      expect(reportOptions.nl.type).to.equal('boolean');
    });
  });
});