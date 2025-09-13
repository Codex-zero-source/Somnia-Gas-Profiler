#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const AIGasAnalyzer = require('../lib/ai-gas-analyzer');
const SecurityManager = require('../lib/security-manager');
const MonitoringService = require('../lib/monitoring-service');

const program = new Command();

program
  .name('ai-analyze')
  .description('AI-powered gas consumption analysis for smart contracts')
  .version('1.0.0');

// Main AI analysis command
program
  .command('analyze')
  .description('Perform AI analysis on gas profiling results')
  .requiredOption('-f, --file <path>', 'Path to gas profiling results JSON file')
  .option('-c, --contract <address>', 'Contract address for enhanced analysis')
  .option('-s, --source <path>', 'Path to contract source code file')
  .option('-p, --provider <provider>', 'AI provider (iointelligence, openai, anthropic)', 'iointelligence')
  .option('-o, --output <path>', 'Output path for AI analysis results')
  .option('--confidence <threshold>', 'Minimum confidence threshold (0.0-1.0)', '0.7')
  .option('--save-feedback', 'Enable feedback collection for this analysis')
  .option('--verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🤖 Starting AI-powered gas analysis...'));
      
      // Initialize services
      const aiAnalyzer = new AIGasAnalyzer({ 
        provider: options.provider,
        confidenceThreshold: parseFloat(options.confidence)
      });
      const securityManager = new SecurityManager();
      const monitoringService = new MonitoringService();
      
      await monitoringService.initialize();
      
      // Validate security configuration
      const securityCheck = securityManager.validateSecurityConfig();
      if (!securityCheck.isSecure) {
        console.log(chalk.yellow('⚠️  Security configuration issues detected:'));
        securityCheck.issues.forEach(issue => {
          console.log(chalk.gray(`   - ${issue}`));
        });
        console.log();
      }
      
      // Load profiling results
      console.log(chalk.blue('📊 Loading gas profiling results...'));
      const profilingData = await loadProfilingResults(options.file);
      
      // Load contract source code if provided
      let contractCode = null;
      if (options.source) {
        try {
          contractCode = await fs.readFile(options.source, 'utf8');
          console.log(chalk.green(`✅ Contract source loaded: ${options.source}`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Failed to load contract source: ${error.message}`));
        }
      }
      
      // Extract gas metrics
      console.log(chalk.blue('🔍 Extracting gas metrics...'));
      const gasMetrics = aiAnalyzer.extractGasMetrics(profilingData);
      
      if (options.verbose) {
        console.log(chalk.gray('Gas Metrics:'));
        console.log(chalk.gray(`  Total Gas Used: ${gasMetrics.totalGasUsed}`));
        console.log(chalk.gray(`  Average Gas Per Function: ${gasMetrics.averageGasPerFunction}`));
        console.log(chalk.gray(`  Efficiency Score: ${gasMetrics.gasEfficiencyScore}`));
        console.log(chalk.gray(`  Functions Analyzed: ${gasMetrics.functionAnalysis.length}`));
      }
      
      // Perform AI analysis
      const startTime = Date.now();
      console.log(chalk.blue('🧠 Performing AI analysis...'));
      
      const aiAnalysis = await aiAnalyzer.analyzeWithAI(gasMetrics, contractCode);
      const processingTime = Date.now() - startTime;
      
      // Display results
      displayAnalysisResults(aiAnalysis, options.verbose);
      
      // Save results
      const outputPath = options.output || `ai-analysis-${Date.now()}.json`;
      await fs.writeFile(outputPath, JSON.stringify(aiAnalysis, null, 2));
      console.log(chalk.green(`💾 Analysis saved to: ${outputPath}`));
      
      // Track analysis for monitoring
      await monitoringService.trackAnalysis({
        contractAddress: options.contract || 'unknown',
        provider: options.provider,
        confidence: aiAnalysis.aiAnalysis?.confidence,
        recommendations: aiAnalysis.aiAnalysis?.recommendations,
        totalGasUsed: gasMetrics.totalGasUsed,
        averageGasPerFunction: gasMetrics.averageGasPerFunction,
        gasEfficiencyScore: gasMetrics.gasEfficiencyScore,
        functionAnalysis: gasMetrics.functionAnalysis,
        processingTime,
        success: true
      });
      
      // Collect feedback if enabled
      if (options.saveFeedback) {
        await collectUserFeedback(aiAnalysis, options.contract, monitoringService);
      }
      
      console.log(chalk.green('✅ AI analysis completed successfully!'));
      
    } catch (error) {
      console.error(chalk.red(`❌ AI analysis failed: ${error.message}`));
      
      // Track error for monitoring
      const monitoringService = new MonitoringService();
      await monitoringService.trackAnalysis({
        contractAddress: options.contract || 'unknown',
        provider: options.provider,
        success: false,
        error: error.message
      });
      
      process.exit(1);
    }
  });

// Security check command
program
  .command('security-check')
  .description('Validate AI analysis security configuration')
  .action(async () => {
    try {
      console.log(chalk.blue('🔒 Checking security configuration...'));
      
      const securityManager = new SecurityManager();
      const securityCheck = securityManager.validateSecurityConfig();
      
      if (securityCheck.isSecure) {
        console.log(chalk.green('✅ Security configuration is properly set up'));
      } else {
        console.log(chalk.red('❌ Security configuration issues detected:'));
        securityCheck.issues.forEach(issue => {
          console.log(chalk.yellow(`   - ${issue}`));
        });
        
        console.log(chalk.blue('\n📋 Recommendations:'));
        securityCheck.recommendations.forEach(rec => {
          console.log(chalk.gray(`   - ${rec}`));
        });
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Security check failed: ${error.message}`));
      process.exit(1);
    }
  });

// Monitoring report command
program
  .command('report')
  .description('Generate AI analysis performance report')
  .option('-d, --days <number>', 'Number of days to include in report', '30')
  .option('-o, --output <path>', 'Output path for the report')
  .option('--format <format>', 'Report format (json, csv)', 'json')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📊 Generating performance report...'));
      
      const monitoringService = new MonitoringService();
      await monitoringService.initialize();
      
      const report = await monitoringService.generatePerformanceReport();
      
      if (report.error) {
        console.error(chalk.red(`❌ Failed to generate report: ${report.error}`));
        process.exit(1);
      }
      
      // Display summary
      console.log(chalk.cyan('\n📈 Performance Summary:'));
      console.log(chalk.white(`   Total Analyses: ${report.summary.totalAnalyses}`));
      console.log(chalk.white(`   Total Recommendations: ${report.summary.totalRecommendations}`));
      console.log(chalk.white(`   Implementation Rate: ${report.summary.implementationRate.toFixed(1)}%`));
      console.log(chalk.white(`   Total Gas Savings: ${report.summary.totalGasSavings}`));
      console.log(chalk.white(`   Average Confidence: ${(report.summary.averageConfidence * 100).toFixed(1)}%`));
      console.log(chalk.white(`   Error Rate: ${report.summary.errorRate.toFixed(1)}%`));
      
      // Display recommendations
      if (report.recommendations.length > 0) {
        console.log(chalk.cyan('\n💡 System Recommendations:'));
        report.recommendations.forEach(rec => {
          const color = rec.priority === 'high' ? chalk.red : 
                       rec.priority === 'medium' ? chalk.yellow : chalk.gray;
          console.log(color(`   [${rec.priority.toUpperCase()}] ${rec.message}`));
        });
      }
      
      // Save report
      const outputPath = options.output || `performance-report-${Date.now()}.${options.format}`;
      
      if (options.format === 'csv') {
        const csvData = await monitoringService.exportData('csv', parseInt(options.days));
        await fs.copyFile(csvData, outputPath);
      } else {
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
      }
      
      console.log(chalk.green(`💾 Report saved to: ${outputPath}`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Report generation failed: ${error.message}`));
      process.exit(1);
    }
  });

// Feedback command
program
  .command('feedback')
  .description('Submit feedback on AI recommendations')
  .requiredOption('-r, --recommendation-id <id>', 'Recommendation ID')
  .requiredOption('--rating <rating>', 'Rating (1-5)')
  .option('-c, --contract <address>', 'Contract address')
  .option('--implemented', 'Mark recommendation as implemented')
  .option('--helpful', 'Mark recommendation as helpful')
  .option('--comments <text>', 'Additional comments')
  .option('--category <category>', 'Feedback category (optimization, security, readability)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📝 Submitting feedback...'));
      
      const monitoringService = new MonitoringService();
      await monitoringService.initialize();
      
      const rating = parseInt(options.rating);
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      await monitoringService.collectFeedback({
        recommendationId: options.recommendationId,
        contractAddress: options.contract,
        rating,
        implemented: options.implemented || false,
        helpful: options.helpful || false,
        comments: options.comments || '',
        category: options.category || 'optimization'
      });
      
      console.log(chalk.green('✅ Feedback submitted successfully!'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Feedback submission failed: ${error.message}`));
      process.exit(1);
    }
  });

// Gas savings tracking command
program
  .command('track-savings')
  .description('Track gas savings from implemented recommendations')
  .requiredOption('-r, --recommendation-id <id>', 'Recommendation ID')
  .requiredOption('-c, --contract <address>', 'Contract address')
  .requiredOption('--before <gas>', 'Gas usage before optimization')
  .requiredOption('--after <gas>', 'Gas usage after optimization')
  .option('--difficulty <level>', 'Implementation difficulty (easy, medium, hard)', 'medium')
  .option('--time <minutes>', 'Implementation time in minutes')
  .action(async (options) => {
    try {
      console.log(chalk.blue('💰 Tracking gas savings...'));
      
      const monitoringService = new MonitoringService();
      await monitoringService.initialize();
      
      const beforeGas = parseInt(options.before);
      const afterGas = parseInt(options.after);
      
      if (beforeGas <= afterGas) {
        console.log(chalk.yellow('⚠️  Warning: No gas savings detected (after >= before)'));
      }
      
      await monitoringService.trackGasSavings({
        recommendationId: options.recommendationId,
        contractAddress: options.contract,
        beforeGas,
        afterGas,
        difficulty: options.difficulty,
        implementationTime: options.time ? parseInt(options.time) : null
      });
      
      const gasSaved = beforeGas - afterGas;
      const percentageSaved = ((gasSaved / beforeGas) * 100).toFixed(2);
      
      console.log(chalk.green(`✅ Gas savings tracked: ${gasSaved} gas (${percentageSaved}%)!`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Gas savings tracking failed: ${error.message}`));
      process.exit(1);
    }
  });

// Helper functions
async function loadProfilingResults(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    
    // Validate the structure
    if (!parsed.results || typeof parsed.results !== 'object') {
      throw new Error('Invalid profiling results format: missing results object');
    }
    
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Profiling results file not found: ${filePath}`);
    }
    throw new Error(`Failed to load profiling results: ${error.message}`);
  }
}

function displayAnalysisResults(analysis, verbose = false) {
  console.log(chalk.cyan('\n🎯 AI Analysis Results:'));
  
  if (analysis.aiAnalysis) {
    const ai = analysis.aiAnalysis;
    
    console.log(chalk.white(`   Provider: ${ai.provider}`));
    console.log(chalk.white(`   Confidence: ${(ai.confidence * 100).toFixed(1)}%`));
    console.log(chalk.white(`   Recommendations: ${ai.recommendations?.length || 0}`));
    
    if (ai.summary) {
      console.log(chalk.gray(`\n📋 Summary:`));
      console.log(chalk.gray(`   ${ai.summary}`));
    }
    
    if (ai.recommendations && ai.recommendations.length > 0) {
      console.log(chalk.cyan('\n💡 Top Recommendations:'));
      ai.recommendations.slice(0, verbose ? ai.recommendations.length : 3).forEach((rec, index) => {
        const priorityColor = rec.priority === 'High' ? chalk.red : 
                             rec.priority === 'Medium' ? chalk.yellow : chalk.gray;
        
        console.log(chalk.white(`\n   ${index + 1}. ${rec.title}`));
        console.log(priorityColor(`      Priority: ${rec.priority}`));
        console.log(chalk.gray(`      Difficulty: ${rec.difficulty}`));
        console.log(chalk.green(`      Estimated Savings: ${rec.estimatedSavings}`));
        console.log(chalk.gray(`      ${rec.description}`));
        
        if (verbose && rec.implementation) {
          console.log(chalk.blue(`      Implementation:`));
          rec.implementation.split('\n').forEach(step => {
            console.log(chalk.gray(`        ${step}`));
          });
        }
      });
    }
    
    if (ai.riskAssessment && verbose) {
      console.log(chalk.yellow(`\n⚠️  Risk Assessment:`));
      console.log(chalk.gray(`   ${ai.riskAssessment}`));
    }
  } else {
    console.log(chalk.yellow('   No AI analysis available'));
  }
  
  // Display gas metrics
  if (verbose) {
    console.log(chalk.cyan('\n📊 Gas Metrics:'));
    console.log(chalk.white(`   Total Gas Used: ${analysis.totalGasUsed}`));
    console.log(chalk.white(`   Average Gas Per Function: ${analysis.averageGasPerFunction}`));
    console.log(chalk.white(`   Efficiency Score: ${analysis.gasEfficiencyScore}/100`));
    
    if (analysis.functionAnalysis && analysis.functionAnalysis.length > 0) {
      console.log(chalk.cyan('\n🔍 Function Analysis:'));
      analysis.functionAnalysis.forEach(func => {
        console.log(chalk.white(`   ${func.name}: ${func.gasUsed} gas (${func.efficiency.toFixed(1)}% efficient)`));
      });
    }
  }
}

async function collectUserFeedback(analysis, contractAddress, monitoringService) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  try {
    console.log(chalk.cyan('\n📝 Feedback Collection (optional - press Enter to skip):'));
    
    const rating = await question('Rate the overall analysis quality (1-5): ');
    if (!rating) {
      console.log(chalk.gray('Feedback collection skipped'));
      return;
    }
    
    const helpful = await question('Were the recommendations helpful? (y/n): ');
    const implemented = await question('Do you plan to implement any recommendations? (y/n): ');
    const comments = await question('Additional comments: ');
    
    await monitoringService.collectFeedback({
      recommendationId: `analysis-${Date.now()}`,
      contractAddress,
      rating: parseInt(rating) || 3,
      helpful: helpful.toLowerCase().startsWith('y'),
      implemented: implemented.toLowerCase().startsWith('y'),
      comments,
      category: 'optimization'
    });
    
    console.log(chalk.green('✅ Thank you for your feedback!'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Feedback collection failed, continuing...'));
  } finally {
    rl.close();
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red(`❌ Unhandled error: ${error.message}`));
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n⚠️  Process interrupted by user'));
  process.exit(0);
});

program.parse();