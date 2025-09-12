# Deployment Guide

## Prerequisites

1. Node.js >= 16.0.0
2. MetaMask wallet
3. STT tokens (Somnia Test Tokens) from the faucet
4. Foundry toolkit (Forge and Anvil)

## Step-by-step Deployment

### 1. Deploy Smart Contracts Using Foundry

1. Navigate to the `foundry-contracts` directory:
```bash
cd foundry-contracts
```

2. Create a `.env` file with your private key:
```bash
echo 'PRIVATE_KEY=your_private_key_here' > .env
```

3. Compile the contracts:
```bash
forge build
```

4. Deploy to Somnia Testnet:
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast
```

5. Note the deployed contract address from the output

### 2. Set up the Backend API

1. Install dependencies:
```bash
cd api
npm install
```

2. Configure environment variables:
```bash
# In api/.env
RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=your_private_key_with_STT_funds
```

3. Start the API server:
```bash
npm start
```

The API will be available at `http://localhost:3001`

### 3. Set up the Frontend

1. Install dependencies:
```bash
cd webapp/gas-profiler
npm install
```

2. Configure environment variables:
```bash
# In webapp/gas-profiler/.env
VITE_API_URL=http://localhost:3001
```

3. Update the contract address in `src/contracts/AnalysisRegistry.deployment.json` with the address from step 1

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Deploy to Production

#### Frontend (Vercel)
1. Push the code to a GitHub repository
2. Create a new project on Vercel
3. Connect your GitHub repository
4. Set environment variables in Vercel dashboard
5. Deploy

#### Backend (Vercel Functions or similar)
1. You can deploy the Express API as Vercel Functions or use a service like Render.com
2. Set environment variables for RPC_URL and PRIVATE_KEY
3. Update the frontend VITE_API_URL to point to your deployed backend

## Testing the Deployment

1. Connect your MetaMask wallet to the dApp
2. Make sure you're on Somnia Testnet
3. Enter a contract address (e.g., one of the example contracts)
4. Click "Analyze Contract"
5. After analysis completes, click "Store On-Chain" to save metadata to the blockchain

## Troubleshooting

### Network Issues
- Make sure you're connected to Somnia Testnet
- Check that your RPC_URL is correct: `https://dream-rpc.somnia.network`

### Wallet Issues
- Make sure MetaMask is installed and unlocked
- Check that you have STT tokens in your wallet

### Contract Issues
- Verify the contract is deployed correctly
- Check that the contract address is correctly configured in the frontend

### Foundry Issues
- Make sure Foundry is properly installed
- Check that your private key in the `.env` file has sufficient STT funds
- Ensure you're using the correct RPC endpoint for Somnia testnet