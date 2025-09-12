// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/AnalysisRegistry.sol";

contract DeployAnalysisRegistry is Script {
    function run() external {
        // Load private key from environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying AnalysisRegistry contract...");
        console.log("Deployer address:", deployer);
        
        // Check if deployer has funds
        uint256 balance = deployer.balance;
        console.log("Deployer balance:", balance);
        
        if (balance == 0) {
            console.log("Warning: Deployer account has zero balance");
            console.log("Make sure your account has STT tokens for gas fees");
        }
        
        vm.startBroadcast(deployerPrivateKey);

        AnalysisRegistry analysisRegistry = new AnalysisRegistry();
        console.log("AnalysisRegistry deployed at:", address(analysisRegistry));

        vm.stopBroadcast();
        
        // Verify the deployment by calling a view function
        uint256 count = analysisRegistry.getAnalysisCount();
        console.log("Initial analysis count:", count);
        console.log("Deployment completed successfully!");
    }
}