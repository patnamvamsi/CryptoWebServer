import React, { useState, useEffect } from 'react';

const BinancePositions = () => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/home/api/binance/positions');
      const data = await response.json();

      if (data.success) {
        setPositions(data.data);
        setLastUpdate(new Date());
      } else {
        setError(data.error || 'Failed to fetch positions');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPositions, 30000);

    return () => clearInterval(interval);
  }, []);

  const calculateTotalValue = () => {
    return positions.reduce((sum, pos) => sum + pos.total, 0).toFixed(2);
  };

  if (loading && positions.length === 0) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading Binance positions...</p>
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
          <hr />
          <button className="btn btn-danger" onClick={fetchPositions}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row mb-3">
        <div className="col-md-8">
          <h2>Binance Positions</h2>
          <p className="text-muted">
            Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
          </p>
        </div>
        <div className="col-md-4 text-end">
          <button
            className="btn btn-primary"
            onClick={fetchPositions}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="alert alert-info">
          No positions found. Your Binance account appears to be empty.
        </div>
      ) : (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Portfolio Summary</h5>
              <p className="card-text">
                <strong>Total Assets:</strong> {positions.length}
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Asset</th>
                  <th className="text-end">Free</th>
                  <th className="text-end">Locked</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{position.asset}</strong>
                    </td>
                    <td className="text-end">{parseFloat(position.free).toFixed(8)}</td>
                    <td className="text-end">{parseFloat(position.locked).toFixed(8)}</td>
                    <td className="text-end">
                      <strong>{position.total.toFixed(8)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default BinancePositions;
