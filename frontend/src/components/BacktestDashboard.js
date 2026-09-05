import React, { useState } from 'react';
import BacktestForm from './BacktestForm';
import BacktestHistory from './BacktestHistory';
import BacktestResults from './BacktestResults';
import BacktestComparison from './BacktestComparison';

const BacktestDashboard = () => {
  const [activeView, setActiveView] = useState('form');
  const [currentJobId, setCurrentJobId] = useState(null);
  const [compareJobIds, setCompareJobIds] = useState([]);

  const handleSubmitSuccess = (data) => {
    setCurrentJobId(data.job_id);
    setActiveView('results');
  };

  const handleViewResults = (jobId) => {
    setCurrentJobId(jobId);
    setActiveView('results');
  };

  const handleCompare = (jobIds) => {
    setCompareJobIds(jobIds);
    setActiveView('comparison');
  };

  const handleBackToHistory = () => {
    setActiveView('history');
    setCurrentJobId(null);
    setCompareJobIds([]);
  };

  return (
    <div style={{ paddingTop: '24px', paddingBottom: '24px' }}>
      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeView === 'form' ? 'active' : ''}`}
            onClick={() => setActiveView('form')}
          >
            New Backtest
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeView === 'history' ? 'active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            History
          </button>
        </li>
        {activeView === 'results' && (
          <li className="nav-item">
            <button className="nav-link active">Results</button>
          </li>
        )}
        {activeView === 'comparison' && (
          <li className="nav-item">
            <button className="nav-link active">Comparison</button>
          </li>
        )}
      </ul>

      {activeView === 'form' && <BacktestForm onSubmitSuccess={handleSubmitSuccess} />}
      {activeView === 'history' && <BacktestHistory onViewResults={handleViewResults} onCompare={handleCompare} />}
      {activeView === 'results' && currentJobId && <BacktestResults jobId={currentJobId} onBack={handleBackToHistory} />}
      {activeView === 'comparison' && compareJobIds.length > 0 && <BacktestComparison jobIds={compareJobIds} onBack={handleBackToHistory} />}
    </div>
  );
};

export default BacktestDashboard;
