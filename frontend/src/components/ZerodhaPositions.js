import React, { useState, useEffect } from 'react';

const ZerodhaPositions = () => {
  const [positions, setPositions] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [accountInfo, setAccountInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' or 'positions'

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch holdings, positions, and account info in parallel
      const [holdingsRes, positionsRes, accountRes] = await Promise.all([
        fetch('/home/api/zerodha/holdings'),
        fetch('/home/api/zerodha/positions'),
        fetch('/home/api/zerodha/account')
      ]);

      const [holdingsData, positionsData, accountData] = await Promise.all([
        holdingsRes.json(),
        positionsRes.json(),
        accountRes.json()
      ]);

      if (holdingsData.success) {
        setHoldings(holdingsData.data);
      } else {
        throw new Error(holdingsData.error || 'Failed to fetch holdings');
      }

      if (positionsData.success) {
        setPositions(positionsData.data);
      } else {
        console.warn('Positions fetch failed:', positionsData.error);
      }

      if (accountData.success) {
        setAccountInfo(accountData.data);
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchAllData, 60000);

    return () => clearInterval(interval);
  }, []);

  const calculateTotalPnL = (data) => {
    return data.reduce((sum, item) => sum + item.pnl, 0).toFixed(2);
  };

  const calculateTotalInvested = () => {
    return holdings.reduce((sum, h) => sum + h.invested_value, 0).toFixed(2);
  };

  const calculateTotalCurrent = () => {
    return holdings.reduce((sum, h) => sum + h.current_value, 0).toFixed(2);
  };

  if (loading && holdings.length === 0 && positions.length === 0) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading Zerodha data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Error!</h4>
          <p>{error}</p>
          <hr />
          <button className="btn btn-danger" onClick={fetchAllData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row mb-3">
        <div className="col-md-8">
          <h2>Zerodha Portfolio</h2>
          <p className="text-muted">
            Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
          </p>
        </div>
        <div className="col-md-4 text-end">
          <button
            className="btn btn-primary"
            onClick={fetchAllData}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {accountInfo && !accountInfo.error && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Account Summary</h5>
            <div className="row">
              <div className="col-md-3">
                <strong>User:</strong> {accountInfo.user_name || accountInfo.user_id}
              </div>
              <div className="col-md-3">
                <strong>Available Funds:</strong> ₹{accountInfo.equity_available?.toFixed(2) || '0.00'}
              </div>
              <div className="col-md-3">
                <strong>Used Margin:</strong> ₹{accountInfo.equity_used?.toFixed(2) || '0.00'}
              </div>
              <div className="col-md-3">
                <strong>Holdings:</strong> {holdings.length} | <strong>Positions:</strong> {positions.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'holdings' ? 'active' : ''}`}
            onClick={() => setActiveTab('holdings')}
          >
            Holdings ({holdings.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            Positions ({positions.length})
          </button>
        </li>
      </ul>

      {/* Holdings Tab */}
      {activeTab === 'holdings' && (
        <>
          {holdings.length === 0 ? (
            <div className="alert alert-info">
              No holdings found. Your equity portfolio appears to be empty.
            </div>
          ) : (
            <>
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="card-title">Holdings Summary</h5>
                  <div className="row">
                    <div className="col-md-4">
                      <strong>Total Invested:</strong> ₹{calculateTotalInvested()}
                    </div>
                    <div className="col-md-4">
                      <strong>Current Value:</strong> ₹{calculateTotalCurrent()}
                    </div>
                    <div className="col-md-4">
                      <strong>Total P&L:</strong>{' '}
                      <span className={calculateTotalPnL(holdings) >= 0 ? 'text-success' : 'text-danger'}>
                        ₹{calculateTotalPnL(holdings)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
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
                        <td><strong>{holding.tradingsymbol}</strong></td>
                        <td>{holding.exchange}</td>
                        <td className="text-end">{holding.quantity}</td>
                        <td className="text-end">₹{holding.average_price.toFixed(2)}</td>
                        <td className="text-end">₹{holding.last_price.toFixed(2)}</td>
                        <td className="text-end">₹{holding.invested_value.toFixed(2)}</td>
                        <td className="text-end">₹{holding.current_value.toFixed(2)}</td>
                        <td className={`text-end ${holding.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                          ₹{holding.pnl.toFixed(2)}
                        </td>
                        <td className={`text-end ${holding.pnl_percent >= 0 ? 'text-success' : 'text-danger'}`}>
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
            <div className="alert alert-info">
              No active positions. You don't have any open intraday or F&O trades.
            </div>
          ) : (
            <>
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="card-title">Positions Summary</h5>
                  <p className="card-text">
                    <strong>Total P&L:</strong>{' '}
                    <span className={calculateTotalPnL(positions) >= 0 ? 'text-success' : 'text-danger'}>
                      ₹{calculateTotalPnL(positions)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
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
                        <td><strong>{position.tradingsymbol}</strong></td>
                        <td>{position.exchange}</td>
                        <td>
                          <span className={`badge bg-${position.position_type === 'DAY' ? 'info' : 'warning'}`}>
                            {position.position_type}
                          </span>
                        </td>
                        <td>{position.product}</td>
                        <td className="text-end">{position.quantity}</td>
                        <td className="text-end">₹{position.average_price.toFixed(2)}</td>
                        <td className="text-end">₹{position.last_price.toFixed(2)}</td>
                        <td className={`text-end ${position.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
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
