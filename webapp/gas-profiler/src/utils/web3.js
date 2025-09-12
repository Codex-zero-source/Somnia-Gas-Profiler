import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

/**
 * Request wallet connection
 */
export async function connectWallet() {
  try {
    const provider = await detectEthereumProvider();
    
    if (!provider) {
      throw new Error('MetaMask not found. Please install MetaMask to use this dApp.');
    }

    // Request account access
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const signer = new ethers.BrowserProvider(provider).getSigner();
    
    return {
      provider,
      signer,
      address: accounts[0]
    };
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}

/**
 * Switch to Somnia testnet
 */
export async function switchToSomniaNetwork() {
  try {
    const provider = await detectEthereumProvider();
    
    if (!provider) {
      throw new Error('MetaMask not found');
    }

    // Try to switch to Somnia testnet
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xC478' }], // 50312 in hex
    });
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0xC478',
              chainName: 'Somnia Testnet',
              nativeCurrency: {
                name: 'Somnia Test Token',
                symbol: 'STT',
                decimals: 18,
              },
              rpcUrls: ['https://dream-rpc.somnia.network'],
              blockExplorerUrls: ['https://shannon-explorer.somnia.network'],
            },
          ],
        });
      } catch (addError) {
        console.error('Failed to add Somnia network:', addError);
        throw addError;
      }
    } else {
      console.error('Failed to switch to Somnia network:', switchError);
      throw switchError;
    }
  }
}

/**
 * Get contract instance
 */
export async function getContract(address, abi, signer) {
  try {
    const contract = new ethers.Contract(address, abi, signer);
    return contract;
  } catch (error) {
    console.error('Failed to get contract instance:', error);
    throw error;
  }
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address) {
  return ethers.isAddress(address);
}