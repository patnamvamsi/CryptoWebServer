import React, { useState, useEffect } from 'react';

const BacktestForm = ({ onSubmitSuccess }) => {
  const [formData, setFormData] = useState({
    strategy: 'rsi',
    symbol: '',
    exchange: 'binance',
    start_date: '',
    end_date: '',
    timeframe: '15m',
    initial_capital: 10000,
    commission: 0.1,
    name: '',
    notes: ''
  });

  const dataAvailability = {
    binance: {
      minDate: '2024-01-01',
      defaultStart: '2024-11-01',
      defaultEnd: new Date().toISOString().slice(0, 16),
      note: 'Historical data available from 2024 onwards'
    },
    zerodha: {
      minDate: '2025-12-01',
      defaultStart: '2025-12-01T09:15',
      defaultEnd: '2025-12-30T15:30',
      note: 'Limited data: December 2025 only (Market hours: 9:15 AM - 3:30 PM IST)'
    }
  };

  const [parameters, setParameters] = useState({
    rsi_period: 14,
    oversold: 30,
    overbought: 70
  });

  const [allSymbols, setAllSymbols] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [availableExchanges, setAvailableExchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [symbolsLoading, setSymbolsLoading] = useState(true);

  useEffect(() => { fetchSymbols(); }, []);

  useEffect(() => {
    if (allSymbols.length > 0) {
      const filtered = allSymbols.filter(s => s.exchange.toLowerCase() === formData.exchange.toLowerCase());
      setSymbols(filtered);
      if (filtered.length > 0 && (!formData.symbol || !filtered.find(s => s.symbol === formData.symbol))) {
        setFormData(prev => ({ ...prev, symbol: filtered[0].symbol }));
      }
      const availability = dataAvailability[formData.exchange.toLowerCase()];
      if (availability && (!formData.start_date || !formData.end_date)) {
        setFormData(prev => ({ ...prev, start_date: availability.defaultStart, end_date: availability.defaultEnd }));
      }
    }
  }, [formData.exchange, allSymbols]);

  const fetchSymbols = async () => {
    try {
      setSymbolsLoading(true);
      const response = await fetch('/api/backtest/symbols');
      const data = await response.json();
      if (data.success) {
        setAllSymbols(data.data);
        const exchanges = [...new Set(data.data.map(s => s.exchange))];
        setAvailableExchanges(exchanges);
        const defaultExchange = exchanges.includes('binance') ? 'binance' : exchanges[0];
        const filtered = data.data.filter(s => s.exchange.toLowerCase() === defaultExchange.toLowerCase());
        setSymbols(filtered);
        if (filtered.length > 0) {
          setFormData(prev => ({ ...prev, exchange: defaultExchange, symbol: filtered[0].symbol }));
        }
      } else {
        setError('Failed to load symbols');
      }
    } catch (err) {
      setError('Error loading symbols: ' + err.message);
    } finally {
      setSymbolsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'exchange') {
      const availability = dataAvailability[value.toLowerCase()];
      if (availability) {
        setFormData(prev => ({ ...prev, [name]: value, start_date: availability.defaultStart, end_date: availability.defaultEnd }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setRecommendedDates = () => {
    const availability = dataAvailability[formData.exchange.toLowerCase()];
    if (availability) {
      setFormData(prev => ({ ...prev, start_date: availability.defaultStart, end_date: availability.defaultEnd }));
    }
  };

  const handleParameterChange = (e) => {
    const { name, value } = e.target;
    setParameters(prev => ({ ...prev, [name]: parseFloat(value) || value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (new Date(formData.start_date) >= new Date(formData.end_date)) {
        throw new Error('End date must be after start date');
      }
      const request = { ...formData, commission: formData.commission / 100, parameters };
      const response = await fetch('/api/backtest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      const data = await response.json();
      if (data.success) {
        setFormData({ ...formData, name: '', notes: '' });
        if (onSubmitSuccess) onSubmitSuccess(data.data);
      } else {
        setError(data.error || 'Failed to submit backtest');
      }
    } catch (err) {
      setError('Error submitting backtest: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#152232',
    border: '1px solid #2a3a4e',
    color: '#e0e6ed',
    borderRadius: '4px',
    fontSize: '13px',
    colorScheme: 'dark'
  };

  const renderParameterFields = () => {
    switch (formData.strategy) {
      case 'rsi':
        return (
          <>
            <div className="col-md-4">
              <label className="form-label">RSI Period</label>
              <input type="number" className="form-control" style={inputStyle} name="rsi_period"
                value={parameters.rsi_period} onChange={handleParameterChange} min="2" max="100" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Oversold Level</label>
              <input type="number" className="form-control" style={inputStyle} name="oversold"
                value={parameters.oversold} onChange={handleParameterChange} min="0" max="100" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Overbought Level</label>
              <input type="number" className="form-control" style={inputStyle} name="overbought"
                value={parameters.overbought} onChange={handleParameterChange} min="0" max="100" />
            </div>
          </>
        );
      default:
        return <p style={{ color: '#7a8ea0', fontSize: '13px' }}>No parameters configured for this strategy</p>;
    }
  };

  return (
    <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '12px 16px' }}>
        <h5 style={{ color: '#e0e6ed', fontSize: '14px', fontWeight: 600, marginBottom: 0 }}>New Backtest</h5>
      </div>
      <div style={{ padding: '20px' }}>
        {error && (
          <div style={{ backgroundColor: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', borderRadius: '4px', padding: '10px 14px', marginBottom: '16px' }}>
            <p style={{ color: '#f6465d', marginBottom: 0, fontSize: '13px' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Strategy, Exchange, Symbol */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Strategy</label>
              <select className="form-select" style={inputStyle} name="strategy" value={formData.strategy} onChange={handleInputChange} required>
                <option value="rsi">RSI Strategy</option>
                <option value="macd">MACD Strategy</option>
                <option value="bollinger">Bollinger Bands</option>
                <option value="grid">Grid Trading</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Exchange</label>
              <select className="form-select" style={inputStyle} name="exchange" value={formData.exchange}
                onChange={handleInputChange} required disabled={symbolsLoading}>
                {symbolsLoading ? <option>Loading...</option> : availableExchanges.length === 0 ? <option>None available</option> :
                  availableExchanges.map(ex => <option key={ex} value={ex}>{ex.toUpperCase()}</option>)}
              </select>
              <small style={{ color: '#546a7e', fontSize: '11px' }}>Symbols update per exchange</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Symbol ({symbols.length})</label>
              <select className="form-select" style={inputStyle} name="symbol" value={formData.symbol}
                onChange={handleInputChange} required disabled={symbolsLoading || symbols.length === 0}>
                {symbolsLoading ? <option>Loading...</option> : symbols.length === 0 ? <option>No symbols</option> :
                  symbols.map(sym => <option key={`${sym.exchange}-${sym.symbol}`} value={sym.symbol}>{sym.symbol}</option>)}
              </select>
            </div>
          </div>

          {/* Data Availability */}
          {dataAvailability[formData.exchange.toLowerCase()] && (
            <div style={{
              backgroundColor: 'rgba(91,141,238,0.08)',
              border: '1px solid rgba(91,141,238,0.2)',
              borderRadius: '4px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <small style={{ color: '#7a8ea0', fontSize: '12px' }}>
                <strong style={{ color: '#e0e6ed' }}>Data:</strong> {dataAvailability[formData.exchange.toLowerCase()].note}
              </small>
              <button type="button" className="btn btn-sm" style={{
                backgroundColor: '#f0a500', color: '#0f1923', border: 'none', fontSize: '11px', fontWeight: 500
              }} onClick={setRecommendedDates}>
                Recommended Dates
              </button>
            </div>
          )}

          {/* Date Range */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Start Date</label>
              <input type="datetime-local" className="form-control" style={inputStyle} name="start_date"
                value={formData.start_date} onChange={handleInputChange}
                min={dataAvailability[formData.exchange.toLowerCase()]?.minDate} required />
              <small style={{ color: '#546a7e', fontSize: '11px' }}>
                From: {dataAvailability[formData.exchange.toLowerCase()]?.minDate || 'N/A'}
              </small>
            </div>
            <div className="col-md-4">
              <label className="form-label">End Date</label>
              <input type="datetime-local" className="form-control" style={inputStyle} name="end_date"
                value={formData.end_date} onChange={handleInputChange} min={formData.start_date} required />
            </div>
            <div className="col-md-4">
              <label className="form-label">Timeframe</label>
              <select className="form-select" style={inputStyle} name="timeframe" value={formData.timeframe} onChange={handleInputChange} required>
                <option value="1m">1 Min</option>
                <option value="5m">5 Min</option>
                <option value="15m">15 Min</option>
                <option value="30m">30 Min</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>
          </div>

          {/* Capital & Commission */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Initial Capital</label>
              <input type="number" className="form-control" style={inputStyle} name="initial_capital"
                value={formData.initial_capital} onChange={handleInputChange} min="100" step="100" required />
            </div>
            <div className="col-md-6">
              <label className="form-label">Commission (%)</label>
              <input type="number" className="form-control" style={inputStyle} name="commission"
                value={formData.commission} onChange={handleInputChange} min="0" max="10" step="0.01" required />
            </div>
          </div>

          {/* Strategy Parameters */}
          <div style={{ backgroundColor: '#1e2d3d', border: '1px solid #2a3a4e', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
            <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Strategy Parameters</h6>
            <div className="row">
              {renderParameterFields()}
            </div>
          </div>

          {/* Name & Notes */}
          <div className="mb-3">
            <label className="form-label">Name (Optional)</label>
            <input type="text" className="form-control" style={inputStyle} name="name"
              value={formData.name} onChange={handleInputChange} placeholder="e.g., BTC RSI Test" />
          </div>
          <div className="mb-3">
            <label className="form-label">Notes (Optional)</label>
            <textarea className="form-control" style={inputStyle} name="notes"
              value={formData.notes} onChange={handleInputChange} rows="3" placeholder="Add notes..." />
          </div>

          {/* Submit */}
          <div className="text-end">
            <button type="submit" className="btn" style={{
              backgroundColor: '#f0a500', color: '#0f1923', border: 'none', fontWeight: 500, padding: '10px 28px', fontSize: '13px'
            }} disabled={loading || symbolsLoading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Submitting...</>
              ) : 'Run Backtest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BacktestForm;
