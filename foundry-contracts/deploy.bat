@echo off
echo Deploying AnalysisRegistry to Somnia testnet...
echo Make sure you have set your PRIVATE_KEY in the .env file

forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast

echo Deployment completed!
echo Check the terminal output for the contract address