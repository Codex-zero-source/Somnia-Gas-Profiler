# Somnia Gas Profiler - Comprehensive Architecture Integration

## Executive Summary

This document outlines the complete architecture integration for the Somnia Gas Profiler ecosystem, encompassing smart contracts, backend services, frontend applications, and their interconnected data flows.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SOMNIA GAS PROFILER ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   FRONTEND      │    │    BACKEND      │    │  SMART CONTRACT │            │
│  │   (React)       │◄──►│   (Express)     │◄──►│   (Solidity)    │            │
│  │                 │    │                 │    │                 │            │
│  │ • Neo-Brutalist │    │ • Redis Cache   │    │ • Analysis      │            │
│  │ • Web3 Integration│   │ • CLI Execution │    │   Registry      │            │
│  │ • Real-time UI  │    │ • API Endpoints │    │ • On-chain      │            │
│  │ • Wallet Connect│    │ • Health Monitor│    │   Storage       │            │
│  │ • AI Insights UI│    │ • AI Integration│    │                 │            │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│           │                       │                       │                    │
│           │              ┌─────────────────┐              │                    │
│           └──────────────►│   REDIS CACHE   │◄─────────────┘                    │
│                          │   (Docker)      │                                   │
│                          │                 │                                   │
│                          │ • Analysis Data │                                   │
│                          │ • Metadata      │                                   │
│                          │ • Statistics    │                                   │
│                          │ • AI Results    │                                   │
│                          └─────────────────┘                                   │
│                                   │                                            │
│                          ┌─────────────────┐                                   │
│                          │   BLOCKCHAIN    │                                   │
│                          │   (Somnia)      │                                   │
│                          │                 │                                   │
│                          │ • Contract Data │                                   │
│                          │ • Transaction   │                                   │
│                          │   History       │                                   │
│                          └─────────────────┘                                   │
│                                   │                                            │
│                          ┌─────────────────┐                                   │
│                          │  AI PROVIDERS   │                                   │
│                          │                 │                                   │
│                          │ • IO Intelligence│                                  │
│                          │ • OpenAI        │                                   │
│                          │ • Anthropic     │                                   │
│                          └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer (React + Vite)

**Location**: `webapp/gas-profiler/`
**Port**: 5173
**Technology Stack**:
- React 18 with Hooks
- Vite for build tooling
- Tailwind CSS with neo-brutalist design
- Web3.js for blockchain interaction
- Axios for API communication

**Key Components**:
```
src/
├── App.jsx                 # Main application component
├── services/
│   └── api.js             # Backend API integration
├── utils/
│   └── web3.js            # Blockchain utilities
├── contracts/
│   └── AnalysisRegistry.json # Smart contract ABI
└── assets/                # Static resources
```

**Core Features**:
- Contract address validation and analysis
- Real-time analysis results display
- Cache status indicators
- Wallet integration (MetaMask)
- On-chain data storage interface
- Terminal-style JSON output
- Responsive neo-brutalist UI

### 2. Backend Layer (Express.js + Node.js)

**Location**: `api/`
**Port**: 3001
**Technology Stack**:
- Express.js framework
- Node.js runtime
- Redis client for caching
- Child process for CLI execution
- CORS for cross-origin requests

**Architecture**:
```
api/
├── server.js              # Main server and routes
├── services/
│   └── redisService.js    # Redis integration layer
├── config/
│   └── redis.js           # Redis configuration
└── package.json           # Dependencies
```

**API Endpoints**:
```
POST   /api/analyze           # Contract analysis with caching
POST   /api/ai/analyze        # AI-powered analysis with insights
GET    /api/health            # System health check
GET    /api/recent?limit=N    # Recent analyses
GET    /api/stats             # Global statistics
GET    /api/cache/stats       # Cache performance
GET    /api/cache/:address    # Cached analysis retrieval
DELETE /api/cache/:address    # Cache invalidation
```

### 4. AI Integration Layer

**Location**: `api/services/`
**Technology Stack**:
- Multiple AI provider support (IO Intelligence, OpenAI, Anthropic)
- Axios for HTTP requests
- Environment-based configuration
- Fallback mechanisms

**Architecture**:
```
api/services/
├── aiService.js           # Main AI service orchestrator
├── providers/
│   ├── ioIntelligence.js  # IO Intelligence provider
│   ├── openai.js          # OpenAI provider
│   └── anthropic.js       # Anthropic provider
└── aiAnalyzer.js          # Analysis logic and prompt engineering
```

**AI Service Features**:
- **Multi-Provider Support**: Configurable AI provider selection
- **Intelligent Fallbacks**: Automatic provider switching on failures
- **Structured Prompts**: Optimized prompts for gas optimization analysis
- **Response Validation**: Ensures consistent AI response format
- **Caching Integration**: AI results cached with analysis data
- **Error Handling**: Graceful degradation when AI services unavailable

**AI Analysis Flow**:
```
Contract Data → Prompt Engineering → AI Provider → Response Validation → Structured Insights
```

**AI Response Structure**:
```javascript
{
  gasOptimizations: [
    {
      function: "transfer",
      issue: "Redundant balance checks",
      suggestion: "Use unchecked arithmetic for gas savings",
      priority: "high",
      estimatedSavings: "15-25%"
    }
  ],
  summary: "Contract shows moderate optimization potential...",
  riskAssessment: "Low risk implementation with standard patterns",
  provider: "iointelligence",
  timestamp: "2024-01-15T10:30:00Z",
  confidence: 0.85
}
```

### 3. Smart Contract Layer (Solidity)

**Location**: `foundry-contracts/src/`
**Network**: Somnia Blockchain
**Technology Stack**:
- Solidity ^0.8.19
- Foundry for development
- OpenZeppelin libraries

**Contract Architecture**:
```solidity
contract AnalysisRegistry {
    struct AnalysisReport {
        address contractAddress;
        string ipfsHash;          // Off-chain data reference
        uint256 gasUsed;
        uint256 timestamp;
        address analyzer;
        bool isPublic;
    }
    
    mapping(address => AnalysisReport[]) public contractAnalyses;
    mapping(address => uint256) public analysisCount;
    
    event AnalysisStored(address indexed contractAddress, string ipfsHash);
    event AnalysisUpdated(address indexed contractAddress, uint256 index);
}
```

**Key Functions**:
- `storeAnalysis()` - Store analysis results on-chain
- `getAnalysis()` - Retrieve analysis by contract and index
- `getLatestAnalysis()` - Get most recent analysis
- `updateAnalysis()` - Update existing analysis
- `getAnalysisCount()` - Get total analyses for contract

### 4. Caching Layer (Redis)

**Deployment**: Docker container (redis:7-alpine)
**Port**: 6379
**Purpose**: High-performance caching and temporary storage

**Data Structures**:
```
analysis:{contractAddress}     # JSON analysis results
meta:{contractAddress}         # Analysis metadata
recent_analyses               # Sorted set (timestamp-based)
global_stats                  # Hash of global statistics
cache_stats                   # Cache performance metrics
```

**TTL Strategy**:
- Analysis results: 1 hour
- Metadata: 24 hours
- Statistics: 5 minutes

## Data Flow Architecture

### 1. Analysis Request Flow

```
┌─────────────┐    1. Submit     ┌─────────────┐    2. Check      ┌─────────────┐
│  Frontend   │ ──────────────► │   Backend   │ ──────────────► │   Redis     │
│             │                 │             │                 │   Cache     │
└─────────────┘                 └─────────────┘                 └─────────────┘
       ▲                               │                               │
       │                               │ 3a. Cache Miss                │
       │                               ▼                               │
       │                        ┌─────────────┐                       │
       │                        │ CLI Analysis│                       │
       │                        │ Execution   │                       │
       │                        └─────────────┘                       │
       │                               │                               │
       │ 6. Return Results             │ 4. Store Results              │
       │                               ▼                               │
       └───────────────────────────────────────────────────────────────┘
                                5. Cache Results
```

### 2. AI Analysis Request Flow

```
┌─────────────┐    1. AI Request ┌─────────────┐    2. Check Cache ┌─────────────┐
│  Frontend   │ ──────────────► │   Backend   │ ──────────────► │   Redis     │
│             │                 │             │                 │   Cache     │
└─────────────┘                 └─────────────┘                 └─────────────┘
       ▲                               │                               │
       │                               │ 3a. Cache Miss                │
       │                               ▼                               │
       │                        ┌─────────────┐                       │
       │                        │ AI Service  │                       │
       │                        │ Orchestrator│                       │
       │                        └─────────────┘                       │
       │                               │                               │
       │                               │ 4. Provider Selection         │
       │                               ▼                               │
       │                        ┌─────────────┐                       │
       │                        │AI Provider  │                       │
       │                        │(IO Intel/   │                       │
       │                        │OpenAI/      │                       │
       │                        │Anthropic)   │                       │
       │                        └─────────────┘                       │
       │                               │                               │
       │ 7. Return AI Insights         │ 5. Cache AI Results           │
       │                               ▼                               │
       └───────────────────────────────────────────────────────────────┘
                                6. Store Results
```

### 3. On-Chain Storage Flow

```
┌─────────────┐    1. Store      ┌─────────────┐    2. Transaction ┌─────────────┐
│  Frontend   │ ──────────────► │   Wallet    │ ──────────────► │  Blockchain │
│             │                 │ (MetaMask)  │                 │  (Somnia)   │
└─────────────┘                 └─────────────┘                 └─────────────┘
       │                               │                               │
       │ 4. Confirmation               │ 3. Sign & Send               │
       └───────────────────────────────┘                               │
                                                                       │
                                ┌─────────────┐    5. Event Log      │
                                │   Smart     │ ◄────────────────────┘
                                │  Contract   │
                                └─────────────┘
```

### 4. Real-Time Updates Flow

```
┌─────────────┐    WebSocket     ┌─────────────┐    Event Listen  ┌─────────────┐
│  Frontend   │ ◄──────────────► │   Backend   │ ──────────────► │ Blockchain  │
│             │                 │             │                 │   Events    │
└─────────────┘                 └─────────────┘                 └─────────────┘
       │                               │                               │
       │ UI Updates                    │ Cache Updates                 │
       ▼                               ▼                               │
┌─────────────┐                ┌─────────────┐                       │
│   React     │                │   Redis     │                       │
│   State     │                │   Cache     │                       │
└─────────────┘                └─────────────┘                       │
                                       ▲                               │
                                       └───────────────────────────────┘
```

## Integration Patterns

### 1. API Integration Pattern

**Frontend → Backend**:
```javascript
// Frontend API Service
const analyzeContract = async (contractAddress) => {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractAddress })
  });
  return response.json();
};
```

**Backend → Redis**:
```javascript
// Backend Redis Integration
const getCachedAnalysis = async (contractAddress) => {
  const cached = await redisClient.get(`analysis:${contractAddress}`);
  return cached ? JSON.parse(cached) : null;
};
```

### 2. Blockchain Integration Pattern

**Frontend → Smart Contract**:
```javascript
// Web3 Integration
const storeOnChain = async (analysisData) => {
  const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
  const tx = await contract.methods.storeAnalysis(
    analysisData.contractAddress,
    analysisData.ipfsHash,
    analysisData.gasUsed
  ).send({ from: userAddress });
  return tx;
};
```

### 3. AI Integration Pattern

**Backend → AI Providers**:
```javascript
// AI Service Integration
const generateAIInsights = async (analysisData) => {
  const aiService = new AIService({
    provider: process.env.AI_PROVIDER || 'iointelligence',
    apiKey: process.env.IOINTELLIGENCE_API_KEY,
    fallbackProviders: ['openai', 'anthropic']
  });
  
  try {
    const insights = await aiService.analyzeContract(analysisData);
    await cacheAIResults(analysisData.contractAddress, insights);
    return insights;
  } catch (error) {
    console.warn('AI analysis failed, returning basic insights:', error);
    return generateBasicInsights(analysisData);
  }
};
```

**Frontend → AI Insights Display**:
```javascript
// AI Insights Rendering
const AIInsightsSection = ({ aiInsights }) => {
  if (!aiInsights) return <div>AI analysis unavailable</div>;
  
  return (
    <div className="ai-insights">
      <h3>🤖 AI-Powered Insights</h3>
      {aiInsights.gasOptimizations?.map((opt, index) => (
        <div key={index} className="optimization-card">
          <span className={`priority-${opt.priority}`}>{opt.priority}</span>
          <h4>{opt.function}</h4>
          <p><strong>Issue:</strong> {opt.issue}</p>
          <p><strong>Suggestion:</strong> {opt.suggestion}</p>
          <p><strong>Estimated Savings:</strong> {opt.estimatedSavings}</p>
        </div>
      ))}
      <div className="risk-assessment">
        <h4>Risk Assessment</h4>
        <p>{aiInsights.riskAssessment}</p>
      </div>
    </div>
  );
};
```

### 4. Error Handling Pattern

**Graceful Degradation**:
```javascript
// Multi-layer fallback
try {
  // Try Redis cache first
  result = await getCachedAnalysis(address);
  if (!result) {
    // Fallback to fresh analysis
    result = await performAnalysis(address);
    await cacheResult(address, result);
  }
} catch (error) {
  // Fallback to basic analysis without caching
  result = await basicAnalysis(address);
}
```

## Security Architecture

### 1. Input Validation
- Contract address format validation
- SQL injection prevention
- XSS protection
- Rate limiting

### 2. Authentication & Authorization
- Wallet-based authentication
- Role-based access control
- API key management
- CORS configuration

### 3. Data Protection
- HTTPS enforcement
- Sensitive data encryption
- Secure Redis connections
- Environment variable protection

## Performance Optimization

### 1. Caching Strategy
```
Level 1: Browser Cache (Static Assets)
Level 2: Redis Cache (Analysis Results)
Level 3: Database Cache (Metadata)
Level 4: CDN Cache (Global Distribution)
```

### 2. Load Balancing
```
┌─────────────┐    Load Balancer    ┌─────────────┐
│   Client    │ ──────────────────► │   Nginx     │
└─────────────┘                     └─────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
             ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
             │ API Server 1│        │ API Server 2│        │ API Server 3│
             └─────────────┘        └─────────────┘        └─────────────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           ▼
                                    ┌─────────────┐
                                    │ Redis Cluster│
                                    └─────────────┘
```

### 3. Database Optimization
- Connection pooling
- Query optimization
- Index strategies
- Partitioning

## Deployment Architecture

### 1. Development Environment
```
Frontend:  http://localhost:5173
Backend:   http://localhost:3001
Redis:     localhost:6379
Blockchain: Somnia Testnet
```

### 2. Production Environment
```
Frontend:  https://gas-profiler.somnia.network
Backend:   https://api.gas-profiler.somnia.network
Redis:     Internal cluster
Blockchain: Somnia Mainnet
```

### 3. Infrastructure as Code
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./webapp/gas-profiler
    ports: ["80:80"]
    environment:
      - VITE_API_URL=https://api.gas-profiler.somnia.network
      - VITE_CONTRACT_ADDRESS=0x...
  
  backend:
    build: ./api
    ports: ["3001:3001"]
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
      - AI_ENABLED=true
      - AI_PROVIDER=iointelligence
      - IOINTELLIGENCE_API_KEY=${IOINTELLIGENCE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on: [redis]
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]
```

## Monitoring & Observability

### 1. Health Monitoring
```javascript
// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      redis: await checkRedisHealth(),
      blockchain: await checkBlockchainHealth(),
      cli: await checkCliHealth()
    }
  };
  res.json(health);
});
```

### 2. Metrics Collection
- Request/response times
- Cache hit/miss rates
- Error rates and types
- User engagement metrics
- Gas usage statistics

### 3. Logging Strategy
```javascript
// Structured Logging
const logger = {
  info: (message, meta) => console.log(JSON.stringify({ level: 'info', message, meta, timestamp: new Date() })),
  error: (message, error) => console.error(JSON.stringify({ level: 'error', message, error: error.stack, timestamp: new Date() })),
  warn: (message, meta) => console.warn(JSON.stringify({ level: 'warn', message, meta, timestamp: new Date() }))
};
```

## Future Enhancements

### 1. Scalability Improvements
- Microservices architecture
- Event-driven architecture
- Message queues (RabbitMQ/Kafka)
- Database sharding

### 2. Advanced Features
- Real-time WebSocket updates
- Advanced analytics dashboard
- Machine learning insights
- Multi-chain support

### 3. DevOps Enhancements
- CI/CD pipelines
- Automated testing
- Blue-green deployments
- Infrastructure monitoring

## Integration Checklist

### ✅ Completed Components
- [x] Frontend React application with neo-brutalist design
- [x] Backend Express API with Redis integration
- [x] Smart contract deployment infrastructure
- [x] Redis caching layer
- [x] API endpoint integration
- [x] Error handling and graceful degradation
- [x] Health monitoring
- [x] Documentation
- [x] AI integration with multiple provider support
- [x] AI-powered gas optimization insights
- [x] Frontend AI insights display components
- [x] AI result caching and fallback mechanisms

### 🔄 In Progress
- [ ] WebSocket real-time updates
- [ ] Advanced analytics
- [ ] Performance optimization
- [ ] Security hardening

### 📋 Planned
- [ ] Production deployment
- [ ] Load testing
- [ ] Security audit
- [ ] User acceptance testing

## Conclusion

This comprehensive architecture provides a robust, scalable foundation for the Somnia Gas Profiler ecosystem. The integration of frontend, backend, smart contracts, and caching layers creates a seamless user experience while maintaining high performance and reliability.

The modular design allows for independent scaling and deployment of components, while comprehensive monitoring ensures system health and performance optimization opportunities.

**Next Steps**: Review this architecture, provide feedback, and proceed with any specific integration requirements or modifications needed for the production deployment.