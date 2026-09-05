import React, { useState, useEffect } from 'react';

const BacktestHistory = ({ onViewResults, onCompare }) => {
  const [backtests, setBacktests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: '', symbol: '', strategy: '' });
  const [selectedJobs, setSelectedJobs] = useState([]);

  useEffect(() => { fetchHistory(); }, [filters]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.strategy) params.append('strategy', filters.strategy);
      const response = await fetch(`/api/backtest/history?${params.toString()}`);
      const data = await response.json();
      if (data.success) setBacktests(data.data);
      else setError(data.error);
    } catch (err) {
      setError('Error fetching history: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectJob = (jobId) => {
    setSelectedJobs(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Delete this backtest?')) return;
    try {
      const response = await fetch(`/api/backtest/${jobId}/delete`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) fetchHistory();
      else alert('Error: ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const getStatusStyle = (status) => {
    const map = {
      submitted: { bg: 'rgba(91,141,238,0.15)', color: '#5b8dee' },
      running: { bg: 'rgba(240,185,11,0.15)', color: '#f0b90b' },
      completed: { bg: 'rgba(14,203,129,0.15)', color: '#0ecb81' },
      failed: { bg: 'rgba(246,70,93,0.15)', color: '#f6465d' }
    };
    return map[status] || { bg: '#2a3a4e', color: '#7a8ea0' };
  };

  const inputStyle = {
    backgroundColor: '#152232',
    border: '1px solid #2a3a4e',
    color: '#e0e6ed',
    borderRadius: '4px',
    fontSize: '13px'
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '48px 0' }}>
        <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ color: '#7a8ea0', marginTop: '12px', fontSize: '13px' }}>Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', borderRadius: '6px', padding: '16px', margin: '24px 0' }}>
        <p style={{ color: '#f6465d', fontWeight: 500, marginBottom: '8px', fontSize: '13px' }}>Error: {error}</p>
        <button className="btn btn-sm" style={{ backgroundColor: '#2a3a4e', color: '#e0e6ed', border: 'none' }} onClick={fetchHistory}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 style={{ color: '#e0e6ed', fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>Backtest History</h3>
          <span style={{ color: '#7a8ea0', fontSize: '12px' }}>{backtests.length} backtest(s)</span>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm" style={{ backgroundColor: '#f0a500', color: '#0f1923', border: 'none', fontSize: '12px' }}
            onClick={fetchHistory} disabled={loading}>Refresh</button>
          {selectedJobs.length > 1 && (
            <button className="btn btn-sm" style={{ backgroundColor: '#5b8dee', color: '#fff', border: 'none', fontSize: '12px' }}
              onClick={() => onCompare(selectedJobs)}>Compare ({selectedJobs.length})</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
        <div className="row">
          <div className="col-md-4">
            <label className="form-label">Status</label>
            <select className="form-select" style={inputStyle} name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="submitted">Submitted</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Symbol</label>
            <input type="text" className="form-control" style={inputStyle} name="symbol" value={filters.symbol}
              onChange={handleFilterChange} placeholder="e.g., BTCUSDT" />
          </div>
          <div className="col-md-4">
            <label className="form-label">Strategy</label>
            <select className="form-select" style={inputStyle} name="strategy" value={filters.strategy} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="rsi">RSI</option>
              <option value="macd">MACD</option>
              <option value="bollinger">Bollinger Bands</option>
              <option value="grid">Grid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {backtests.length === 0 ? (
        <p style={{ color: '#7a8ea0', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
          No backtests found. Create a new backtest to get started.
        </p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>
                  <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedJobs(backtests.filter(b => b.status === 'completed').map(b => b.job_id));
                    else setSelectedJobs([]);
                  }} />
                </th>
                <th>Name</th>
                <th>Strategy</th>
                <th>Symbol</th>
                <th>Timeframe</th>
                <th>Period</th>
                <th>Status</th>
                <th className="text-end">Return</th>
                <th className="text-end">Sharpe</th>
                <th className="text-end">Trades</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backtests.map(bt => {
                const ss = getStatusStyle(bt.status);
                return (
                  <tr key={bt.job_id}>
                    <td>
                      <input type="checkbox" checked={selectedJobs.includes(bt.job_id)}
                        onChange={() => handleSelectJob(bt.job_id)} disabled={bt.status !== 'completed'} />
                    </td>
                    <td>
                      <span style={{ color: '#e0e6ed', fontWeight: 500 }}>{bt.name || `Backtest ${bt.job_id.substring(0, 8)}`}</span>
                      {bt.notes && <small style={{ display: 'block', color: '#546a7e', fontSize: '11px' }}>{bt.notes.substring(0, 50)}...</small>}
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: '#2a3a4e', color: '#7a8ea0' }}>{bt.strategy.toUpperCase()}</span>
                    </td>
                    <td style={{ color: '#e0e6ed' }}>{bt.symbol}</td>
                    <td style={{ color: '#7a8ea0' }}>{bt.timeframe}</td>
                    <td>
                      <small style={{ color: '#7a8ea0', fontSize: '11px' }}>
                        {new Date(bt.start_date).toLocaleDateString()} –<br />
                        {new Date(bt.end_date).toLocaleDateString()}
                      </small>
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: ss.bg, color: ss.color }}>{bt.status.toUpperCase()}</span>
                    </td>
                    <td className="text-end" style={{ color: bt.total_return >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 500 }}>
                      {bt.total_return !== null ? `${parseFloat(bt.total_return).toFixed(2)}%` : '–'}
                    </td>
                    <td className="text-end" style={{ color: '#e0e6ed' }}>
                      {bt.sharpe_ratio !== null ? parseFloat(bt.sharpe_ratio).toFixed(2) : '–'}
                    </td>
                    <td className="text-end" style={{ color: '#7a8ea0' }}>{bt.total_trades || '–'}</td>
                    <td><small style={{ color: '#546a7e', fontSize: '11px' }}>{new Date(bt.created_at).toLocaleString()}</small></td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm" style={{ backgroundColor: '#f0a500', color: '#0f1923', border: 'none', fontSize: '11px' }}
                          onClick={() => onViewResults(bt.job_id)} disabled={bt.status !== 'completed'}>View</button>
                        <button className="btn btn-sm" style={{ backgroundColor: 'rgba(246,70,93,0.12)', color: '#f6465d', border: '1px solid rgba(246,70,93,0.25)', fontSize: '11px' }}
                          onClick={() => handleDeleteJob(bt.job_id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BacktestHistory;
