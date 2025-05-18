import React, { useState, useEffect } from 'react';
import AdvancedOptimizerUI from '../components/AdvancedOptimizerUI';
import TeamStacks from '../components/TeamStacks';
import ExposureControl from '../components/ExposureControl';

/**
 * This page integrates all optimization features into one coherent interface
 */
const OptimizerPage = ({
  API_BASE_URL,
  playerData,
  lineups,
  exposureSettings,
  onUpdateExposures,
  onGenerateLineups,
  onImportLineups
}) => {
  // Main section tracks which part of the optimization process you're viewing
  const [activeSection, setActiveSection] = useState('optimizer');

  // Sub-section for advanced optimizer content
  const [optimizerSubSection, setOptimizerSubSection] = useState('settings');

  const [dataReady, setDataReady] = useState(false);

  // Check if data is ready for optimization
  useEffect(() => {
    const hasPlayerData = Array.isArray(playerData) && playerData.length > 0;
    setDataReady(hasPlayerData);

    if (hasPlayerData) {
      console.log("OptimizerPage: Player data is ready", {
        playerCount: playerData.length,
        lineupsCount: lineups.length,
        hasExposureSettings: !!exposureSettings
      });
    } else {
      console.warn("OptimizerPage: Waiting for player data");
    }
  }, [playerData, lineups, exposureSettings]);

  // Handle generating lineups from the optimizer
  const handleGenerateLineups = async (count, options) => {
    if (!dataReady) {
      alert("Player data not ready. Please upload player projections first.");
      return false;
    }

    if (onGenerateLineups) {
      try {
        await onGenerateLineups(count, options);
        return true;
      } catch (error) {
        console.error('Error generating lineups:', error);
        alert(`Error generating lineups: ${error.message}`);
        return false;
      }
    }
    return false;
  };

  // Handle importing pre-generated lineups from the optimizer
  const handleImportLineups = async (optimizedLineups) => {
    if (onImportLineups) {
      try {
        await onImportLineups(optimizedLineups);
        return true;
      } catch (error) {
        console.error('Error importing lineups:', error);
        alert(`Error importing lineups: ${error.message}`);
        return false;
      }
    }
    return false;
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Advanced Optimizer</h2>

        {/* Main Section Navigation */}
        <div className="tabs-container">
          <ul style={{ listStyle: 'none', display: 'flex' }}>
            <li style={{ marginRight: '0.5rem' }}>
              <button
                className={`tab ${activeSection === 'optimizer' ? 'active' : ''}`}
                onClick={() => setActiveSection('optimizer')}
              >
                Optimizer
              </button>
            </li>
            <li style={{ marginRight: '0.5rem' }}>
              <button
                className={`tab ${activeSection === 'team-stacks' ? 'active' : ''}`}
                onClick={() => setActiveSection('team-stacks')}
              >
                Team Stacks
              </button>
            </li>
            <li style={{ marginRight: '0.5rem' }}>
              <button
                className={`tab ${activeSection === 'exposure' ? 'active' : ''}`}
                onClick={() => setActiveSection('exposure')}
              >
                Exposure Control
              </button>
            </li>
            <li style={{ marginRight: '0.5rem' }}>
              <button
                className={`tab ${activeSection === 'insights' ? 'active' : ''}`}
                onClick={() => setActiveSection('insights')}
              >
                Slate Insights
              </button>
            </li>
          </ul>
        </div>

        {/* Show data required warning if necessary */}
        {!dataReady && (
          <div className="card" style={{ border: '1px solid #f56565', padding: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ color: '#f56565', marginBottom: '0.5rem' }}>Data Required</h3>
            <p>Please upload player projections data before using the optimizer. Go to the Upload tab to import your data.</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '0.5rem' }}
              onClick={() => window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'upload' }))}
            >
              Go to Upload Tab
            </button>
          </div>
        )}

        {/* Advanced Optimizer Section */}
        {activeSection === 'optimizer' && (
          <div className="optimizer-container">
            {dataReady ? (
              <>
                {/* Sub-section tabs for the optimizer */}
                <div className="sub-tabs-container" style={{ marginBottom: '1rem' }}>
                  <ul style={{ listStyle: 'none', display: 'flex', borderBottom: '1px solid #2d3748', padding: '0' }}>
                    <li>
                      <button
                        className={`tab ${optimizerSubSection === 'settings' ? 'active' : ''}`}
                        onClick={() => setOptimizerSubSection('settings')}
                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                      >
                        Settings
                      </button>
                    </li>
                    <li>
                      <button
                        className={`tab ${optimizerSubSection === 'results' ? 'active' : ''}`}
                        onClick={() => setOptimizerSubSection('results')}
                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                      >
                        Results
                      </button>
                    </li>
                    <li>
                      <button
                        className={`tab ${optimizerSubSection === 'lineup-details' ? 'active' : ''}`}
                        onClick={() => setOptimizerSubSection('lineup-details')}
                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                      >
                        Lineup Details
                      </button>
                    </li>
                  </ul>
                </div>

                <AdvancedOptimizerUI
                  API_BASE_URL={API_BASE_URL}
                  playerData={playerData}
                  lineups={lineups}
                  exposureSettings={exposureSettings}
                  onUpdateExposures={onUpdateExposures}
                  onGenerateLineups={handleGenerateLineups}
                  onImportLineups={handleImportLineups}
                  activeTab={optimizerSubSection}
                  onChangeTab={setOptimizerSubSection}
                />
              </>
            ) : (
              <p>Please upload player projection data to use the optimizer.</p>
            )}
          </div>
        )}

        {/* Team Stacks Section */}
      {activeSection === 'team-stacks' && (
        <div className="team-stacks-container">
          {dataReady ? (
            <TeamStacks
              API_BASE_URL={API_BASE_URL}
              teamData={[]}
              lineups={lineups} // Added this line to pass lineups data
              exposureSettings={exposureSettings}
              onUpdateExposures={onUpdateExposures}
              onGenerateLineups={handleGenerateLineups}
            />
          ) : (
            <p>Please upload player projection data to use team stacks.</p>
          )}
        </div>
      )}

        {/* Exposure Control Section */}
        {activeSection === 'exposure' && (
          <div className="exposure-container">
            {dataReady ? (
              <ExposureControl
                API_BASE_URL={API_BASE_URL}
                playerData={playerData}
                lineups={lineups}
                exposureSettings={exposureSettings}
                onUpdateExposures={onUpdateExposures}
                onGenerateLineups={handleGenerateLineups}
              />
            ) : (
              <p>Please upload player projection data to manage exposure settings.</p>
            )}
          </div>
        )}

        {/* Slate Insights Section */}
        {activeSection === 'insights' && (
          <div className="insights-container">
            <div className="card" style={{ border: '1px solid #4fd1c5' }}>
              <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Slate Insights Coming Soon</h3>
              <p style={{ color: '#90cdf4' }}>
                This section will include detailed LoL slate analysis including:
              </p>
              <ul style={{ color: '#90cdf4', marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                <li>Team-by-team matchup analysis</li>
                <li>Lane matchup advantage stats</li>
                <li>Player performance trends</li>
                <li>Team scoring correlations</li>
                <li>Vegas lines and implied team totals</li>
                <li>Ownership projections and leverage opportunities</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizerPage;