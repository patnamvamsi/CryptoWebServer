import React, { useState } from 'react';

const MarketDataAdmin = () => {
  const [activeTab, setActiveTab] = useState('binance');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  // Form states for Binance
  const [binanceSymbol, setBinanceSymbol] = useState('');
  const [binancePriority, setBinancePriority] = useState('1');
  const [binanceState, setBinanceState] = useState('true');

  // Form states for Zerodha
  const [zerodhaSymbol, setZerodhaSymbol] = useState('');
  const [zerodhaPriority, setZerodhaPriority] = useState('1');
  const [zerodhaState, setZerodhaState] = useState('true');
  const [zerodhaExchange, setZerodhaExchange] = useState('NSE');
  const [zerodhaInterval, setZerodhaInterval] = useState('1m');

  const MARKET_DATA_URL = 'http://127.0.0.1:8002';

  const callAPI = async (endpoint, method = 'GET', body = null) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(`${MARKET_DATA_URL}${endpoint}`, options);
      const data = await res.json();

      setResponse({
        status: res.status,
        data: data,
        endpoint: endpoint,
        timestamp: new Date().toLocaleString()
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Binance API handlers
  const handleRefreshBinanceSymbols = () => {
    callAPI('/update/symbols');
  };

  const handleFetchHistoricalData = () => {
    if (window.confirm('This will fetch ALL historical data. This may take a long time. Continue?')) {
      callAPI('/historicaldata');
    }
  };

  const handleFetchGapData = () => {
    callAPI('/historicalgapdata');
  };

  const handleUpdateBinanceMarketData = () => {
    if (!binanceSymbol) {
      setError('Please enter a symbol');
      return;
    }
    callAPI(`/update/marketdata/${binanceSymbol}`);
  };

  const handleActivateBinanceSymbol = () => {
    if (!binanceSymbol) {
      setError('Please enter a symbol');
      return;
    }
    callAPI(`/activatesymbol/${binanceSymbol}/${binancePriority}/${binanceState}`, 'POST');
  };

  // Zerodha API handlers
  const handleRefreshZerodhaSymbols = () => {
    callAPI(`/zerodha/update/symbols?exchange_segment=${zerodhaExchange}`);
  };

  const handleGetActiveZerodhaSymbols = () => {
    callAPI('/zerodha/active-symbols');
  };

  const handleInitializeDefaults = () => {
    if (window.confirm('Initialize default NSE symbols?')) {
      callAPI('/zerodha/initialize-defaults', 'POST');
    }
  };

  const handleUpdateZerodhaMarketData = () => {
    if (!zerodhaSymbol) {
      setError('Please enter a symbol');
      return;
    }
    callAPI(`/zerodha/update/marketdata/${zerodhaSymbol}?exchange_segment=${zerodhaExchange}&interval=${zerodhaInterval}`);
  };

  const handleActivateZerodhaSymbol = () => {
    if (!zerodhaSymbol) {
      setError('Please enter a symbol');
      return;
    }
    callAPI(`/zerodha/activatesymbol/${zerodhaSymbol}/${zerodhaPriority}/${zerodhaState}`, 'POST');
  };

  return (
    <div className="container mt-4">
      <h2>Market Data Microservice Admin</h2>
      <p className="text-muted">Manage Binance and Zerodha market data ingestion</p>

      {/* Main Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'binance' ? 'active' : ''}`}
            onClick={() => setActiveTab('binance')}
          >
            Binance APIs
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'zerodha' ? 'active' : ''}`}
            onClick={() => setActiveTab('zerodha')}
          >
            Zerodha APIs
          </button>
        </li>
      </ul>

      {/* Binance Tab Content */}
      {activeTab === 'binance' && (
        <div className="row">
          {/* Symbol Management */}
          <div className="col-md-6 mb-4">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h5>Symbol Management</h5>
              </div>
              <div className="card-body">
                <button
                  className="btn btn-primary w-100 mb-3"
                  onClick={handleRefreshBinanceSymbols}
                  disabled={loading}
                >
                  Refresh Binance Symbols
                </button>

                <hr />

                <h6>Activate/Deactivate Symbol</h6>
                <div className="mb-3">
                  <label className="form-label">Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., BTCUSDT"
                    value={binanceSymbol}
                    onChange={(e) => setBinanceSymbol(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Priority</label>
                  <input
                    type="number"
                    className="form-control"
                    value={binancePriority}
                    onChange={(e) => setBinancePriority(e.target.value)}
                    min="1"
                    max="10"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">State</label>
                  <select
                    className="form-select"
                    value={binanceState}
                    onChange={(e) => setBinanceState(e.target.value)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <button
                  className="btn btn-success w-100"
                  onClick={handleActivateBinanceSymbol}
                  disabled={loading}
                >
                  Update Symbol Status
                </button>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="col-md-6 mb-4">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h5>Data Management</h5>
              </div>
              <div className="card-body">
                <button
                  className="btn btn-warning w-100 mb-3"
                  onClick={handleFetchHistoricalData}
                  disabled={loading}
                >
                  Fetch ALL Historical Data
                </button>

                <button
                  className="btn btn-info w-100 mb-3"
                  onClick={handleFetchGapData}
                  disabled={loading}
                >
                  Fetch Gap Historical Data
                </button>

                <hr />

                <h6>Update Market Data for Symbol</h6>
                <div className="mb-3">
                  <label className="form-label">Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., BTCUSDT"
                    value={binanceSymbol}
                    onChange={(e) => setBinanceSymbol(e.target.value.toUpperCase())}
                  />
                </div>
                <button
                  className="btn btn-primary w-100"
                  onClick={handleUpdateBinanceMarketData}
                  disabled={loading}
                >
                  Update Recent Market Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zerodha Tab Content */}
      {activeTab === 'zerodha' && (
        <div className="row">
          {/* Symbol Management */}
          <div className="col-md-6 mb-4">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h5>Symbol Management</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Exchange Segment</label>
                  <select
                    className="form-select"
                    value={zerodhaExchange}
                    onChange={(e) => setZerodhaExchange(e.target.value)}
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                    <option value="NFO">NFO (F&O)</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary w-100 mb-3"
                  onClick={handleRefreshZerodhaSymbols}
                  disabled={loading}
                >
                  Refresh Zerodha Symbols
                </button>

                <button
                  className="btn btn-info w-100 mb-3"
                  onClick={handleGetActiveZerodhaSymbols}
                  disabled={loading}
                >
                  Get Active Symbols
                </button>

                <button
                  className="btn btn-warning w-100 mb-3"
                  onClick={handleInitializeDefaults}
                  disabled={loading}
                >
                  Initialize Default NSE Symbols
                </button>

                <hr />

                <h6>Activate/Deactivate Symbol</h6>
                <div className="mb-3">
                  <label className="form-label">Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., INFY"
                    value={zerodhaSymbol}
                    onChange={(e) => setZerodhaSymbol(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Priority</label>
                  <input
                    type="number"
                    className="form-control"
                    value={zerodhaPriority}
                    onChange={(e) => setZerodhaPriority(e.target.value)}
                    min="1"
                    max="10"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">State</label>
                  <select
                    className="form-select"
                    value={zerodhaState}
                    onChange={(e) => setZerodhaState(e.target.value)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <button
                  className="btn btn-success w-100"
                  onClick={handleActivateZerodhaSymbol}
                  disabled={loading}
                >
                  Update Symbol Status
                </button>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="col-md-6 mb-4">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h5>Data Management</h5>
              </div>
              <div className="card-body">
                <h6>Update Market Data for Symbol</h6>
                <div className="mb-3">
                  <label className="form-label">Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., INFY"
                    value={zerodhaSymbol}
                    onChange={(e) => setZerodhaSymbol(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Exchange Segment</label>
                  <select
                    className="form-select"
                    value={zerodhaExchange}
                    onChange={(e) => setZerodhaExchange(e.target.value)}
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                    <option value="NFO">NFO (F&O)</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Interval</label>
                  <select
                    className="form-select"
                    value={zerodhaInterval}
                    onChange={(e) => setZerodhaInterval(e.target.value)}
                  >
                    <option value="1m">1 Minute</option>
                    <option value="3m">3 Minutes</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="30m">30 Minutes</option>
                    <option value="60m">1 Hour</option>
                    <option value="1d">1 Day</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary w-100"
                  onClick={handleUpdateZerodhaMarketData}
                  disabled={loading}
                >
                  Update Recent Market Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Section */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-dark text-white">
              <h5>API Response</h5>
            </div>
            <div className="card-body">
              {loading && (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Processing request...</p>
                </div>
              )}

              {error && (
                <div className="alert alert-danger" role="alert">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {response && (
                <div>
                  <div className="mb-3">
                    <span className={`badge ${response.status === 200 ? 'bg-success' : 'bg-danger'} me-2`}>
                      Status: {response.status}
                    </span>
                    <span className="badge bg-info me-2">
                      Endpoint: {response.endpoint}
                    </span>
                    <span className="badge bg-secondary">
                      {response.timestamp}
                    </span>
                  </div>
                  <pre className="bg-light p-3 rounded">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              )}

              {!loading && !error && !response && (
                <p className="text-muted text-center">
                  Click any button above to invoke an API and see the response here
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDataAdmin;
