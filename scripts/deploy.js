#!/usr/bin/env node

/**
 * Contract Deployment Helper for Somnia Gas Profiler
 * Provides utilities to deploy example contracts for testing
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
require('dotenv').config();

class ContractDeployment {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.deployedContracts = {};
  }

  async initialize() {
    try {
      // Initialize provider
      const rpcUrl = process.env.RPC_URL || 'https://dream-rpc.somnia.network';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(chalk.green(`✅ Connected to network: ${network.name || 'Unknown'} (Chain ID: ${network.chainId})`));
      
      // Initialize wallet
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY environment variable is required');
      }
      
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(chalk.blue(`💰 Deployer: ${this.wallet.address} (Balance: ${ethers.formatEther(balance)} ETH)`));
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Initialization failed: ${error.message}`));
      return false;
    }
  }

  async deployContract(contractName, constructorArgs = [], bytecode = null) {
    try {
      console.log(chalk.blue(`🚀 Deploying ${contractName}...`));
      
      // Load bytecode if not provided
      if (!bytecode) {
        bytecode = await this.loadBytecode(contractName);
      }
      
      // Create contract factory
      const factory = new ethers.ContractFactory(
        [], // ABI not needed for deployment
        bytecode,
        this.wallet
      );
      
      // Deploy contract
      const contract = await factory.deploy(...constructorArgs);
      await contract.waitForDeployment();
      
      const address = await contract.getAddress();
      console.log(chalk.green(`✅ ${contractName} deployed at: ${address}`));
      
      // Store deployment info
      this.deployedContracts[contractName] = {
        address,
        constructorArgs,
        deploymentBlock: await this.provider.getBlockNumber(),
        deploymentTx: contract.deploymentTransaction().hash
      };
      
      return address;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to deploy ${contractName}: ${error.message}`));
      throw error;
    }
  }

  async loadBytecode(contractName) {
    // This is a placeholder - in real scenario, you'd compile contracts or load pre-compiled bytecode
    // For this example, we'll provide simple bytecode for basic contracts
    
    const bytecodes = {
      'SimpleStorage': '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100d9565b60405180910390f35b610073600480360381019061006e919061009d565b61007e565b005b60008054905090565b8060008190555050565b60008135905061009781610103565b92915050565b6000602082840312156100b3576100b26100fe565b5b60006100c184828501610088565b91505092915050565b6100d3816100f4565b82525050565b60006020820190506100ee60008301846100ca565b92915050565b6000819050919050565b600080fd5b61010c816100f4565b811461011757600080fd5b5056fea2646970667358221220a101a9d6b3b8e1b8e1b8e1b8e1b8e1b8e1b8e1b8e1b8e1b8e1b8e1b8e164736f6c63430008070033',
      
      // Note: In a real implementation, you would:
      // 1. Use Hardhat/Truffle to compile contracts
      // 2. Store compiled artifacts
      // 3. Load bytecode from compilation output
      // For demo purposes, we'll use a simple storage contract bytecode
    };
    
    if (bytecodes[contractName]) {
      return bytecodes[contractName];
    }
    
    throw new Error(`Bytecode not found for contract: ${contractName}`);
  }

  async deploySimpleStorage() {
    return await this.deployContract('SimpleStorage', []);
  }

  async deployERC20Mock(totalSupply = 1000000) {
    // Note: This would require actual ERC20Mock bytecode
    console.log(chalk.yellow(`⚠️  ERC20Mock deployment requires compiled bytecode`));
    console.log(chalk.gray(`   Compile contracts using: npx hardhat compile`));
    return null;
  }

  async deployHeavyLoop() {
    // Note: This would require actual HeavyLoop bytecode
    console.log(chalk.yellow(`⚠️  HeavyLoop deployment requires compiled bytecode`));
    console.log(chalk.gray(`   Compile contracts using: npx hardhat compile`));
    return null;
  }

  async saveDeploymentInfo(filename = 'deployed-contracts.json') {
    try {
      const deploymentInfo = {
        network: {
          name: (await this.provider.getNetwork()).name || 'Unknown',
          chainId: (await this.provider.getNetwork()).chainId,
          rpc: this.provider._getConnection().url
        },
        deployer: this.wallet.address,
        timestamp: new Date().toISOString(),
        contracts: this.deployedContracts
      };
      
      const filePath = path.join(__dirname, filename);
      await fs.writeFile(filePath, JSON.stringify(deploymentInfo, null, 2));
      
      console.log(chalk.green(`💾 Deployment info saved to ${filename}`));
      return filePath;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save deployment info: ${error.message}`));
    }
  }

  async loadDeploymentInfo(filename = 'deployed-contracts.json') {
    try {
      const filePath = path.join(__dirname, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const deploymentInfo = JSON.parse(content);
      
      console.log(chalk.green(`📖 Loaded deployment info from ${filename}`));
      return deploymentInfo;
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️  No deployment info found: ${filename}`));
      return null;
    }
  }

  generateProfilerCommands() {
    console.log(chalk.cyan('\n📋 Somnia Gas Profiler Commands'));
    console.log(chalk.gray('═'.repeat(50)));
    
    Object.entries(this.deployedContracts).forEach(([name, info]) => {
      console.log(chalk.blue(`\n${name}:`));
      console.log(chalk.gray(`  Address: ${info.address}`));
      
      // Generate example commands based on contract type
      switch (name) {
        case 'SimpleStorage':
          console.log(chalk.white(`  Profile set function:`));
          console.log(chalk.green(`    somnia-gas-profiler analyze --address ${info.address} --abi ./examples/SimpleStorage.json --fn "set(uint256)" --args '[42]' --runs 5`));
          console.log(chalk.white(`  Profile get function:`));
          console.log(chalk.green(`    somnia-gas-profiler analyze --address ${info.address} --abi ./examples/SimpleStorage.json --fn "get()" --args '[]' --runs 3`));
          break;
          
        case 'ERC20Mock':
          console.log(chalk.white(`  Profile transfer function:`));
          console.log(chalk.green(`    somnia-gas-profiler analyze --address ${info.address} --abi ./examples/ERC20Mock.json --fn "transfer(address,uint256)" --args '["0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15", 100]' --runs 5`));
          break;
          
        case 'HeavyLoop':
          console.log(chalk.white(`  Profile optimized vs unoptimized loops:`));
          console.log(chalk.green(`    somnia-gas-profiler analyze --address ${info.address} --abi ./examples/HeavyLoop.json --fn "optimizedLoop(uint256)" "unoptimizedLoop(uint256)" --args '[10]' '[10]' --runs 3`));
          break;
      }
    });
    
    console.log(chalk.cyan('\n📊 Generate Reports:'));
    console.log(chalk.green('  somnia-gas-profiler report --in profiling_results.json --format table --nl'));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const deployment = new ContractDeployment();
  
  if (!await deployment.initialize()) {
    process.exit(1);
  }
  
  try {
    switch (command) {
      case 'deploy':
        const contractName = args[1];
        if (!contractName) {
          console.log(chalk.red('❌ Please specify contract name'));
          console.log(chalk.gray('Usage: node deploy.js deploy <contract-name>'));
          process.exit(1);
        }
        
        switch (contractName.toLowerCase()) {
          case 'simple':
          case 'simplestorage':
            await deployment.deploySimpleStorage();
            break;
          case 'erc20':
          case 'erc20mock':
            await deployment.deployERC20Mock();
            break;
          case 'heavy':
          case 'heavyloop':
            await deployment.deployHeavyLoop();
            break;
          case 'all':
            await deployment.deploySimpleStorage();
            await deployment.deployERC20Mock();
            await deployment.deployHeavyLoop();
            break;
          default:
            console.log(chalk.red(`❌ Unknown contract: ${contractName}`));
            process.exit(1);
        }
        
        await deployment.saveDeploymentInfo();
        deployment.generateProfilerCommands();
        break;
        
      case 'info':
        const info = await deployment.loadDeploymentInfo();
        if (info) {
          console.log(chalk.cyan('📋 Deployed Contracts:'));
          console.log(JSON.stringify(info, null, 2));
          deployment.deployedContracts = info.contracts;
          deployment.generateProfilerCommands();
        }
        break;
        
      case 'commands':
        const loadedInfo = await deployment.loadDeploymentInfo();
        if (loadedInfo) {
          deployment.deployedContracts = loadedInfo.contracts;
          deployment.generateProfilerCommands();
        } else {
          console.log(chalk.yellow('⚠️  No deployed contracts found. Deploy contracts first.'));
        }
        break;
        
      default:
        console.log(chalk.blue('🔧 Somnia Gas Profiler - Contract Deployment Helper'));
        console.log(chalk.gray('═'.repeat(50)));
        console.log('');
        console.log('Commands:');
        console.log(chalk.green('  deploy <contract>  ') + chalk.gray('Deploy a contract (simple, erc20, heavy, all)'));
        console.log(chalk.green('  info              ') + chalk.gray('Show deployment information'));
        console.log(chalk.green('  commands          ') + chalk.gray('Generate profiler commands for deployed contracts'));
        console.log('');
        console.log('Examples:');
        console.log(chalk.yellow('  node deploy.js deploy simple'));
        console.log(chalk.yellow('  node deploy.js deploy all'));
        console.log(chalk.yellow('  node deploy.js info'));
        console.log('');
        console.log('Prerequisites:');
        console.log(chalk.gray('  - Set PRIVATE_KEY environment variable'));
        console.log(chalk.gray('  - Set RPC_URL environment variable (optional)'));
        console.log(chalk.gray('  - Ensure wallet has sufficient balance'));
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ContractDeployment };