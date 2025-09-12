const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying AnalysisRegistry contract...");

  // Get the contract factory
  const AnalysisRegistry = await ethers.getContractFactory("AnalysisRegistry");
  
  // Deploy the contract
  const analysisRegistry = await AnalysisRegistry.deploy();
  
  console.log("AnalysisRegistry deployed to:", analysisRegistry.target);
  
  // Wait for the deployment transaction to be mined
  await analysisRegistry.waitForDeployment();
  
  console.log("Deployment completed successfully!");
  
  // Verify the deployment by calling a view function
  const analysisCount = await analysisRegistry.getAnalysisCount();
  console.log("Initial analysis count:", analysisCount.toString());
  
  // Save the contract address to a file for frontend use
  const fs = require("fs");
  const contractData = {
    address: analysisRegistry.target,
    abi: (await ethers.getContractFactory("AnalysisRegistry")).abi
  };
  
  fs.writeFileSync(
    "./webapp/gas-profiler/src/contracts/AnalysisRegistry.deployment.json",
    JSON.stringify(contractData, null, 2)
  );
  
  console.log("Contract deployment data saved to frontend directory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });