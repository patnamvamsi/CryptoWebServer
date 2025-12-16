import React, { Component } from "react";
import { render } from "react-dom";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import BinancePositions from "./BinancePositions";
import ZerodhaPositions from "./ZerodhaPositions";
import BrokerPortfolio from "./BrokerPortfolio";
import MarketDataAdmin from "./MarketDataAdmin";
import BacktestDashboard from "./BacktestDashboard";

export default class App extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <Router>
        <div className="container-fluid">
          <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
            <div className="container-fluid">
              <Link className="navbar-brand" to="/">Crypto Algo Platform</Link>
              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav">
                  <li className="nav-item">
                    <Link className="nav-link" to="/">Home</Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/portfolio">Portfolio</Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/binance">Binance</Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/zerodha">Zerodha</Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/historical">Historical Data</Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/backtesting">Backtesting</Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/marketdata">Market Data Admin</Link>
                  </li>
                </ul>
              </div>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={
              <div className="text-center mt-5">
                <h1>Welcome to Crypto Algo Trading Platform</h1>
                <p className="lead">Multi-broker trading dashboard with Binance and Zerodha integration</p>
                <div className="mt-4">
                  <Link to="/portfolio" className="btn btn-primary btn-lg me-3">View Portfolio</Link>
                  <Link to="/binance" className="btn btn-outline-primary btn-lg me-3">Binance</Link>
                  <Link to="/zerodha" className="btn btn-outline-primary btn-lg">Zerodha</Link>
                </div>
              </div>
            } />
            <Route path="/portfolio" element={<BrokerPortfolio />} />
            <Route path="/binance" element={<BinancePositions />} />
            <Route path="/zerodha" element={<ZerodhaPositions />} />
            <Route path="/historical" element={<div className="mt-5"><h2>Historical Data (Coming Soon)</h2></div>} />
            <Route path="/backtesting" element={<BacktestDashboard />} />
            <Route path="/marketdata" element={<MarketDataAdmin />} />
          </Routes>
        </div>
      </Router>
    );
  }
}

const appDiv = document.getElementById("app");
render(<App />, appDiv);