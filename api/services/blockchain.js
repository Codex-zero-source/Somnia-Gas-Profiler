const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * Blockchain service for storing analysis metadata on-chain
 */
class BlockchainService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = process.env.ANALYSIS_REGISTRY_V2_ADDRESS || '0x0000000000000000000000000000000000000000';
    this.rpcUrl = process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network';
    this.privateKey = process.env.PRIVATE_KEY;
    
    // Enhanced ABI for AnalysisRegistryV2
    this.contractABI = [
      {
        "inputs": [
          {"internalType": "address", "name": "_contractAddress", "type": "address"},
          {"internalType": "uint256", "name": "_totalFunctions", "type": "uint256"},
          {"internalType": "uint256", "name": "_avgGasUsage", "type": "uint256"},
          {"internalType": "uint256", "name": "_minGasUsage", "type": "uint256"},
          {"internalType": "uint256", "name": "_maxGasUsage", "type": "uint256"},
          {"internalType": "uint256", "name": "_totalGasUsage", "type": "uint256"},
          {"internalType": "uint256", "name": "_efficiencyScore", "type": "uint256"},
          {"internalType": "string", "name": "_ipfsHash", "type": "string"},
          {"internalType": "string", "name": "_csvDataHash", "type": "string"},
          {"internalType": "string", "name": "_redisKey", "type": "string"},
          {"internalType": "string", "name": "_name", "type": "string"},
          {"internalType": "string", "name": "_analysisType", "type": "string"},
          {"internalType": "bool", "name": "_isOptimized", "type": "bool"}
        ],
        "name": "storeAnalysis",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "string", "name": "_redisKey", "type": "string"}],
        "name": "getAnalysisByRedisKey",
        "outputs": [{
          "components": [
            {"internalType": "address", "name": "contractAddress", "type": "address"},
            {"internalType": "address", "name": "analyzer", "type": "address"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "uint256", "name": "totalFunctions", "type": "uint256"},
            {"internalType": "uint256", "name": "avgGasUsage", "type": "uint256"},
            {"internalType": "uint256", "name": "minGasUsage", "type": "uint256"},
            {"internalType": "uint256", "name": "maxGasUsage", "type": "uint256"},
            {"internalType": "uint256", "name": "totalGasUsage", "type": "uint256"},
            {"internalType": "uint256", "name": "efficiencyScore", "type": "uint256"},
            {"internalType": "string", "name": "ipfsHash", "type": "string"},
            {"internalType": "string", "name": "csvDataHash", "type": "string"},
            {"internalType": "string", "name": "redisKey", "type": "string"},
            {"internalType": "string", "name": "name", "type": "string"},
            {"internalType": "string", "name": "analysisType", "type": "string"},
            {"internalType": "bool", "name": "isOptimized", "type": "bool"}
          ],
          "internalType": "struct AnalysisRegistryV2.Analysis",
          "name": "",
          "type": "tuple"
        }],
        "stateMutability": "view",
        "type": "function"
      }
    ];
  }

  /**
   * Initialize blockchain connection
   */
  async initialize() {
    try {
      if (!this.privateKey) {
        console.warn('⚠️ No private key provided, blockchain storage disabled');
        return false;
      }

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.wallet);
      
      console.log('✅ Blockchain service initialized');
      console.log(`📍 Contract address: ${this.contractAddress}`);
      console.log(`🔗 RPC URL: ${this.rpcUrl}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error.message);
      return false;
    }
  }

  /**
   * Store analysis metadata on-chain
   */
  async storeAnalysisOnChain(analysisData, csvData, redisKey) {
    try {
      if (!this.contract) {
        throw new Error('Blockchain service not initialized');
      }

      // Calculate efficiency score based on gas metrics
      const efficiencyScore = this.calculateEfficiencyScore(analysisData);
      
      // Generate CSV data hash for integrity
      const csvDataHash = this.generateDataHash(csvData);
      
      // Prepare transaction parameters
      const txParams = [
        analysisData.contractAddress,
        analysisData.totalFunctions || 0,
        analysisData.avgGasUsage || 0,
        analysisData.minGasUsage || 0,
        analysisData.maxGasUsage || 0,
        analysisData.totalGasUsage || 0,
        efficiencyScore,
        analysisData.ipfsHash || '',
        csvDataHash,
        redisKey,
        analysisData.name || `Analysis-${Date.now()}`,
        'full',
        analysisData.isOptimized || false
      ];

      console.log('📤 Storing analysis on-chain...');
      const tx = await this.contract.storeAnalysis(...txParams);
      
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      console.log('✅ Analysis stored on-chain successfully');
      console.log(`🔗 Transaction hash: ${receipt.hash}`);
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        efficiencyScore,
        csvDataHash
      };
    } catch (error) {
      console.error('❌ Failed to store analysis on-chain:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve analysis metadata from blockchain using Redis key
   */
  async getAnalysisFromChain(redisKey) {
    try {
      if (!this.contract) {
        throw new Error('Blockchain service not initialized');
      }

      const analysis = await this.contract.getAnalysisByRedisKey(redisKey);
      
      return {
        success: true,
        data: {
          contractAddress: analysis.contractAddress,
          analyzer: analysis.analyzer,
          timestamp: Number(analysis.timestamp),
          totalFunctions: Number(analysis.totalFunctions),
          avgGasUsage: Number(analysis.avgGasUsage),
          minGasUsage: Number(analysis.minGasUsage),
          maxGasUsage: Number(analysis.maxGasUsage),
          totalGasUsage: Number(analysis.totalGasUsage),
          efficiencyScore: Number(analysis.efficiencyScore),
          ipfsHash: analysis.ipfsHash,
          csvDataHash: analysis.csvDataHash,
          redisKey: analysis.redisKey,
          name: analysis.name,
          analysisType: analysis.analysisType,
          isOptimized: analysis.isOptimized
        }
      };
    } catch (error) {
      console.error('❌ Failed to retrieve analysis from chain:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate efficiency score based on gas metrics
   */
  calculateEfficiencyScore(analysisData) {
    try {
      // Simple efficiency calculation based on average gas usage
      // Lower gas usage = higher efficiency
      const avgGas = analysisData.avgGasUsage || 0;
      
      if (avgGas === 0) return 50; // Default score
      
      // Efficiency thresholds (these can be adjusted based on real-world data)
      if (avgGas < 21000) return 95;  // Excellent
      if (avgGas < 50000) return 85;  // Very Good
      if (avgGas < 100000) return 70; // Good
      if (avgGas < 200000) return 55; // Average
      if (avgGas < 500000) return 35; // Poor
      return 15; // Critical
    } catch (error) {
      console.error('Error calculating efficiency score:', error);
      return 50; // Default score on error
    }
  }

  /**
   * Generate hash for data integrity
   */
  generateDataHash(data) {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      return crypto.createHash('sha256').update(dataString).digest('hex');
    } catch (error) {
      console.error('Error generating data hash:', error);
      return '';
    }
  }

  /**
   * Check if blockchain service is available
   */
  isAvailable() {
    return this.contract !== null;
  }

  /**
   * Get wallet address
   */
  getWalletAddress() {
    return this.wallet ? this.wallet.address : null;
  }
}

module.exports = BlockchainService;