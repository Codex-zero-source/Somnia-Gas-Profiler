// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/AnalysisRegistry.sol";

contract TestContract is Script {
    function run() external {
        address contractAddress = 0x9E6B5779907beEbDFa40907956d9B891e891c540;
        console.log("Testing AnalysisRegistry at:", contractAddress);
        
        AnalysisRegistry registry = AnalysisRegistry(contractAddress);
        
        // Test getAnalysisCount
        try registry.getAnalysisCount() returns (uint256 count) {
            console.log("SUCCESS: getAnalysisCount() returned", count);
        } catch Error(string memory reason) {
            console.log("ERROR: getAnalysisCount() failed with reason:", reason);
        } catch (bytes memory /* reason */) {
            console.log("ERROR: getAnalysisCount() failed with unknown error");
        }
        
        // Test storeAnalysis (this will require a transaction)
        // We'll skip this for now since it requires a broadcast
    }
}