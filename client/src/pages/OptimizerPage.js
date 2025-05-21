import React, { useState, useEffect } from "react";
import LineupList from "../components/LineupList";
import AdvancedOptimizerUI from "../components/AdvancedOptimizerUI";

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
  onImportLineups,
}) => {
  // Main section tracks which part of the optimization process you're viewing
  const [activeSection, setActiveSection] = useState("optimizer");

  // Sub-section for advanced optimizer content
  const [optimizerSubSection, setOptimizerSubSection] = useState("settings");

  const [dataReady, setDataReady] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check if data is ready for optimization
  useEffect(() => {
    const hasPlayerData = Array.isArray(playerData) && playerData.length > 0;
    setDataReady(hasPlayerData);

    if (hasPlayerData) {
      console.log("OptimizerPage: Player data is ready", {
        playerCount: playerData.length,
        lineupsCount: lineups.length,
        hasExposureSettings: !!exposureSettings,
      });
    } else {
      console.warn("OptimizerPage: Waiting for player data");
    }
  }, [playerData, lineups, exposureSettings]);

  // Reset save success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

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
        console.error("Error generating lineups:", error);
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
        setSaveSuccess(true);
        // Automatically switch to the lineups view
        setActiveSection("lineups");
        return true;
      } catch (error) {
        console.error("Error importing lineups:", error);
        alert(`Error importing lineups: ${error.message}`);
        return false;
      }
    }
    return false;
  };

  return (
    <div>
      <div className="card">
        {/* Save success message */}
        {saveSuccess && (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "rgba(56, 161, 105, 0.2)",
              borderRadius: "0.25rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38a169",
              border: "1px solid #38a169",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "0.5rem" }}
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>
              Lineups saved successfully! View them in the Lineups tab.
            </span>
          </div>
        )}

        {/* Show data required warning if necessary */}
        {!dataReady && (
          <div
            className="card"
            style={{
              border: "1px solid #f56565",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h3 style={{ color: "#f56565", marginBottom: "0.5rem" }}>
              Data Required
            </h3>
            <p>
              Please upload player projections data before using the optimizer.
              Go to the Upload tab to import your data.
            </p>
          </div>
        )}

        {/* Advanced Optimizer Section */}
        {activeSection === "optimizer" && (
          <div className="optimizer-container">
            {dataReady ? (
              <>
                {/* Sub-section tabs for the optimizer */}
                <div
                  className="sub-tabs-container"
                  style={{ marginBottom: "1rem" }}
                >
                  <ul
                    style={{
                      listStyle: "none",
                      display: "flex",
                      borderBottom: "1px solid #2d3748",
                      padding: "0",
                    }}
                  >
                    <li>
                      <button
                        className={`tab ${
                          optimizerSubSection === "settings" ? "active" : ""
                        }`}
                        onClick={() => setOptimizerSubSection("settings")}
                        style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
                      >
                        Settings
                      </button>
                    </li>
                    <li>
                      <button
                        className={`tab ${
                          optimizerSubSection === "results" ? "active" : ""
                        }`}
                        onClick={() => setOptimizerSubSection("results")}
                        style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
                      >
                        Results
                      </button>
                    </li>
                    <li>
                      <button
                        className={`tab ${
                          optimizerSubSection === "lineup-details"
                            ? "active"
                            : ""
                        }`}
                        onClick={() => setOptimizerSubSection("lineup-details")}
                        style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
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

        {/* Generated Lineups Section */}
        {activeSection === "lineups" && (
          <div className="lineups-container">
            {dataReady ? (
              <>
                {/* Optimize button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <h3 style={{ color: "#4fd1c5", margin: 0 }}>
                    Optimized Lineups
                  </h3>

                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveSection("optimizer")}
                  >
                    Return to Optimizer
                  </button>
                </div>

                {/* Display lineups with NexusScore */}
                {lineups.length > 0 ? (
                  <LineupList
                    lineups={lineups}
                    playerData={playerData}
                    onEdit={(lineup) => {
                      console.log("Edit lineup:", lineup);
                    }}
                    onDelete={(lineup) => {
                      console.log("Delete lineup:", lineup);
                    }}
                    onRunSimulation={() => {
                      console.log("Run simulation for lineups");
                    }}
                    onExport={(format) => {
                      console.log(`Export lineups as ${format}`);
                    }}
                  />
                ) : (
                  <div className="empty-state">
                    <p>No optimized lineups have been generated yet.</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setActiveSection("optimizer")}
                    >
                      Go to Optimizer
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p>Please upload player projection data to generate lineups.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizerPage;
