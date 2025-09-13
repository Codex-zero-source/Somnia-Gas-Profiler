# Somnia Gas Profiler Web3 dApp

This is the Web3 frontend for the Somnia Gas Profiler, built with React, Vite, and ethers.js.

## Features

- Web3 wallet integration with MetaMask
- Contract gas analysis
- On-chain storage of analysis metadata
- Responsive UI with Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Environment Variables

Create a `.env` file in the root of this directory with the following variables:

```
VITE_API_URL=http://localhost:3001
```

## Architecture

The frontend communicates with the backend API server which wraps the existing CLI tools. The frontend also interacts directly with the Somnia blockchain through MetaMask for on-chain storage of analysis metadata.