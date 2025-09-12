// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AnalysisRegistryV2
 * @dev Enhanced contract to store comprehensive gas analysis metadata on-chain for the Somnia Gas Profiler
 * @notice This version includes additional fields for CSV data, efficiency metrics, and Redis integration
 */
contract AnalysisRegistryV2 {
    // Enhanced structure to store comprehensive analysis metadata
    struct Analysis {
        address contractAddress;     // Address of the analyzed contract
        address analyzer;            // Address of the user who performed the analysis
        uint256 timestamp;           // Block timestamp when analysis was stored
        uint256 totalFunctions;      // Total number of functions analyzed
        uint256 avgGasUsage;         // Average gas usage across all functions
        uint256 minGasUsage;         // Minimum gas usage found
        uint256 maxGasUsage;         // Maximum gas usage found
        uint256 totalGasUsage;       // Total gas usage across all functions
        uint256 efficiencyScore;     // Gas efficiency score (0-100)
        string ipfsHash;             // IPFS hash of the full analysis data
        string csvDataHash;          // Hash of the CSV data for integrity
        string redisKey;             // Redis cache key for quick retrieval
        string name;                 // Name/label for this analysis
        string analysisType;         // Type of analysis ("quick" or "full")
        bool isOptimized;            // Whether the contract appears optimized
    }

    // Gas efficiency categories
    enum EfficiencyGrade {
        EXCELLENT,  // 90-100%
        GOOD,       // 70-89%
        AVERAGE,    // 50-69%
        POOR,       // 30-49%
        CRITICAL    // 0-29%
    }

    // Mapping from analysis ID to Analysis
    mapping(uint256 => Analysis) public analyses;
    
    // Mapping from user address to their analysis IDs
    mapping(address => uint256[]) public userAnalyses;
    
    // Mapping from contract address to analysis IDs
    mapping(address => uint256[]) public contractAnalyses;
    
    // Mapping from Redis key to analysis ID for quick lookup
    mapping(string => uint256) public redisKeyToAnalysisId;
    
    // Mapping to track analysis counts per contract
    mapping(address => uint256) public contractAnalysisCount;
    
    // Counter for analysis IDs
    uint256 public analysisCount;
    
    // Total gas analyzed across all contracts
    uint256 public totalGasAnalyzed;
    
    // Events
    event AnalysisStored(
        uint256 indexed analysisId,
        address indexed contractAddress,
        address indexed analyzer,
        uint256 timestamp,
        string analysisType,
        uint256 efficiencyScore
    );
    
    event AnalysisUpdated(
        uint256 indexed analysisId,
        string newRedisKey,
        string newCsvDataHash
    );

    /**
     * @dev Store a new comprehensive analysis
     * @param _contractAddress The address of the analyzed contract
     * @param _totalFunctions The total number of functions analyzed
     * @param _avgGasUsage The average gas usage across all functions
     * @param _minGasUsage The minimum gas usage found
     * @param _maxGasUsage The maximum gas usage found
     * @param _totalGasUsage The total gas usage across all functions
     * @param _efficiencyScore Gas efficiency score (0-100)
     * @param _ipfsHash The IPFS hash of the full analysis data
     * @param _csvDataHash Hash of the CSV data for integrity
     * @param _redisKey Redis cache key for quick retrieval
     * @param _name The name/label for this analysis
     * @param _analysisType Type of analysis ("quick" or "full")
     * @param _isOptimized Whether the contract appears optimized
     */
    function storeAnalysis(
        address _contractAddress,
        uint256 _totalFunctions,
        uint256 _avgGasUsage,
        uint256 _minGasUsage,
        uint256 _maxGasUsage,
        uint256 _totalGasUsage,
        uint256 _efficiencyScore,
        string memory _ipfsHash,
        string memory _csvDataHash,
        string memory _redisKey,
        string memory _name,
        string memory _analysisType,
        bool _isOptimized
    ) public {
        require(_contractAddress != address(0), "Invalid contract address");
        require(_totalFunctions > 0, "Must have at least one function");
        require(_efficiencyScore <= 100, "Efficiency score must be <= 100");
        require(bytes(_redisKey).length > 0, "Redis key cannot be empty");
        require(redisKeyToAnalysisId[_redisKey] == 0, "Redis key already exists");
        
        analysisCount++;
        
        analyses[analysisCount] = Analysis({
            contractAddress: _contractAddress,
            analyzer: msg.sender,
            timestamp: block.timestamp,
            totalFunctions: _totalFunctions,
            avgGasUsage: _avgGasUsage,
            minGasUsage: _minGasUsage,
            maxGasUsage: _maxGasUsage,
            totalGasUsage: _totalGasUsage,
            efficiencyScore: _efficiencyScore,
            ipfsHash: _ipfsHash,
            csvDataHash: _csvDataHash,
            redisKey: _redisKey,
            name: _name,
            analysisType: _analysisType,
            isOptimized: _isOptimized
        });
        
        userAnalyses[msg.sender].push(analysisCount);
        contractAnalyses[_contractAddress].push(analysisCount);
        redisKeyToAnalysisId[_redisKey] = analysisCount;
        contractAnalysisCount[_contractAddress]++;
        totalGasAnalyzed += _totalGasUsage;
        
        emit AnalysisStored(
            analysisCount,
            _contractAddress,
            msg.sender,
            block.timestamp,
            _analysisType,
            _efficiencyScore
        );
    }

    /**
     * @dev Update Redis key and CSV hash for an existing analysis
     * @param _analysisId The ID of the analysis to update
     * @param _newRedisKey New Redis cache key
     * @param _newCsvDataHash New CSV data hash
     */
    function updateAnalysisCache(
        uint256 _analysisId,
        string memory _newRedisKey,
        string memory _newCsvDataHash
    ) public {
        require(_analysisId > 0 && _analysisId <= analysisCount, "Invalid analysis ID");
        require(analyses[_analysisId].analyzer == msg.sender, "Only analyzer can update");
        require(bytes(_newRedisKey).length > 0, "Redis key cannot be empty");
        require(redisKeyToAnalysisId[_newRedisKey] == 0, "Redis key already exists");
        
        // Remove old Redis key mapping
        delete redisKeyToAnalysisId[analyses[_analysisId].redisKey];
        
        // Update analysis
        analyses[_analysisId].redisKey = _newRedisKey;
        analyses[_analysisId].csvDataHash = _newCsvDataHash;
        
        // Add new Redis key mapping
        redisKeyToAnalysisId[_newRedisKey] = _analysisId;
        
        emit AnalysisUpdated(_analysisId, _newRedisKey, _newCsvDataHash);
    }

    /**
     * @dev Get a specific analysis by ID
     * @param _analysisId The ID of the analysis to retrieve
     * @return Analysis struct
     */
    function getAnalysis(uint256 _analysisId) public view returns (Analysis memory) {
        require(_analysisId > 0 && _analysisId <= analysisCount, "Invalid analysis ID");
        return analyses[_analysisId];
    }

    /**
     * @dev Get analysis by Redis key
     * @param _redisKey The Redis key to lookup
     * @return Analysis struct
     */
    function getAnalysisByRedisKey(string memory _redisKey) public view returns (Analysis memory) {
        uint256 analysisId = redisKeyToAnalysisId[_redisKey];
        require(analysisId > 0, "Analysis not found for Redis key");
        return analyses[analysisId];
    }

    /**
     * @dev Get efficiency grade for a given score
     * @param _efficiencyScore The efficiency score (0-100)
     * @return EfficiencyGrade enum value
     */
    function getEfficiencyGrade(uint256 _efficiencyScore) public pure returns (EfficiencyGrade) {
        if (_efficiencyScore >= 90) return EfficiencyGrade.EXCELLENT;
        if (_efficiencyScore >= 70) return EfficiencyGrade.GOOD;
        if (_efficiencyScore >= 50) return EfficiencyGrade.AVERAGE;
        if (_efficiencyScore >= 30) return EfficiencyGrade.POOR;
        return EfficiencyGrade.CRITICAL;
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

    /**
     * @dev Get global statistics
     * @return totalAnalyses Total number of analyses
     * @return totalGas Total gas analyzed across all contracts
     * @return avgEfficiency Average efficiency score across all analyses
     */
    function getGlobalStats() public view returns (
        uint256 totalAnalyses,
        uint256 totalGas,
        uint256 avgEfficiency
    ) {
        totalAnalyses = analysisCount;
        totalGas = totalGasAnalyzed;
        
        if (analysisCount > 0) {
            uint256 totalEfficiency = 0;
            for (uint256 i = 1; i <= analysisCount; i++) {
                totalEfficiency += analyses[i].efficiencyScore;
            }
            avgEfficiency = totalEfficiency / analysisCount;
        } else {
            avgEfficiency = 0;
        }
    }

    /**
     * @dev Get recent analyses (last N analyses)
     * @param _count Number of recent analyses to retrieve
     * @return Array of analysis IDs
     */
    function getRecentAnalyses(uint256 _count) public view returns (uint256[] memory) {
        if (analysisCount == 0) {
            return new uint256[](0);
        }
        
        uint256 actualCount = _count > analysisCount ? analysisCount : _count;
        uint256[] memory recentIds = new uint256[](actualCount);
        
        for (uint256 i = 0; i < actualCount; i++) {
            recentIds[i] = analysisCount - i;
        }
        
        return recentIds;
    }

    /**
     * @dev Check if a Redis key exists
     * @param _redisKey The Redis key to check
     * @return True if the key exists
     */
    function redisKeyExists(string memory _redisKey) public view returns (bool) {
        return redisKeyToAnalysisId[_redisKey] != 0;
    }

    /**
     * @dev Get contract analysis statistics
     * @param _contractAddress The contract address
     * @return analysisCount Number of analyses for this contract
     * @return avgEfficiency Average efficiency score
     * @return lastAnalysisId ID of the most recent analysis
     */
    function getContractStats(address _contractAddress) public view returns (
        uint256 analysisCount,
        uint256 avgEfficiency,
        uint256 lastAnalysisId
    ) {
        uint256[] memory contractAnalysisIds = contractAnalyses[_contractAddress];
        analysisCount = contractAnalysisIds.length;
        
        if (analysisCount > 0) {
            uint256 totalEfficiency = 0;
            for (uint256 i = 0; i < analysisCount; i++) {
                totalEfficiency += analyses[contractAnalysisIds[i]].efficiencyScore;
            }
            avgEfficiency = totalEfficiency / analysisCount;
            lastAnalysisId = contractAnalysisIds[analysisCount - 1];
        } else {
            avgEfficiency = 0;
            lastAnalysisId = 0;
        }
    }
}