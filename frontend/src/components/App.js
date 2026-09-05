import React, { Component } from "react";
import { render } from "react-dom";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import BinancePositions from "./BinancePositions";
import ZerodhaPositions from "./ZerodhaPositions";
import BrokerPortfolio from "./BrokerPortfolio";
import MarketDataAdmin from "./MarketDataAdmin";
import BacktestDashboard from "./BacktestDashboard";
import HistoricalData from "./HistoricalData";
import HealthDashboard from "./HealthDashboard";

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <li className="nav-item">
      <Link
        className="nav-link"
        to={to}
        style={{
          color: isActive ? '#e0e6ed' : '#7a8ea0',
          borderBottom: isActive ? '2px solid #f0a500' : '2px solid transparent',
          padding: '14px 16px',
          fontSize: '13px',
          fontWeight: isActive ? 500 : 400,
          transition: 'color 0.15s'
        }}
      >
        {children}
      </Link>
    </li>
  );
};

export default class App extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <Router>
        <div style={{ backgroundColor: '#0f1923', minHeight: '100vh', color: '#e0e6ed', width: '100%' }}>
          <nav className="navbar navbar-expand-lg" style={{
            backgroundColor: '#1a2836',
            borderBottom: '1px solid #2a3a4e',
            height: '48px'
          }}>
            <div className="container-fluid">
              <Link className="navbar-brand" to="/" style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#e0e6ed',
                letterSpacing: '-0.02em'
              }}>
                <span style={{ color: '#f0a500' }}>Vritti</span> Trading
              </Link>
              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav ms-auto" style={{ gap: '4px' }}>
                  <NavLink to="/">Home</NavLink>
                  <NavLink to="/portfolio">Portfolio</NavLink>
                  <NavLink to="/historical">Historical</NavLink>
                  <NavLink to="/backtesting">Backtesting</NavLink>
                  <NavLink to="/marketdata">Market Data</NavLink>
                  <NavLink to="/health">Health</NavLink>
                </ul>
              </div>
            </div>
          </nav>

          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
          <Routes>
            <Route path="/" element={
              <div style={{ padding: '64px 0', maxWidth: '960px', margin: '0 auto' }}>
                <div style={{ marginBottom: '48px' }}>
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    color: '#e0e6ed',
                    marginBottom: '12px',
                    letterSpacing: '-0.02em'
                  }}>
                    <span style={{ color: '#f0a500' }}>Vritti</span> Trading Platform
                  </h1>
                  <p style={{ color: '#7a8ea0', fontSize: '14px', marginBottom: '32px' }}>
                    Multi-broker trading dashboard with real-time analytics
                  </p>
                  <div className="d-flex gap-2 flex-wrap">
                    <Link to="/portfolio" className="btn" style={{
                      backgroundColor: '#f0a500',
                      color: '#0f1923',
                      fontWeight: 500,
                      border: 'none',
                      padding: '10px 24px'
                    }}>
                      View Portfolio
                    </Link>
                    <Link to="/backtesting" className="btn" style={{
                      backgroundColor: '#2a3a4e',
                      color: '#e0e6ed',
                      border: '1px solid #354a5f',
                      padding: '10px 24px'
                    }}>
                      Backtesting
                    </Link>
                    <Link to="/historical" className="btn" style={{
                      backgroundColor: '#2a3a4e',
                      color: '#e0e6ed',
                      border: '1px solid #354a5f',
                      padding: '10px 24px'
                    }}>
                      Historical Data
                    </Link>
                  </div>
                </div>

                <div className="row" style={{ marginTop: '48px' }}>
                  {[
                    { title: 'Multi-Broker', desc: 'Binance & Zerodha integration' },
                    { title: 'Real-Time', desc: 'Live market data streaming' },
                    { title: 'Analytics', desc: 'Advanced backtesting engine' }
                  ].map((item, i) => (
                    <div key={i} className="col-md-4 mb-3">
                      <div style={{
                        backgroundColor: '#1a2836',
                        border: '1px solid #2a3a4e',
                        borderRadius: '6px',
                        padding: '20px'
                      }}>
                        <h5 style={{ color: '#e0e6ed', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                          {item.title}
                        </h5>
                        <p style={{ color: '#7a8ea0', fontSize: '13px', marginBottom: 0 }}>
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            } />
            <Route path="/portfolio" element={<BrokerPortfolio />} />
            <Route path="/binance" element={<BinancePositions />} />
            <Route path="/zerodha" element={<ZerodhaPositions />} />
            <Route path="/historical" element={<HistoricalData />} />
            <Route path="/backtesting" element={<BacktestDashboard />} />
            <Route path="/marketdata" element={<MarketDataAdmin />} />
            <Route path="/health" element={<HealthDashboard />} />
          </Routes>
          </div>
        </div>
      </Router>
    );
  }
}

const appDiv = document.getElementById("app");
render(<App />, appDiv);
