import React, { useState } from 'react';
import BinancePositions from './BinancePositions';
import ZerodhaPositions from './ZerodhaPositions';

const BrokerPortfolio = () => {
  const [activeBroker, setActiveBroker] = useState('binance');

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">Multi-Broker Portfolio Dashboard</h1>

          {/* Broker Tab Navigation */}
          <ul className="nav nav-pills nav-fill mb-4">
            <li className="nav-item">
              <button
                className={`nav-link ${activeBroker === 'binance' ? 'active' : ''}`}
                onClick={() => setActiveBroker('binance')}
                style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                🪙 Binance (Crypto)
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeBroker === 'zerodha' ? 'active' : ''}`}
                onClick={() => setActiveBroker('zerodha')}
                style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                📈 Zerodha (Equity & F&O)
              </button>
            </li>
          </ul>

          {/* Content Area */}
          <div className="tab-content">
            {activeBroker === 'binance' && <BinancePositions />}
            {activeBroker === 'zerodha' && <ZerodhaPositions />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokerPortfolio;
