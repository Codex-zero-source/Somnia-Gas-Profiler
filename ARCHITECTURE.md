# Somnia Gas Profiler dApp Architecture

## Overview

The Somnia Gas Profiler dApp is a decentralized application that allows users to analyze gas usage of smart contracts on the Somnia blockchain. The architecture consists of four main components:

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│   React Frontend│    │   Express API    │    │  Smart Contracts     │
│   (Web3 dApp)   │◄──►│   (Node.js)      │◄──►│  (Solidity)          │
└─────────────────┘    └──────────────────┘    └──────────────────────┘
       │                        │                         │
       │                 ┌─────────────┐                  │
       │                 │ CLI Tools   │                  │
       │                 │ (Profiler)  │                  │
       │                 └─────────────┘                  │
       │                        │                         │
       │                 ┌─────────────┐                  │
       │                 │  Database   │                  │
       │                 │ (Optional)  │                  │
       │                 └─────────────┘                  │
       │                                                  │
       └──────────────────────────────────────────────────┘
                        Somnia Blockchain
```

## Components

### 1. React Frontend (Web3 dApp)
- Built with React and Vite for fast development
- Uses ethers.js for Web3 interactions
- Connects to MetaMask for wallet integration
- Communicates with the backend API for analysis
- Allows users to store analysis results on-chain

### 2. Express API Server
- Wraps existing CLI functionality in RESTful endpoints
- Handles contract analysis requests
- Manages communication between frontend and CLI tools
- Provides JSON responses for frontend consumption

### 3. Smart Contracts
- **AnalysisRegistry.sol**: Stores metadata of contract analyses on-chain
- **Deployed Contract Address**: `0x5e2a8a982690529aeb2952801dcddd1376684879`
- Deployed to Somnia testnet using Foundry (Forge)
- Allows transparent and verifiable storage of analysis results
- Provides functions to retrieve analysis data

### 4. CLI Tools
- Existing gas profiling functionality wrapped by the API
- Performs actual gas analysis of smart contracts
- Generates detailed reports on function gas usage

## Data Flow

1. User connects wallet and inputs contract address in the frontend
2. Frontend sends request to Express API
3. API executes CLI tool to analyze the contract
4. CLI tool returns analysis data to API
5. API formats and returns data to frontend
6. User can optionally store analysis metadata on-chain
7. Analysis metadata is stored in AnalysisRegistry smart contract deployed via Foundry
8. Full analysis data can be stored in IPFS (in full implementation)

## Deployment

### Frontend
- Deployed to Vercel for easy hosting
- Uses environment variables for API configuration

### Backend
- Can be deployed to Vercel Functions or similar serverless platform
- Requires RPC endpoint configuration for Somnia testnet

### Smart Contracts
- Deployed to Somnia testnet using Foundry toolkit
- Verified on Somnia explorer for transparency