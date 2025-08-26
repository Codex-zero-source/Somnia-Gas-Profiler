const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * Contract Compiler for Somnia Gas Profiler
 * Handles Solidity compilation using Foundry, Hardhat, or Solc
 */
class ContractCompiler {
  constructor() {
    this.foundryPath = process.env.FOUNDRY_PATH || 'forge';
    this.hardhatPath = process.env.HARDHAT_PATH || 'npx hardhat';
    this.optimizationRuns = process.env.DEFAULT_OPTIMIZATION_RUNS || 200;
  }

  /**
   * Compile Solidity source code
   * @param {string} sourceCode - Solidity source code
   * @param {string} contractName - Name of the contract to compile
   * @param {Object} options - Compilation options
   * @returns {Promise<Object>} Compilation result with bytecode and ABI
   */
  async compileSource(sourceCode, contractName, options = {}) {
    const tempDir = await this.createTempDirectory();
    
    try {
      // Write source to temporary file
      const sourceFile = path.join(tempDir, `${contractName}.sol`);
      await fs.writeFile(sourceFile, sourceCode, 'utf8');

      console.log(chalk.blue(`📝 Compiling ${contractName}.sol...`));

      // Try compilation methods in order of preference
      let result = await this.tryFoundryCompile(tempDir, contractName, options);
      
      if (!result) {
        console.log(chalk.yellow('⚠️  Foundry compilation failed, trying Hardhat...'));
        result = await this.tryHardhatCompile(tempDir, contractName, options);
      }

      if (!result) {
        console.log(chalk.yellow('⚠️  Hardhat compilation failed, trying direct Solc...'));
        result = await this.trySolcCompile(sourceFile, contractName, options);
      }

      if (!result) {
        throw new Error('All compilation methods failed');
      }

      console.log(chalk.green(`✅ Successfully compiled ${contractName}`));
      return result;

    } finally {
      // Clean up temporary directory
      await this.cleanupTempDirectory(tempDir);
    }
  }

  /**
   * Compile Solidity file
   * @param {string} filePath - Path to .sol file
   * @param {string} contractName - Name of contract (optional, inferred from file)
   * @param {Object} options - Compilation options
   * @returns {Promise<Object>} Compilation result
   */
  async compileFile(filePath, contractName = null, options = {}) {
    try {
      const sourceCode = await fs.readFile(filePath, 'utf8');
      
      if (!contractName) {
        contractName = this.extractContractName(sourceCode) || path.basename(filePath, '.sol');
      }

      return await this.compileSource(sourceCode, contractName, options);

    } catch (error) {
      throw new Error(`Failed to compile file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Try compiling with Foundry
   * @param {string} projectDir - Directory containing source files
   * @param {string} contractName - Contract name
   * @param {Object} options - Compilation options
   * @returns {Promise<Object|null>} Compilation result or null if failed
   */
  async tryFoundryCompile(projectDir, contractName, options) {
    try {
      // Create foundry.toml configuration
      const foundryConfig = `[profile.default]
src = "."
out = "out"
libs = []
optimizer = true
optimizer_runs = ${options.optimizationRuns || this.optimizationRuns}
solc_version = "${options.solcVersion || '0.8.19'}"
`;
      
      await fs.writeFile(path.join(projectDir, 'foundry.toml'), foundryConfig);

      // Run forge build
      const forgeArgs = ['build', '--force'];
      if (options.viaIR) {
        forgeArgs.push('--via-ir');
      }

      const result = await this.runCommand(this.foundryPath, forgeArgs, projectDir);
      
      if (result.code !== 0) {
        console.log(chalk.gray(`   Foundry error: ${result.stderr}`));
        return null;
      }

      // Read compiled artifacts
      const artifactPath = path.join(projectDir, 'out', `${contractName}.sol`, `${contractName}.json`);
      const artifactContent = await fs.readFile(artifactPath, 'utf8');
      const artifact = JSON.parse(artifactContent);

      return {
        bytecode: artifact.bytecode?.object || artifact.bytecode,
        abi: artifact.abi,
        compiler: 'foundry',
        metadata: artifact.metadata
      };

    } catch (error) {
      console.log(chalk.gray(`   Foundry compilation failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Try compiling with Hardhat
   * @param {string} projectDir - Directory containing source files
   * @param {string} contractName - Contract name
   * @param {Object} options - Compilation options
   * @returns {Promise<Object|null>} Compilation result or null if failed
   */
  async tryHardhatCompile(projectDir, contractName, options) {
    try {
      // Create hardhat.config.js
      const hardhatConfig = `require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "${options.solcVersion || '0.8.19'}",
    settings: {
      optimizer: {
        enabled: true,
        runs: ${options.optimizationRuns || this.optimizationRuns}
      }
    }
  },
  paths: {
    sources: ".",
    artifacts: "./artifacts"
  }
};`;

      await fs.writeFile(path.join(projectDir, 'hardhat.config.js'), hardhatConfig);

      // Create package.json for Hardhat
      const packageJson = {
        name: "temp-hardhat-project",
        version: "1.0.0",
        devDependencies: {
          "@nomicfoundation/hardhat-toolbox": "^3.0.2",
          "hardhat": "^2.17.1"
        }
      };
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Install dependencies and compile
      await this.runCommand('npm', ['install', '--silent'], projectDir);
      const result = await this.runCommand('npx', ['hardhat', 'compile'], projectDir);

      if (result.code !== 0) {
        console.log(chalk.gray(`   Hardhat error: ${result.stderr}`));
        return null;
      }

      // Read compiled artifacts
      const artifactPath = path.join(projectDir, 'artifacts', `${contractName}.sol`, `${contractName}.json`);
      const artifactContent = await fs.readFile(artifactPath, 'utf8');
      const artifact = JSON.parse(artifactContent);

      return {
        bytecode: artifact.bytecode,
        abi: artifact.abi,
        compiler: 'hardhat',
        metadata: artifact.metadata
      };

    } catch (error) {
      console.log(chalk.gray(`   Hardhat compilation failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Try compiling with direct Solc
   * @param {string} sourceFile - Path to source file
   * @param {string} contractName - Contract name
   * @param {Object} options - Compilation options
   * @returns {Promise<Object|null>} Compilation result or null if failed
   */
  async trySolcCompile(sourceFile, contractName, options) {
    try {
      const solcArgs = [
        '--combined-json', 'abi,bin',
        '--optimize',
        '--optimize-runs', (options.optimizationRuns || this.optimizationRuns).toString(),
        sourceFile
      ];

      const result = await this.runCommand('solc', solcArgs);

      if (result.code !== 0) {
        console.log(chalk.gray(`   Solc error: ${result.stderr}`));
        return null;
      }

      const output = JSON.parse(result.stdout);
      const contractKey = `${sourceFile}:${contractName}`;
      
      if (!output.contracts[contractKey]) {
        throw new Error(`Contract ${contractName} not found in compilation output`);
      }

      const contract = output.contracts[contractKey];

      return {
        bytecode: '0x' + contract.bin,
        abi: JSON.parse(contract.abi),
        compiler: 'solc',
        metadata: null
      };

    } catch (error) {
      console.log(chalk.gray(`   Solc compilation failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Extract contract name from source code
   * @param {string} sourceCode - Solidity source code
   * @returns {string|null} Contract name or null if not found
   */
  extractContractName(sourceCode) {
    const contractMatch = sourceCode.match(/contract\s+(\w+)/);
    return contractMatch ? contractMatch[1] : null;
  }

  /**
   * Create temporary directory for compilation
   * @returns {Promise<string>} Path to temporary directory
   */
  async createTempDirectory() {
    const tempDir = path.join(__dirname, '..', 'temp', `compile_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary directory
   * @param {string} tempDir - Directory to clean up
   */
  async cleanupTempDirectory(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Warning: Failed to clean up temporary directory: ${error.message}`));
    }
  }

  /**
   * Run command and return result
   * @param {string} command - Command to run
   * @param {Array<string>} args - Command arguments
   * @param {string} cwd - Working directory
   * @returns {Promise<Object>} Command result
   */
  async runCommand(command, args, cwd = process.cwd()) {
    return new Promise((resolve) => {
      const child = spawn(command, args, { 
        cwd, 
        stdio: 'pipe',
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        resolve({
          code: 1,
          stdout: '',
          stderr: error.message
        });
      });
    });
  }

  /**
   * Check if compilation tools are available
   * @returns {Promise<Object>} Available tools status
   */
  async checkAvailableTools() {
    const tools = {
      foundry: false,
      hardhat: false,
      solc: false
    };

    // Check Foundry
    try {
      const result = await this.runCommand(this.foundryPath, ['--version']);
      tools.foundry = result.code === 0;
    } catch (error) {
      tools.foundry = false;
    }

    // Check Hardhat
    try {
      const result = await this.runCommand('npx', ['hardhat', '--version']);
      tools.hardhat = result.code === 0;
    } catch (error) {
      tools.hardhat = false;
    }

    // Check Solc
    try {
      const result = await this.runCommand('solc', ['--version']);
      tools.solc = result.code === 0;
    } catch (error) {
      tools.solc = false;
    }

    return tools;
  }

  /**
   * Display available compilation tools
   */
  async displayAvailableTools() {
    console.log(chalk.blue('🔧 Checking available compilation tools...'));
    const tools = await this.checkAvailableTools();

    console.log(chalk.gray('Available compilers:'));
    console.log(`   ${tools.foundry ? chalk.green('✅') : chalk.red('❌')} Foundry (forge)`);
    console.log(`   ${tools.hardhat ? chalk.green('✅') : chalk.red('❌')} Hardhat`);
    console.log(`   ${tools.solc ? chalk.green('✅') : chalk.red('❌')} Solc`);

    if (!tools.foundry && !tools.hardhat && !tools.solc) {
      console.log(chalk.yellow('⚠️  No compilation tools found. Install Foundry, Hardhat, or Solc to compile contracts.'));
    }
  }
}

module.exports = {
  ContractCompiler
};