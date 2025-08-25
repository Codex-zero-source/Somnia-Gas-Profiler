const hre = require("hardhat");
const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log("🚀 Deploying Somnia Gas Profiler Example Contracts...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  const deployedContracts = {};

  try {
    // Deploy SimpleStorage
    console.log("\n📋 Deploying SimpleStorage...");
    const SimpleStorage = await hre.ethers.getContractFactory("SimpleStorage");
    const simpleStorage = await SimpleStorage.deploy();
    await simpleStorage.waitForDeployment();
    const simpleStorageAddress = await simpleStorage.getAddress();
    
    deployedContracts.SimpleStorage = {
      address: simpleStorageAddress,
      args: [],
      contract: "SimpleStorage"
    };
    console.log("✅ SimpleStorage deployed to:", simpleStorageAddress);

    // Deploy ERC20Mock
    console.log("\n🪙 Deploying ERC20Mock...");
    const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
    const totalSupply = 1000000; // 1 million tokens
    const erc20Mock = await ERC20Mock.deploy(totalSupply);
    await erc20Mock.waitForDeployment();
    const erc20MockAddress = await erc20Mock.getAddress();
    
    deployedContracts.ERC20Mock = {
      address: erc20MockAddress,
      args: [totalSupply],
      contract: "ERC20Mock"
    };
    console.log("✅ ERC20Mock deployed to:", erc20MockAddress);

    // Deploy HeavyLoop
    console.log("\n🔄 Deploying HeavyLoop...");
    const HeavyLoop = await hre.ethers.getContractFactory("HeavyLoop");
    const heavyLoop = await HeavyLoop.deploy();
    await heavyLoop.waitForDeployment();
    const heavyLoopAddress = await heavyLoop.getAddress();
    
    deployedContracts.HeavyLoop = {
      address: heavyLoopAddress,
      args: [],
      contract: "HeavyLoop"
    };
    console.log("✅ HeavyLoop deployed to:", heavyLoopAddress);

    // Save deployment information
    const deploymentInfo = {
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts
    };

    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    await fs.mkdir(deploymentsDir, { recursive: true });
    
    const deploymentFile = path.join(deploymentsDir, `${hre.network.name}-deployments.json`);
    await fs.writeFile(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);

    // Generate profiler commands
    console.log("\n📋 Gas Profiler Commands:");
    console.log("=" * 50);
    
    console.log("\n🔹 SimpleStorage Examples:");
    console.log(`somnia-gas-profiler analyze --address ${simpleStorageAddress} --abi ./examples/SimpleStorage.json --fn "set(uint256)" --args '[42]' --runs 5`);
    console.log(`somnia-gas-profiler analyze --address ${simpleStorageAddress} --abi ./examples/SimpleStorage.json --fn "get()" --args '[]' --runs 3`);
    
    console.log("\n🔹 ERC20Mock Examples:");
    console.log(`somnia-gas-profiler analyze --address ${erc20MockAddress} --abi ./examples/ERC20Mock.json --fn "transfer(address,uint256)" --args '["${deployer.address}", 100]' --runs 5`);
    console.log(`somnia-gas-profiler analyze --address ${erc20MockAddress} --abi ./examples/ERC20Mock.json --fn "balanceOf(address)" --args '["${deployer.address}"]' --runs 3`);
    
    console.log("\n🔹 HeavyLoop Examples:");
    console.log(`somnia-gas-profiler analyze --address ${heavyLoopAddress} --abi ./examples/HeavyLoop.json --fn "optimizedLoop(uint256)" --args '[10]' --runs 3`);
    console.log(`somnia-gas-profiler analyze --address ${heavyLoopAddress} --abi ./examples/HeavyLoop.json --fn "unoptimizedLoop(uint256)" --args '[10]' --runs 3`);
    
    console.log("\n🔹 Comparison Example:");
    console.log(`somnia-gas-profiler analyze --address ${heavyLoopAddress} --abi ./examples/HeavyLoop.json --fn "optimizedLoop(uint256)" "unoptimizedLoop(uint256)" --args '[20]' '[20]' --runs 5 --out optimization-comparison.json`);
    
    console.log("\n📊 Generate Reports:");
    console.log("somnia-gas-profiler report --in profiling_results.json --format table --nl");
    console.log("somnia-gas-profiler report --in profiling_results.json --format csv --out gas-report.csv");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });