import React, { useState, useEffect } from 'react';
import { connectWallet, switchToSomniaNetwork, getContract, isValidAddress } from './utils/web3';
import { analyzeContract, fullAnalyzeContract, healthCheck } from './services/api';
import contractABI from './contracts/AnalysisRegistry.json';
import { ethers } from 'ethers';

// Add Poppins font import
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// Add custom CSS for neo-brutalist effects
const customStyles = document.createElement('style');
customStyles.textContent = `
  .text-shadow-neon {
    text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  }
  
  @keyframes scan {
    0% { transform: translateY(-100vh); }
    100% { transform: translateY(100vh); }
  }
  
  .animate-scan {
    animation: scan 3s linear infinite;
  }
  
  /* Terminal cursor blink */
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .cursor-blink {
    animation: blink 1s infinite;
  }
`;
document.head.appendChild(customStyles);

// Neo-Brutalist Background Pattern Component
const BGPattern = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden">
    {/* Terminal Grid */}
    <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="brutalistGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00ff41" strokeWidth="0.5" opacity="0.3"/>
        </pattern>
        <pattern id="neonDots" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="1" fill="#ff0080" opacity="0.6"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#brutalistGrid)" />
      <rect width="100%" height="100%" fill="url(#neonDots)" />
    </svg>
    
    {/* Neon Geometric Shapes */}
    <div className="absolute top-10 left-10 w-32 h-32 border-4 border-cyan-400 rotate-45 opacity-20"></div>
    <div className="absolute top-20 right-20 w-24 h-24 bg-gradient-to-r from-pink-500 to-purple-500 opacity-10"></div>
    <div className="absolute bottom-32 left-32 w-40 h-2 bg-yellow-400 opacity-30"></div>
    <div className="absolute bottom-20 right-40 w-2 h-40 bg-green-400 opacity-30"></div>
    
    {/* Scanning Lines Effect */}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-2 animate-pulse" style={{animation: 'scan 3s linear infinite'}}></div>
  </div>
);

// Neo-Brutalist Input Component
const Input = React.forwardRef(({ className = '', type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={`flex h-16 w-full border-4 border-white bg-black/80 px-4 py-3 text-white text-xl font-mono placeholder:text-gray-500 focus:outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 uppercase tracking-wide shadow-[8px_8px_0px_0px_#00ff41] focus:shadow-[4px_4px_0px_0px_#00ff41] rounded-none ${className}`}
      ref={ref}
      {...props}
    />
  );
});

// Neo-Brutalist Button Component
const Button = React.forwardRef(({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
  const baseClasses = 'inline-flex items-center justify-center text-lg font-black transition-all duration-200 focus:outline-none disabled:pointer-events-none disabled:opacity-50 uppercase tracking-wider rounded-none';
  
  const variants = {
    default: 'bg-yellow-400 hover:bg-yellow-500 text-black border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000]',
    outline: 'border-4 border-cyan-400 bg-transparent hover:bg-cyan-400 text-cyan-400 hover:text-black shadow-[8px_8px_0px_0px_#00ffff] hover:shadow-[4px_4px_0px_0px_#00ffff]',
    ghost: 'text-white hover:bg-white/20 border-2 border-white/30 hover:border-white/50',
    secondary: 'bg-pink-400 hover:bg-pink-500 text-black border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000]'
  };
  
  const sizes = {
    default: 'h-12 px-6 py-3',
    sm: 'h-9 px-3',
    lg: 'h-14 px-8 py-4'
  };
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      ref={ref}
      {...props}
    />
  );
});

// Enhanced Icons
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

export default function SomniaGasProfiler() {
  const [contractAddress, setContractAddress] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!contractAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }

    if (!isValidAddress(contractAddress)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setAnalysisResult(null);

    try {
      const result = await fullAnalyzeContract(contractAddress);
      
      // The API now returns an object with analysis, cached, timestamp, etc.
      // Ensure we have the expected structure
      const formattedResult = {
        success: result.success || true,
        analysis: result.analysis || result,
        formattedReport: result.formattedReport || null,
        csvData: result.csvData || null,
        cached: result.cached || false,
        timestamp: result.timestamp || new Date().toISOString(),
        executionTime: result.executionTime || null,
        contractAddress: contractAddress
      };
      
      setAnalysisResult(formattedResult);
      
      // Store analysis on-chain if wallet is connected (only for new analyses, not cached ones)
      if (walletConnected && formattedResult.success && !formattedResult.cached) {
        try {
          await storeAnalysisOnChain(contractAddress, formattedResult.analysis);
        } catch (onChainError) {
          console.error('Failed to store on-chain:', onChainError);
          // Don't fail the entire operation if on-chain storage fails
        }
      }
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const connectWalletHandler = async () => {
    setIsConnecting(true);
    try {
      const { address } = await connectWallet();
      await switchToSomniaNetwork();
      setWalletConnected(true);
      setWalletAddress(address);
    } catch (error) {
      setError('Failed to connect wallet: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const storeAnalysisOnChain = async (address, analysis) => {
    try {
      const contract = await getContract(contractABI.abi);
      
      // Simulate storing analysis (in a real implementation, you'd call the contract)
      console.log('Storing analysis on-chain for:', address, analysis);
      
    } catch (error) {
      console.error('Failed to store analysis on-chain:', error);
    }
  };

  const getEfficiencyColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyBadge = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-black font-['Poppins'] relative overflow-hidden" style={{fontFamily: 'Poppins, sans-serif'}}>
      <BGPattern />
      
      {/* Neo-Brutalist Header */}
      <header className="relative z-10 bg-black border-b-4 border-cyan-400 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-cyan-400 border-4 border-black shadow-[8px_8px_0px_0px_#00ff41]">
              <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-wider">
                SOMNIA GAS PROFILER
              </h1>
              <p className="text-cyan-400 text-lg font-bold uppercase tracking-wide">SMART CONTRACT ANALYSIS TERMINAL</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {walletConnected ? (
              <div className="relative">
                {/* Glassmorphism wallet display */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-6 py-3 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_#4ade80]"></div>
                    <span className="text-green-300 font-bold text-lg">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                  </div>
                </div>
                {/* Neon glow effect */}
                <div className="absolute inset-0 bg-green-400/20 rounded-lg blur-md -z-10"></div>
              </div>
            ) : (
              <Button 
                onClick={connectWalletHandler} 
                disabled={isConnecting}
                className="bg-pink-500 hover:bg-pink-600 text-black font-black text-lg px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_#ff0080] hover:shadow-[4px_4px_0px_0px_#ff0080] transition-all duration-200 uppercase tracking-wide"
              >
                {isConnecting ? <LoadingIcon /> : <WalletIcon />}
                <span className="ml-2">{isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-12">
        {/* Neo-Brutalist Hero Section */}
        <div className="relative z-10 text-center py-20 px-6">
          <h2 className="text-7xl font-black mb-8 text-white uppercase tracking-wider leading-tight">
            <span className="block text-cyan-400 text-shadow-neon">ANALYZE</span>
            <span className="block text-pink-400 text-shadow-neon">SMART CONTRACT</span>
            <span className="block text-yellow-400 text-shadow-neon">GAS USAGE</span>
          </h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-2xl text-white font-bold uppercase tracking-wide leading-relaxed border-l-4 border-cyan-400 pl-6 bg-black/50 py-4">
              DETAILED INSIGHTS • OPTIMIZE PERFORMANCE • REDUCE COSTS
            </p>
            <p className="text-lg text-cyan-300 mt-4 font-medium uppercase tracking-wide">
              SOMNIA NETWORK TERMINAL ACCESS
            </p>
          </div>
        </div>

        {/* Neo-Brutalist Analysis Form with Glassmorphism */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="relative">
            {/* Glassmorphism container */}
            <div className="bg-white/5 backdrop-blur-xl rounded-none border-4 border-cyan-400 p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] relative">
              {/* Neon glow effect */}
              <div className="absolute inset-0 bg-cyan-400/10 blur-xl -z-10"></div>
              
              <h3 className="text-3xl font-black text-white mb-8 uppercase tracking-wider border-b-4 border-pink-400 pb-4 flex items-center">
                <SearchIcon />
                <span className="ml-4">CONTRACT ANALYSIS TERMINAL</span>
              </h3>
              
              <div className="space-y-8">
                <div>
                  <label htmlFor="contract-address" className="block text-lg font-black text-cyan-400 mb-3 uppercase tracking-wide">
                    CONTRACT ADDRESS
                  </label>
                  <div className="relative">
                    <Input
                      id="contract-address"
                      type="text"
                      placeholder="0x..."
                      value={contractAddress}
                      onChange={(e) => setContractAddress(e.target.value)}
                      className="w-full bg-black/80 border-4 border-white text-white placeholder:text-gray-500 focus:border-cyan-400 focus:ring-0 text-xl font-mono p-4 rounded-none shadow-[8px_8px_0px_0px_#00ff41] focus:shadow-[4px_4px_0px_0px_#00ff41] transition-all duration-200 uppercase"
                    />
                    {/* Terminal cursor effect */}
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-3 h-6 bg-cyan-400 animate-pulse"></div>
                  </div>
                </div>
                
                {error && (
                  <div className="p-4 bg-red-500/20 border-4 border-red-500 rounded-none backdrop-blur-sm">
                    <p className="text-red-300 text-lg font-bold uppercase tracking-wide">{error}</p>
                  </div>
                )}
                
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !contractAddress.trim()}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black text-2xl py-6 px-8 border-4 border-black shadow-[12px_12px_0px_0px_#000000] hover:shadow-[6px_6px_0px_0px_#000000] transition-all duration-200 disabled:opacity-50 uppercase tracking-wider rounded-none"
                >
                  {isAnalyzing ? (
                    <div className="flex items-center justify-center">
                      <LoadingIcon />
                      <span className="ml-4">ANALYZING...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <SearchIcon />
                      <span className="ml-4">EXECUTE ANALYSIS</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Neo-Brutalist Results Section */}
        {analysisResult && (
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Glassmorphism container */}
              <div className="bg-white/5 backdrop-blur-xl rounded-none border-4 border-yellow-400 p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] relative">
                {/* Neon glow effect */}
                <div className="absolute inset-0 bg-yellow-400/10 blur-xl -z-10"></div>
                
                <h3 className="text-3xl font-black text-white mb-8 uppercase tracking-wider border-b-4 border-green-400 pb-4">
                  ANALYSIS RESULTS
                </h3>
                
                {analysisResult.success ? (
                  <div className="space-y-8">
                    {/* Gas Usage Summary - Neo-Brutalist Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                      <div className="bg-cyan-400 border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000000] relative">
                        <div className="absolute top-2 right-2 w-4 h-4 bg-black animate-pulse"></div>
                        <h4 className="text-xl font-black text-black mb-3 uppercase tracking-wide">TOTAL FUNCTIONS</h4>
                        <p className="text-4xl font-black text-black">
                          {analysisResult.analysis?.results ? Object.keys(analysisResult.analysis.results).length : 'N/A'}
                        </p>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-black"></div>
                      </div>
                      
                      <div className="bg-pink-400 border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000000] relative">
                        <div className="absolute top-2 right-2 w-4 h-4 bg-black animate-pulse"></div>
                        <h4 className="text-xl font-black text-black mb-3 uppercase tracking-wide">AVG GAS USED</h4>
                        <p className="text-4xl font-black text-black">
                          {analysisResult.analysis?.results ? 
                            Math.round(Object.values(analysisResult.analysis.results)
                              .reduce((sum, func) => sum + (func.aggregated?.avg || 0), 0) / 
                              Object.keys(analysisResult.analysis.results).length).toLocaleString() : 'N/A'}
                        </p>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-black"></div>
                      </div>
                      
                      <div className="bg-yellow-400 border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000000] relative">
                        <div className="absolute top-2 right-2 w-4 h-4 bg-black animate-pulse"></div>
                        <h4 className="text-xl font-black text-black mb-3 uppercase tracking-wide">TOTAL RUNS</h4>
                        <p className="text-4xl font-black text-black">
                          {analysisResult.analysis?.results ? 
                            Object.values(analysisResult.analysis.results)
                              .reduce((sum, func) => sum + (func.aggregated?.callCount || 0), 0) : 'N/A'}
                        </p>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-black"></div>
                      </div>
                    </div>
                    
                    {/* Cache Status Indicator */}
                    {analysisResult.cached && (
                      <div className="bg-blue-500 border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000000] relative mb-6">
                        <div className="absolute top-2 right-2 w-4 h-4 bg-black animate-pulse"></div>
                        <h4 className="text-xl font-black text-black mb-2 uppercase tracking-wide flex items-center">
                          <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                          </svg>
                          CACHED RESULT
                        </h4>
                        <p className="text-black font-bold">Retrieved from Redis cache • {new Date(analysisResult.timestamp).toLocaleString()}</p>
                      </div>
                    )}
                    
                    {/* CSV Data Table */}
                    {(analysisResult.csvData || analysisResult.analysis?.results) && (
                      <div className="bg-black border-4 border-purple-400 p-6 shadow-[8px_8px_0px_0px_#a855f7] relative mb-8">
                        <div className="absolute top-2 left-2 flex space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xl font-black text-purple-400 uppercase tracking-wide">GAS ANALYSIS DATA TABLE</h4>
                          <div className="flex items-center space-x-4">
                            <span className="text-cyan-400 text-sm font-bold uppercase">CSV FORMAT</span>
                            <span className="text-yellow-400 text-sm font-bold uppercase">
                              {new Date(analysisResult.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-black/80 p-4 border-2 border-purple-400/50 overflow-x-auto">
                          <div className="mb-4 flex items-center space-x-4">
                            <span className="text-cyan-400 font-mono">root@somnia:~$</span>
                            <span className="text-white font-mono">cat gas_analysis.csv</span>
                          </div>
                          <div className="overflow-x-auto">
                            {analysisResult.csvData ? (
                              <table className="w-full text-sm font-mono">
                                <thead>
                                  <tr className="border-b-2 border-purple-400/50">
                                    {analysisResult.csvData.split('\n')[0]?.split(',').map((header, index) => (
                                      <th key={index} className="text-purple-400 font-black uppercase tracking-wide px-4 py-2 text-left">
                                        {header.trim().replace(/"/g, '')}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysisResult.csvData.split('\n').slice(1).filter(row => row.trim()).map((row, index) => (
                                    <tr key={index} className="border-b border-purple-400/20 hover:bg-purple-400/10">
                                      {row.split(',').map((cell, cellIndex) => (
                                        <td key={cellIndex} className="text-green-300 px-4 py-2">
                                          {cell.trim().replace(/"/g, '')}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <table className="w-full text-sm font-mono">
                                <thead>
                                  <tr className="border-b-2 border-purple-400/50">
                                    <th className="text-purple-400 font-black uppercase tracking-wide px-4 py-2 text-left">Function</th>
                                    <th className="text-purple-400 font-black uppercase tracking-wide px-4 py-2 text-left">Min Gas</th>
                                    <th className="text-purple-400 font-black uppercase tracking-wide px-4 py-2 text-left">Max Gas</th>
                                    <th className="text-purple-400 font-black uppercase tracking-wide px-4 py-2 text-left">Avg Gas</th>
                                    <th className="text-purple-400 font-black uppercase tracking-wide px-4 py-2 text-left">Total Runs</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysisResult.analysis?.results && Object.entries(analysisResult.analysis.results).map(([funcName, funcData], index) => (
                                    <tr key={index} className="border-b border-purple-400/20 hover:bg-purple-400/10">
                                      <td className="text-green-300 px-4 py-2">{funcName}</td>
                                      <td className="text-green-300 px-4 py-2">{funcData.aggregated?.min?.toLocaleString() || 'N/A'}</td>
                                      <td className="text-green-300 px-4 py-2">{funcData.aggregated?.max?.toLocaleString() || 'N/A'}</td>
                                      <td className="text-green-300 px-4 py-2">{funcData.aggregated?.avg?.toLocaleString() || 'N/A'}</td>
                                      <td className="text-green-300 px-4 py-2">{funcData.aggregated?.callCount || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* On-Chain Metadata Display */}
                    {analysisResult.onChainMetadata && (
                      <div className="bg-black border-4 border-orange-400 p-6 shadow-[8px_8px_0px_0px_#fb923c] relative mb-8">
                        <div className="absolute top-2 left-2 flex space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xl font-black text-orange-400 uppercase tracking-wide">ON-CHAIN METADATA</h4>
                          <div className="flex items-center space-x-4">
                            <span className="text-cyan-400 text-sm font-bold uppercase">BLOCKCHAIN STORED</span>
                            <span className="text-yellow-400 text-sm font-bold uppercase">
                              {new Date(analysisResult.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-black/80 p-4 border-2 border-orange-400/50">
                          <div className="mb-4 flex items-center space-x-4">
                            <span className="text-cyan-400 font-mono">root@somnia:~$</span>
                            <span className="text-white font-mono">cat on_chain_metadata.json</span>
                          </div>
                          <pre className="text-orange-300 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                            {JSON.stringify(analysisResult.onChainMetadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Detailed Analysis - Terminal Style */}
                    <div className="bg-black border-4 border-green-400 p-6 shadow-[8px_8px_0px_0px_#00ff41] relative">
                      <div className="absolute top-2 left-2 flex space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xl font-black text-green-400 uppercase tracking-wide">DETAILED ANALYSIS TERMINAL</h4>
                        <div className="flex items-center space-x-4">
                          <span className="text-cyan-400 text-sm font-bold uppercase">
                            {analysisResult.cached ? 'CACHED' : 'LIVE'}
                          </span>
                          <span className="text-yellow-400 text-sm font-bold uppercase">
                            {new Date(analysisResult.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="bg-black/80 p-4 border-2 border-green-400/50">
                        <div className="mb-4 flex items-center space-x-4">
                          <span className="text-cyan-400 font-mono">root@somnia:~$</span>
                          <span className="text-white font-mono">cat contract_analysis.json</span>
                        </div>
                        <pre className="text-green-300 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                          {analysisResult.formattedReport || JSON.stringify(analysisResult.analysis, null, 2)}
                        </pre>
                        <div className="mt-4 pt-4 border-t border-green-400/30">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 font-mono">Analysis completed • Contract: {contractAddress}</span>
                            <span className="text-gray-400 font-mono">{analysisResult.cached ? 'Source: Redis Cache' : 'Source: Live Analysis'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-500 border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000000] relative">
                    <div className="absolute top-2 right-2 w-4 h-4 bg-black animate-pulse"></div>
                    <h4 className="text-xl font-black text-black mb-3 uppercase tracking-wide">ANALYSIS FAILED</h4>
                    <p className="text-lg font-bold text-black">{analysisResult.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Neo-Brutalist Footer */}
      <footer className="relative z-10 border-t-4 border-cyan-400 bg-black px-6 py-12 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="text-center md:text-left">
              <h4 className="text-2xl font-black text-cyan-400 uppercase tracking-wider mb-4">TERMINAL</h4>
              <p className="text-white font-bold uppercase tracking-wide">SOMNIA GAS PROFILER</p>
            </div>
            <div className="text-center">
              <h4 className="text-2xl font-black text-pink-400 uppercase tracking-wider mb-4">STATUS</h4>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-green-400 animate-pulse"></div>
                <p className="text-green-400 font-bold uppercase tracking-wide">ONLINE</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <h4 className="text-2xl font-black text-yellow-400 uppercase tracking-wider mb-4">NETWORK</h4>
              <p className="text-white font-bold uppercase tracking-wide">SOMNIA BLOCKCHAIN</p>
            </div>
          </div>
          <div className="border-t-2 border-white/20 pt-8 text-center">
            <p className="text-white font-bold uppercase tracking-wider">
              © 2025 SOMNIA GAS PROFILER • BUILT FOR THE FUTURE
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
