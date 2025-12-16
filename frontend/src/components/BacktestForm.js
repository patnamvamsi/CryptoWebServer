import React, { useState, useEffect } from 'react';

const BacktestForm = ({ onSubmitSuccess }) => {
  // State for form fields
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

  // Strategy-specific parameters
  const [parameters, setParameters] = useState({
    rsi_period: 14,
    oversold: 30,
    overbought: 70
  });

  // UI state
  const [allSymbols, setAllSymbols] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [availableExchanges, setAvailableExchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [symbolsLoading, setSymbolsLoading] = useState(true);

  // Fetch symbols on mount
  useEffect(() => {
    fetchSymbols();
  }, []);

  // Filter symbols when exchange changes
  useEffect(() => {
    if (allSymbols.length > 0) {
      const filtered = allSymbols.filter(s => s.exchange.toLowerCase() === formData.exchange.toLowerCase());
      setSymbols(filtered);
      // Set first filtered symbol as default
      if (filtered.length > 0 && (!formData.symbol || !filtered.find(s => s.symbol === formData.symbol))) {
        setFormData(prev => ({ ...prev, symbol: filtered[0].symbol }));
      }
    }
  }, [formData.exchange, allSymbols]);

  const fetchSymbols = async () => {
    try {
      setSymbolsLoading(true);
      const response = await fetch('/home/api/backtest/symbols');
      const data = await response.json();

      if (data.success) {
        setAllSymbols(data.data);

        // Extract unique exchanges
        const exchanges = [...new Set(data.data.map(s => s.exchange))];
        setAvailableExchanges(exchanges);

        // Set default exchange if not already set
        const defaultExchange = exchanges.includes('binance') ? 'binance' : exchanges[0];

        // Filter for initial exchange
        const filtered = data.data.filter(s => s.exchange.toLowerCase() === defaultExchange.toLowerCase());
        setSymbols(filtered);

        // Set first symbol as default
        if (filtered.length > 0) {
          setFormData(prev => ({
            ...prev,
            exchange: defaultExchange,
            symbol: filtered[0].symbol
          }));
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
    setFormData(prev => ({ ...prev, [name]: value }));
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
      // Validate dates
      if (new Date(formData.start_date) >= new Date(formData.end_date)) {
        throw new Error('End date must be after start date');
      }

      // Prepare request
      const request = {
        ...formData,
        commission: formData.commission / 100, // Convert percentage to decimal
        parameters: parameters
      };

      const response = await fetch('/home/api/backtest/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (data.success) {
        // Reset form
        setFormData({
          ...formData,
          name: '',
          notes: ''
        });

        // Callback to parent
        if (onSubmitSuccess) {
          onSubmitSuccess(data.data);
        }
      } else {
        setError(data.error || 'Failed to submit backtest');
      }
    } catch (err) {
      setError('Error submitting backtest: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render parameter fields based on strategy
  const renderParameterFields = () => {
    switch (formData.strategy) {
      case 'rsi':
        return (
          <>
            <div className="col-md-4">
              <label className="form-label">RSI Period</label>
              <input
                type="number"
                className="form-control"
                name="rsi_period"
                value={parameters.rsi_period}
                onChange={handleParameterChange}
                min="2"
                max="100"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Oversold Level</label>
              <input
                type="number"
                className="form-control"
                name="oversold"
                value={parameters.oversold}
                onChange={handleParameterChange}
                min="0"
                max="100"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Overbought Level</label>
              <input
                type="number"
                className="form-control"
                name="overbought"
                value={parameters.overbought}
                onChange={handleParameterChange}
                min="0"
                max="100"
              />
            </div>
          </>
        );
      default:
        return <p className="text-muted">No parameters configured for this strategy</p>;
    }
  };

  return (
    <div className="card">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">New Backtest</h5>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Strategy and Exchange Selection */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Strategy</label>
              <select
                className="form-select"
                name="strategy"
                value={formData.strategy}
                onChange={handleInputChange}
                required
              >
                <option value="rsi">RSI Strategy</option>
                <option value="macd">MACD Strategy</option>
                <option value="bollinger">Bollinger Bands</option>
                <option value="grid">Grid Trading</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Exchange</label>
              <select
                className="form-select"
                name="exchange"
                value={formData.exchange}
                onChange={handleInputChange}
                required
                disabled={symbolsLoading}
              >
                {symbolsLoading ? (
                  <option>Loading exchanges...</option>
                ) : availableExchanges.length === 0 ? (
                  <option>No exchanges available</option>
                ) : (
                  availableExchanges.map(ex => (
                    <option key={ex} value={ex}>
                      {ex.toUpperCase()}
                    </option>
                  ))
                )}
              </select>
              <small className="text-muted">Symbols will update based on exchange</small>
            </div>

            <div className="col-md-4">
              <label className="form-label">Symbol ({symbols.length} available)</label>
              <select
                className="form-select"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                required
                disabled={symbolsLoading || symbols.length === 0}
              >
                {symbolsLoading ? (
                  <option>Loading symbols...</option>
                ) : symbols.length === 0 ? (
                  <option>No symbols for {formData.exchange}</option>
                ) : (
                  symbols.map(sym => (
                    <option key={`${sym.exchange}-${sym.symbol}`} value={sym.symbol}>
                      {sym.symbol}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Date Range */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Start Date</label>
              <input
                type="datetime-local"
                className="form-control"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">End Date</label>
              <input
                type="datetime-local"
                className="form-control"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Timeframe</label>
              <select
                className="form-select"
                name="timeframe"
                value={formData.timeframe}
                onChange={handleInputChange}
                required
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>
          </div>

          {/* Capital and Commission */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Initial Capital</label>
              <input
                type="number"
                className="form-control"
                name="initial_capital"
                value={formData.initial_capital}
                onChange={handleInputChange}
                min="100"
                step="100"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Commission Rate (%)</label>
              <input
                type="number"
                className="form-control"
                name="commission"
                value={formData.commission}
                onChange={handleInputChange}
                min="0"
                max="10"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* Strategy Parameters */}
          <div className="card mb-3">
            <div className="card-header bg-light">
              <h6 className="mb-0">Strategy Parameters</h6>
            </div>
            <div className="card-body">
              <div className="row">
                {renderParameterFields()}
              </div>
            </div>
          </div>

          {/* Optional: Name and Notes */}
          <div className="row mb-3">
            <div className="col-md-12">
              <label className="form-label">Backtest Name (Optional)</label>
              <input
                type="text"
                className="form-control"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., BTC RSI Strategy Test - Jan 2023"
              />
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-12">
              <label className="form-label">Notes (Optional)</label>
              <textarea
                className="form-control"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                placeholder="Add notes about this backtest..."
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-end">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || symbolsLoading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Submitting...
                </>
              ) : (
                'Run Backtest'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BacktestForm;
