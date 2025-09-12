const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Analyze a contract
 */
export async function analyzeContract(contractAddress) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contractAddress }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to analyze contract:', error);
    throw error;
  }
}

/**
 * Health check
 */
export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

export const getRecentAnalyses = async (limit = 10) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/recent?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch recent analyses:', error);
    throw error;
  }
};

export const getGlobalStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch global stats:', error);
    throw error;
  }
};

export const getCacheStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cache/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch cache stats:', error);
    throw error;
  }
};

export const deleteAnalysisCache = async (contractAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cache/${contractAddress}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to delete analysis cache:', error);
    throw error;
  }
};