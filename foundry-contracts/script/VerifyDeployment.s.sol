// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/AnalysisRegistry.sol";

contract VerifyDeployment is Script {
    function run(address contractAddress) external {
        console.log("Verifying AnalysisRegistry deployment at:", contractAddress);
        
        AnalysisRegistry analysisRegistry = AnalysisRegistry(contractAddress);
        
        try analysisRegistry.getAnalysisCount() returns (uint256 count) {
            console.log("Contract is deployed and accessible");
            console.log("Current analysis count:", count);
        } catch Error(string memory reason) {
            console.log("Contract call failed with reason:", reason);
        } catch (bytes memory /* reason */) {
            console.log("Contract call failed");
        }
        
        console.log("Verification completed!");
    }
    
    // Fallback function if no address is provided
    function run() external {
        // Try with the last deployed address
        address contractAddress = 0xcCD665e81bd568EEC701cb1ca187A25A2Ab3FAAF;
        run(contractAddress);
    }
}