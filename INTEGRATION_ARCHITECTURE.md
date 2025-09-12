# Somnia Gas Profiler - Integration Architecture Documentation

## Overview

This document provides a comprehensive overview of the integrated architecture connecting the frontend, API, and Redis database for the Somnia Gas Profiler application.

## Architecture Components

### 1. Frontend (React + Vite)
- **Location**: `webapp/gas-profiler/`
- **Port**: 5173
- **Framework**: React with Vite
- **Styling**: Tailwind CSS with neo-brutalist design
- **Key Features**:
  - Contract address input with validation
  - Real-time analysis results display
  - Cache status indicators
  - Terminal-style JSON output
  - Wallet integration for on-chain storage

### 2. API Server (Express.js)
- **Location**: `api/`
- **Port**: 3001
- **Framework**: Express.js
- **Key Features**:
  - Contract analysis endpoints
  - Redis caching integration
  - CLI command execution
  - Health monitoring
  - Graceful error handling

### 3. Redis Database
- **Port**: 6379
- **Deployment**: Docker container (redis:7-alpine)
- **Purpose**: Caching and storing analysis results
- **Key Features**:
  - Analysis result caching
  - Metadata storage
  - Global statistics tracking
  - TTL-based cache expiration

## Data Flow Architecture

```
┌─────────────────┐    HTTP/JSON     ┌─────────────────┐    Redis Protocol    ┌─────────────────┐
│                 │ ──────────────► │                 │ ──────────────────► │                 │
│   Frontend      │                 │   API Server    │                     │   Redis Cache   │
│   (React)       │ ◄────────────── │   (Express)     │ ◄────────────────── │   (Docker)      │
│                 │    JSON Response │                 │    Cached Data      │                 │
└─────────────────┘                 └─────────────────┘                     └─────────────────┘
        │                                     │
        │                                     │
        │                                     ▼
        │                           ┌─────────────────┐
        │                           │                 │
        │                           │   CLI Tools     │
        │                           │   (Analysis)    │
        │                           │                 │
        │                           └─────────────────┘
        │
        ▼
┌─────────────────┐
│                 │
│   Blockchain    │
│   (On-chain     │
│    Storage)     │
│                 │
└─────────────────┘
```

## API Endpoints

### Core Analysis
- `POST /api/analyze` - Analyze contract with Redis caching
- `GET /api/health` - Health check with Redis status

### Redis Management
- `GET /api/recent?limit=N` - Get recent analyses
- `GET /api/stats` - Get global statistics
- `GET /api/cache/stats` - Get cache statistics
- `GET /api/cache/:address` - Get cached analysis
- `DELETE /api/cache/:address` - Delete cached analysis

## Redis Schema Design

### Key Patterns
```
analysis:{contractAddress}     # Individual analysis results
meta:{contractAddress}         # Analysis metadata
recent_analyses               # Sorted set of recent analyses
global_stats                  # Global statistics hash
```

### Data Structures

#### Analysis Result
```json
{
  "analysis": { /* CLI analysis output */ },
  "timestamp": "2024-01-15T10:30:00Z",
  "executionTime": 1250,
  "contractAddress": "0x...",
  "cached": false
}
```

#### Metadata
```json
{
  "contractAddress": "0x...",
  "firstAnalyzed": "2024-01-15T10:30:00Z",
  "lastAnalyzed": "2024-01-15T10:30:00Z",
  "analysisCount": 1,
  "averageExecutionTime": 1250
}
```

#### Global Statistics
```json
{
  "totalAnalyses": 42,
  "uniqueContracts": 15,
  "cacheHitRate": 0.65,
  "averageExecutionTime": 1180
}
```

## Frontend Integration

### API Service Layer
**File**: `webapp/gas-profiler/src/services/api.js`

```javascript
// Core functions
export const analyzeContract = async (contractAddress)
export const healthCheck = async ()
export const getRecentAnalyses = async (limit = 10)
export const getGlobalStats = async ()
export const getCacheStats = async ()
export const deleteAnalysisCache = async (contractAddress)
```

### State Management
**File**: `webapp/gas-profiler/src/App.jsx`

```javascript
// Key state variables
const [analysisResult, setAnalysisResult] = useState(null)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState('')
const [contractAddress, setContractAddress] = useState('')
```

### Response Handling
The frontend handles both cached and live analysis results:

```javascript
const formattedResult = {
  analysis: result.analysis || result,
  cached: result.cached || false,
  timestamp: result.timestamp || new Date().toISOString(),
  executionTime: result.executionTime || null,
  contractAddress: contractAddress
}
```

## Error Handling Strategy

### API Level
- Redis connection failures are handled gracefully
- API continues to function without Redis if connection fails
- Comprehensive error logging and user feedback

### Frontend Level
- Network error handling with user-friendly messages
- Loading states and progress indicators
- Fallback UI for failed operations

### Redis Level
- Connection retry logic
- Graceful degradation when Redis is unavailable
- Cache miss handling

## Performance Optimizations

### Caching Strategy
- **TTL**: 1 hour for analysis results
- **Cache Keys**: Contract address-based
- **Hit Rate Tracking**: Monitored via global stats

### Frontend Optimizations
- Debounced input validation
- Lazy loading of analysis results
- Optimistic UI updates

### API Optimizations
- Connection pooling for Redis
- Async/await patterns for non-blocking operations
- Graceful shutdown handling

## Security Considerations

### Input Validation
- Contract address format validation
- SQL injection prevention (though using Redis)
- Rate limiting considerations

### Data Privacy
- No sensitive data stored in Redis
- Analysis results are public blockchain data
- Secure Redis connection (localhost only)

## Deployment Architecture

### Development Environment
```
Frontend: http://localhost:5173
API: http://localhost:3001
Redis: localhost:6379 (Docker container)
```

### Production Considerations
- Redis persistence configuration
- Load balancing for API servers
- CDN for frontend assets
- Environment-specific configuration

## Monitoring and Observability

### Health Checks
- API health endpoint with Redis status
- Frontend connection monitoring
- Redis connection status tracking

### Metrics
- Cache hit/miss rates
- Analysis execution times
- Error rates and types
- User engagement metrics

## Future Enhancements

### Planned Features
- Real-time analysis updates via WebSockets
- Advanced caching strategies (LRU, etc.)
- Analysis result comparison tools
- Batch analysis capabilities

### Scalability Improvements
- Redis clustering for high availability
- API server horizontal scaling
- Database sharding strategies
- CDN integration for global performance

## Troubleshooting Guide

### Common Issues

1. **Redis Connection Failed**
   - Check Docker container status: `docker ps`
   - Restart Redis: `docker restart somnia-redis`
   - Verify port 6379 availability

2. **API Server Port Conflict**
   - Check port usage: `netstat -ano | findstr :3001`
   - Kill conflicting process: `taskkill /PID <PID> /F`
   - Restart API server

3. **Frontend API Connection Issues**
   - Verify API server is running on port 3001
   - Check CORS configuration
   - Validate API_BASE_URL in frontend

### Debug Commands
```bash
# Check Redis status
docker logs somnia-redis

# Test Redis connection
redis-cli ping

# Check API health
curl http://localhost:3001/api/health

# View cache stats
curl http://localhost:3001/api/cache/stats
```

## Conclusion

This integrated architecture provides a robust, scalable foundation for the Somnia Gas Profiler application. The combination of React frontend, Express API, and Redis caching delivers excellent performance while maintaining code clarity and maintainability.

The modular design allows for independent scaling and deployment of components, while the comprehensive error handling ensures reliable operation even under adverse conditions.