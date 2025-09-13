# Somnia Gas Profiler

Professional gas profiling and analysis platform for Somnia smart contracts. This repository contains a unified Node.js API that serves a modern React (Vite) frontend and exposes HTTP endpoints for programmatic analysis. It also includes a CLI toolkit used by the API for executing analyses.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/somnia/gas-profiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

## Overview

- Unified deployment: Express API (Node.js) + React frontend (Vite) under `api/`
- ABI auto‑fetching for contracts on the Somnia network
- Redis‑backed caching of analysis results to speed up repeat requests
- Export analysis in JSON/CSV and view results in a polished web UI
- CLI analysis tools integrated and used by the API

Live service (Render): https://somnia-gas-profiler.onrender.com

## Features

- **Automated ABI Fetching**: Automatically retrieves contract ABIs from Somnia Explorer
- **Comprehensive Gas Analysis**: Detailed gas consumption profiling for smart contract functions
- **Developer-Focused Insights**: Categorized analysis with optimization recommendations
- **Multiple Output Formats**: JSON, CSV, and table formats for different use cases
- **Gasless Profiling**: Analyze contracts without spending gas using static analysis
- **Cost Calculation**: Automatic STT (Somnia Test Token) cost calculations
- **Production Ready**: Clean, lightweight setup with professional documentation

## 📋 Prerequisites

- **Node.js**: Version 16.0.0 or higher
- **npm**: Latest version recommended
- **Git**: For cloning the repository
- **Redis**: Server for caching and session management
- **Access**: To Somnia blockchain network

## ⚡ Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/somnia/gas-profiler.git
cd gas-profiler

# Install root dependencies (for CLI tools and testing)
npm install

# Install API service dependencies
cd api
npm install

# Build the React frontend
cd frontend
npm install
npm run build
cd ..

# Set up environment variables
cp ../.env.example .env
# Edit .env with your Redis and blockchain configuration

# Start Redis server (if not already running)
redis-server

# Start the unified API + frontend server
node server.js
```

The application will be available at `http://localhost:3000` with both the web interface and API endpoints.

### Basic Usage

#### Web Interface
Once the server is running, open your browser to `http://localhost:3000` to access the modern React-based interface where you can:
- Enter contract addresses for analysis
- View detailed gas profiling results
- Export analysis data in JSON or CSV format
- Browse recent analyses and statistics

#### API Endpoints
The server exposes REST API endpoints for programmatic access:

```bash
# Analyze a contract via API
curl -X POST http://localhost:3000/api/full-analyze \
  -H "Content-Type: application/json" \
  -d '{"contractAddress": "0x1234567890123456789012345678901234567890"}'

# Get recent analyses
curl http://localhost:3000/api/recent-analyses

# Check server health
curl http://localhost:3000/api/health
```

#### CLI Tools (Development)
For development and testing, CLI tools are available at the project root:

```bash
# Quick analysis with automatic ABI fetching
node cli/quick-analyze.js --address 0x1234567890123456789012345678901234567890

# Batch profiling multiple contracts
node cli/batch-profiling.js --file contracts.txt
```

## 🔧 API Reference

### POST /api/full-analyze
Performs comprehensive gas analysis on a smart contract.

**Request Body:**
```json
{
  "contractAddress": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contractAddress": "0x1234...",
    "analysis": { /* detailed analysis results */ },
    "exportFiles": {
      "json": "/path/to/analysis.json",
      "csv": "/path/to/analysis.csv"
    }
  }
}
```

### GET /api/recent-analyses
Retrieve recently performed analyses.

**Query Parameters:**
- `limit` (optional): Number of results to return (default: 10)

### GET /api/analysis/:contractAddress
Retrieve cached analysis for a specific contract address.

### DELETE /api/analysis/:contractAddress
Delete cached analysis for a specific contract address.

### GET /api/health
Health check endpoint returning server status and Redis connection info.

### GET /api/stats
Retrieve global statistics about analyses performed.

## 🛠️ CLI Commands (Development)

The following CLI tools are available for development and testing purposes. In production, the API server uses its own co-located copies of these tools.

### Quick Analysis
```bash
node cli/quick-analyze.js --address <CONTRACT_ADDRESS> [options]

Options:
  --address        Contract address (required)
  --export-redis   Export to Redis cache
  --export-csv     Export to CSV file
  --output         Custom output directory
  --verbose        Enable verbose output
```

### Batch Processing
```bash
node cli/batch-profiling.js --file <ADDRESSES_FILE> [options]

Options:
  --file           File containing contract addresses (one per line)
  --concurrent     Number of concurrent analyses (default: 3)
  --delay          Delay between analyses in ms (default: 1000)
  --output-dir     Directory for output files
```

### Paymaster Discovery
```bash
node cli/paymaster-discovery.js [options]

Options:
  --scan-recent    Scan recent blocks for paymaster contracts
  --analyze        Perform gas analysis on discovered paymasters
  --export         Export results to file
```

## 📊 Analysis Features

### Function Categorization
- **Query Functions**: View and read operations
- **Administrative Functions**: Configuration and setup
- **Fee Management**: Fee-related operations
- **State Management**: State-changing operations
- **Other Functions**: Uncategorized functions

### Gas Efficiency Ratings
- **Excellent**: < 50,000 gas
- **Good**: 50,000 - 100,000 gas
- **Moderate**: 100,000 - 500,000 gas
- **High**: 500,000 - 1,000,000 gas
- **Very High**: > 1,000,000 gas

### Output Formats

#### JSON Output
```json
{
  "contract": "0x1234...",
  "network": "Somnia Testnet",
  "results": {
    "functionName": {
      "aggregated": {
        "avg": 85000,
        "min": 80000,
        "max": 90000,
        "total": 850000,
        "callCount": 10
      }
    }
  }
}
```

#### CSV Output
```csv
Function,Average Gas,Min Gas,Max Gas,Total Gas,Calls,Cost (STT)
swap(address,bool,int256,uint160,bytes),85000,80000,90000,850000,10,0.00051000
```

## 🏗️ Project Structure

```
somnia-gas-profiler/
├── cli/                    # Command-line interface
├── lib/                    # Core libraries
│   ├── somnia-abi-fetcher.js    # ABI fetching from Somnia Explorer
│   ├── developer-analyzer.js    # Developer-focused analysis
│   ├── gas-profiler.js          # Main profiling engine
│   └── abi-extractor.js         # ABI processing utilities
├── test/                   # Test suite (mocha/chai)
├── examples/               # Usage examples
├── docs/                   # Documentation
├── contracts/              # Sample contracts
└── scripts/                # Utility scripts
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests (from project root)
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx mocha test/profiler.spec.js

# Test the API server
cd api
npm test

# Test the frontend
cd api/frontend
npm test
```

### Test Categories

- **Unit Tests**: Individual component and library testing
- **Integration Tests**: API endpoint and workflow testing
- **E2E Tests**: Full application testing including frontend
- **Performance Tests**: Gas optimization validation
- **Network Tests**: Blockchain interaction testing

## 📈 Example Workflow

```bash
# 1. Quick analysis of a smart contract
npm run quick-analyze -- --address 0x0162e6f939C58ac4b4FEB4C65E15CB31bd178789

# 2. Generate detailed CSV report
npm run report -- --in profiling_*.json --format csv --out contract-analysis.csv

# 3. Focus on specific functions
npm run analyze -- --address 0x123... --functions "transfer,approve,mint"

# 4. Gasless analysis (no transactions)
npm run analyze -- --address 0x123... --gasless
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Blockchain Configuration
SONIA_RPC_URL=https://rpc.somnia.network
SONIA_EXPLORER_URL=https://explorer.somnia.network

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Application Settings
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Analysis Settings
DEFAULT_GAS_LIMIT=8000000
MAX_CONCURRENT_ANALYSES=5
CACHE_TTL=3600

# Frontend Build (for production)
FRONTEND_BUILD_PATH=./frontend/dist
```

## 🚀 Deployment

### Production Deployment

The application is designed for unified deployment with both API and frontend served from a single Node.js process.

#### Using Render (Recommended)

The project includes a `render.yaml` configuration for easy deployment:

```yaml
services:
  - type: web
    name: somnia-gas-profiler
    env: node
    buildCommand: |
      cd api && npm install
      cd frontend && npm install && npm run build
    startCommand: cd api && node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        fromService:
          type: redis
          name: somnia-gas-profiler-redis
          property: connectionString

  - type: redis
    name: somnia-gas-profiler-redis
    ipAllowList: []
```

#### Manual Deployment

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd somnia-gas-profiler

# 2. Install API dependencies
cd api
npm install

# 3. Build frontend
cd frontend
npm install
npm run build
cd ..

# 4. Set production environment variables
export NODE_ENV=production
export REDIS_URL=your_redis_connection_string
export PORT=3000

# 5. Start the server
node server.js
```

#### Docker Deployment

```bash
# Build the Docker image
docker build -t somnia-gas-profiler .

# Run with Redis
docker run -d --name redis redis:alpine
docker run -d -p 3000:3000 \
  --link redis:redis \
  -e REDIS_URL=redis://redis:6379 \
  -e NODE_ENV=production \
  somnia-gas-profiler
```

### Network Configuration

The tool supports multiple Somnia network configurations:

- **Somnia Devnet**: Default development network
- **Somnia Testnet**: Public test network
- **Custom RPC**: Configure your own endpoint

## 🔧 Advanced Usage

### Custom ABI Sources

```bash
# Use local ABI file
npm run analyze -- --address 0x123... --abi ./contracts/MyContract.json

# Force verified contract ABI only
npm run analyze -- --address 0x123... --require-verified

# Allow minimal ABI generation
npm run analyze -- --address 0x123... --allow-minimal
```

### Batch Analysis

```bash
# Analyze multiple contracts
npm run analyze -- --batch ./contract-list.json

# Generate comparative report
npm run report -- --compare --in profiling_*.json
```

## 📚 API Reference

### SomniaABIFetcher

```javascript
const { SomniaABIFetcher } = require('./lib/somnia-abi-fetcher');

const fetcher = new SomniaABIFetcher();
const result = await fetcher.fetchAndValidateABI(contractAddress);
```

### DeveloperAnalyzer

```javascript
const { DeveloperAnalyzer } = require('./lib/developer-analyzer');

const analyzer = new DeveloperAnalyzer();
const analysis = analyzer.analyzeGasProfile(profilingData, contractAddress);
```

## 🚨 Troubleshooting

### Common Issues

#### Server Won't Start
- **Issue**: API server fails to start
- **Solution**: Check Redis connection and port availability
- **Check**: Ensure all dependencies are installed in both `api/` and `api/frontend/`

#### Frontend Not Loading
- **Issue**: Web interface shows 404 or blank page
- **Solution**: Ensure frontend is built (`cd api/frontend && npm run build`)
- **Check**: Verify `FRONTEND_BUILD_PATH` environment variable

#### API Endpoints Return 500 Error
- **Issue**: Analysis requests fail with HTTP 500
- **Solution**: Check Redis connection and CLI tool availability
- **Debug**: Check server logs for specific error messages

#### High Gas Usage Analysis
- **Issue**: Contract shows unexpectedly high gas consumption
- **Solution**: Check for loops, external calls, and storage operations
- **Tools**: Use the detailed function analysis feature in the web interface

#### Network Connection Issues
- **Issue**: Cannot connect to Somnia network
- **Solution**: Verify RPC URL and network configuration in `.env`
- **Check**: Ensure firewall allows outbound connections

#### ABI Fetching Failures
- **Issue**: Cannot automatically fetch contract ABI
- **Solution**: The system will attempt to analyze without ABI
- **Alternative**: Verify contract is verified on Somnia Explorer

#### Redis Connection Issues
- **Issue**: Cache operations fail
- **Solution**: Verify Redis server is running and accessible
- **Check**: Test Redis connection with `redis-cli ping`

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/somnia-gas-profiler.git
cd somnia-gas-profiler

# Install root dependencies
npm install

# Install API dependencies
cd api
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Set up environment
cp ../.env.example .env
# Edit .env with your configuration

# Start development server
node server.js
```

### Making Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes to the appropriate directory:
   - API changes: `api/server.js`, `api/services/`, etc.
   - Frontend changes: `api/frontend/src/`
   - CLI changes: `api/cli/` (and optionally root `cli/` for development)
3. Test your changes: `npm test`
4. Build frontend if modified: `cd api/frontend && npm run build`
5. Submit a pull request with a clear description

### Code Style

- Follow existing code conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌐 Live Service

Try the Somnia Gas Profiler online without any setup:

**🔗 https://somnia-gas-profiler.onrender.com**

The live service includes:
- Full web interface for contract analysis
- Real-time gas profiling results
- Export functionality (JSON/CSV)
- Recent analyses browser
- API endpoints for programmatic access

*Note: The live service may take a moment to wake up if it hasn't been used recently.*

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/somnia/gas-profiler/issues)
- **Discord**: [Somnia Community](https://discord.gg/somnia)
- **Documentation**: [docs/](./docs/)
- **Examples**: [examples/](./examples/)

## 🎯 Roadmap

- [ ] **Advanced Gas Optimization Suggestions**
- [ ] **Real-time Gas Monitoring Dashboard**
- [ ] **Integration with Popular IDEs**
- [ ] **Automated Gas Regression Testing**
- [ ] **Multi-contract Batch Analysis UI**
- [ ] **Historical Gas Trend Analysis**

---

**Made with ❤️ for the Somnia blockchain ecosystem**