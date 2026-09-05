import React, { useState, useEffect } from 'react';

const ZerodhaPositions = () => {
  const [positions, setPositions] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [accountInfo, setAccountInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('holdings');

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [holdingsRes, positionsRes, accountRes] = await Promise.all([
        fetch('/api/zerodha/holdings'),
        fetch('/api/zerodha/positions'),
        fetch('/api/zerodha/account')
      ]);
      const [holdingsData, positionsData, accountData] = await Promise.all([
        holdingsRes.json(), positionsRes.json(), accountRes.json()
      ]);
      if (holdingsData.success) setHoldings(holdingsData.data);
      else throw new Error(holdingsData.error || 'Failed to fetch holdings');
      if (positionsData.success) setPositions(positionsData.data);
      if (accountData.success) setAccountInfo(accountData.data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, []);

  const calculateTotalPnL = (data) => data.reduce((sum, item) => sum + item.pnl, 0).toFixed(2);
  const calculateTotalInvested = () => holdings.reduce((sum, h) => sum + h.invested_value, 0).toFixed(2);
  const calculateTotalCurrent = () => holdings.reduce((sum, h) => sum + h.current_value, 0).toFixed(2);

  const tabStyle = (isActive) => ({
    backgroundColor: isActive ? '#2a3a4e' : 'transparent',
    color: isActive ? '#e0e6ed' : '#7a8ea0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    padding: '6px 14px'
  });

  if (loading && holdings.length === 0 && positions.length === 0) {
    return (
      <div className="text-center" style={{ padding: '48px 0' }}>
        <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ color: '#7a8ea0', marginTop: '12px', fontSize: '13px' }}>Loading Zerodha data...</p>
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
        <button className="btn btn-sm" style={{ backgroundColor: '#2a3a4e', color: '#e0e6ed', border: 'none' }} onClick={fetchAllData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '16px' }}>
        <div>
          <h4 style={{ color: '#e0e6ed', fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
            Zerodha Portfolio
          </h4>
          <span style={{ color: '#546a7e', fontSize: '11px' }}>
            Updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
          </span>
        </div>
        <button
          className="btn btn-sm"
          style={{
            backgroundColor: loading ? '#2a3a4e' : '#f0a500',
            color: loading ? '#7a8ea0' : '#0f1923',
            border: 'none',
            fontSize: '12px'
          }}
          onClick={fetchAllData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Account Summary */}
      {accountInfo && !accountInfo.error && (
        <div style={{
          backgroundColor: '#1a2836',
          border: '1px solid #2a3a4e',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div className="row">
            {[
              { label: 'User', value: accountInfo.user_name || accountInfo.user_id, color: '#e0e6ed' },
              { label: 'Available', value: `₹${accountInfo.equity_available?.toFixed(2) || '0.00'}`, color: '#e0e6ed' },
              { label: 'Used Margin', value: `₹${accountInfo.equity_used?.toFixed(2) || '0.00'}`, color: '#f6465d' },
              { label: 'Stats', value: `${holdings.length} Holdings · ${positions.length} Positions`, color: '#e0e6ed' }
            ].map((item, i) => (
              <div key={i} className="col-md-3">
                <span style={{ color: '#7a8ea0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</span>
                <p style={{ color: item.color, fontSize: '14px', fontWeight: 500, marginBottom: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="d-flex" style={{ gap: '4px', backgroundColor: '#1a2836', padding: '4px', borderRadius: '6px', marginBottom: '16px', display: 'inline-flex' }}>
        <button style={tabStyle(activeTab === 'holdings')} onClick={() => setActiveTab('holdings')}>
          Holdings ({holdings.length})
        </button>
        <button style={tabStyle(activeTab === 'positions')} onClick={() => setActiveTab('positions')}>
          Positions ({positions.length})
        </button>
      </div>

      {/* Holdings Tab */}
      {activeTab === 'holdings' && (
        <>
          {holdings.length === 0 ? (
            <p style={{ color: '#7a8ea0', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
              No holdings found.
            </p>
          ) : (
            <>
              <div style={{
                backgroundColor: '#1a2836',
                border: '1px solid #2a3a4e',
                borderRadius: '6px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div className="row">
                  {[
                    { label: 'Total Invested', value: `₹${calculateTotalInvested()}`, color: '#e0e6ed' },
                    { label: 'Current Value', value: `₹${calculateTotalCurrent()}`, color: '#e0e6ed' },
                    { label: 'Total P&L', value: `₹${calculateTotalPnL(holdings)}`, color: calculateTotalPnL(holdings) >= 0 ? '#0ecb81' : '#f6465d' }
                  ].map((item, i) => (
                    <div key={i} className="col-md-4">
                      <span style={{ color: '#7a8ea0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</span>
                      <p style={{ color: item.color, fontSize: '18px', fontWeight: 600, marginBottom: 0 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Exchange</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Avg Price</th>
                      <th className="text-end">LTP</th>
                      <th className="text-end">Invested</th>
                      <th className="text-end">Current</th>
                      <th className="text-end">P&L</th>
                      <th className="text-end">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding, index) => (
                      <tr key={index}>
                        <td style={{ fontWeight: 500, color: '#e0e6ed' }}>{holding.tradingsymbol}</td>
                        <td style={{ color: '#7a8ea0' }}>{holding.exchange}</td>
                        <td className="text-end" style={{ color: '#7a8ea0' }}>{holding.quantity}</td>
                        <td className="text-end" style={{ color: '#7a8ea0' }}>₹{holding.average_price.toFixed(2)}</td>
                        <td className="text-end" style={{ color: '#e0e6ed' }}>₹{holding.last_price.toFixed(2)}</td>
                        <td className="text-end" style={{ color: '#7a8ea0' }}>₹{holding.invested_value.toFixed(2)}</td>
                        <td className="text-end" style={{ color: '#e0e6ed', fontWeight: 500 }}>₹{holding.current_value.toFixed(2)}</td>
                        <td className="text-end" style={{ color: holding.pnl >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 500 }}>
                          ₹{holding.pnl.toFixed(2)}
                        </td>
                        <td className="text-end" style={{ color: holding.pnl_percent >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 500 }}>
                          {holding.pnl_percent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <>
          {positions.length === 0 ? (
            <p style={{ color: '#7a8ea0', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
              No active positions.
            </p>
          ) : (
            <>
              <div style={{
                backgroundColor: '#1a2836',
                border: '1px solid #2a3a4e',
                borderRadius: '6px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <span style={{ color: '#7a8ea0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total P&L</span>
                <p style={{ color: calculateTotalPnL(positions) >= 0 ? '#0ecb81' : '#f6465d', fontSize: '18px', fontWeight: 600, marginBottom: 0 }}>
                  ₹{calculateTotalPnL(positions)}
                </p>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Exchange</th>
                      <th>Type</th>
                      <th>Product</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Avg Price</th>
                      <th className="text-end">LTP</th>
                      <th className="text-end">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position, index) => (
                      <tr key={index}>
                        <td style={{ fontWeight: 500, color: '#e0e6ed' }}>{position.tradingsymbol}</td>
                        <td style={{ color: '#7a8ea0' }}>{position.exchange}</td>
                        <td>
                          <span className="badge" style={{
                            backgroundColor: position.position_type === 'DAY' ? 'rgba(91,141,238,0.15)' : 'rgba(240,185,11,0.15)',
                            color: position.position_type === 'DAY' ? '#5b8dee' : '#f0b90b',
                            fontSize: '11px'
                          }}>
                            {position.position_type}
                          </span>
                        </td>
                        <td style={{ color: '#7a8ea0' }}>{position.product}</td>
                        <td className="text-end" style={{ color: '#7a8ea0' }}>{position.quantity}</td>
                        <td className="text-end" style={{ color: '#7a8ea0' }}>₹{position.average_price.toFixed(2)}</td>
                        <td className="text-end" style={{ color: '#e0e6ed' }}>₹{position.last_price.toFixed(2)}</td>
                        <td className="text-end" style={{ color: position.pnl >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 500 }}>
                          ₹{position.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ZerodhaPositions;
