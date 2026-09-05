import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const BacktestResults = ({ jobId, onBack }) => {
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/backtest/${jobId}/status`);
      const data = await response.json();
      if (data.success) {
        setStatus(data.data.status);
        if (data.data.status === 'completed') fetchResults();
        else if (data.data.status === 'failed') setError(data.data.message || 'Backtest failed');
      } else setError(data.error);
    } catch (err) { setError('Error fetching status: ' + err.message); }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/backtest/${jobId}/results`);
      const data = await response.json();
      if (data.success) setResults(data.data);
      else setError(data.error);
    } catch (err) { setError('Error fetching results: ' + err.message); }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#7a8ea0', font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1e2d3d', titleColor: '#e0e6ed', bodyColor: '#7a8ea0',
        borderColor: '#2a3a4e', borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#546a7e', font: { size: 10 } }, grid: { color: '#2a3a4e' } },
      y: { ticks: { color: '#546a7e', font: { size: 10 } }, grid: { color: '#2a3a4e' } }
    }
  };

  const prepareEquityCurve = () => {
    if (!results?.equity_curve || !Array.isArray(results.equity_curve)) return null;
    return {
      labels: results.equity_curve.map((_, idx) => idx),
      datasets: [{ label: 'Portfolio Value', data: results.equity_curve.map(v => Number(v) || 0),
        borderColor: '#f0a500', backgroundColor: 'rgba(212,168,67,0.05)', fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 0 }]
    };
  };

  const prepareDrawdown = () => {
    if (!results?.drawdown_curve || !Array.isArray(results.drawdown_curve)) return null;
    return {
      labels: results.drawdown_curve.map((_, idx) => idx),
      datasets: [{ label: 'Drawdown %', data: results.drawdown_curve.map(v => Number(v) || 0),
        borderColor: '#f6465d', backgroundColor: 'rgba(246,70,93,0.05)', fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 0 }]
    };
  };

  const preparePnLDistribution = () => {
    if (!results?.trades || !Array.isArray(results.trades) || results.trades.length === 0) return null;
    const bins = [-5000, -2000, -1000, -500, 0, 500, 1000, 2000, 5000];
    const counts = new Array(bins.length - 1).fill(0);
    results.trades.forEach(trade => {
      const pnl = Number(trade.profit_net) || 0;
      for (let i = 0; i < bins.length - 1; i++) { if (pnl >= bins[i] && pnl < bins[i + 1]) { counts[i]++; break; } }
    });
    return {
      labels: bins.slice(0, -1).map((v, i) => `$${v} to $${bins[i + 1]}`),
      datasets: [{ label: 'Trades', data: counts, backgroundColor: counts.map((_, i) => bins[i] < 0 ? 'rgba(246,70,93,0.6)' : 'rgba(14,203,129,0.6)') }]
    };
  };

  const prepareWinLoss = () => {
    if (!results?.trades || !Array.isArray(results.trades) || results.trades.length === 0) return null;
    let wins = 0, losses = 0;
    results.trades.forEach(trade => { const pnl = Number(trade.profit_net) || 0; if (pnl > 0) wins++; else if (pnl < 0) losses++; });
    return {
      labels: ['Wins', 'Losses'],
      datasets: [{ data: [wins, losses], backgroundColor: ['#0ecb81', '#f6465d'], borderColor: '#1a2836', borderWidth: 2 }]
    };
  };

  const btnBack = { backgroundColor: '#2a3a4e', color: '#e0e6ed', border: 'none', fontSize: '13px' };

  if (status === 'submitted' || status === 'running') {
    return (
      <div className="text-center" style={{ padding: '64px 0' }}>
        <div className="spinner-border mb-3" style={{ width: '2rem', height: '2rem' }} role="status"><span className="visually-hidden">Loading...</span></div>
        <h5 style={{ color: '#e0e6ed', fontSize: '14px' }}>Backtest {status === 'submitted' ? 'Submitted' : 'Running'}...</h5>
        <p style={{ color: '#7a8ea0', fontSize: '12px' }}>Job: {jobId}</p>
        <button className="btn btn-sm mt-2" style={btnBack} onClick={onBack}>Back</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center" style={{ padding: '64px 0' }}>
        <p style={{ color: '#f6465d', fontSize: '13px' }}>{error}</p>
        <button className="btn btn-sm mt-2" style={btnBack} onClick={onBack}>Back</button>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="text-center" style={{ padding: '64px 0' }}>
        <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status"><span className="visually-hidden">Loading...</span></div>
        <p style={{ color: '#7a8ea0', marginTop: '12px', fontSize: '13px' }}>Loading results...</p>
      </div>
    );
  }

  const metrics = results.metrics || {};
  const trades = results.trades || [];
  const parameters = results.parameters || {};

  const MetricCard = ({ label, value, color }) => (
    <div className="col-md-3 mb-3">
      <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
        <span style={{ color: '#7a8ea0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <p style={{ color: color || '#e0e6ed', fontSize: '20px', fontWeight: 600, marginBottom: 0, marginTop: '4px' }}>{value}</p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 style={{ color: '#e0e6ed', fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>Backtest Results</h3>
          <span style={{ color: '#546a7e', fontSize: '11px' }}>Job: {jobId}</span>
        </div>
        <button className="btn btn-sm" style={btnBack} onClick={onBack}>Back to History</button>
      </div>

      {/* KPI Cards */}
      <div className="row">
        <MetricCard label="Total Return" value={`${(Number(metrics.total_return) || 0).toFixed(2)}%`}
          color={(Number(metrics.total_return) || 0) >= 0 ? '#0ecb81' : '#f6465d'} />
        <MetricCard label="Sharpe Ratio" value={metrics.sharpe_ratio != null ? Number(metrics.sharpe_ratio).toFixed(2) : 'N/A'} />
        <MetricCard label="Max Drawdown" value={`${(Number(metrics.max_drawdown) || 0).toFixed(2)}%`} color="#f6465d" />
        <MetricCard label="Win Rate" value={`${(Number(metrics.win_rate) || 0).toFixed(1)}%`} />
      </div>

      {/* Detailed Metrics */}
      <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
          <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Detailed Metrics</h6>
        </div>
        <div style={{ padding: '16px' }}>
          <div className="row" style={{ fontSize: '12px' }}>
            <div className="col-md-4">
              <dl className="row mb-0">
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Total Trades</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{Number(metrics.total_trades) || 0}</dd>
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Profit Factor</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{metrics.profit_factor != null ? Number(metrics.profit_factor).toFixed(2) : 'N/A'}</dd>
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>CAGR</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{metrics.cagr != null ? Number(metrics.cagr).toFixed(2) + '%' : 'N/A'}</dd>
              </dl>
            </div>
            <div className="col-md-4">
              <dl className="row mb-0">
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Avg Win</dt>
                <dd className="col-sm-5" style={{ color: '#0ecb81' }}>${(Number(metrics.avg_win) || 0).toFixed(2)}</dd>
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Avg Loss</dt>
                <dd className="col-sm-5" style={{ color: '#f6465d' }}>${(Number(metrics.avg_loss) || 0).toFixed(2)}</dd>
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Volatility</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{metrics.volatility != null ? Number(metrics.volatility).toFixed(2) + '%' : 'N/A'}</dd>
              </dl>
            </div>
            <div className="col-md-4">
              <dl className="row mb-0">
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Sortino</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{metrics.sortino_ratio != null ? Number(metrics.sortino_ratio).toFixed(2) : 'N/A'}</dd>
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>Calmar</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{metrics.calmar_ratio != null ? Number(metrics.calmar_ratio).toFixed(2) : 'N/A'}</dd>
                <dt className="col-sm-7" style={{ color: '#7a8ea0', fontWeight: 400 }}>VaR (95%)</dt>
                <dd className="col-sm-5" style={{ color: '#e0e6ed' }}>{metrics.var_95 != null ? Number(metrics.var_95).toFixed(2) + '%' : 'N/A'}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Parameters */}
      <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
          <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Strategy Parameters</h6>
        </div>
        <div style={{ padding: '16px' }}>
          <pre style={{ backgroundColor: '#152232', color: '#7a8ea0', padding: '12px', borderRadius: '4px', border: '1px solid #2a3a4e', marginBottom: 0, fontSize: '12px' }}>
            {typeof parameters === 'object' && parameters !== null ? JSON.stringify(parameters, null, 2) : String(parameters || '{}')}
          </pre>
        </div>
      </div>

      {/* Trade History */}
      {Array.isArray(trades) && trades.length > 0 && (
        <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
            <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Trades ({trades.length})</h6>
          </div>
          <div className="table-responsive">
            <table className="table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th className="text-end">P&L</th>
                  <th className="text-end">Net P&L</th>
                  <th className="text-end">Commission</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 50).map((trade, index) => {
                  const profit = Number(trade.profit) || 0;
                  const profitNet = Number(trade.profit_net) || 0;
                  const commission = Number(trade.commission) || 0;
                  let dateStr = 'N/A';
                  if (trade.date) { try { dateStr = new Date(trade.date).toLocaleString(); } catch (e) { dateStr = String(trade.date); } }
                  return (
                    <tr key={index}>
                      <td style={{ color: '#546a7e' }}>{index + 1}</td>
                      <td style={{ color: '#7a8ea0' }}>{dateStr}</td>
                      <td className="text-end" style={{ color: profit >= 0 ? '#0ecb81' : '#f6465d' }}>${profit.toFixed(2)}</td>
                      <td className="text-end" style={{ color: profitNet >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 500 }}>${profitNet.toFixed(2)}</td>
                      <td className="text-end" style={{ color: '#7a8ea0' }}>${commission.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {trades.length > 50 && (
              <p style={{ color: '#546a7e', textAlign: 'center', padding: '8px', fontSize: '12px' }}>Showing 50 of {trades.length}</p>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      {prepareEquityCurve() && (
        <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
            <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Equity Curve</h6>
          </div>
          <div style={{ padding: '16px', height: '350px' }}>
            <Line data={prepareEquityCurve()} options={chartOptions} />
          </div>
        </div>
      )}

      {prepareDrawdown() && (
        <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
            <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Drawdown</h6>
          </div>
          <div style={{ padding: '16px', height: '260px' }}>
            <Line data={prepareDrawdown()} options={chartOptions} />
          </div>
        </div>
      )}

      <div className="row mb-3">
        {preparePnLDistribution() && (
          <div className="col-md-8">
            <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
                <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>P&L Distribution</h6>
              </div>
              <div style={{ padding: '16px', height: '260px' }}>
                <Bar data={preparePnLDistribution()} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
        {prepareWinLoss() && (
          <div className="col-md-4">
            <div style={{ backgroundColor: '#1a2836', border: '1px solid #2a3a4e', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e2d3d', borderBottom: '1px solid #2a3a4e', padding: '10px 16px' }}>
                <h6 style={{ color: '#e0e6ed', fontSize: '13px', fontWeight: 600, marginBottom: 0 }}>Win/Loss</h6>
              </div>
              <div style={{ padding: '16px', height: '260px' }}>
                <Pie data={prepareWinLoss()} options={{
                  ...chartOptions, scales: undefined,
                  plugins: { ...chartOptions.plugins, legend: { position: 'bottom', labels: { color: '#7a8ea0', font: { size: 11 } } } }
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BacktestResults;
