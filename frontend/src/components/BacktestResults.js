import React, { useState, useEffect } from 'react';

const BacktestResults = ({ jobId, onBack }) => {
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch status immediately
    fetchStatus();

    // Poll status every 3 seconds if not completed
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/home/api/backtest/${jobId}/status`);
      const data = await response.json();

      if (data.success) {
        setStatus(data.data.status);

        if (data.data.status === 'completed') {
          // Fetch full results
          fetchResults();
        } else if (data.data.status === 'failed') {
          setError(data.data.message || 'Backtest failed');
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error fetching status: ' + err.message);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch(`/home/api/backtest/${jobId}/results`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error fetching results: ' + err.message);
    }
  };

  // Loading state
  if (status === 'submitted' || status === 'running') {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4>Backtest {status === 'submitted' ? 'Submitted' : 'Running'}...</h4>
          <p className="text-muted">Job ID: {jobId}</p>
          <p>This may take a few minutes depending on the date range.</p>
          <button className="btn btn-secondary mt-3" onClick={onBack}>
            Back to History
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Error!</h4>
          <p>{error}</p>
          <hr />
          <button className="btn btn-danger" onClick={onBack}>
            Back to History
          </button>
        </div>
      </div>
    );
  }

  // No results yet
  if (!results) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading results...</p>
        </div>
      </div>
    );
  }

  // Display results
  const { metrics = {}, trades = [], parameters = {} } = results;

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="row mb-3">
        <div className="col-md-8">
          <h2>Backtest Results</h2>
        </div>
        <div className="col-md-4 text-end">
          <button className="btn btn-secondary" onClick={onBack}>
            Back to History
          </button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="text-muted">Total Return</h6>
              <h3 className={metrics.total_return >= 0 ? 'text-success' : 'text-danger'}>
                {metrics.total_return?.toFixed(2) || 0}%
              </h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="text-muted">Sharpe Ratio</h6>
              <h3>{metrics.sharpe_ratio?.toFixed(2) || 'N/A'}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="text-muted">Max Drawdown</h6>
              <h3 className="text-danger">{metrics.max_drawdown?.toFixed(2) || 0}%</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="text-muted">Win Rate</h6>
              <h3>{metrics.win_rate?.toFixed(1) || 0}%</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="card mb-4">
        <div className="card-header">
          <h5>Detailed Metrics</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <dl className="row">
                <dt className="col-sm-8">Total Trades:</dt>
                <dd className="col-sm-4">{metrics.total_trades || 0}</dd>

                <dt className="col-sm-8">Profit Factor:</dt>
                <dd className="col-sm-4">{metrics.profit_factor?.toFixed(2) || 'N/A'}</dd>

                <dt className="col-sm-8">CAGR:</dt>
                <dd className="col-sm-4">{metrics.cagr?.toFixed(2) || 'N/A'}%</dd>
              </dl>
            </div>

            <div className="col-md-4">
              <dl className="row">
                <dt className="col-sm-8">Avg Win:</dt>
                <dd className="col-sm-4 text-success">${metrics.avg_win?.toFixed(2) || 0}</dd>

                <dt className="col-sm-8">Avg Loss:</dt>
                <dd className="col-sm-4 text-danger">${metrics.avg_loss?.toFixed(2) || 0}</dd>

                <dt className="col-sm-8">Volatility:</dt>
                <dd className="col-sm-4">{metrics.volatility?.toFixed(2) || 'N/A'}%</dd>
              </dl>
            </div>

            <div className="col-md-4">
              <dl className="row">
                <dt className="col-sm-8">Sortino Ratio:</dt>
                <dd className="col-sm-4">{metrics.sortino_ratio?.toFixed(2) || 'N/A'}</dd>

                <dt className="col-sm-8">Calmar Ratio:</dt>
                <dd className="col-sm-4">{metrics.calmar_ratio?.toFixed(2) || 'N/A'}</dd>

                <dt className="col-sm-8">VaR (95%):</dt>
                <dd className="col-sm-4">{metrics.var_95?.toFixed(2) || 'N/A'}%</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Parameters */}
      <div className="card mb-4">
        <div className="card-header">
          <h5>Strategy Parameters</h5>
        </div>
        <div className="card-body">
          <pre className="bg-light p-3 rounded">
            {JSON.stringify(parameters, null, 2)}
          </pre>
        </div>
      </div>

      {/* Trades Table */}
      {trades && trades.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5>Trade History ({trades.length} trades)</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th className="text-end">P&L</th>
                    <th className="text-end">Net P&L</th>
                    <th className="text-end">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 50).map((trade, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{trade.date ? new Date(trade.date).toLocaleString() : 'N/A'}</td>
                      <td className={`text-end ${trade.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                        ${trade.profit?.toFixed(2) || 0}
                      </td>
                      <td className={`text-end ${trade.profit_net >= 0 ? 'text-success' : 'text-danger'}`}>
                        ${trade.profit_net?.toFixed(2) || 0}
                      </td>
                      <td className="text-end">${trade.commission?.toFixed(2) || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trades.length > 50 && (
                <p className="text-muted text-center">Showing first 50 of {trades.length} trades</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestResults;
