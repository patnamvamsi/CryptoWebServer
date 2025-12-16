import React, { useState, useEffect } from 'react';

const BacktestComparison = ({ jobIds, onBack }) => {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchComparisons();
  }, [jobIds]);

  const fetchComparisons = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch results for each job
      const promises = jobIds.map(jobId =>
        fetch(`/home/api/backtest/${jobId}/results`).then(res => res.json())
      );

      const results = await Promise.all(promises);

      const validResults = results
        .filter(r => r.success)
        .map(r => r.data);

      if (validResults.length === 0) {
        setError('No valid results to compare');
      } else {
        setComparisons(validResults);
      }
    } catch (err) {
      setError('Error fetching comparison data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading comparison data...</p>
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
          <button className="btn btn-danger" onClick={onBack}>
            Back to History
          </button>
        </div>
      </div>
    );
  }

  // Metrics to compare
  const metricRows = [
    { key: 'total_return', label: 'Total Return (%)', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'max' },
    { key: 'sharpe_ratio', label: 'Sharpe Ratio', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'max' },
    { key: 'max_drawdown', label: 'Max Drawdown (%)', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'min' },
    { key: 'win_rate', label: 'Win Rate (%)', format: (v) => v?.toFixed(1) || 'N/A', highlight: 'max' },
    { key: 'total_trades', label: 'Total Trades', format: (v) => v || 'N/A', highlight: 'none' },
    { key: 'profit_factor', label: 'Profit Factor', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'max' },
    { key: 'cagr', label: 'CAGR (%)', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'max' },
    { key: 'volatility', label: 'Volatility (%)', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'min' },
    { key: 'sortino_ratio', label: 'Sortino Ratio', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'max' },
    { key: 'calmar_ratio', label: 'Calmar Ratio', format: (v) => v?.toFixed(2) || 'N/A', highlight: 'max' }
  ];

  const getBestValue = (metricKey, highlight) => {
    if (highlight === 'none') return null;

    const values = comparisons
      .map(c => c.metrics?.[metricKey])
      .filter(v => v !== undefined && v !== null);

    if (values.length === 0) return null;

    if (highlight === 'max') return Math.max(...values);
    if (highlight === 'min') return Math.min(...values);
    return null;
  };

  const isBestValue = (value, metricKey, highlight) => {
    if (value === undefined || value === null) return false;
    const bestValue = getBestValue(metricKey, highlight);
    return bestValue !== null && value === bestValue;
  };

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="row mb-3">
        <div className="col-md-8">
          <h2>Backtest Comparison</h2>
          <p className="text-muted">Comparing {comparisons.length} backtest(s)</p>
        </div>
        <div className="col-md-4 text-end">
          <button className="btn btn-secondary" onClick={onBack}>
            Back to History
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        {comparisons.map((result, index) => (
          <div key={result.job_id} className="col-md-4 mb-3">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h6 className="mb-0">Backtest #{index + 1}</h6>
              </div>
              <div className="card-body">
                <dl className="row mb-0">
                  <dt className="col-sm-6">Strategy:</dt>
                  <dd className="col-sm-6">{result.strategy?.toUpperCase() || 'N/A'}</dd>

                  <dt className="col-sm-6">Symbol:</dt>
                  <dd className="col-sm-6">{result.symbol || 'N/A'}</dd>

                  <dt className="col-sm-6">Timeframe:</dt>
                  <dd className="col-sm-6">{result.timeframe || 'N/A'}</dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="card mb-4">
        <div className="card-header">
          <h5>Performance Metrics Comparison</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-dark">
                <tr>
                  <th>Metric</th>
                  {comparisons.map((result, index) => (
                    <th key={result.job_id} className="text-center">
                      Backtest #{index + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map(row => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong></td>
                    {comparisons.map(result => {
                      const value = result.metrics?.[row.key];
                      const isBest = isBestValue(value, row.key, row.highlight);

                      return (
                        <td
                          key={result.job_id}
                          className={`text-center ${isBest ? 'table-success fw-bold' : ''}`}
                        >
                          {row.format(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-2">
            <small>Green cells indicate the best value for each metric</small>
          </p>
        </div>
      </div>

      {/* Parameters Comparison */}
      <div className="card mb-4">
        <div className="card-header">
          <h5>Strategy Parameters</h5>
        </div>
        <div className="card-body">
          <div className="row">
            {comparisons.map((result, index) => (
              <div key={result.job_id} className="col-md-4 mb-3">
                <h6>Backtest #{index + 1}</h6>
                <pre className="bg-light p-3 rounded">
                  {JSON.stringify(result.parameters || {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BacktestComparison;
