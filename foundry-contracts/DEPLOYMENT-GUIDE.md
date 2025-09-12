# Deploying AnalysisRegistry to Somnia Testnet

## Prerequisites
1. Foundry installed and working (which you already have)
2. STT tokens on Somnia testnet
3. A wallet private key with STT funds

## Setup

1. Edit the `.env` file and replace the placeholder with your actual private key:
   ```
   PRIVATE_KEY=your_actual_private_key_here_no_0x_prefix
   ```
   
   Important:
   - Do NOT include the "0x" prefix
   - Make sure it's a valid 64-character hex string
   - Ensure this account has STT tokens for gas fees

2. Save the file

## Deployment

Run the deployment script:
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast
```

## Expected Output

If successful, you should see output similar to:
```
Deploying AnalysisRegistry contract...
Deployer address: 0x...
AnalysisRegistry deployed at: 0x...
Initial analysis count: 0
```

Note the contract address as you'll need it for the frontend integration.

## Verification (Optional)

If you want to verify the contract on the explorer:
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast --verify
```

## Troubleshooting

Common issues:
1. "vm.envUint: failed parsing" - Check that your private key is properly formatted in .env
2. "insufficient funds" - Make sure your account has STT tokens
3. "connection failed" - Check your internet connection and RPC endpoint accessibility

## Getting STT Tokens

To get STT tokens:
1. Visit the Somnia faucet
2. Connect your wallet
3. Request test tokens
4. Transfer some to the account corresponding to your private key