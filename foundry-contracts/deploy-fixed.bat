@echo off
echo ========================================
echo AnalysisRegistry Deployment Tool V2
echo ========================================
echo.

echo Loading environment variables...
call .env
echo Private key loaded.

echo Deploying AnalysisRegistry to Somnia testnet...
echo This may take a minute...
echo.

set PRIVATE_KEY=0x2ffed5c53cdd4cb56752a759841e2a8556e929945e9528de915511aa27fe31c3
forge script script/DeployAnalysisRegistryV2.s.sol:DeployAnalysisRegistryV2 --rpc-url somnia --broadcast

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Deployment completed successfully!
    echo ========================================
    echo Check the output above for the contract address
    echo.
) else (
    echo.
    echo ========================================
    echo Deployment failed!
    echo ========================================
    echo Check the error message above
    echo.
)

pause