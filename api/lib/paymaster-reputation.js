const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { ethers } = require('ethers');

/**
 * Paymaster Reputation and Reliability Tracking System
 * Tracks performance metrics, reliability scores, and usage patterns
 */
class PaymasterReputationTracker {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), '.reputation-data');
    this.provider = options.provider;
    this.reputationCache = new Map();
    this.trackingEnabled = options.trackingEnabled !== false;
    this.syncInterval = options.syncInterval || 3600000; // 1 hour
    
    // Reputation scoring weights
    this.weights = {
      reliability: 0.25,      // Success rate
      gasEfficiency: 0.20,    // Gas optimization
      costStability: 0.15,    // Price consistency
      availability: 0.15,     // Uptime/availability
      compliance: 0.15,       // EIP-4337 compliance
      community: 0.10         // Community feedback
    };
    
    this.initializeTracker();
  }

  /**
   * Initialize the reputation tracking system
   */
  async initializeTracker() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadReputationData();
      
      if (this.trackingEnabled) {
        console.log(chalk.gray('📊 Paymaster reputation tracking initialized'));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Reputation tracker initialization failed: ${error.message}`));
    }
  }

  /**
   * Track a paymaster interaction and update reputation
   * @param {string} paymasterAddress - Paymaster address
   * @param {Object} interaction - Interaction data
   */
  async trackInteraction(paymasterAddress, interaction) {
    if (!this.trackingEnabled) return;

    try {
      const reputation = await this.getReputation(paymasterAddress);
      
      // Update interaction history
      reputation.interactions.push({
        timestamp: Date.now(),
        type: interaction.type,
        success: interaction.success,
        gasUsed: interaction.gasUsed,
        cost: interaction.cost,
        duration: interaction.duration,
        error: interaction.error || null
      });

      // Keep only last 1000 interactions
      if (reputation.interactions.length > 1000) {
        reputation.interactions = reputation.interactions.slice(-1000);
      }

      // Update metrics
      await this.updateMetrics(paymasterAddress, reputation);
      
      // Recalculate reputation score
      await this.calculateReputationScore(paymasterAddress, reputation);
      
      // Cache updated reputation
      this.reputationCache.set(paymasterAddress, reputation);
      
      // Save to persistent storage
      await this.saveReputationData(paymasterAddress, reputation);
      
    } catch (error) {
      console.log(chalk.gray(`   Reputation tracking failed: ${error.message.substring(0, 50)}...`));
    }
  }

  /**
   * Get reputation data for a paymaster
   * @param {string} paymasterAddress - Paymaster address
   * @returns {Promise<Object>} Reputation data
   */
  async getReputation(paymasterAddress) {
    // Check cache first
    if (this.reputationCache.has(paymasterAddress)) {
      return this.reputationCache.get(paymasterAddress);
    }

    // Load from storage
    const reputation = await this.loadPaymasterReputation(paymasterAddress);
    this.reputationCache.set(paymasterAddress, reputation);
    
    return reputation;
  }

  /**
   * Generate comprehensive reputation report
   * @param {string} paymasterAddress - Paymaster address
   * @returns {Promise<Object>} Reputation report
   */
  async generateReputationReport(paymasterAddress) {
    try {
      const reputation = await this.getReputation(paymasterAddress);
      
      const report = {
        address: paymasterAddress,
        reputation: reputation.score,
        grade: this.getReputationGrade(reputation.score),
        metrics: reputation.metrics,
        trends: await this.calculateTrends(reputation),
        reliability: {
          uptime: reputation.metrics.availability,
          successRate: reputation.metrics.reliability,
          avgResponseTime: reputation.metrics.avgResponseTime
        },
        performance: {
          gasEfficiency: reputation.metrics.gasEfficiency,
          costStability: reputation.metrics.costStability,
          optimization: reputation.metrics.optimization
        },
        compliance: {
          eip4337Score: reputation.metrics.compliance,
          interfaceSupport: reputation.validationResults?.interfaceSupport || 'unknown',
          standardCompliance: reputation.validationResults?.standardCompliance || 'unknown'
        },
        recommendations: this.generateRecommendations(reputation),
        riskAssessment: this.assessRisk(reputation),
        lastUpdated: reputation.lastUpdated,
        totalInteractions: reputation.interactions.length,
        trackingPeriod: this.calculateTrackingPeriod(reputation.interactions)
      };

      return report;
      
    } catch (error) {
      throw new Error(`Failed to generate reputation report: ${error.message}`);
    }
  }

  /**
   * Compare multiple paymasters by reputation
   * @param {Array} paymasterAddresses - Array of paymaster addresses
   * @returns {Promise<Object>} Comparison report
   */
  async comparePaymasters(paymasterAddresses) {
    try {
      console.log(chalk.blue('📊 Comparing paymaster reputations...'));
      
      const comparisons = [];
      
      for (const address of paymasterAddresses) {
        const report = await this.generateReputationReport(address);
        comparisons.push(report);
      }
      
      // Sort by reputation score
      comparisons.sort((a, b) => b.reputation - a.reputation);
      
      const comparison = {
        timestamp: new Date().toISOString(),
        paymasterCount: comparisons.length,
        rankings: comparisons.map((comp, index) => ({
          rank: index + 1,
          address: comp.address,
          reputation: comp.reputation,
          grade: comp.grade,
          strengths: this.identifyStrengths(comp),
          weaknesses: this.identifyWeaknesses(comp)
        })),
        analysis: {
          topPerformer: comparisons[0],
          averageReputation: comparisons.reduce((sum, comp) => sum + comp.reputation, 0) / comparisons.length,
          reliabilityLeader: comparisons.reduce((prev, curr) => 
            curr.reliability.successRate > prev.reliability.successRate ? curr : prev
          ),
          costLeader: comparisons.reduce((prev, curr) =>
            curr.performance.costStability > prev.performance.costStability ? curr : prev
          ),
          complianceLeader: comparisons.reduce((prev, curr) =>
            curr.compliance.eip4337Score > prev.compliance.eip4337Score ? curr : prev
          )
        },
        recommendations: this.generateComparisonRecommendations(comparisons)
      };
      
      return comparison;
      
    } catch (error) {
      throw new Error(`Paymaster comparison failed: ${error.message}`);
    }
  }

  /**
   * Update metrics based on interaction history
   */
  async updateMetrics(paymasterAddress, reputation) {
    const interactions = reputation.interactions;
    if (interactions.length === 0) return;

    const recent = interactions.slice(-100); // Last 100 interactions
    const successful = recent.filter(i => i.success);
    
    // Reliability metrics
    reputation.metrics.reliability = (successful.length / recent.length) * 100;
    reputation.metrics.avgResponseTime = recent.reduce((sum, i) => sum + (i.duration || 0), 0) / recent.length;
    
    // Gas efficiency
    const gasUsages = successful.map(i => i.gasUsed).filter(g => g > 0);
    if (gasUsages.length > 0) {
      const avgGas = gasUsages.reduce((sum, gas) => sum + gas, 0) / gasUsages.length;
      reputation.metrics.gasEfficiency = Math.max(0, 100 - ((avgGas - 40000) / 40000 * 100));
    }
    
    // Cost stability
    const costs = successful.map(i => i.cost).filter(c => c > 0);
    if (costs.length > 1) {
      const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
      const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - avgCost, 2), 0) / costs.length;
      const stdDev = Math.sqrt(variance);
      reputation.metrics.costStability = Math.max(0, 100 - (stdDev / avgCost * 100));
    }
    
    // Availability (based on successful interactions over time)
    const now = Date.now();
    const last24h = interactions.filter(i => now - i.timestamp < 86400000);
    reputation.metrics.availability = last24h.length > 0 ? 
      (last24h.filter(i => i.success).length / last24h.length) * 100 : 0;
  }

  /**
   * Calculate overall reputation score
   */
  async calculateReputationScore(paymasterAddress, reputation) {
    const metrics = reputation.metrics;
    
    const score = 
      (metrics.reliability * this.weights.reliability) +
      (metrics.gasEfficiency * this.weights.gasEfficiency) +
      (metrics.costStability * this.weights.costStability) +
      (metrics.availability * this.weights.availability) +
      (metrics.compliance * this.weights.compliance) +
      (metrics.community * this.weights.community);
    
    reputation.score = Math.round(score);
    reputation.lastUpdated = Date.now();
  }

  /**
   * Load paymaster reputation from storage
   */
  async loadPaymasterReputation(paymasterAddress) {
    try {
      const filePath = path.join(this.dataPath, `${paymasterAddress}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      // Return default reputation structure
      return {
        address: paymasterAddress,
        score: 50, // Neutral starting score
        metrics: {
          reliability: 50,
          gasEfficiency: 50,
          costStability: 50,
          availability: 50,
          compliance: 50,
          community: 50,
          avgResponseTime: 0
        },
        interactions: [],
        validationResults: null,
        trends: {},
        lastUpdated: Date.now(),
        created: Date.now()
      };
    }
  }

  /**
   * Save reputation data to storage
   */
  async saveReputationData(paymasterAddress, reputation) {
    try {
      const filePath = path.join(this.dataPath, `${paymasterAddress}.json`);
      await fs.writeFile(filePath, JSON.stringify(reputation, null, 2));
    } catch (error) {
      console.log(chalk.gray(`   Failed to save reputation data: ${error.message}`));
    }
  }

  /**
   * Load all reputation data
   */
  async loadReputationData() {
    try {
      const files = await fs.readdir(this.dataPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const address = file.replace('.json', '');
        const reputation = await this.loadPaymasterReputation(address);
        this.reputationCache.set(address, reputation);
      }
      
      console.log(chalk.gray(`   Loaded reputation data for ${jsonFiles.length} paymaster(s)`));
    } catch (error) {
      // First run, no data exists yet
    }
  }

  /**
   * Calculate trends based on historical data
   */
  async calculateTrends(reputation) {
    const interactions = reputation.interactions;
    if (interactions.length < 10) {
      return { insufficient_data: true };
    }

    const recent = interactions.slice(-50);
    const older = interactions.slice(-100, -50);
    
    if (older.length === 0) {
      return { insufficient_data: true };
    }

    const recentSuccess = recent.filter(i => i.success).length / recent.length;
    const olderSuccess = older.filter(i => i.success).length / older.length;
    
    const recentAvgGas = recent.filter(i => i.gasUsed > 0)
      .reduce((sum, i, _, arr) => sum + i.gasUsed / arr.length, 0);
    const olderAvgGas = older.filter(i => i.gasUsed > 0)
      .reduce((sum, i, _, arr) => sum + i.gasUsed / arr.length, 0);

    return {
      reliability: {
        direction: recentSuccess > olderSuccess ? 'improving' : 
                   recentSuccess < olderSuccess ? 'declining' : 'stable',
        change: ((recentSuccess - olderSuccess) * 100).toFixed(1)
      },
      gasEfficiency: {
        direction: recentAvgGas < olderAvgGas ? 'improving' : 
                   recentAvgGas > olderAvgGas ? 'declining' : 'stable',
        change: olderAvgGas > 0 ? (((recentAvgGas - olderAvgGas) / olderAvgGas) * 100).toFixed(1) : '0'
      }
    };
  }

  /**
   * Get reputation grade based on score
   */
  getReputationGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations based on reputation
   */
  generateRecommendations(reputation) {
    const recommendations = [];
    const metrics = reputation.metrics;

    if (metrics.reliability < 80) {
      recommendations.push({
        type: 'reliability',
        priority: metrics.reliability < 60 ? 'high' : 'medium',
        message: 'Improve transaction success rate',
        suggestions: ['Monitor paymaster balance', 'Optimize validation logic', 'Add error handling']
      });
    }

    if (metrics.gasEfficiency < 70) {
      recommendations.push({
        type: 'efficiency',
        priority: 'medium',
        message: 'Optimize gas usage',
        suggestions: ['Review validation algorithm', 'Minimize storage operations', 'Consider gas optimizations']
      });
    }

    if (metrics.costStability < 60) {
      recommendations.push({
        type: 'stability',
        priority: 'low',
        message: 'Improve cost predictability',
        suggestions: ['Implement fixed pricing', 'Add cost monitoring', 'Consider cost caps']
      });
    }

    return recommendations;
  }

  /**
   * Assess risk based on reputation metrics
   */
  assessRisk(reputation) {
    const metrics = reputation.metrics;
    let riskScore = 0;

    if (metrics.reliability < 70) riskScore += 30;
    else if (metrics.reliability < 85) riskScore += 15;

    if (metrics.availability < 80) riskScore += 25;
    else if (metrics.availability < 95) riskScore += 10;

    if (metrics.gasEfficiency < 60) riskScore += 20;
    if (metrics.costStability < 70) riskScore += 15;
    if (metrics.compliance < 80) riskScore += 25;

    return {
      score: riskScore,
      level: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
      factors: this.identifyRiskFactors(metrics)
    };
  }

  /**
   * Identify risk factors
   */
  identifyRiskFactors(metrics) {
    const factors = [];
    
    if (metrics.reliability < 70) factors.push('Low success rate');
    if (metrics.availability < 80) factors.push('Poor availability');
    if (metrics.gasEfficiency < 60) factors.push('High gas consumption');
    if (metrics.costStability < 70) factors.push('Unstable costs');
    if (metrics.compliance < 80) factors.push('Compliance issues');
    
    return factors;
  }

  /**
   * Identify strengths from metrics
   */
  identifyStrengths(report) {
    const strengths = [];
    
    if (report.reliability.successRate >= 95) strengths.push('Excellent reliability');
    if (report.performance.gasEfficiency >= 80) strengths.push('High gas efficiency');
    if (report.performance.costStability >= 85) strengths.push('Stable costs');
    if (report.compliance.eip4337Score >= 90) strengths.push('Full EIP-4337 compliance');
    
    return strengths;
  }

  /**
   * Identify weaknesses from metrics
   */
  identifyWeaknesses(report) {
    const weaknesses = [];
    
    if (report.reliability.successRate < 80) weaknesses.push('Low success rate');
    if (report.performance.gasEfficiency < 60) weaknesses.push('Poor gas efficiency');
    if (report.performance.costStability < 70) weaknesses.push('Unstable costs');
    if (report.compliance.eip4337Score < 70) weaknesses.push('Compliance issues');
    
    return weaknesses;
  }

  /**
   * Generate comparison recommendations
   */
  generateComparisonRecommendations(comparisons) {
    const recommendations = [];
    
    const topPerformer = comparisons[0];
    const avgScore = comparisons.reduce((sum, comp) => sum + comp.reputation, 0) / comparisons.length;
    
    recommendations.push(`Best choice: ${topPerformer.address} (Grade: ${topPerformer.grade})`);
    
    if (topPerformer.reputation > avgScore + 20) {
      recommendations.push('Consider using the top performer for production workloads');
    }
    
    const lowPerformers = comparisons.filter(comp => comp.reputation < 60);
    if (lowPerformers.length > 0) {
      recommendations.push(`Avoid low-performing paymasters: ${lowPerformers.length} found`);
    }
    
    return recommendations;
  }

  /**
   * Calculate tracking period
   */
  calculateTrackingPeriod(interactions) {
    if (interactions.length === 0) return 'No data';
    
    const oldest = Math.min(...interactions.map(i => i.timestamp));
    const newest = Math.max(...interactions.map(i => i.timestamp));
    const diffDays = Math.round((newest - oldest) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Less than 1 day';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.round(diffDays / 30)} months`;
    return `${Math.round(diffDays / 365)} years`;
  }

  /**
   * Clear all reputation data (for testing/reset)
   */
  async clearAllData() {
    try {
      const files = await fs.readdir(this.dataPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.dataPath, file));
        }
      }
      this.reputationCache.clear();
      console.log(chalk.green('✅ All reputation data cleared'));
    } catch (error) {
      throw new Error(`Failed to clear reputation data: ${error.message}`);
    }
  }
}

module.exports = {
  PaymasterReputationTracker,
  createReputationTracker: (options) => new PaymasterReputationTracker(options)
};