import React, { useState, useEffect } from 'react';

const BacktestComparison = ({ jobIds, onBack }) => {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchComparisons(); }, [jobIds]);

  const fetchComparisons = async () => {
    try {
      setLoading(true);
      setError(null);
      const promises = jobIds.map(jobId => fetch(`/api/backtest/${jobId}/results`).then(res => res.json()));
      const results = await Promise.all(promises);
      const valid = results.filter(r => r.success).map(r => r.data);
      if (valid.length === 0) setError('No valid results to compare');
      else setComparisons(valid);
    } catch (err) {
      setError('Error fetching comparison data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '48px 0' }}>
        <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ color: '#7a8ea0', marginTop: '12px', fontSize: '13px' }}>Loading comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', borderRadius: '6px', padding: '16px', margin: '24px 0' }}>
        <p style={{ color: '#f6465d', fontWeight: 500, marginBottom: '8px', fontSize: '13px' }}>Error: {error}</p>
        <button className="btn btn-sm" style={{ backgroundColor: '#2a3a4e', color: '#e0e6ed', border: 'none' }} onClick={onBack}>Back</button>
      </div>
    );
  }

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
    const values = comparisons.map(c => c.metrics?.[metricKey]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return null;
    return highlight === 'max' ? Math.max(...values) : Math.min(...values);
  };

  const isBestValue = (value, metricKey, highlight) => {
    if (value === undefined || value === null) return false;
    const best = getBestValue(metricKey, highlight);
    return best !== null && value === best;
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 style={{ color: '#e0e6ed', fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>Backtest Comparison</h3>
          <span style={{ color: '#7a8ea0', fontSize: '12px' }}>Comparing {comparisons.length} backtest(s)</span>
        </div>
        <button className="btn btn-sm" style={{ backgroundColor: '#2a3a4e', color: '#e0e6ed', border: 'none', fontSize: '12px' }} onClick={onBack}>
          Back to History
        </button>
      </div>

      {/* Summary Cards */}
      <div className="row mb-3">
        {comparisons.map((result, index) => (
          <div key={result.job_id} className="col-md-4 mb-3">
            <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
                <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Backtest #{index + 1}</h6>
              </div>
              <div style={{ padding: '12px 16px', fontSize: '12px' }}>
                <dl className="row mb-0">
                  <dt className="col-sm-6" style={{ color: '#7a8ea0', fontWeight: 400 }}>Strategy</dt>
                  <dd className="col-sm-6" style={{ color: '#e0e6ed' }}>{result.strategy?.toUpperCase() || 'N/A'}</dd>
                  <dt className="col-sm-6" style={{ color: '#7a8ea0', fontWeight: 400 }}>Symbol</dt>
                  <dd className="col-sm-6" style={{ color: '#e0e6ed' }}>{result.symbol || 'N/A'}</dd>
                  <dt className="col-sm-6" style={{ color: '#7a8ea0', fontWeight: 400 }}>Timeframe</dt>
                  <dd className="col-sm-6" style={{ color: '#e0e6ed' }}>{result.timeframe || 'N/A'}</dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
          <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Performance Metrics</h6>
        </div>
        <div className="table-responsive">
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Metric</th>
                {comparisons.map((result, i) => (
                  <th key={result.job_id} className="text-center">#{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map(row => (
                <tr key={row.key}>
                  <td style={{ color: '#e0e6ed', fontWeight: 500 }}>{row.label}</td>
                  {comparisons.map(result => {
                    const value = result.metrics?.[row.key];
                    const best = isBestValue(value, row.key, row.highlight);
                    return (
                      <td key={result.job_id} className="text-center" style={{
                        color: best ? '#0ecb81' : '#e0e6ed',
                        fontWeight: best ? 600 : 400,
                        backgroundColor: best ? 'rgba(14,203,129,0.06)' : 'transparent'
                      }}>
                        {row.format(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid #2a3a4e' }}>
          <small style={{ color: '#546a7e', fontSize: '11px' }}>Green = best value per metric</small>
        </div>
      </div>

      {/* Parameters */}
      <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
          <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Strategy Parameters</h6>
        </div>
        <div style={{ padding: '16px' }}>
          <div className="row">
            {comparisons.map((result, index) => (
              <div key={result.job_id} className="col-md-4 mb-3">
                <h6 style={{ color: '#7a8ea0', fontSize: '12px', marginBottom: '8px' }}>Backtest #{index + 1}</h6>
                <pre style={{
                  backgroundColor: '#152232', color: '#7a8ea0', padding: '12px',
                  borderRadius: '4px', border: '1px solid #2a3a4e', fontSize: '12px', marginBottom: 0
                }}>
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
