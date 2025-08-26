const fs = require('fs').promises;
const { stringify } = require('csv-stringify');
const chalk = require('chalk');

/**
 * Enhanced CSV Exporter for Somnia Gas Profiler
 * Provides comprehensive CSV export with aggregated statistics
 */
class CSVExporter {
  constructor() {
    this.defaultColumns = [
      'contract_address',
      'function_signature',
      'run_number',
      'gas_used',
      'tx_hash',
      'block_number',
      'timestamp',
      'args_json',
      'mode',
      'rpc_endpoint'
    ];

    this.costColumns = [
      'cost_stt',
      'cost_wei', 
      'gas_price_wei'
    ];

    this.aggregateColumns = [
      'function_signature',
      'total_runs',
      'min_gas',
      'max_gas',
      'avg_gas',
      'total_gas',
      'gas_variance',
      'efficiency_rating'
    ];

    this.aggregateCostColumns = [
      'min_cost_stt',
      'max_cost_stt',
      'avg_cost_stt',
      'total_cost_stt'
    ];
  }

  /**
   * Export profiling data to CSV with enhanced formatting
   * @param {Object} profilingData - Raw profiling results
   * @param {string} outputPath - Output CSV file path
   * @param {Object} options - Export options
   * @returns {Promise<void>}
   */
  async exportToCSV(profilingData, outputPath, options = {}) {
    try {
      console.log(chalk.blue('📊 Exporting enhanced CSV report...'));

      const records = await this.generateCSVRecords(profilingData, options);
      
      const csvContent = await new Promise((resolve, reject) => {
        stringify(records, {
          header: true,
          quoted: true,
          quoted_empty: true
        }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      await fs.writeFile(outputPath, csvContent, 'utf8');

      console.log(chalk.green(`✅ CSV exported successfully: ${outputPath}`));
      console.log(chalk.gray(`   Records: ${records.length - 1} (excluding header)`));
      console.log(chalk.gray(`   Columns: ${records[0].length}`));

    } catch (error) {
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  /**
   * Generate CSV records from profiling data
   * @param {Object} profilingData - Raw profiling results
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} CSV records array
   */
  async generateCSVRecords(profilingData, options) {
    const records = [];
    const includeAggregates = options.includeAggregates !== false;
    const includeCosts = this.hasCostData(profilingData);

    // Determine columns
    let columns = [...this.defaultColumns];
    if (includeCosts) {
      columns = columns.concat(this.costColumns);
    }

    // Add headers
    records.push(columns);

    // Add detail records
    for (const [functionSig, result] of Object.entries(profilingData.results || {})) {
      for (const run of result.runs) {
        const record = [
          profilingData.address || '',
          functionSig,
          run.run,
          run.gasUsed,
          run.txHash || '',
          run.blockNumber || '',
          profilingData.timestamp || new Date().toISOString(),
          JSON.stringify(run.args || []),
          run.mode || 'standard',
          profilingData.rpc || ''
        ];

        if (includeCosts && run.costInSTT !== undefined) {
          record.push(
            run.costInSTT || '',
            run.costInWei || '',
            run.gasPrice || ''
          );
        } else if (includeCosts) {
          record.push('', '', '');
        }

        records.push(record);
      }
    }

    // Add aggregated section if requested
    if (includeAggregates) {
      records.push([]); // Empty row separator
      records.push(['=== AGGREGATED STATISTICS ===']);
      records.push([]);

      const aggregateRecords = this.generateAggregateRecords(profilingData, includeCosts);
      records.push(...aggregateRecords);
    }

    return records;
  }

  /**
   * Generate aggregated statistics records
   * @param {Object} profilingData - Raw profiling results
   * @param {boolean} includeCosts - Whether to include cost data
   * @returns {Array} Aggregate records
   */
  generateAggregateRecords(profilingData, includeCosts) {
    const records = [];
    
    // Headers for aggregate section
    let headers = [...this.aggregateColumns];
    if (includeCosts) {
      headers = headers.concat(this.aggregateCostColumns);
    }
    records.push(headers);

    // Calculate aggregate statistics for each function
    for (const [functionSig, result] of Object.entries(profilingData.results || {})) {
      const agg = result.aggregated;
      const variance = this.calculateVariance(result.runs.map(r => r.gasUsed));
      const efficiency = this.calculateEfficiencyRating(agg.avg, agg.min, agg.max);

      const record = [
        functionSig,
        agg.callCount || result.runs.length,
        agg.min,
        agg.max,
        agg.avg,
        agg.total,
        variance.toFixed(2),
        efficiency
      ];

      if (includeCosts && agg.minCost !== undefined) {
        record.push(
          agg.minCost.toFixed(8),
          agg.maxCost.toFixed(8),
          agg.avgCost.toFixed(8),
          agg.totalCost.toFixed(8)
        );
      } else if (includeCosts) {
        record.push('', '', '', '');
      }

      records.push(record);
    }

    return records;
  }

  /**
   * Export to Excel-compatible CSV with enhanced formatting
   * @param {Object} profilingData - Raw profiling results
   * @param {string} outputPath - Output CSV file path
   * @param {Object} options - Export options
   * @returns {Promise<void>}
   */
  async exportToExcelCSV(profilingData, outputPath, options = {}) {
    try {
      console.log(chalk.blue('📊 Exporting Excel-compatible CSV...'));

      const records = await this.generateExcelRecords(profilingData, options);
      
      // Use semicolon delimiter for Excel compatibility
      const csvContent = await new Promise((resolve, reject) => {
        stringify(records, {
          header: true,
          quoted: true,
          delimiter: ';',
          quoted_empty: true
        }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      await fs.writeFile(outputPath, csvContent, 'utf8');

      console.log(chalk.green(`✅ Excel CSV exported: ${outputPath}`));

    } catch (error) {
      throw new Error(`Excel CSV export failed: ${error.message}`);
    }
  }

  /**
   * Generate Excel-optimized records
   * @param {Object} profilingData - Raw profiling results
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Excel-formatted records
   */
  async generateExcelRecords(profilingData, options) {
    const records = [];
    
    // Excel-friendly headers
    const headers = [
      'Contract Address',
      'Function',
      'Run #',
      'Gas Used',
      'Transaction Hash',
      'Block Number',
      'Timestamp',
      'Arguments',
      'Mode',
      'RPC Endpoint'
    ];

    const includeCosts = this.hasCostData(profilingData);
    if (includeCosts) {
      headers.push('Cost (STT)', 'Cost (Wei)', 'Gas Price (Wei)');
    }

    records.push(headers);

    // Data rows with Excel-friendly formatting
    for (const [functionSig, result] of Object.entries(profilingData.results || {})) {
      for (const run of result.runs) {
        const record = [
          profilingData.address || '',
          functionSig,
          run.run,
          run.gasUsed,
          run.txHash || '',
          run.blockNumber || '',
          new Date(profilingData.timestamp || Date.now()).toLocaleString(),
          this.formatArgsForExcel(run.args),
          run.mode || 'standard',
          profilingData.rpc || ''
        ];

        if (includeCosts && run.costInSTT !== undefined) {
          record.push(
            parseFloat(run.costInSTT) || 0,
            run.costInWei || 0,
            run.gasPrice || 0
          );
        } else if (includeCosts) {
          record.push(0, 0, 0);
        }

        records.push(record);
      }
    }

    return records;
  }

  /**
   * Export summary statistics only
   * @param {Object} profilingData - Raw profiling results
   * @param {string} outputPath - Output CSV file path
   * @returns {Promise<void>}
   */
  async exportSummaryCSV(profilingData, outputPath) {
    try {
      console.log(chalk.blue('📊 Exporting summary CSV...'));

      const records = [];
      const includeCosts = this.hasCostData(profilingData);

      // Summary headers
      let headers = [
        'Function',
        'Total Runs',
        'Min Gas',
        'Max Gas',
        'Avg Gas',
        'Total Gas',
        'Gas Efficiency',
        'Complexity Score'
      ];

      if (includeCosts) {
        headers.push('Avg Cost (STT)', 'Total Cost (STT)');
      }

      records.push(headers);

      // Summary data
      for (const [functionSig, result] of Object.entries(profilingData.results || {})) {
        const agg = result.aggregated;
        const efficiency = this.calculateEfficiencyRating(agg.avg, agg.min, agg.max);
        const complexity = this.calculateComplexityScore(functionSig, agg.avg);

        const record = [
          functionSig,
          agg.callCount || result.runs.length,
          agg.min,
          agg.max,
          Math.round(agg.avg),
          agg.total,
          efficiency,
          complexity
        ];

        if (includeCosts && agg.avgCost !== undefined) {
          record.push(
            agg.avgCost.toFixed(8),
            agg.totalCost.toFixed(8)
          );
        } else if (includeCosts) {
          record.push(0, 0);
        }

        records.push(record);
      }

      const csvContent = await new Promise((resolve, reject) => {
        stringify(records, {
          header: true,
          quoted: true
        }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      await fs.writeFile(outputPath, csvContent, 'utf8');
      console.log(chalk.green(`✅ Summary CSV exported: ${outputPath}`));

    } catch (error) {
      throw new Error(`Summary CSV export failed: ${error.message}`);
    }
  }

  /**
   * Check if profiling data contains cost information
   * @param {Object} profilingData - Profiling results
   * @returns {boolean} True if cost data is available
   */
  hasCostData(profilingData) {
    for (const result of Object.values(profilingData.results || {})) {
      if (result.runs.some(run => run.costInSTT !== undefined)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate variance of gas usage
   * @param {Array<number>} values - Gas usage values
   * @returns {number} Variance
   */
  calculateVariance(values) {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate efficiency rating
   * @param {number} avg - Average gas usage
   * @param {number} min - Minimum gas usage
   * @param {number} max - Maximum gas usage
   * @returns {string} Efficiency rating
   */
  calculateEfficiencyRating(avg, min, max) {
    if (min === max) return 'Consistent';
    
    const variance = ((max - min) / avg) * 100;
    
    if (variance < 5) return 'Excellent';
    if (variance < 15) return 'Good';
    if (variance < 30) return 'Fair';
    return 'Variable';
  }

  /**
   * Calculate complexity score based on function signature and gas usage
   * @param {string} functionSig - Function signature
   * @param {number} avgGas - Average gas usage
   * @returns {string} Complexity score
   */
  calculateComplexityScore(functionSig, avgGas) {
    // Parameter count factor
    const paramCount = (functionSig.match(/,/g) || []).length + 1;
    
    // Gas usage factor
    let gasComplexity;
    if (avgGas < 25000) gasComplexity = 1;
    else if (avgGas < 50000) gasComplexity = 2;
    else if (avgGas < 100000) gasComplexity = 3;
    else gasComplexity = 4;

    const totalScore = paramCount + gasComplexity;

    if (totalScore <= 3) return 'Simple';
    if (totalScore <= 5) return 'Moderate';
    if (totalScore <= 7) return 'Complex';
    return 'Very Complex';
  }

  /**
   * Format function arguments for Excel compatibility
   * @param {Array} args - Function arguments
   * @returns {string} Formatted arguments string
   */
  formatArgsForExcel(args) {
    if (!args || args.length === 0) return '[]';
    
    try {
      return JSON.stringify(args).replace(/"/g, '""'); // Escape quotes for Excel
    } catch (error) {
      return String(args);
    }
  }

  /**
   * Generate comparison CSV between two profiling results
   * @param {Object} data1 - First profiling results
   * @param {Object} data2 - Second profiling results
   * @param {string} outputPath - Output CSV file path
   * @returns {Promise<void>}
   */
  async exportComparisonCSV(data1, data2, outputPath) {
    try {
      console.log(chalk.blue('📊 Exporting comparison CSV...'));

      const records = [];
      
      // Comparison headers
      const headers = [
        'Function',
        'Data1_Avg_Gas',
        'Data2_Avg_Gas',
        'Gas_Difference',
        'Percent_Change',
        'Data1_Min_Gas',
        'Data2_Min_Gas',
        'Data1_Max_Gas',
        'Data2_Max_Gas',
        'Performance_Rating'
      ];

      records.push(headers);

      // Find common functions
      const functions1 = Object.keys(data1.results || {});
      const functions2 = Object.keys(data2.results || {});
      const commonFunctions = functions1.filter(f => functions2.includes(f));

      for (const func of commonFunctions) {
        const r1 = data1.results[func].aggregated;
        const r2 = data2.results[func].aggregated;
        
        const gassDiff = r2.avg - r1.avg;
        const percentChange = ((r2.avg - r1.avg) / r1.avg * 100).toFixed(2);
        
        let performanceRating;
        if (gassDiff < -1000) performanceRating = 'Much Better';
        else if (gassDiff < -100) performanceRating = 'Better';
        else if (gassDiff <= 100) performanceRating = 'Similar';
        else if (gassDiff <= 1000) performanceRating = 'Worse';
        else performanceRating = 'Much Worse';

        const record = [
          func,
          r1.avg,
          r2.avg,
          gassDiff,
          percentChange + '%',
          r1.min,
          r2.min,
          r1.max,
          r2.max,
          performanceRating
        ];

        records.push(record);
      }

      const csvContent = await new Promise((resolve, reject) => {
        stringify(records, {
          header: true,
          quoted: true
        }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      await fs.writeFile(outputPath, csvContent, 'utf8');
      console.log(chalk.green(`✅ Comparison CSV exported: ${outputPath}`));

    } catch (error) {
      throw new Error(`Comparison CSV export failed: ${error.message}`);
    }
  }
}

module.exports = {
  CSVExporter
};