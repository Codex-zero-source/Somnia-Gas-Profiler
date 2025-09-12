// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/AnalysisRegistry.sol";

contract AnalysisRegistryTest is Test {
    AnalysisRegistry public analysisRegistry;
    
    address user1 = address(1);
    address contract1 = address(2);

    function setUp() public {
        analysisRegistry = new AnalysisRegistry();
    }

    function testStoreAnalysis() public {
        vm.startPrank(user1);
        
        analysisRegistry.storeAnalysis(
            contract1,
            5,
            100000,
            "QmTestHash123456789",
            "Test Analysis"
        );
        
        assertEq(analysisRegistry.getAnalysisCount(), 1);
        
        AnalysisRegistry.Analysis memory analysis = analysisRegistry.getAnalysis(1);
        assertEq(analysis.contractAddress, contract1);
        assertEq(analysis.analyzer, user1);
        assertEq(analysis.totalFunctions, 5);
        assertEq(analysis.avgGasUsage, 100000);
        assertEq(analysis.ipfsHash, "QmTestHash123456789");
        assertEq(analysis.name, "Test Analysis");
        
        vm.stopPrank();
    }

    function testGetUserAnalyses() public {
        vm.startPrank(user1);
        
        analysisRegistry.storeAnalysis(
            contract1,
            5,
            100000,
            "QmTestHash123456789",
            "Test Analysis"
        );
        
        uint256[] memory userAnalysisIds = analysisRegistry.getUserAnalyses(user1);
        assertEq(userAnalysisIds.length, 1);
        assertEq(userAnalysisIds[0], 1);
        
        vm.stopPrank();
    }

    function testGetContractAnalyses() public {
        vm.startPrank(user1);
        
        analysisRegistry.storeAnalysis(
            contract1,
            5,
            100000,
            "QmTestHash123456789",
            "Test Analysis"
        );
        
        uint256[] memory contractAnalysisIds = analysisRegistry.getContractAnalyses(contract1);
        assertEq(contractAnalysisIds.length, 1);
        assertEq(contractAnalysisIds[0], 1);
        
        vm.stopPrank();
    }
}