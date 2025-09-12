# AnalysisRegistry Contract Deployment

This directory contains the AnalysisRegistry smart contract and deployment scripts for the Somnia Gas Profiler.

## Prerequisites

1. [Foundry](https://getfoundry.sh/) installed
2. Private key with STT funds for deployment on Somnia testnet

## Setup

1. Install dependencies:
```bash
forge install
```

2. Create a `.env` file with your private key:
```bash
# Copy the example file
cp .env.example .env

# Edit .env and replace with your actual private key
# Do NOT include the "0x" prefix
```

## Compilation

Compile the contracts:
```bash
forge build
```

## Testing

Run the tests:
```bash
forge test
```

## Deployment

### Option 1: Using the deployment script (Recommended)
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast
```

### Option 2: Using the Windows batch file
Double-click on `deploy-windows.bat` or run it from the command line:
```bash
deploy-windows.bat
```

### Option 3: With verification
```bash
forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast --verify
```

## Verifying Deployment

After deployment, you can verify the contract is working:
```bash
forge script script/VerifyDeployment.s.sol:VerifyDeployment --sig "run(address)" <contract_address>
```

## Contract Details

The AnalysisRegistry contract allows storing metadata about gas analysis of smart contracts on the Somnia blockchain. It includes functions to:
- Store analysis metadata
- Retrieve analysis by ID
- Get all analyses for a user
- Get all analyses for a contract

The contract emits an `AnalysisStored` event when a new analysis is stored, making it easy to track and index analyses.

## Troubleshooting

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for detailed troubleshooting steps.