const fs = require('fs').promises;
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { table } = require('table');
const chalk = require('chalk');

class SomniaGasReporter {
  constructor() {
    this.data = null;
  }

  async loadResults(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      this.data = JSON.parse(content);
      console.log(chalk.green(`✅ Loaded profiling results from ${filePath}`));
      return this.data;
    } catch (error) {
      throw new Error(`Failed to load results file: ${error.message}`);
    }
  }

  sortResults(results, sortBy = 'avg') {
    const entries = Object.entries(results);
    
    return entries.sort(([, a], [, b]) => {
      const valueA = a.aggregated[sortBy];
      const valueB = b.aggregated[sortBy];
      return valueB - valueA; // Descending order
    });
  }

  formatNumber(num) {
    return num.toLocaleString();
  }

  generateTableReport(sortBy = 'avg') {
    if (!this.data) {
      throw new Error('No data loaded. Call loadResults() first.');
    }

    const sortedResults = this.sortResults(this.data.results, sortBy);
    
    // Check if any results have cost data
    const hasCostData = Object.values(this.data.results).some(result => 
      result.aggregated.avgCost !== undefined
    );
    
    // Table headers - include cost columns if cost data is available
    const headers = [
      chalk.bold('Function'),
      chalk.bold('Runs'),
      chalk.bold('Min Gas'),
      chalk.bold('Max Gas'),
      chalk.bold('Avg Gas'),
      chalk.bold('Total Gas')
    ];
    
    if (hasCostData) {
      headers.push(
        chalk.bold('Min Cost (STT)'),
        chalk.bold('Max Cost (STT)'),
        chalk.bold('Avg Cost (STT)'),
        chalk.bold('Total Cost (STT)')
      );
    }

    // Table data
    const tableData = [headers];
    
    for (const [functionSig, result] of sortedResults) {
      const row = [
        functionSig,
        result.aggregated.callCount.toString(),
        this.formatNumber(result.aggregated.min),
        this.formatNumber(result.aggregated.max),
        this.formatNumber(result.aggregated.avg),
        this.formatNumber(result.aggregated.total)
      ];
      
      // Add cost data if available
      if (hasCostData) {
        if (result.aggregated.avgCost !== undefined) {
          row.push(
            result.aggregated.minCost.toFixed(8),
            result.aggregated.maxCost.toFixed(8),
            result.aggregated.avgCost.toFixed(8),
            result.aggregated.totalCost.toFixed(8)
          );
        } else {
          row.push('N/A', 'N/A', 'N/A', 'N/A');
        }
      }
      
      tableData.push(row);
    }

    // Configure table formatting
    const config = {
      border: {
        topBody: `─`,
        topJoin: `┬`,
        topLeft: `┌`,
        topRight: `┐`,
        bottomBody: `─`,
        bottomJoin: `┴`,
        bottomLeft: `└`,
        bottomRight: `┘`,
        bodyLeft: `│`,
        bodyRight: `│`,
        bodyJoin: `│`,
        joinBody: `─`,
        joinLeft: `├`,
        joinRight: `┤`,
        joinJoin: `┼`
      },
      columnDefault: {
        paddingLeft: 1,
        paddingRight: 1
      },
      header: {
        alignment: 'center',
        content: chalk.bold('Somnia Gas Profiling Results')
      }
    };

    const tableOutput = table(tableData, config);
    
    // Add metadata
    let output = '\n';
    output += chalk.cyan(`📊 Somnia Gas Profiling Report\n`);
    output += chalk.gray(`─────────────────────────────────────\n`);
    output += chalk.blue(`🌐 Network: ${this.data.network}\n`);
    output += chalk.blue(`🔗 RPC: ${this.data.rpc}\n`);
    output += chalk.blue(`📋 Contract: ${this.data.address}\n`);
    output += chalk.blue(`⏰ Timestamp: ${new Date(this.data.timestamp).toLocaleString()}\n`);
    output += chalk.blue(`📈 Sorted by: ${sortBy} gas\n\n`);
    
    output += tableOutput;
    
    // Add summary statistics
    const totalFunctions = Object.keys(this.data.results).length;
    let totalGas = 0;
    let totalCalls = 0;
    let totalCostSTT = 0;
    let hasSummaryData = false;
    
    for (const result of Object.values(this.data.results)) {
      totalGas += result.aggregated.total;
      totalCalls += result.aggregated.callCount;
      if (result.aggregated.totalCost !== undefined) {
        totalCostSTT += result.aggregated.totalCost;
        hasSummaryData = true;
      }
    }
    
    output += '\n';
    output += chalk.cyan(`📈 Summary Statistics\n`);
    output += chalk.gray(`─────────────────────\n`);
    output += chalk.yellow(`Functions profiled: ${totalFunctions}\n`);
    output += chalk.yellow(`Total transactions: ${totalCalls}\n`);
    output += chalk.yellow(`Total gas consumed: ${this.formatNumber(totalGas)}\n`);
    output += chalk.yellow(`Average per transaction: ${this.formatNumber(Math.round(totalGas / totalCalls))}\n`);
    
    if (hasSummaryData) {
      output += chalk.yellow(`Total cost: ${totalCostSTT.toFixed(8)} STT\n`);
      output += chalk.yellow(`Average cost per transaction: ${(totalCostSTT / totalCalls).toFixed(8)} STT\n`);
    }
    
    output += '\n';
    
    return output;
  }

  generateCSVReport() {
    if (!this.data) {
      throw new Error('No data loaded. Call loadResults() first.');
    }

    const records = [];
    
    // Check if any results have cost data
    const hasCostData = Object.values(this.data.results).some(result => 
      result.runs.some(run => run.costInSTT !== null && run.costInSTT !== undefined)
    );
    
    // Add header
    const headers = [
      'function',
      'run',
      'args_json',
      'gas_used',
      'mode',
      'tx_hash',
      'block_number',
      'rpc'
    ];
    
    if (hasCostData) {
      headers.push('cost_stt', 'cost_wei', 'gas_price_wei');
    }
    
    records.push(headers);

    // Add data rows
    for (const [functionSig, result] of Object.entries(this.data.results)) {
      for (const run of result.runs) {
        const row = [
          functionSig,
          run.run,
          JSON.stringify(run.args),
          run.gasUsed,
          run.mode,
          run.txHash || '',
          run.blockNumber || '',
          this.data.rpc
        ];
        
        // Add cost data if available
        if (hasCostData) {
          row.push(
            run.costInSTT || '',
            run.costInWei || '',
            run.gasPrice || ''
          );
        }
        
        records.push(row);
      }
    }

    return stringify(records, {
      header: false,
      quoted: true
    });
  }

  generateJSONReport() {
    if (!this.data) {
      throw new Error('No data loaded. Call loadResults() first.');
    }

    return JSON.stringify(this.data, null, 2);
  }

  async compareResults(file1Path, file2Path) {
    try {
      const results1 = JSON.parse(await fs.readFile(file1Path, 'utf8'));
      const results2 = JSON.parse(await fs.readFile(file2Path, 'utf8'));

      const comparison = {
        file1: path.basename(file1Path),
        file2: path.basename(file2Path),
        timestamp1: results1.timestamp,
        timestamp2: results2.timestamp,
        differences: {}
      };

      // Find common functions
      const functions1 = Object.keys(results1.results);
      const functions2 = Object.keys(results2.results);
      const commonFunctions = functions1.filter(f => functions2.includes(f));

      for (const func of commonFunctions) {
        const r1 = results1.results[func];
        const r2 = results2.results[func];

        comparison.differences[func] = {
          avg_gas_diff: r2.aggregated.avg - r1.aggregated.avg,
          avg_gas_percent: ((r2.aggregated.avg - r1.aggregated.avg) / r1.aggregated.avg * 100).toFixed(2),
          min_gas_diff: r2.aggregated.min - r1.aggregated.min,
          max_gas_diff: r2.aggregated.max - r1.aggregated.max
        };
      }

      return comparison;
    } catch (error) {
      throw new Error(`Failed to compare results: ${error.message}`);
    }
  }

  generateComparisonReport(comparison) {
    let output = '\n';
    output += chalk.cyan(`🔍 Gas Profiling Comparison Report\n`);
    output += chalk.gray(`═══════════════════════════════════════\n`);
    output += chalk.blue(`📊 File 1: ${comparison.file1} (${new Date(comparison.timestamp1).toLocaleString()})\n`);
    output += chalk.blue(`📊 File 2: ${comparison.file2} (${new Date(comparison.timestamp2).toLocaleString()})\n\n`);

    const headers = [
      chalk.bold('Function'),
      chalk.bold('Avg Gas Diff'),
      chalk.bold('Change %'),
      chalk.bold('Min Diff'),
      chalk.bold('Max Diff')
    ];

    const tableData = [headers];

    for (const [func, diff] of Object.entries(comparison.differences)) {
      const avgDiff = diff.avg_gas_diff;
      const avgDiffFormatted = avgDiff >= 0 ? `+${this.formatNumber(avgDiff)}` : this.formatNumber(avgDiff);
      const percentFormatted = `${diff.avg_gas_percent}%`;
      
      // Color code based on improvement/regression
      const avgColor = avgDiff < 0 ? chalk.green : (avgDiff > 0 ? chalk.red : chalk.gray);
      const percentColor = parseFloat(diff.avg_gas_percent) < 0 ? chalk.green : (parseFloat(diff.avg_gas_percent) > 0 ? chalk.red : chalk.gray);

      tableData.push([
        func,
        avgColor(avgDiffFormatted),
        percentColor(percentFormatted),
        diff.min_gas_diff >= 0 ? `+${this.formatNumber(diff.min_gas_diff)}` : this.formatNumber(diff.min_gas_diff),
        diff.max_gas_diff >= 0 ? `+${this.formatNumber(diff.max_gas_diff)}` : this.formatNumber(diff.max_gas_diff)
      ]);
    }

    output += table(tableData);
    output += '\n';
    output += chalk.yellow(`💡 Green = Gas savings, Red = Gas increase\n\n`);

    return output;
  }

  async generate(options) {
    const {
      in: inputFile,
      format,
      out: outputFile,
      sort,
      nl,
      compare,
      verbose
    } = options;

    try {
      // Load primary results
      await this.loadResults(inputFile);

      let output = '';

      // Handle comparison if requested
      if (compare) {
        const comparison = await this.compareResults(inputFile, compare);
        output = this.generateComparisonReport(comparison);
        console.log(output);
        return;
      }

      // Generate report based on format
      switch (format) {
        case 'json':
          output = this.generateJSONReport();
          break;
        case 'csv':
          output = this.generateCSVReport();
          break;
        case 'table':
        default:
          output = this.generateTableReport(sort);
          break;
      }

      // Save to file or output to console
      if (outputFile) {
        await fs.writeFile(outputFile, output, 'utf8');
        console.log(chalk.green(`💾 Report saved to ${outputFile}`));
      } else {
        console.log(output);
      }

      // Generate natural language summary if requested
      if (nl) {
        await this.generateNaturalLanguageSummary();
      }

    } catch (error) {
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  async generateNaturalLanguageSummary() {
    try {
      console.log(chalk.blue('\n🤖 Generating AI-powered summary...\n'));
      
      // Check for OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.log(chalk.yellow('⚠️  OPENAI_API_KEY not found. Skipping natural language summary.'));
        console.log(chalk.gray('   Set OPENAI_API_KEY environment variable to enable AI summaries.'));
        return;
      }

      // Import OpenAI (dynamic import for optional dependency)
      let OpenAI;
      try {
        OpenAI = require('openai');
      } catch (error) {
        console.log(chalk.yellow('⚠️  OpenAI package not available. Install with: npm install openai'));
        return;
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Prepare data for AI analysis
      const functionsData = Object.entries(this.data.results).map(([func, result]) => ({
        function: func,
        avgGas: result.aggregated.avg,
        minGas: result.aggregated.min,
        maxGas: result.aggregated.max,
        calls: result.aggregated.callCount
      }));

      const prompt = `Analyze this Somnia blockchain gas profiling data and provide a concise technical summary (max 120 words):

Contract: ${this.data.address}
Network: ${this.data.network}

Gas Usage Data:
${functionsData.map(f => `- ${f.function}: avg ${f.avgGas} gas (range: ${f.minGas}-${f.maxGas})`).join('\n')}

Focus on:
1. Gas efficiency patterns
2. Most/least expensive functions
3. Optimization recommendations
4. Notable gas usage characteristics

Keep it technical and actionable for smart contract developers.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3
      });

      const summary = response.choices[0].message.content.trim();
      
      console.log(chalk.cyan('🧠 AI Analysis Summary'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white(summary));
      console.log('\n');

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to generate AI summary: ${error.message}`));
    }
  }
}

module.exports = {
  generate: async (options) => {
    const reporter = new SomniaGasReporter();
    await reporter.generate(options);
  },
  SomniaGasReporter
};