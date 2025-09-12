// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/AnalysisRegistry.sol";

contract DeployAnalysisRegistryV2 is Script {
    function run() external {
        // Load private key from environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying AnalysisRegistry contract...");
        console.log("Deployer address:", deployer);
        
        // Check deployer balance
        uint256 balance = deployer.balance;
        console.log("Deployer balance (wei):", balance);
        
        // Convert to ether for better readability
        uint256 balanceEther = balance / 1e18;
        uint256 balanceRemainder = balance % 1e18;
        console.log("Deployer balance (STT):", balanceEther, ".", balanceRemainder);
        
        if (balance == 0) {
            console.log("ERROR: Deployer has zero balance!");
            revert("Insufficient funds");
        }
        
        vm.startBroadcast(deployerPrivateKey);

        AnalysisRegistry analysisRegistry = new AnalysisRegistry();
        console.log("AnalysisRegistry deployed at:", address(analysisRegistry));

        vm.stopBroadcast();
        
        // Verify the deployment by calling a view function
        try analysisRegistry.getAnalysisCount() returns (uint256 count) {
            console.log("Initial analysis count:", count);
            console.log("Deployment verification successful!");
        } catch {
            console.log("WARNING: Could not verify deployment immediately");
        }
        
        console.log("Deployment completed!");
    }
}