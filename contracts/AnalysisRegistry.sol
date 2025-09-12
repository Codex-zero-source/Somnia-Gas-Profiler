// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AnalysisRegistry
 * @dev A contract to store gas analysis metadata on-chain for the Somnia Gas Profiler
 */
contract AnalysisRegistry {
    // Structure to store analysis metadata
    struct Analysis {
        address contractAddress;
        address analyzer;
        uint256 timestamp;
        uint256 totalFunctions;
        uint256 avgGasUsage;
        string ipfsHash;
        string name;
    }

    // Mapping from analysis ID to Analysis
    mapping(uint256 => Analysis) public analyses;
    
    // Mapping from user address to their analysis IDs
    mapping(address => uint256[]) public userAnalyses;
    
    // Mapping from contract address to analysis IDs
    mapping(address => uint256[]) public contractAnalyses;
    
    // Counter for analysis IDs
    uint256 public analysisCount;

    // Event emitted when a new analysis is stored
    event AnalysisStored(
        uint256 indexed analysisId,
        address indexed contractAddress,
        address indexed analyzer,
        uint256 timestamp
    );

    /**
     * @dev Store a new analysis
     * @param _contractAddress The address of the analyzed contract
     * @param _totalFunctions The total number of functions analyzed
     * @param _avgGasUsage The average gas usage across all functions
     * @param _ipfsHash The IPFS hash of the full analysis data
     * @param _name The name/label for this analysis
     */
    function storeAnalysis(
        address _contractAddress,
        uint256 _totalFunctions,
        uint256 _avgGasUsage,
        string memory _ipfsHash,
        string memory _name
    ) public {
        analysisCount++;
        
        analyses[analysisCount] = Analysis({
            contractAddress: _contractAddress,
            analyzer: msg.sender,
            timestamp: block.timestamp,
            totalFunctions: _totalFunctions,
            avgGasUsage: _avgGasUsage,
            ipfsHash: _ipfsHash,
            name: _name
        });
        
        userAnalyses[msg.sender].push(analysisCount);
        contractAnalyses[_contractAddress].push(analysisCount);
        
        emit AnalysisStored(
            analysisCount,
            _contractAddress,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Get a specific analysis by ID
     * @param _analysisId The ID of the analysis to retrieve
     * @return Analysis struct
     */
    function getAnalysis(uint256 _analysisId) public view returns (Analysis memory) {
        return analyses[_analysisId];
    }

    /**
     * @dev Get all analysis IDs for a specific user
     * @param _user The address of the user
     * @return Array of analysis IDs
     */
    function getUserAnalyses(address _user) public view returns (uint256[] memory) {
        return userAnalyses[_user];
    }

    /**
     * @dev Get all analysis IDs for a specific contract
     * @param _contractAddress The address of the contract
     * @return Array of analysis IDs
     */
    function getContractAnalyses(address _contractAddress) public view returns (uint256[] memory) {
        return contractAnalyses[_contractAddress];
    }

    /**
     * @dev Get the total number of analyses stored
     * @return Total analysis count
     */
    function getAnalysisCount() public view returns (uint256) {
        return analysisCount;
    }
}