import React, { useState, useEffect } from 'react';

const BacktestHistory = ({ onViewResults, onCompare }) => {
  const [backtests, setBacktests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    symbol: '',
    strategy: ''
  });
  const [selectedJobs, setSelectedJobs] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, [filters]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.strategy) params.append('strategy', filters.strategy);

      const response = await fetch(`/home/api/backtest/history?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setBacktests(data.data);
      } else {
        setError(data.error);
      }
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
    setSelectedJobs(prev => {
      if (prev.includes(jobId)) {
        return prev.filter(id => id !== jobId);
      } else {
        return [...prev, jobId];
      }
    });
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this backtest?')) {
      return;
    }

    try {
      const response = await fetch(`/home/api/backtest/${jobId}/delete`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        // Refresh list
        fetchHistory();
      } else {
        alert('Error deleting backtest: ' + data.error);
      }
    } catch (err) {
      alert('Error deleting backtest: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'submitted': 'bg-info',
      'running': 'bg-warning',
      'completed': 'bg-success',
      'failed': 'bg-danger'
    };
    return badges[status] || 'bg-secondary';
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading backtest history...</p>
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
          <button className="btn btn-danger" onClick={fetchHistory}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="row mb-3">
        <div className="col-md-8">
          <h2>Backtest History</h2>
          <p className="text-muted">{backtests.length} backtest(s) found</p>
        </div>
        <div className="col-md-4 text-end">
          <button
            className="btn btn-primary"
            onClick={fetchHistory}
            disabled={loading}
          >
            Refresh
          </button>
          {selectedJobs.length > 1 && (
            <button
              className="btn btn-info ms-2"
              onClick={() => onCompare(selectedJobs)}
            >
              Compare ({selectedJobs.length})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Symbol</label>
              <input
                type="text"
                className="form-control"
                name="symbol"
                value={filters.symbol}
                onChange={handleFilterChange}
                placeholder="e.g., BTCUSDT"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Strategy</label>
              <select
                className="form-select"
                name="strategy"
                value={filters.strategy}
                onChange={handleFilterChange}
              >
                <option value="">All Strategies</option>
                <option value="rsi">RSI</option>
                <option value="macd">MACD</option>
                <option value="bollinger">Bollinger Bands</option>
                <option value="grid">Grid</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Backtests Table */}
      {backtests.length === 0 ? (
        <div className="alert alert-info">
          No backtests found. Create a new backtest to get started!
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobs(backtests.filter(b => b.status === 'completed').map(b => b.job_id));
                      } else {
                        setSelectedJobs([]);
                      }
                    }}
                  />
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
              {backtests.map(backtest => (
                <tr key={backtest.job_id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedJobs.includes(backtest.job_id)}
                      onChange={() => handleSelectJob(backtest.job_id)}
                      disabled={backtest.status !== 'completed'}
                    />
                  </td>
                  <td>
                    <strong>{backtest.name || `Backtest ${backtest.job_id.substring(0, 8)}`}</strong>
                    {backtest.notes && (
                      <small className="d-block text-muted">{backtest.notes.substring(0, 50)}...</small>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-secondary">{backtest.strategy.toUpperCase()}</span>
                  </td>
                  <td>{backtest.symbol}</td>
                  <td>{backtest.timeframe}</td>
                  <td>
                    <small>
                      {new Date(backtest.start_date).toLocaleDateString()} - <br />
                      {new Date(backtest.end_date).toLocaleDateString()}
                    </small>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(backtest.status)}`}>
                      {backtest.status.toUpperCase()}
                    </span>
                  </td>
                  <td className={`text-end ${backtest.total_return >= 0 ? 'text-success' : 'text-danger'}`}>
                    {backtest.total_return !== null ? `${parseFloat(backtest.total_return).toFixed(2)}%` : '-'}
                  </td>
                  <td className="text-end">
                    {backtest.sharpe_ratio !== null ? parseFloat(backtest.sharpe_ratio).toFixed(2) : '-'}
                  </td>
                  <td className="text-end">
                    {backtest.total_trades || '-'}
                  </td>
                  <td>
                    <small>{new Date(backtest.created_at).toLocaleString()}</small>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary me-1"
                      onClick={() => onViewResults(backtest.job_id)}
                      disabled={backtest.status !== 'completed'}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteJob(backtest.job_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BacktestHistory;
