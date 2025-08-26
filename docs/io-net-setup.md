# IO.net Intelligence API Setup Guide

This guide explains how to set up and configure the IO.net Intelligence API for AI-powered gas analysis in the Somnia Gas Profiler.

## 🌟 Overview

The IO.net Intelligence API provides advanced AI capabilities for natural language analysis of smart contract gas usage. It uses the DeepSeek-R1-0528 model to deliver:

- **Gas optimization recommendations**
- **Cost analysis and projections**  
- **Best practices compliance checking**
- **Production readiness assessment**
- **Security consideration insights**

## 🚀 Getting Started

### Step 1: Obtain IO.net API Key

1. Visit [IO.net Intelligence Platform](https://io.net)
2. Create an account or sign in
3. Navigate to the API section
4. Generate a new API key for your project
5. Copy the API key (format: `io_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file
nano .env  # or your preferred editor
```

Add your IO.net API key:
```bash
# IO.net Intelligence API for natural language analysis
IOINTELLIGENCE_API_KEY=your_actual_io_net_api_key_here
```

### Step 3: Verify Configuration

```bash
# Test the configuration
somnia-gas-profiler quick-analyze \\n  --address 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15 \\n  --standard ERC20 \\n  --runs 2
```

If configured correctly, you should see:
```
✅ IO.net Intelligence API configured
   Model: deepseek-ai/DeepSeek-R1-0528
   Endpoint: https://api.intelligence.io.solutions/api/v1/chat/completions

🤖 Generating AI-powered gas analysis via IO.net...
```

## 🔧 API Configuration Details

### Endpoint Information

- **Base URL**: `https://api.intelligence.io.solutions`
- **Chat Completions**: `/api/v1/chat/completions`
- **Model**: `deepseek-ai/DeepSeek-R1-0528`
- **Authentication**: Bearer token

### Request Format

The profiler sends requests in the following format:

```json
{
  \"model\": \"deepseek-ai/DeepSeek-R1-0528\",
  \"messages\": [
    {
      \"role\": \"system\",
      \"content\": \"You are an expert Ethereum gas optimization analyst...\"
    },
    {
      \"role\": \"user\",
      \"content\": \"Contract Address: 0x123...\nNetwork: Somnia Testnet\n...\"
    }
  ]
}
```

### Response Structure

```json
{
  \"id\": \"chatcmpl-xxxxx\",
  \"object\": \"chat.completion\",
  \"created\": 1692998765,
  \"model\": \"deepseek-ai/DeepSeek-R1-0528\",
  \"choices\": [
    {
      \"index\": 0,
      \"message\": {
        \"role\": \"assistant\",
        \"content\": \"## Smart Contract Gas Analysis Report...\"
      },
      \"finish_reason\": \"stop\"
    }
  ],
  \"usage\": {
    \"prompt_tokens\": 245,
    \"completion_tokens\": 512,
    \"total_tokens\": 757
  }
}
```

## 💡 Analysis Types

### Basic Analysis (Default)
General gas efficiency assessment with optimization recommendations.

```bash
somnia-gas-profiler profile --address 0x123... --abi contract.json
```

### Optimization Analysis
Focused on specific optimization opportunities.

```bash
# Use natural language analyzer directly for optimization focus
node -e \"
const { NaturalLanguageAnalyzer } = require('./lib/nl-analyzer');
const analyzer = new NaturalLanguageAnalyzer();
analyzer.generateAnalysis(profilingData, { type: 'optimization_analysis' })
  .then(result => analyzer.displayAnalysis(result));
\"
```

### Cost Analysis
Detailed cost breakdown and projections.

```bash
# Automatically triggered when cost data is available
somnia-gas-profiler profile \\n  --address 0x123... \\n  --runs 10  # Higher runs for better cost analysis
```

### Deployment Analysis
Production readiness assessment.

```bash
somnia-gas-profiler compile-and-profile \\n  --source MyContract.sol \\n  --optimization-runs 1000
# Includes deployment-focused analysis
```

## 🎯 Optimization Prompts

The profiler uses specialized prompts for different analysis types:

### Gas Optimization Prompt
```
Contract Gas Optimization Analysis Request:

Contract: {address}
Network: Somnia Testnet
Functions Analyzed: {function_count}

HIGH GAS FUNCTIONS:
- transfer(address,uint256): 51,245 gas average
- approve(address,uint256): 46,512 gas average

Please provide:
1. Specific optimization opportunities
2. Code patterns that could be improved
3. Solidity best practices recommendations
4. Potential gas savings estimates
5. Risk assessment for optimization strategies
```

### Cost Analysis Prompt
```
Smart Contract Cost Analysis (Somnia Network):

Contract: {address}
Cost Data Available: Yes (STT token costs calculated)

Please provide comprehensive cost analysis including:
1. User interaction cost estimates in STT
2. Cost-effectiveness compared to other networks
3. Gas price volatility impact
4. Cost optimization strategies
5. Break-even analysis for usage patterns
```

## 🔒 Security & Best Practices

### API Key Security

```bash
# ✅ Good: Use environment variables
export IOINTELLIGENCE_API_KEY=\"your_key_here\"

# ❌ Bad: Hard-code in scripts
somnia-gas-profiler profile --api-key \"your_key_here\"  # Don't do this
```

### Rate Limiting

- The profiler includes automatic rate limiting
- Default timeout: 30 seconds per request
- Retries on temporary failures
- Graceful fallback when API is unavailable

### Data Privacy

- Only gas profiling data is sent to IO.net
- No private keys or sensitive data transmitted
- Contract addresses and function signatures are included
- Analysis results can be saved locally

## 🛠️ Troubleshooting

### Common Issues

#### \"IOINTELLIGENCE_API_KEY not configured\"
```bash
# Check if .env file exists and contains the key
cat .env | grep IOINTELLIGENCE_API_KEY

# Verify environment variable is loaded
echo $IOINTELLIGENCE_API_KEY
```

#### \"IO.net API error (401): Unauthorized\"
```bash
# Invalid API key - verify the key is correct
# Check for extra spaces or characters
# Regenerate API key if necessary
```

#### \"Failed to connect to IO.net API\"
```bash
# Check internet connection
ping api.intelligence.io.solutions

# Test direct API access
curl -H \"Authorization: Bearer $IOINTELLIGENCE_API_KEY\" \\n     https://api.intelligence.io.solutions/api/v1/chat/completions
```

#### \"Analysis timeout\"
```bash
# For large contracts, increase timeout or skip AI analysis
somnia-gas-profiler profile --address 0x123... --skip-ai
```

### Debug Mode

```bash
# Enable verbose logging to see API requests/responses
somnia-gas-profiler profile \\n  --address 0x123... \\n  --abi contract.json \\n  --verbose
```

### Fallback Mode

When IO.net API is unavailable, the profiler provides automated analysis:

```
AUTOMATED ANALYSIS (AI service unavailable)

Contract: 0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15
Functions Analyzed: 6
Total Gas Consumed: 833,965

PERFORMANCE OVERVIEW:
- Highest gas function: transferFrom(address,address,uint256) (62,123 gas avg)
- Lowest gas function: totalSupply() (2,123 gas avg)

RECOMMENDATIONS:
1. Review high-gas functions for optimization opportunities
2. Consider gas-efficient alternatives for expensive operations
3. Implement proper testing for gas usage validation

Note: Enhanced AI analysis available when IOINTELLIGENCE_API_KEY is configured.
```

## 📊 Usage Monitoring

### Token Usage Tracking

The profiler displays token usage after each analysis:

```
🤖 Generating AI-powered gas analysis via IO.net...
📊 Tokens used: 1,247 (prompt: 523, completion: 724)
```

### Cost Estimation

- Average analysis: 500-1500 tokens
- Complex contracts: 1000-3000 tokens
- Comparison analysis: 800-2000 tokens

Refer to [IO.net pricing](https://io.net/pricing) for current token costs.

## 🔧 Advanced Configuration

### Custom Analysis Templates

Extend the natural language analyzer with custom prompts:

```javascript
// lib/custom-prompts.js
const customPrompts = {
  DEFI_ANALYSIS: (data) => `
    DeFi Protocol Gas Analysis:
    
    Contract: ${data.address}
    Focus Areas:
    1. MEV protection gas costs
    2. Slippage tolerance impact
    3. Liquidity provider efficiency
    4. Flash loan gas optimization
    
    Please provide DeFi-specific optimization recommendations...
  `
};

module.exports = { customPrompts };
```

### Integration with Development Tools

```json
// package.json
{
  \"scripts\": {
    \"gas-check\": \"somnia-gas-profiler compile-and-profile --source contracts/MyContract.sol\",
    \"gas-compare\": \"somnia-gas-profiler report --in before.json --compare after.json\",
    \"gas-ci\": \"somnia-gas-profiler quick-analyze --address $CONTRACT_ADDRESS --skip-ai\"
  }
}
```

### Environment Variables Reference

```bash
# Required
IOINTELLIGENCE_API_KEY=your_api_key_here

# Optional customization
IO_NET_TIMEOUT=30000          # Request timeout in milliseconds
IO_NET_MAX_RETRIES=3          # Maximum retry attempts
IO_NET_MODEL=deepseek-ai/DeepSeek-R1-0528  # Model to use
```

## 🤝 Support

For IO.net API issues:
- [IO.net Documentation](https://docs.io.net)
- [IO.net Support](https://io.net/support)
- [Community Discord](https://discord.gg/io-net)

For Somnia Gas Profiler issues:
- [GitHub Issues](https://github.com/Codex-zero-source/Somnia-Gas-Profiler/issues)
- [Somnia Documentation](https://docs.somnia.network)

---

*The IO.net Intelligence API integration provides powerful AI-driven insights to help optimize your smart contracts for the Somnia network. For the most current API documentation and features, always refer to the official IO.net documentation.*", "original_text": "", "replace_all": false}]