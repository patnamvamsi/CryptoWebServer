import React, { useState, useEffect } from 'react';

const MarketDataAdmin = () => {
  const [activeTab, setActiveTab] = useState('binance');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const [binanceSymbol, setBinanceSymbol] = useState('');
  const [binancePriority, setBinancePriority] = useState('1');
  const [binanceState, setBinanceState] = useState('true');
  const [binanceSymbolsList, setBinanceSymbolsList] = useState([]);
  const [filteredBinanceSymbols, setFilteredBinanceSymbols] = useState([]);
  const [showBinanceDropdown, setShowBinanceDropdown] = useState(false);

  const [zerodhaSymbol, setZerodhaSymbol] = useState('');
  const [zerodhaPriority, setZerodhaPriority] = useState('1');
  const [zerodhaState, setZerodhaState] = useState('true');
  const [zerodhaExchange, setZerodhaExchange] = useState('NSE');
  const [zerodhaInterval, setZerodhaInterval] = useState('1m');
  const [zerodhaSymbolsList, setZerodhaSymbolsList] = useState([]);
  const [filteredZerodhaSymbols, setFilteredZerodhaSymbols] = useState([]);
  const [showZerodhaDropdown, setShowZerodhaDropdown] = useState(false);

  const MARKET_DATA_URL = 'http://127.0.0.1:8002';

  useEffect(() => { fetchBinanceSymbols(); }, []);
  useEffect(() => {
    if (activeTab === 'zerodha') fetchZerodhaSymbols();
  }, [zerodhaExchange, activeTab]);

  const handleBinanceSymbolChange = (value) => {
    setBinanceSymbol(value);
    if (value) {
      const filtered = binanceSymbolsList.filter(s => s.toUpperCase().includes(value.toUpperCase()));
      setFilteredBinanceSymbols(filtered.slice(0, 20));
      setShowBinanceDropdown(filtered.length > 0);
    } else {
      setFilteredBinanceSymbols([]);
      setShowBinanceDropdown(false);
    }
  };

  const handleZerodhaSymbolChange = (value) => {
    setZerodhaSymbol(value);
    if (value) {
      const filtered = zerodhaSymbolsList.filter(s => s.toUpperCase().includes(value.toUpperCase()));
      setFilteredZerodhaSymbols(filtered.slice(0, 20));
      setShowZerodhaDropdown(filtered.length > 0);
    } else {
      setFilteredZerodhaSymbols([]);
      setShowZerodhaDropdown(false);
    }
  };

  const fetchBinanceSymbols = async () => {
    try {
      const res = await fetch(`${MARKET_DATA_URL}/binance/symbols`);
      const data = await res.json();
      if (data.symbols) setBinanceSymbolsList(data.symbols);
    } catch (err) { console.error('Failed to fetch Binance symbols:', err); }
  };

  const fetchZerodhaSymbols = async () => {
    try {
      const res = await fetch(`${MARKET_DATA_URL}/zerodha/symbols?exchange_segment=${zerodhaExchange}`);
      const data = await res.json();
      if (data.symbols) setZerodhaSymbolsList(data.symbols);
    } catch (err) { console.error('Failed to fetch Zerodha symbols:', err); }
  };

  const callAPI = async (endpoint, method = 'GET', body = null) => {
    setLoading(true); setError(null); setResponse(null);
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body && method === 'POST') options.body = JSON.stringify(body);
      const res = await fetch(`${MARKET_DATA_URL}${endpoint}`, options);
      const data = await res.json();
      setResponse({ status: res.status, data, endpoint, timestamp: new Date().toLocaleString() });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRefreshBinanceSymbols = () => callAPI('/update/symbols');
  const handleGetActiveBinanceSymbols = () => callAPI('/binance/active-symbols');
  const handleFetchHistoricalData = () => {
    if (window.confirm('This will fetch ALL historical data. This may take a long time. Continue?'))
      callAPI('/historicaldata');
  };
  const handleFetchGapData = () => callAPI('/historicalgapdata');
  const handleUpdateBinanceMarketData = () => {
    if (!binanceSymbol) { setError('Please enter a symbol'); return; }
    callAPI(`/update/marketdata/${binanceSymbol.toUpperCase()}`);
  };
  const handleActivateBinanceSymbol = () => {
    if (!binanceSymbol) { setError('Please enter a symbol'); return; }
    callAPI(`/activatesymbol/${binanceSymbol.toUpperCase()}/${binancePriority}/${binanceState}`, 'POST');
  };

  const handleRefreshZerodhaSymbols = () => callAPI(`/zerodha/update/symbols?exchange_segment=${zerodhaExchange}`);
  const handleGetActiveZerodhaSymbols = () => callAPI('/zerodha/active-symbols');
  const handleInitializeDefaults = () => {
    if (window.confirm('Initialize default NSE symbols?'))
      callAPI('/zerodha/initialize-defaults', 'POST');
  };
  const handleUpdateZerodhaMarketData = () => {
    if (!zerodhaSymbol) { setError('Please enter a symbol'); return; }
    callAPI(`/zerodha/update/marketdata/${zerodhaSymbol.toUpperCase()}?exchange_segment=${zerodhaExchange}&interval=${zerodhaInterval}`);
  };
  const handleActivateZerodhaSymbol = () => {
    if (!zerodhaSymbol) { setError('Please enter a symbol'); return; }
    callAPI(`/zerodha/activatesymbol/${zerodhaSymbol.toUpperCase()}/${zerodhaPriority}/${zerodhaState}`, 'POST');
  };
  const handleFetchZerodhaGapData = () => {
    if (window.confirm(`Fetch gap data for all active ${zerodhaExchange} symbols?`))
      callAPI(`/zerodha/historicalgapdata?exchange_segment=${zerodhaExchange}&interval=${zerodhaInterval}`);
  };

  const tabStyle = (isActive) => ({
    backgroundColor: isActive ? '#2a3a4e' : 'transparent',
    color: isActive ? '#e0e6ed' : '#7a8ea0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    padding: '8px 20px'
  });

  const inputStyle = {
    backgroundColor: '#152232',
    border: '1px solid #2a3a4e',
    color: '#e0e6ed',
    borderRadius: '4px',
    fontSize: '13px'
  };

  const btnPrimary = {
    backgroundColor: '#f0a500',
    color: '#0f1923',
    border: 'none',
    fontWeight: 500,
    fontSize: '13px'
  };

  const btnSecondary = {
    backgroundColor: '#2a3a4e',
    color: '#e0e6ed',
    border: '1px solid #354a5f',
    fontWeight: 500,
    fontSize: '13px'
  };

  const btnDanger = {
    backgroundColor: 'rgba(246,70,93,0.12)',
    color: '#f6465d',
    border: '1px solid rgba(246,70,93,0.25)',
    fontWeight: 500,
    fontSize: '13px'
  };

  const SectionCard = ({ title, children }) => (
    <div style={{
      backgroundColor: '#1a2836',
      border: '1px solid #2a3a4e',
      borderRadius: '6px',
      marginBottom: '16px',
      overflow: 'hidden'
    }}>
      <div style={{
        backgroundColor: '#1e2d3d',
        borderBottom: '1px solid #2a3a4e',
        padding: '10px 16px'
      }}>
        <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>
          {title}
        </h6>
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  );

  const DropdownList = ({ items, show, onSelect }) => {
    if (!show || items.length === 0) return null;
    return (
      <div style={{
        position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '180px',
        overflowY: 'auto', backgroundColor: '#152232', border: '1px solid #2a3a4e',
        borderRadius: '4px', marginTop: '2px', zIndex: 1000
      }}>
        {items.map((symbol, index) => (
          <div key={index} style={{
            padding: '8px 12px', cursor: 'pointer', color: '#e0e6ed', fontSize: '12px',
            borderBottom: index < items.length - 1 ? '1px solid #2a3a4e' : 'none'
          }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a3a4e'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            onClick={() => onSelect(symbol)}
          >
            {symbol}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ paddingTop: '24px', paddingBottom: '24px' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 style={{ color: '#e0e6ed', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
            Market Data Admin
          </h2>
          <p style={{ color: '#7a8ea0', fontSize: '12px', marginBottom: 0 }}>
            Manage ingestion and symbol configuration
          </p>
        </div>
        <div className="d-flex" style={{ gap: '4px', backgroundColor: '#1a2836', padding: '4px', borderRadius: '6px' }}>
          <button style={tabStyle(activeTab === 'binance')} onClick={() => setActiveTab('binance')}>Binance</button>
          <button style={tabStyle(activeTab === 'zerodha')} onClick={() => setActiveTab('zerodha')}>Zerodha</button>
        </div>
      </div>

      {/* Binance */}
      {activeTab === 'binance' && (
        <div className="row">
          <div className="col-lg-4">
            <SectionCard title="Quick Actions">
              <div className="d-grid gap-2">
                <button className="btn" style={btnPrimary} onClick={handleGetActiveBinanceSymbols} disabled={loading}>View Active Symbols</button>
                <button className="btn" style={btnSecondary} onClick={handleRefreshBinanceSymbols} disabled={loading}>Refresh Symbol List</button>
                <button className="btn" style={btnDanger} onClick={handleFetchGapData} disabled={loading}>Fill Data Gaps</button>
              </div>
            </SectionCard>
            <SectionCard title="Bulk Operations">
              <button className="btn w-100" style={btnDanger} onClick={handleFetchHistoricalData} disabled={loading}>Fetch ALL Historical Data</button>
              <p style={{ color: '#546a7e', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>This operation may take considerable time</p>
            </SectionCard>
          </div>
          <div className="col-lg-8">
            <SectionCard title="Symbol Management">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Symbol</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" className="form-control" style={inputStyle} placeholder="e.g., BTCUSDT"
                      value={binanceSymbol} onChange={(e) => handleBinanceSymbolChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowBinanceDropdown(false), 200)}
                      onFocus={() => binanceSymbol && setShowBinanceDropdown(filteredBinanceSymbols.length > 0)}
                    />
                    <DropdownList items={filteredBinanceSymbols} show={showBinanceDropdown}
                      onSelect={(s) => { setBinanceSymbol(s); setShowBinanceDropdown(false); }} />
                  </div>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Priority</label>
                  <input type="number" className="form-control" style={inputStyle} value={binancePriority}
                    onChange={(e) => setBinancePriority(e.target.value)} min="1" max="10" />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" style={inputStyle} value={binanceState} onChange={(e) => setBinanceState(e.target.value)}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button className="btn flex-fill" style={btnPrimary} onClick={handleActivateBinanceSymbol} disabled={loading}>Update Status</button>
                <button className="btn flex-fill" style={btnSecondary} onClick={handleUpdateBinanceMarketData} disabled={loading}>Update Market Data</button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Zerodha */}
      {activeTab === 'zerodha' && (
        <div className="row">
          <div className="col-lg-4">
            <SectionCard title="Token Management">
              <div className="d-grid gap-2">
                <button className="btn" style={{ ...btnSecondary, borderColor: 'rgba(240,185,11,0.3)', color: '#f0b90b' }}
                  onClick={() => callAPI('/zerodha/token/status')} disabled={loading}>Check Token Status</button>
                <button className="btn" style={btnSecondary}
                  onClick={() => { if (window.confirm('Re-authenticate with Zerodha?')) callAPI('/zerodha/token/refresh', 'POST'); }}
                  disabled={loading}>Refresh Access Token</button>
              </div>
              <p style={{ color: '#546a7e', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>Tokens valid for 24 hours</p>
            </SectionCard>
            <SectionCard title="Exchange Settings">
              <label className="form-label">Exchange Segment</label>
              <select className="form-select mb-3" style={inputStyle} value={zerodhaExchange} onChange={(e) => setZerodhaExchange(e.target.value)}>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
                <option value="NFO">NFO (F&O)</option>
              </select>
              <label className="form-label">Data Interval</label>
              <select className="form-select" style={inputStyle} value={zerodhaInterval} onChange={(e) => setZerodhaInterval(e.target.value)}>
                <option value="1m">1 Min</option>
                <option value="3m">3 Min</option>
                <option value="5m">5 Min</option>
                <option value="15m">15 Min</option>
                <option value="30m">30 Min</option>
                <option value="60m">1 Hour</option>
                <option value="1d">1 Day</option>
              </select>
            </SectionCard>
            <SectionCard title="Quick Actions">
              <div className="d-grid gap-2">
                <button className="btn" style={btnPrimary} onClick={handleGetActiveZerodhaSymbols} disabled={loading}>View Active Symbols</button>
                <button className="btn" style={btnSecondary} onClick={handleRefreshZerodhaSymbols} disabled={loading}>Refresh Symbol List</button>
                <button className="btn" style={btnSecondary} onClick={handleInitializeDefaults} disabled={loading}>Initialize Defaults</button>
                <button className="btn" style={btnDanger} onClick={handleFetchZerodhaGapData} disabled={loading}>Fill Data Gaps</button>
              </div>
            </SectionCard>
          </div>
          <div className="col-lg-8">
            <SectionCard title="Symbol Management">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Symbol</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" className="form-control" style={inputStyle} placeholder="e.g., INFY, SBIN"
                      value={zerodhaSymbol} onChange={(e) => handleZerodhaSymbolChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowZerodhaDropdown(false), 200)}
                      onFocus={() => zerodhaSymbol && setShowZerodhaDropdown(filteredZerodhaSymbols.length > 0)}
                    />
                    <DropdownList items={filteredZerodhaSymbols} show={showZerodhaDropdown}
                      onSelect={(s) => { setZerodhaSymbol(s); setShowZerodhaDropdown(false); }} />
                  </div>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Priority</label>
                  <input type="number" className="form-control" style={inputStyle} value={zerodhaPriority}
                    onChange={(e) => setZerodhaPriority(e.target.value)} min="1" max="10" />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" style={inputStyle} value={zerodhaState} onChange={(e) => setZerodhaState(e.target.value)}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button className="btn flex-fill" style={btnPrimary} onClick={handleActivateZerodhaSymbol} disabled={loading}>Update Status</button>
                <button className="btn flex-fill" style={btnSecondary} onClick={handleUpdateZerodhaMarketData} disabled={loading}>Update Market Data</button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Response Monitor */}
      <SectionCard title="API Response">
        {loading && (
          <div className="text-center" style={{ padding: '24px 0' }}>
            <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p style={{ color: '#7a8ea0', marginTop: '8px', fontSize: '13px' }}>Processing...</p>
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', borderRadius: '4px', padding: '12px' }}>
            <p style={{ color: '#f6465d', marginBottom: 0, fontSize: '13px' }}>Error: {error}</p>
          </div>
        )}
        {response && (
          <div>
            <div className="d-flex gap-2 mb-3 flex-wrap">
              <span className="badge" style={{
                backgroundColor: response.status === 200 ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                color: response.status === 200 ? '#0ecb81' : '#f6465d'
              }}>
                {response.status}
              </span>
              <span className="badge" style={{ backgroundColor: '#2a3a4e', color: '#7a8ea0' }}>{response.endpoint}</span>
              <span className="badge" style={{ backgroundColor: '#2a3a4e', color: '#546a7e' }}>{response.timestamp}</span>
            </div>
            <pre style={{
              backgroundColor: '#152232',
              color: '#7a8ea0',
              border: '1px solid #2a3a4e',
              borderRadius: '4px',
              padding: '12px',
              maxHeight: '300px',
              overflow: 'auto',
              fontSize: '12px',
              marginBottom: 0
            }}>
              {JSON.stringify(response.data, null, 2)}
            </pre>
          </div>
        )}
        {!loading && !error && !response && (
          <p style={{ color: '#546a7e', fontSize: '13px', textAlign: 'center', padding: '24px 0', marginBottom: 0 }}>
            Click an action above to see API responses
          </p>
        )}
      </SectionCard>
    </div>
  );
};

export default MarketDataAdmin;
