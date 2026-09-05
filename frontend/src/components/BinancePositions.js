import React, { useState, useEffect } from 'react';
import useWebSocket from '../hooks/useWebSocket';

const BinancePositions = () => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [priceUpdatesEnabled, setPriceUpdatesEnabled] = useState(true);

  const { subscribe, unsubscribe, lastMessage, isConnected } = useWebSocket('binance');

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/binance/positions');
      const data = await response.json();
      if (data.success) {
        setPositions(data.data);
        setLastUpdate(new Date());
      } else {
        setError(data.error || 'Failed to fetch positions');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (priceUpdatesEnabled && positions.length > 0) {
      const symbols = positions
        .map(pos => `${pos.asset}USDT`)
        .filter(symbol => symbol !== 'USDTUSDT');
      if (symbols.length > 0) {
        subscribe(symbols);
      }
      return () => {
        if (symbols.length > 0) {
          unsubscribe(symbols);
        }
      };
    }
  }, [positions, priceUpdatesEnabled, subscribe, unsubscribe]);

  useEffect(() => {
    if (lastMessage && lastMessage.price && lastMessage.symbol) {
      setLivePrices(prev => ({
        ...prev,
        [lastMessage.symbol]: {
          price: lastMessage.price,
          change: lastMessage.changePercent,
          timestamp: lastMessage.timestamp
        }
      }));
    }
  }, [lastMessage]);

  const calculateTotalValue = () => {
    return positions.reduce((sum, pos) => sum + pos.total, 0).toFixed(2);
  };

  if (loading && positions.length === 0) {
    return (
      <div className="text-center" style={{ padding: '48px 0' }}>
        <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ color: '#7a8ea0', marginTop: '12px', fontSize: '13px' }}>Loading positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'rgba(246,70,93,0.08)',
        border: '1px solid rgba(246,70,93,0.2)',
        borderRadius: '6px',
        padding: '16px 20px',
        margin: '24px 0'
      }}>
        <p style={{ color: '#f6465d', fontWeight: 500, marginBottom: '8px', fontSize: '13px' }}>Error: {error}</p>
        <button className="btn btn-sm" style={{
          backgroundColor: '#2a3a4e',
          color: '#e0e6ed',
          border: 'none'
        }} onClick={fetchPositions}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '16px' }}>
        <div>
          <h4 style={{ color: '#e0e6ed', fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
            Binance Holdings
          </h4>
          <span style={{ color: '#546a7e', fontSize: '11px' }}>
            Updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
          </span>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm"
            style={{
              backgroundColor: priceUpdatesEnabled && isConnected ? 'rgba(14,203,129,0.1)' : '#2a3a4e',
              color: priceUpdatesEnabled && isConnected ? '#0ecb81' : '#7a8ea0',
              border: `1px solid ${priceUpdatesEnabled && isConnected ? 'rgba(14,203,129,0.3)' : '#2a3a4e'}`,
              fontSize: '12px'
            }}
            onClick={() => setPriceUpdatesEnabled(!priceUpdatesEnabled)}
          >
            {isConnected && priceUpdatesEnabled ? 'Live' : 'Offline'}
          </button>
          <button
            className="btn btn-sm"
            style={{
              backgroundColor: loading ? '#2a3a4e' : '#f0a500',
              color: loading ? '#7a8ea0' : '#0f1923',
              border: 'none',
              fontSize: '12px'
            }}
            onClick={fetchPositions}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {positions.length === 0 ? (
        <p style={{ color: '#7a8ea0', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
          No positions found.
        </p>
      ) : (
        <>
          {/* Summary */}
          <div style={{
            backgroundColor: '#1a2836',
            border: '1px solid #2a3a4e',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div className="row">
              <div className="col-md-4">
                <span style={{ color: '#7a8ea0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Assets</span>
                <p style={{ color: '#e0e6ed', fontSize: '18px', fontWeight: 600, marginBottom: 0 }}>{positions.length}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="text-end">Free</th>
                  <th className="text-end">Locked</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Price (USDT)</th>
                  <th className="text-end">Est. Value</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position, index) => {
                  const symbol = `${position.asset}USDT`;
                  const livePrice = livePrices[symbol];
                  const estimatedValue = livePrice ? (position.total * livePrice.price).toFixed(2) : null;

                  return (
                    <tr key={index}>
                      <td style={{ fontWeight: 500, color: '#e0e6ed' }}>{position.asset}</td>
                      <td className="text-end" style={{ color: '#7a8ea0' }}>
                        {parseFloat(position.free).toFixed(8)}
                      </td>
                      <td className="text-end" style={{ color: '#7a8ea0' }}>
                        {parseFloat(position.locked).toFixed(8)}
                      </td>
                      <td className="text-end" style={{ color: '#e0e6ed', fontWeight: 500 }}>
                        {position.total.toFixed(8)}
                      </td>
                      <td className="text-end">
                        {livePrice ? (
                          <div>
                            <span style={{ color: '#e0e6ed' }}>
                              ${livePrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                            </span>
                            <span style={{
                              color: livePrice.change >= 0 ? '#0ecb81' : '#f6465d',
                              fontSize: '11px',
                              marginLeft: '6px'
                            }}>
                              {livePrice.change >= 0 ? '+' : ''}{livePrice.change?.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#546a7e' }}>—</span>
                        )}
                      </td>
                      <td className="text-end">
                        {estimatedValue ? (
                          <span style={{ color: '#e0e6ed', fontWeight: 500 }}>
                            ${parseFloat(estimatedValue).toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: '#546a7e' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default BinancePositions;
