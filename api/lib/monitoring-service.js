const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MonitoringService {
  constructor() {
    this.enabled = process.env.AI_MONITORING_ENABLED === 'true';
    this.feedbackCollection = process.env.AI_FEEDBACK_COLLECTION === 'true';
    this.performanceTracking = process.env.AI_PERFORMANCE_TRACKING === 'true';
    this.dataDir = path.join(process.cwd(), 'api', '.monitoring-data');
    this.sessionId = crypto.randomBytes(16).toString('hex');
    this.metrics = {
      analysisCount: 0,
      totalGasSavings: 0,
      recommendationsGenerated: 0,
      implementedRecommendations: 0,
      averageConfidence: 0,
      errorCount: 0
    };
  }

  /**
   * Initialize monitoring service
   */
  async initialize() {
    if (!this.enabled) {
      console.log('📊 Monitoring service disabled');
      return;
    }

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.loadExistingMetrics();
      console.log('📊 Monitoring service initialized');
    } catch (error) {
      console.error('Failed to initialize monitoring service:', error.message);
    }
  }

  /**
   * Load existing metrics from storage
   */
  async loadExistingMetrics() {
    try {
      const metricsFile = path.join(this.dataDir, 'metrics.json');
      const data = await fs.readFile(metricsFile, 'utf8');
      const savedMetrics = JSON.parse(data);
      
      // Merge with current metrics
      Object.keys(this.metrics).forEach(key => {
        if (savedMetrics[key] !== undefined) {
          this.metrics[key] = savedMetrics[key];
        }
      });
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('Starting with fresh monitoring metrics');
    }
  }

  /**
   * Save metrics to storage
   */
  async saveMetrics() {
    if (!this.enabled) return;

    try {
      const metricsFile = path.join(this.dataDir, 'metrics.json');
      await fs.writeFile(metricsFile, JSON.stringify({
        ...this.metrics,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('Failed to save monitoring metrics:', error.message);
    }
  }

  /**
   * Track AI analysis performance
   */
  async trackAnalysis(analysisData) {
    if (!this.enabled || !this.performanceTracking) return;

    try {
      const analysisRecord = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        contractAddress: this.anonymizeAddress(analysisData.contractAddress),
        provider: analysisData.provider,
        confidence: analysisData.confidence,
        recommendationsCount: analysisData.recommendations?.length || 0,
        gasMetrics: {
          totalGasUsed: analysisData.totalGasUsed,
          averageGasPerFunction: analysisData.averageGasPerFunction,
          efficiencyScore: analysisData.gasEfficiencyScore,
          functionCount: analysisData.functionAnalysis?.length || 0
        },
        processingTime: analysisData.processingTime,
        success: analysisData.success !== false
      };

      // Update metrics
      this.metrics.analysisCount++;
      this.metrics.recommendationsGenerated += analysisRecord.recommendationsCount;
      
      if (analysisRecord.confidence) {
        this.metrics.averageConfidence = (
          (this.metrics.averageConfidence * (this.metrics.analysisCount - 1) + analysisRecord.confidence) / 
          this.metrics.analysisCount
        );
      }

      if (!analysisRecord.success) {
        this.metrics.errorCount++;
      }

      // Save analysis record
      await this.saveAnalysisRecord(analysisRecord);
      await this.saveMetrics();

      console.log(`📊 Analysis tracked: ${analysisRecord.recommendationsCount} recommendations, ${analysisRecord.confidence} confidence`);
    } catch (error) {
      console.error('Failed to track analysis:', error.message);
    }
  }

  /**
   * Track gas savings from implemented recommendations
   */
  async trackGasSavings(savingsData) {
    if (!this.enabled || !this.performanceTracking) return;

    try {
      const savingsRecord = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        contractAddress: this.anonymizeAddress(savingsData.contractAddress),
        recommendationId: savingsData.recommendationId,
        beforeGas: savingsData.beforeGas,
        afterGas: savingsData.afterGas,
        gasSaved: savingsData.beforeGas - savingsData.afterGas,
        percentageSaved: ((savingsData.beforeGas - savingsData.afterGas) / savingsData.beforeGas) * 100,
        implementationDifficulty: savingsData.difficulty,
        implementationTime: savingsData.implementationTime
      };

      // Update metrics
      this.metrics.totalGasSavings += savingsRecord.gasSaved;
      this.metrics.implementedRecommendations++;

      // Save savings record
      await this.saveSavingsRecord(savingsRecord);
      await this.saveMetrics();

      console.log(`💰 Gas savings tracked: ${savingsRecord.gasSaved} gas (${savingsRecord.percentageSaved.toFixed(2)}%)`);
    } catch (error) {
      console.error('Failed to track gas savings:', error.message);
    }
  }

  /**
   * Collect user feedback on recommendations
   */
  async collectFeedback(feedbackData) {
    if (!this.enabled || !this.feedbackCollection) return;

    try {
      const feedbackRecord = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        recommendationId: feedbackData.recommendationId,
        contractAddress: this.anonymizeAddress(feedbackData.contractAddress),
        rating: feedbackData.rating, // 1-5 scale
        implemented: feedbackData.implemented,
        helpful: feedbackData.helpful,
        accuracy: feedbackData.accuracy,
        comments: feedbackData.comments,
        category: feedbackData.category // 'optimization', 'security', 'readability', etc.
      };

      await this.saveFeedbackRecord(feedbackRecord);
      console.log(`📝 Feedback collected: ${feedbackRecord.rating}/5 rating`);
    } catch (error) {
      console.error('Failed to collect feedback:', error.message);
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport() {
    if (!this.enabled) {
      return { error: 'Monitoring disabled' };
    }

    try {
      const analysisRecords = await this.loadAnalysisRecords();
      const savingsRecords = await this.loadSavingsRecords();
      const feedbackRecords = await this.loadFeedbackRecords();

      const report = {
        summary: {
          totalAnalyses: this.metrics.analysisCount,
          totalRecommendations: this.metrics.recommendationsGenerated,
          implementedRecommendations: this.metrics.implementedRecommendations,
          totalGasSavings: this.metrics.totalGasSavings,
          averageConfidence: this.metrics.averageConfidence,
          errorRate: this.metrics.analysisCount > 0 ? (this.metrics.errorCount / this.metrics.analysisCount) * 100 : 0,
          implementationRate: this.metrics.recommendationsGenerated > 0 ? 
            (this.metrics.implementedRecommendations / this.metrics.recommendationsGenerated) * 100 : 0
        },
        trends: {
          dailyAnalyses: this.calculateDailyTrends(analysisRecords),
          gasSavingsTrend: this.calculateGasSavingsTrend(savingsRecords),
          confidenceTrend: this.calculateConfidenceTrend(analysisRecords)
        },
        topOptimizations: this.getTopOptimizations(savingsRecords),
        userSatisfaction: this.calculateUserSatisfaction(feedbackRecords),
        recommendations: this.generateRecommendations(analysisRecords, savingsRecords, feedbackRecords),
        generatedAt: new Date().toISOString()
      };

      // Save report
      const reportFile = path.join(this.dataDir, `performance-report-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      return report;
    } catch (error) {
      console.error('Failed to generate performance report:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return {
      ...this.metrics,
      sessionId: this.sessionId,
      enabled: this.enabled,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Reset metrics (for testing or new periods)
   */
  async resetMetrics() {
    if (!this.enabled) return;

    this.metrics = {
      analysisCount: 0,
      totalGasSavings: 0,
      recommendationsGenerated: 0,
      implementedRecommendations: 0,
      averageConfidence: 0,
      errorCount: 0
    };

    await this.saveMetrics();
    console.log('📊 Monitoring metrics reset');
  }

  /**
   * Private helper methods
   */
  async saveAnalysisRecord(record) {
    const filename = `analysis-${record.timestamp.split('T')[0]}.jsonl`;
    const filepath = path.join(this.dataDir, filename);
    await fs.appendFile(filepath, JSON.stringify(record) + '\n');
  }

  async saveSavingsRecord(record) {
    const filename = `savings-${record.timestamp.split('T')[0]}.jsonl`;
    const filepath = path.join(this.dataDir, filename);
    await fs.appendFile(filepath, JSON.stringify(record) + '\n');
  }

  async saveFeedbackRecord(record) {
    const filename = `feedback-${record.timestamp.split('T')[0]}.jsonl`;
    const filepath = path.join(this.dataDir, filename);
    await fs.appendFile(filepath, JSON.stringify(record) + '\n');
  }

  async loadAnalysisRecords(days = 30) {
    return this.loadRecords('analysis', days);
  }

  async loadSavingsRecords(days = 30) {
    return this.loadRecords('savings', days);
  }

  async loadFeedbackRecords(days = 30) {
    return this.loadRecords('feedback', days);
  }

  async loadRecords(type, days) {
    const records = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const files = await fs.readdir(this.dataDir);
      const relevantFiles = files.filter(file => 
        file.startsWith(`${type}-`) && file.endsWith('.jsonl')
      );

      for (const file of relevantFiles) {
        const filepath = path.join(this.dataDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            const recordDate = new Date(record.timestamp);
            
            if (recordDate >= cutoffDate) {
              records.push(record);
            }
          } catch (parseError) {
            // Skip malformed records
          }
        }
      }
    } catch (error) {
      console.error(`Failed to load ${type} records:`, error.message);
    }

    return records;
  }

  calculateDailyTrends(records) {
    const dailyCounts = {};
    
    records.forEach(record => {
      const date = record.timestamp.split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    return Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  calculateGasSavingsTrend(records) {
    const dailySavings = {};
    
    records.forEach(record => {
      const date = record.timestamp.split('T')[0];
      dailySavings[date] = (dailySavings[date] || 0) + record.gasSaved;
    });

    return Object.entries(dailySavings)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, savings]) => ({ date, savings }));
  }

  calculateConfidenceTrend(records) {
    const dailyConfidence = {};
    const dailyCounts = {};
    
    records.forEach(record => {
      if (record.confidence) {
        const date = record.timestamp.split('T')[0];
        dailyConfidence[date] = (dailyConfidence[date] || 0) + record.confidence;
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      }
    });

    return Object.entries(dailyConfidence)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totalConfidence]) => ({
        date,
        averageConfidence: totalConfidence / dailyCounts[date]
      }));
  }

  getTopOptimizations(records) {
    return records
      .sort((a, b) => b.gasSaved - a.gasSaved)
      .slice(0, 10)
      .map(record => ({
        gasSaved: record.gasSaved,
        percentageSaved: record.percentageSaved,
        difficulty: record.implementationDifficulty,
        date: record.timestamp.split('T')[0]
      }));
  }

  calculateUserSatisfaction(records) {
    if (records.length === 0) {
      return { averageRating: 0, totalFeedback: 0, satisfaction: 'No data' };
    }

    const totalRating = records.reduce((sum, record) => sum + (record.rating || 0), 0);
    const averageRating = totalRating / records.length;
    const implementedCount = records.filter(record => record.implemented).length;
    const helpfulCount = records.filter(record => record.helpful).length;

    return {
      averageRating: averageRating.toFixed(2),
      totalFeedback: records.length,
      implementationRate: ((implementedCount / records.length) * 100).toFixed(1),
      helpfulnessRate: ((helpfulCount / records.length) * 100).toFixed(1),
      satisfaction: averageRating >= 4 ? 'High' : averageRating >= 3 ? 'Medium' : 'Low'
    };
  }

  generateRecommendations(analysisRecords, savingsRecords, feedbackRecords) {
    const recommendations = [];

    // Analyze error rate
    const errorRate = this.metrics.analysisCount > 0 ? 
      (this.metrics.errorCount / this.metrics.analysisCount) * 100 : 0;
    
    if (errorRate > 10) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: `High error rate detected (${errorRate.toFixed(1)}%). Consider reviewing API configuration and network stability.`
      });
    }

    // Analyze implementation rate
    const implementationRate = this.metrics.recommendationsGenerated > 0 ? 
      (this.metrics.implementedRecommendations / this.metrics.recommendationsGenerated) * 100 : 0;
    
    if (implementationRate < 20) {
      recommendations.push({
        type: 'adoption',
        priority: 'medium',
        message: `Low implementation rate (${implementationRate.toFixed(1)}%). Consider improving recommendation clarity and providing more detailed implementation guides.`
      });
    }

    // Analyze confidence levels
    if (this.metrics.averageConfidence < 0.7) {
      recommendations.push({
        type: 'accuracy',
        priority: 'medium',
        message: `Low average confidence (${(this.metrics.averageConfidence * 100).toFixed(1)}%). Consider providing more contract context or using a different AI model.`
      });
    }

    // Analyze user satisfaction
    const satisfaction = this.calculateUserSatisfaction(feedbackRecords);
    if (satisfaction.averageRating < 3) {
      recommendations.push({
        type: 'satisfaction',
        priority: 'high',
        message: `Low user satisfaction (${satisfaction.averageRating}/5). Review recommendation quality and user feedback for improvement opportunities.`
      });
    }

    return recommendations;
  }

  anonymizeAddress(address) {
    if (!address || typeof address !== 'string') return address;
    
    if (address.startsWith('0x') && address.length === 42) {
      return `0x${address.slice(2, 6)}...${address.slice(-4)}`;
    }
    
    return '[ADDRESS]';
  }

  /**
   * Export data for external analysis
   */
  async exportData(format = 'json', days = 30) {
    if (!this.enabled) {
      throw new Error('Monitoring disabled');
    }

    const analysisRecords = await this.loadAnalysisRecords(days);
    const savingsRecords = await this.loadSavingsRecords(days);
    const feedbackRecords = await this.loadFeedbackRecords(days);

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        daysCovered: days,
        recordCounts: {
          analyses: analysisRecords.length,
          savings: savingsRecords.length,
          feedback: feedbackRecords.length
        }
      },
      metrics: this.metrics,
      records: {
        analyses: analysisRecords,
        savings: savingsRecords,
        feedback: feedbackRecords
      }
    };

    const filename = `monitoring-export-${Date.now()}.${format}`;
    const filepath = path.join(this.dataDir, filename);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = this.convertToCSV(exportData);
      await fs.writeFile(filepath, csv);
    } else {
      // Default to JSON
      await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    }

    return filepath;
  }

  convertToCSV(data) {
    // Simple CSV conversion for analysis records
    const headers = ['timestamp', 'contractAddress', 'provider', 'confidence', 'recommendationsCount', 'totalGasUsed', 'efficiencyScore'];
    const rows = [headers.join(',')];

    data.records.analyses.forEach(record => {
      const row = [
        record.timestamp,
        record.contractAddress,
        record.provider,
        record.confidence,
        record.recommendationsCount,
        record.gasMetrics.totalGasUsed,
        record.gasMetrics.efficiencyScore
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }
}

module.exports = MonitoringService;