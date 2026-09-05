import React, { Component } from "react";

export default class HealthDashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      healthData: null,
      loading: true,
      error: null,
      lastUpdated: null,
    };
  }

  componentDidMount() {
    this.fetchHealthData();
    this.refreshInterval = setInterval(() => this.fetchHealthData(), 30000);
  }

  componentWillUnmount() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  fetchHealthData = async () => {
    try {
      const response = await fetch("/health");
      const data = await response.json();
      this.setState({ healthData: data, loading: false, error: null, lastUpdated: new Date() });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  };

  getStatusColor(status) {
    switch (status) {
      case 'healthy': return '#0ecb81';
      case 'degraded': return '#f0b90b';
      case 'unhealthy':
      case 'disconnected': return '#f6465d';
      default: return '#546a7e';
    }
  }

  getStatusBadge(status) {
    const color = this.getStatusColor(status);
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span className="badge" style={{
        backgroundColor: color + '15',
        color: color,
        border: `1px solid ${color}30`,
        fontSize: '11px',
        fontWeight: 500
      }}>
        <span style={{
          display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
          backgroundColor: color, marginRight: '6px',
          animation: status === 'healthy' ? 'pulse 2s infinite' : 'none'
        }}></span>
        {displayStatus}
      </span>
    );
  }

  renderComponentCard(name, componentData) {
    const status = componentData.status;
    const borderColor = this.getStatusColor(status);

    return (
      <div key={name} className="col-md-6 col-lg-4 mb-3">
        <div style={{
          backgroundColor: '#1a2836',
          borderRadius: '6px',
          border: `1px solid ${borderColor}25`,
          padding: '16px',
          height: '100%'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 style={{ color: '#e0e6ed', fontWeight: 600, fontSize: '13px', marginBottom: 0 }}>
              {name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h6>
            {this.getStatusBadge(status)}
          </div>

          <div style={{ fontSize: '12px' }}>
            {componentData.message && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>Message:</span> {componentData.message}
              </p>
            )}
            {componentData.version && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>Version:</span> {componentData.version}
              </p>
            )}
            {componentData.host && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>Host:</span> {componentData.host}{componentData.port && `:${componentData.port}`}
              </p>
            )}
            {componentData.database && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>Database:</span> {componentData.database}
              </p>
            )}
            {componentData.url && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>URL:</span> {componentData.url}
              </p>
            )}
            {componentData.active_symbols !== undefined && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>Active Symbols:</span> {componentData.active_symbols}
              </p>
            )}
            {componentData.used_memory_human && (
              <p style={{ color: '#7a8ea0', marginBottom: '4px' }}>
                <span style={{ color: '#546a7e' }}>Memory:</span> {componentData.used_memory_human}
              </p>
            )}
            {componentData.error && (
              <div style={{
                backgroundColor: 'rgba(246,70,93,0.06)',
                borderRadius: '4px',
                border: '1px solid rgba(246,70,93,0.15)',
                padding: '8px',
                marginTop: '8px'
              }}>
                <p style={{ color: '#f6465d', fontSize: '11px', fontFamily: 'monospace', marginBottom: 0 }}>
                  {componentData.error}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { healthData, loading, error, lastUpdated } = this.state;

    if (loading && !healthData) {
      return (
        <div className="text-center" style={{ padding: '48px 0' }}>
          <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ color: '#7a8ea0', marginTop: '12px', fontSize: '13px' }}>Loading health status...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: '24px' }}>
          <div style={{
            backgroundColor: 'rgba(246,70,93,0.08)',
            border: '1px solid rgba(246,70,93,0.2)',
            borderRadius: '6px',
            padding: '16px'
          }}>
            <p style={{ color: '#f6465d', fontWeight: 500, marginBottom: '8px', fontSize: '13px' }}>Error: {error}</p>
            <button className="btn btn-sm" style={{ backgroundColor: '#2a3a4e', color: '#e0e6ed', border: 'none' }}
              onClick={this.fetchHealthData}>Retry</button>
          </div>
        </div>
      );
    }

    const overallColor = this.getStatusColor(healthData.overall_status);

    return (
      <div style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#1a2836',
          border: `1px solid ${overallColor}25`,
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            <div>
              <h2 style={{ color: '#e0e6ed', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                Platform Health
              </h2>
              <p style={{ color: '#7a8ea0', fontSize: '12px', marginBottom: 0 }}>
                System status and component monitoring
              </p>
            </div>
            <div className="text-end">
              <div className="mb-2">{this.getStatusBadge(healthData.overall_status)}</div>
              <span style={{ color: '#546a7e', fontSize: '11px' }}>
                {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
              </span>
              <button className="btn btn-sm ms-2" onClick={this.fetchHealthData} style={{
                backgroundColor: '#2a3a4e', color: '#7a8ea0', border: 'none', fontSize: '11px'
              }}>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Component Cards */}
        <div className="row">
          {healthData.components && Object.entries(healthData.components).map(([name, data]) =>
            this.renderComponentCard(name, data)
          )}
        </div>

        <div className="text-center" style={{ marginTop: '16px' }}>
          <span style={{ color: '#546a7e', fontSize: '11px' }}>
            Server: {new Date(healthData.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
}
