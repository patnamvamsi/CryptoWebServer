import React, { useState } from 'react';
import BinancePositions from './BinancePositions';
import ZerodhaPositions from './ZerodhaPositions';

const BrokerPortfolio = () => {
  const [activeBroker, setActiveBroker] = useState('binance');

  const tabStyle = (isActive) => ({
    backgroundColor: isActive ? '#2a3a4e' : 'transparent',
    color: isActive ? '#e0e6ed' : '#7a8ea0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    padding: '8px 20px',
    transition: 'all 0.15s'
  });

  return (
    <div style={{ paddingTop: '24px', paddingBottom: '24px' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 style={{ color: '#e0e6ed', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
            Portfolio
          </h2>
          <p style={{ color: '#7a8ea0', fontSize: '12px', marginBottom: 0 }}>
            Track positions across exchanges
          </p>
        </div>
        <div className="d-flex" style={{ gap: '4px', backgroundColor: '#1a2836', padding: '4px', borderRadius: '6px' }}>
          <button style={tabStyle(activeBroker === 'binance')} onClick={() => setActiveBroker('binance')}>
            Binance
          </button>
          <button style={tabStyle(activeBroker === 'zerodha')} onClick={() => setActiveBroker('zerodha')}>
            Zerodha
          </button>
        </div>
      </div>

      <div>
        {activeBroker === 'binance' && <BinancePositions />}
        {activeBroker === 'zerodha' && <ZerodhaPositions />}
      </div>
    </div>
  );
};

export default BrokerPortfolio;
