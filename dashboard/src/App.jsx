import React, { useState } from 'react';
import { Input, Button, Typography, message } from 'antd';
import { analyzeContract } from './services/api';

const { Title, Paragraph } = Typography;

function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleAnalyze = async () => {
    try {
      const result = await analyzeContract(contractAddress);
      setAnalysisResult(result);
      message.success('Contract analyzed successfully');
    } catch (error) {
      message.error('Failed to analyze contract');
    }
  };

  return (
    <div style={{ padding: '24px', background: '#242424', color: '#fff' }}>
      <Title level={3} style={{ marginBottom: '24px' }}>
        Somnia Gas Profiler
      </Title>
      <Paragraph>
        Get detailed gas analysis for your smart contracts on Somnia testnet with real-time cost calculations in STT tokens.
      </Paragraph>
      <Input
        placeholder="Contract Address"
        value={contractAddress}
        onChange={(e) => setContractAddress(e.target.value)}
        style={{ margin: '16px 0' }}
      />
      <Typography.Text type="secondary">
        Connected to Somnia Testnet
      </Typography.Text>
      <Button type="primary" onClick={handleAnalyze} style={{ marginTop: '16px' }}>
        Analyze Contract
      </Button>
      {analysisResult && (
        <div style={{ marginTop: '24px' }}>
          <Title level={4}>Analysis Result</Title>
          <pre>{JSON.stringify(analysisResult, null, 2)}</pre>
        </div>
      )}
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center' }}>
        <Typography.Text type="secondary">Powered by Somnia blockchain technology</Typography.Text>
        <a href="https://github.com/user/repo" style={{ marginLeft: '16px', color: '#646cff' }}>
          View CLI Tool on GitHub
        </a>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#646cff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="feather feather-share"
        >
          <path d="M4 9h16M4 15h16M4 18v-6a2 2 0 0 1 2-2h2"></path>
        </svg>
      </div>
    </div>
  );
}

export default App;