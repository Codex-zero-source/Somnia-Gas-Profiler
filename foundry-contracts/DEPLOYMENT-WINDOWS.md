# Deploying AnalysisRegistry on Windows/WSL

## Prerequisites
- Foundry installed in WSL environment
- STT tokens on Somnia testnet
- Private key with funds

## Deployment Steps

1. Copy the `.env.example` file to `.env` and add your private key:
```bash
cp .env.example .env
# Edit .env and add your private key
```

2. Deploy the contract:
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast
```

3. If you want to verify the contract on the explorer:
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast --verify
```

## Getting STT Tokens

If you need STT tokens for deployment:
1. Visit the Somnia faucet
2. Connect your wallet
3. Request test tokens

## Troubleshooting

If you encounter issues:
1. Make sure your private key is correctly formatted in the .env file (without 0x prefix)
2. Ensure you have sufficient STT tokens for gas fees
3. Check that the RPC endpoint is accessible