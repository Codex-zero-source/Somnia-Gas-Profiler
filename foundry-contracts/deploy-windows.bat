@echo off
echo ========================================
echo AnalysisRegistry Deployment Tool
echo ========================================
echo.

echo Checking if .env file exists...
if not exist .env (
    echo ERROR: .env file not found!
    echo Please create a .env file with your PRIVATE_KEY
    echo See DEPLOYMENT-GUIDE.md for instructions
    echo.
    pause
    exit /b 1
)

echo .env file found.
echo.

echo Deploying AnalysisRegistry to Somnia testnet...
echo This may take a minute...
echo.

forge script script/DeployAnalysisRegistry.s.sol:DeployAnalysisRegistry --rpc-url somnia --broadcast

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
    echo See DEPLOYMENT-GUIDE.md for troubleshooting
    echo.
)

pause