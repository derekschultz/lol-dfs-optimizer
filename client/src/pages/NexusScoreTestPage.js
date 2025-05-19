import React, { useState, useEffect } from "react";
import NexusScoreTester from "../components/NexusScoreTester";

/**
 * NexusScoreTestPage - A page for testing and refining NexusScore formulations
 */
const NexusScoreTestPage = ({
  API_BASE_URL,
  playerData,
  lineups,
  exposureSettings,
  onUpdateExposures,
  onImportLineups,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [historicalData, setHistoricalData] = useState(null);

  // Load any historical test data when component mounts
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        // Try to fetch historical test data from the server
        const response = await fetch(`${API_BASE_URL}/nexusscore/history`);

        if (response.ok) {
          const data = await response.json();
          setHistoricalData(data);
        }
      } catch (error) {
        console.error("Error loading historical NexusScore data:", error);
      }
    };

    loadHistoricalData();
  }, [API_BASE_URL]);

  // Handle saving test results
  const saveTestResults = async (results) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/nexusscore/test-results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(results),
      });

      if (response.ok) {
        const savedData = await response.json();
        setTestResults(savedData);
        alert("Test results saved successfully!");
      } else {
        throw new Error("Failed to save test results");
      }
    } catch (error) {
      console.error("Error saving test results:", error);
      alert(`Error saving results: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle saving a formula as the new default
  const saveFormula = async (formula) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/nexusscore/formula`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: formula.id,
          name: formula.name,
          description: formula.description,
          // Include the formula implementation function as a string
          implementation: formula.implementation.toString(),
        }),
      });

      if (response.ok) {
        alert(
          `Formula "${formula.name}" saved as the new default NexusScore calculation`
        );
        return true;
      } else {
        throw new Error("Failed to save formula");
      }
    } catch (error) {
      console.error("Error saving formula:", error);
      alert(`Error saving formula: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="nexus-score-test-page">
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="card-title">NexusScore A/B Testing</h2>

        <p style={{ color: "#90cdf4", marginBottom: "1.5rem" }}>
          This tool allows you to compare different NexusScore formulations to
          determine which best predicts tournament success. Test different
          mathematical approaches and compare how they rank your lineups.
        </p>

        {/* Status bar - either data availability or loading state */}
        <div
          style={{
            backgroundColor: playerData.length > 0 ? "#153e75" : "#742a2a",
            padding: "0.75rem",
            borderRadius: "0.25rem",
            marginBottom: "1.5rem",
          }}
        >
          {isLoading ? (
            <div
              style={{ color: "white", display: "flex", alignItems: "center" }}
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
                style={{
                  marginRight: "0.5rem",
                  animation: "spin 1s linear infinite",
                }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
              <span>Processing, please wait...</span>
            </div>
          ) : playerData.length > 0 ? (
            <div style={{ color: "white" }}>
              <span style={{ fontWeight: "bold", color: "#4fd1c5" }}>
                Ready for testing:{" "}
              </span>
              {playerData.length} players and {lineups.length} lineups available
            </div>
          ) : (
            <div style={{ color: "white" }}>
              <span style={{ fontWeight: "bold", color: "#f56565" }}>
                Data required:{" "}
              </span>
              Please upload player data and generate lineups before testing
            </div>
          )}
        </div>
      </div>

      {/* Main NexusScore tester component */}
      <NexusScoreTester
        playerData={playerData}
        lineups={lineups}
        onSaveFormula={saveFormula}
      />

      {/* Historical performance section (if we have it) */}
      {historicalData && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2 className="card-title">Historical Performance</h2>

          <p style={{ color: "#90cdf4", marginBottom: "1rem" }}>
            View how different NexusScore formulations performed in past
            tournaments.
          </p>

          {/* Historical data would be displayed here */}
          <div className="stat-card">
            <h3 style={{ color: "#4fd1c5", marginBottom: "0.5rem" }}>
              Formula Performance Data
            </h3>
            <p>
              Historical performance data for formulas will be displayed here
              when available.
            </p>
          </div>
        </div>
      )}

      {/* Usage instructions for those new to the tool */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 className="card-title">How to Use This Tool</h2>

        <div className="instructions">
          <ol style={{ paddingLeft: "1.5rem", color: "#e2e8f0" }}>
            <li style={{ marginBottom: "0.75rem" }}>
              <strong style={{ color: "#4fd1c5" }}>
                Select formulas to test
              </strong>{" "}
              - Choose which NexusScore formulations you want to compare
            </li>
            <li style={{ marginBottom: "0.75rem" }}>
              <strong style={{ color: "#4fd1c5" }}>Run the A/B test</strong> -
              All selected formulas will be applied to your current lineups
            </li>
            <li style={{ marginBottom: "0.75rem" }}>
              <strong style={{ color: "#4fd1c5" }}>Compare results</strong> -
              Review correlation matrices and score distributions to understand
              differences
            </li>
            <li style={{ marginBottom: "0.75rem" }}>
              <strong style={{ color: "#4fd1c5" }}>Select a formula</strong> -
              Choose the best performing formula to set as your new default
            </li>
            <li style={{ marginBottom: "0.75rem" }}>
              <strong style={{ color: "#4fd1c5" }}>Track performance</strong> -
              Over time, track which formula consistently produces the best
              tournament results
            </li>
          </ol>

          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              backgroundColor: "rgba(79, 209, 197, 0.1)",
              borderRadius: "0.25rem",
            }}
          >
            <p
              style={{
                color: "#4fd1c5",
                fontWeight: "bold",
                marginBottom: "0.5rem",
              }}
            >
              Expert tip:
            </p>
            <p style={{ color: "#e2e8f0" }}>
              The ideal NexusScore formula may vary based on contest size and
              type. For large GPPs, prioritize formulas with high uniqueness
              (less agreement with other formulas), while cash games benefit
              from formulas that prioritize projection accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NexusScoreTestPage;
