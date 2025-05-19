import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import NexusScoreLineup from "./NexusScoreLineup";
import AdvancedOptimizer from "../lib/AdvancedOptimizer";

// Helper function to safely format numeric values
const formatNumber = (value, decimals = 2) => {
  // If it's already a string, try to parse it
  if (typeof value === "string") {
    try {
      return parseFloat(value).toFixed(decimals);
    } catch (e) {
      return value;
    }
  }

  // If it's a number, format it
  if (typeof value === "number") {
    return value.toFixed(decimals);
  }

  // Fall back to 0 if the value is undefined or null
  return (0).toFixed(decimals);
};

// eslint-disable-next-line no-unused-vars
const NexusScoreCard = ({ score, components }) => {
  // Default values if components aren't available
  const {
    baseProjection = 0,
    leverageFactor = 1,
    avgOwnership = 0,
    fieldAvgOwnership = 0,
    stackBonus = 0,
    positionBonus = 0,
    teamStacks = "",
  } = components || {};

  // Format values for display
  const formattedLeverage = (leverageFactor * 100 - 100).toFixed(1);
  const ownershipDiff = ((fieldAvgOwnership - avgOwnership) * 100).toFixed(1);

  // Determine color based on score
  // Gradient from red (80) to yellow (120) to green (160+)
  let scoreColor = "#ef4444"; // Red for <100
  if (score >= 160) scoreColor = "#10b981"; // Green for 160+
  else if (score >= 140) scoreColor = "#22c55e"; // Light green for 140-160
  else if (score >= 120) scoreColor = "#84cc16"; // Lime for 120-140
  else if (score >= 100) scoreColor = "#eab308"; // Yellow for 100-120
  else if (score >= 80) scoreColor = "#f97316"; // Orange for 80-100

  return (
    <div
      className="nexus-score-card"
      style={{
        padding: "1rem",
        backgroundColor: "rgba(30, 58, 138, 0.3)",
        borderRadius: "0.5rem",
        border: `1px solid ${scoreColor}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glowing effect based on score */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: `radial-gradient(circle at center, ${scoreColor}22 0%, transparent 70%)`,
          opacity: 0.8,
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          className="flex-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3
              style={{
                color: "#4fd1c5",
                fontSize: "1.125rem",
                margin: "0 0 0.5rem 0",
              }}
            >
              NexusScore™
            </h3>
            <p style={{ margin: 0, color: "#90cdf4", fontSize: "0.875rem" }}>
              Comprehensive lineup strength rating
            </p>
          </div>
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: "bold",
              color: scoreColor,
              textShadow: `0 0 10px ${scoreColor}44`,
            }}
          >
            {Math.round(score)}
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ color: "#90cdf4" }}>Base Projection</span>
            <span style={{ color: "#f7fafc" }}>
              {baseProjection.toFixed(1)} pts
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ color: "#90cdf4" }}>Leverage Factor</span>
            <span
              style={{ color: formattedLeverage > 0 ? "#10b981" : "#f56565" }}
            >
              {formattedLeverage > 0 ? "+" : ""}
              {formattedLeverage}%
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ color: "#90cdf4" }}>Ownership Edge</span>
            <span style={{ color: ownershipDiff > 0 ? "#10b981" : "#f56565" }}>
              {ownershipDiff > 0 ? "+" : ""}
              {ownershipDiff}%
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ color: "#90cdf4" }}>Stack Bonus</span>
            <span style={{ color: stackBonus > 0 ? "#10b981" : "#90cdf4" }}>
              {stackBonus > 0 ? "+" : ""}
              {stackBonus.toFixed(1)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
            }}
          >
            <span style={{ color: "#90cdf4" }}>Position Impact</span>
            <span style={{ color: positionBonus > 0 ? "#10b981" : "#90cdf4" }}>
              {positionBonus > 0 ? "+" : ""}
              {positionBonus.toFixed(1)}
            </span>
          </div>
        </div>

        {teamStacks && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem",
              backgroundColor: "rgba(42, 67, 101, 0.3)",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              color: "#9f7aea",
            }}
          >
            <strong style={{ color: "#4fd1c5" }}>Team Stacks:</strong>{" "}
            {teamStacks}
          </div>
        )}
      </div>
    </div>
  );
};

const NexusScoreExplainer = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="nexus-score-explainer-modal"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(10, 15, 30, 0.9)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
      }}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: "#1a365d",
          borderRadius: "0.5rem",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          border: "1px solid #2c5282",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          ×
        </button>

        {/* Header */}
        <div
          style={{
            borderBottom: "1px solid #4fd1c5",
            padding: "1.5rem",
            background: "linear-gradient(90deg, #1a365d 0%, #164e63 100%)",
          }}
        >
          <h2
            style={{
              color: "#4fd1c5",
              margin: 0,
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                backgroundColor: "#10b981",
                color: "white",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                marginRight: "0.75rem",
                fontWeight: "bold",
              }}
            >
              N
            </span>
            Understanding NexusScore™
          </h2>
          <p style={{ color: "#90cdf4", margin: "0.5rem 0 0 0" }}>
            The comprehensive strength rating system for League of Legends DFS
            lineups
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem" }}>
          <h3 style={{ color: "#4fd1c5", marginTop: 0 }}>
            What is NexusScore?
          </h3>
          <p style={{ color: "#e2e8f0" }}>
            NexusScore is an advanced metric that evaluates your lineup's
            strength beyond raw projected points. It incorporates game theory
            concepts and LoL-specific factors to give you a more accurate
            prediction of lineup performance.
          </p>

          <h3 style={{ color: "#4fd1c5" }}>Key Components</h3>

          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#8b5cf6", margin: "0.5rem 0" }}>
              Base Projection
            </h4>
            <p style={{ color: "#e2e8f0", margin: 0 }}>
              The foundation of NexusScore is your lineup's total projected
              points. This raw projection is then modified by the following
              factors.
            </p>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#8b5cf6", margin: "0.5rem 0" }}>
              Ownership Leverage
            </h4>
            <p style={{ color: "#e2e8f0", margin: 0 }}>
              NexusScore rewards lineups with lower projected ownership compared
              to their point potential. When you roster low-owned players who
              perform well, you gain leverage over the field.
            </p>
            <div
              style={{
                margin: "0.5rem 0",
                padding: "0.5rem",
                backgroundColor: "rgba(44, 82, 130, 0.3)",
                borderRadius: "0.25rem",
                borderLeft: "3px solid #8b5cf6",
                fontSize: "0.875rem",
              }}
            >
              <strong style={{ color: "#8b5cf6" }}>Formula:</strong>{" "}
              <span style={{ color: "#e2e8f0" }}>
                NexusScore increases by up to 50% when your lineup has half the
                average ownership, and decreases by up to 50% when ownership is
                double the average.
              </span>
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#8b5cf6", margin: "0.5rem 0" }}>
              Team Stack Bonus
            </h4>
            <p style={{ color: "#e2e8f0", margin: 0 }}>
              In LoL DFS, team stacking is crucial since player performances
              correlate strongly. NexusScore awards bonus points for effective
              stacking strategies.
            </p>
            <div
              style={{
                margin: "0.5rem 0",
                padding: "0.5rem",
                backgroundColor: "rgba(44, 82, 130, 0.3)",
                borderRadius: "0.25rem",
                borderLeft: "3px solid #8b5cf6",
                fontSize: "0.875rem",
              }}
            >
              <strong style={{ color: "#8b5cf6" }}>Bonus Scale:</strong> <br />
              <span style={{ color: "#e2e8f0" }}>
                • 2-player stack: +1 point
                <br />
                • 3-player stack: +3 points
                <br />• 4-player stack: +8 points
              </span>
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#8b5cf6", margin: "0.5rem 0" }}>
              Position Impact
            </h4>
            <p style={{ color: "#e2e8f0", margin: 0 }}>
              Certain positions in LoL have higher ceilings and more potential
              for explosive performances. NexusScore weighs positions
              differently based on their typical impact.
            </p>
            <div
              style={{
                margin: "0.5rem 0",
                padding: "0.5rem",
                backgroundColor: "rgba(44, 82, 130, 0.3)",
                borderRadius: "0.25rem",
                borderLeft: "3px solid #8b5cf6",
                fontSize: "0.875rem",
              }}
            >
              <strong style={{ color: "#8b5cf6" }}>Position Weights:</strong>{" "}
              <br />
              <span style={{ color: "#e2e8f0" }}>
                • MID: 2.0x (highest ceiling)
                <br />
                • ADC: 1.8x (high damage output)
                <br />
                • JNG: 1.5x (game influence)
                <br />
                • TOP: 1.2x (moderate impact)
                <br />
                • SUP: 1.0x (utility focus)
                <br />• TEAM: 0.8x (consistent but limited)
              </span>
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#8b5cf6", margin: "0.5rem 0" }}>
              Consistency Factor
            </h4>
            <p style={{ color: "#e2e8f0", margin: 0 }}>
              NexusScore analyzes the projected volatility of your lineup. Some
              amount of variance is beneficial in tournaments, but extreme
              volatility can be risky.
            </p>
          </div>

          <h3 style={{ color: "#4fd1c5" }}>Interpreting Your Score</h3>

          <div
            style={{
              display: "flex",
              margin: "1rem 0",
              backgroundColor: "rgba(26, 54, 93, 0.5)",
              borderRadius: "0.5rem",
              padding: "1rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div
              style={{
                flex: "1 1 120px",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#ef4444",
                }}
              >
                70-99
              </div>
              <div style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>
                Below Average
              </div>
            </div>
            <div
              style={{
                flex: "1 1 120px",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#f97316",
                }}
              >
                100-119
              </div>
              <div style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>
                Average
              </div>
            </div>
            <div
              style={{
                flex: "1 1 120px",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#eab308",
                }}
              >
                120-139
              </div>
              <div style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>Good</div>
            </div>
            <div
              style={{
                flex: "1 1 120px",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#84cc16",
                }}
              >
                140-159
              </div>
              <div style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>
                Excellent
              </div>
            </div>
            <div
              style={{
                flex: "1 1 120px",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#10b981",
                }}
              >
                160+
              </div>
              <div style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>
                Elite
              </div>
            </div>
          </div>

          <p style={{ color: "#e2e8f0" }}>
            Generally, lineups with a NexusScore of 140+ should be prioritized
            for tournaments, while scores of 120+ are strong for cash games.
            Consider rebuilding lineups scoring below 100.
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem",
              backgroundColor: "rgba(79, 209, 197, 0.1)",
              borderRadius: "0.5rem",
              borderLeft: "3px solid #4fd1c5",
            }}
          >
            <p style={{ color: "#e2e8f0", margin: 0 }}>
              <strong style={{ color: "#4fd1c5" }}>Pro Tip:</strong> Use
              NexusScore alongside ROI and First Place % metrics for a complete
              view of lineup potential. NexusScore is especially valuable when
              comparing lineups with similar projected points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdvancedOptimizerUI = ({
  API_BASE_URL,
  playerData,
  lineups,
  exposureSettings,
  onUpdateExposures,
  onGenerateLineups,
  onImportLineups,
  activeTab,
  onChangeTab,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [optimizerReady, setOptimizerReady] = useState(false);
  const [optimizerSettings, setOptimizerSettings] = useState({
    iterations: 10000,
    randomness: 0.15,
    targetTop: 0.2,
    leverageMultiplier: 0.7,
    simCount: 10,
    fieldSize: 1000,
  });
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [activeTabInternal, setActiveTabInternal] = useState(
    activeTab || "settings"
  );
  const [simulationProgress, setSimulationProgress] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [simulationStage, setSimulationStage] = useState("");
  const [simulationStatus, setSimulationStatus] = useState("");
  const [optimizerInstance, setOptimizerInstance] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [selectedLineup, setSelectedLineup] = useState(null);

  const isInternalTabChange = useRef(false);
  const [showNexusExplainer, setShowNexusExplainer] = useState(false);
  const [sortBy, setSortBy] = useState("roi");
  const [selectedLineups, setSelectedLineups] = useState({});
  const [savedLineups, setSavedLineups] = useState([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (
      activeTab &&
      activeTab !== activeTabInternal &&
      !isInternalTabChange.current
    ) {
      setActiveTabInternal(activeTab);
    }
  }, [activeTab, activeTabInternal]);

  const handleTabChange = (tabName) => {
    isInternalTabChange.current = true;
    setActiveTabInternal(tabName);
    if (onChangeTab) {
      onChangeTab(tabName);
    }
    setTimeout(() => {
      isInternalTabChange.current = false;
    }, 0);
  };

  const [slateInfo, setSlateInfo] = useState({
    title: "Current LoL Slate",
    totalPlayers: playerData.length,
    avgSalary:
      playerData.length > 0
        ? Math.round(
            playerData.reduce((sum, p) => sum + (p.salary || 0), 0) /
              playerData.length
          )
        : 0,
    avgProjection:
      playerData.length > 0
        ? (
            playerData.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) /
            playerData.length
          ).toFixed(1)
        : 0,
    topTeams: [],
  });

  const optimizerRef = useRef(null);

  // Define initializeOptimizer using useCallback before it's used
  const initializeOptimizer = useCallback(async () => {
    try {
      setIsLoading(true);
      setSimulationProgress(0);
      setSimulationStage("initialization");
      setSimulationStatus("Initializing optimizer...");

      console.log("Creating new optimizer instance...");
      optimizerRef.current = null;

      const optimizer = new AdvancedOptimizer({
        iterations: optimizerSettings.iterations,
        randomness: optimizerSettings.randomness,
        targetTop: optimizerSettings.targetTop,
        leverageMultiplier: optimizerSettings.leverageMultiplier,
        fieldSize: optimizerSettings.fieldSize,
        correlation: {
          sameTeam: 0.7,
          opposingTeam: -0.15,
          sameTeamSamePosition: 0.2,
          captain: 0.9,
        },
      });

      optimizer.setProgressCallback((percent, stage) => {
        setSimulationProgress(percent);
        if (stage) setSimulationStage(stage);
      });

      optimizer.setStatusCallback((status) => {
        setSimulationStatus(status);
      });

      optimizerRef.current = optimizer;
      setOptimizerInstance(optimizer);

      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log("Initializing optimizer with:", {
        playerCount: playerData.length,
        lineupsCount: lineups.length,
        hasExposureSettings: !!exposureSettings,
      });

      if (!playerData || playerData.length === 0) {
        throw new Error(
          "No player data available. Please upload player projections first."
        );
      }

      if (playerData.length > 0) {
        console.log("Sample player data:", {
          name: playerData[0].name,
          position: playerData[0].position,
          points: playerData[0].projectedPoints,
        });
      }

      const initResult = await optimizer.initialize(
        playerData,
        exposureSettings,
        lineups
      );

      if (!initResult) {
        throw new Error(
          "Optimizer initialization failed. Please check console for details."
        );
      }

      setOptimizerReady(true);
      setSimulationStatus("Optimizer ready");
    } catch (error) {
      console.error("Error initializing optimizer:", error);
      setSimulationStatus(`Error: ${error.message}`);
      alert("Error initializing optimizer: " + error.message);
      setOptimizerReady(false);
    } finally {
      setIsLoading(false);
    }
  }, [playerData, optimizerSettings, exposureSettings, lineups]); // All dependencies

  useEffect(() => {
    if (
      playerData.length > 0 &&
      !optimizerInstance &&
      !hasInitialized.current
    ) {
      hasInitialized.current = true;
      initializeOptimizer();
    }
  }, [playerData, optimizerInstance, initializeOptimizer]);

  useEffect(() => {
    if (playerData.length > 0) {
      const teams = {};
      playerData.forEach((player) => {
        if (!player.team) return;

        if (!teams[player.team]) {
          teams[player.team] = {
            name: player.team,
            totalProjection: 0,
            count: 0,
          };
        }

        const projPoints =
          player.projectedPoints !== undefined &&
          player.projectedPoints !== null
            ? Number(player.projectedPoints)
            : player.Median !== undefined && player.Median !== null
            ? Number(player.Median)
            : 0;

        teams[player.team].totalProjection += projPoints;
        teams[player.team].count++;
      });

      const topTeams = Object.values(teams)
        .map((team) => ({
          ...team,
          avgProjection: team.count > 0 ? team.totalProjection / team.count : 0,
        }))
        .sort((a, b) => b.totalProjection - a.totalProjection)
        .slice(0, 5);

      setSlateInfo({
        title: "Current LoL Slate",
        totalPlayers: playerData.length,
        avgSalary: Math.round(
          playerData.reduce((sum, p) => sum + (p.salary || 0), 0) /
            playerData.length
        ),
        avgProjection: (
          playerData.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) /
          playerData.length
        ).toFixed(1),
        topTeams,
      });
    }
  }, [playerData]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const getSortedLineups = useCallback(() => {
    if (!optimizationResults || !optimizationResults.lineups) {
      return [];
    }

    const lineups = [...optimizationResults.lineups];

    if (sortBy === "nexusScore") {
      return lineups.sort((a, b) => (b.nexusScore || 0) - (a.nexusScore || 0));
    } else if (sortBy === "roi") {
      return lineups.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
    } else if (sortBy === "firstPlace") {
      return lineups.sort(
        (a, b) => parseFloat(b.firstPlace) - parseFloat(a.firstPlace)
      );
    } else if (sortBy === "projection") {
      return lineups.sort(
        (a, b) => parseFloat(b.projectedPoints) - parseFloat(a.projectedPoints)
      );
    } else if (sortBy === "ownership") {
      return lineups.sort(
        (a, b) => parseFloat(b.ownership) - parseFloat(a.ownership)
      );
    }

    return lineups.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
  }, [optimizationResults, sortBy]);

  useEffect(() => {
    if (
      optimizationResults &&
      optimizationResults.lineups &&
      optimizationResults.lineups.length > 0
    ) {
      const sortedLineups = getSortedLineups();
      setSelectedLineup(sortedLineups[0]);
    }
  }, [optimizationResults, getSortedLineups]);

  const handleSortChange = (criteria) => {
    setSortBy(criteria);
  };

  useEffect(() => {
    if (
      playerData.length > 0 &&
      !optimizerInstance &&
      !hasInitialized.current
    ) {
      hasInitialized.current = true;
      initializeOptimizer();
    }
  }, [playerData, optimizerInstance, initializeOptimizer]);

  const cancelOperation = () => {
    if (optimizerRef.current) {
      setIsCancelling(true);
      optimizerRef.current.cancel();

      setTimeout(() => {
        setIsLoading(false);
        setIsCancelling(false);
        setSimulationProgress(0);
        setSimulationStatus("Operation cancelled");
      }, 500);
    }
  };

  const runOptimizer = async () => {
    console.log(
      "Running optimizer, ready state:",
      optimizerReady,
      "optimizer instance:",
      optimizerRef.current ? "exists" : "missing"
    );

    setIsLoading(true);
    setSimulationProgress(0);
    setSimulationStage("starting");
    setSimulationStatus("Starting optimization...");

    if (!optimizerReady && playerData.length > 0) {
      console.log("Optimizer not ready, attempting initialization...");
      await initializeOptimizer();

      if (!optimizerReady) {
        alert(
          "Optimizer could not be initialized. Please check the console for errors."
        );
        setIsLoading(false);
        setSimulationProgress(0);
        return;
      }
    }

    if (!optimizerRef.current) {
      alert(
        "Optimizer not initialized. Please initialize the optimizer first."
      );
      setIsLoading(false);
      setSimulationProgress(0);
      return;
    }

    try {
      if (!optimizerRef.current.optimizerReady) {
        console.log(
          "Optimizer exists but not ready, attempting to reinitialize..."
        );

        const initResult = await optimizerRef.current.initialize(
          playerData,
          exposureSettings,
          lineups
        );

        if (!initResult) {
          throw new Error(
            "Failed to initialize optimizer. Please try refreshing the page."
          );
        }
      }

      optimizerRef.current.config.fieldSize = optimizerSettings.fieldSize;
      const results = await optimizerRef.current.runSimulation(
        optimizerSettings.simCount
      );

      setSimulationProgress(100);
      setSimulationStatus("Simulation completed");

      setOptimizationResults(results);

      handleTabChange("results");

      setSelectedLineups({});

      setTimeout(() => {
        setIsLoading(false);
        setSimulationProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error running optimizer:", error);
      setIsLoading(false);
      setSimulationProgress(0);
      setSimulationStatus(`Error: ${error.message}`);
      alert("Error running optimizer: " + error.message);
    }
  };

  const toggleLineupSelection = (lineup) => {
    setSelectedLineups((prev) => {
      const newSelections = { ...prev };
      if (newSelections[lineup.id]) {
        delete newSelections[lineup.id];
      } else {
        newSelections[lineup.id] = lineup;
      }
      return newSelections;
    });
  };

  const saveSelectedLineups = async () => {
    const selectedLineupsList = Object.values(selectedLineups);

    if (selectedLineupsList.length === 0) {
      alert("Please select at least one lineup to save");
      return;
    }

    try {
      setIsLoading(true);

      const formattedLineups = selectedLineupsList.map((lineup) => ({
        id: lineup.id,
        name: `${sortBy === "nexusScore" ? "NexusScore" : "Optimized"} ${
          sortBy === "nexusScore"
            ? Math.round(lineup.nexusScore || 100)
            : formatNumber(lineup.roi) + "x"
        } (${formatNumber(lineup.projectedPoints, 1)} pts)`,
        cpt: lineup.cpt,
        players: lineup.players,
        projectedPoints: lineup.projectedPoints,
        roi: lineup.roi,
        nexusScore: lineup.nexusScore,
        firstPlace: lineup.firstPlace ? Number(lineup.firstPlace) : 0,
        top10: lineup.top10 ? Number(lineup.top10) : 0,
      }));

      if (onGenerateLineups) {
        await onGenerateLineups(formattedLineups.length, {
          lineups: formattedLineups,
        });

        setSavedLineups((prev) => [
          ...prev,
          ...selectedLineupsList.map((l) => l.id),
        ]);

        setSaveSuccess(true);

        setSelectedLineups({});
      } else {
        alert("Lineup save function not available");
      }
    } catch (error) {
      console.error("Error saving lineups:", error);
      alert(`Error saving lineups: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateLineupsFromResults = async () => {
    if (!optimizationResults) {
      alert(
        "No optimization results available. Please run the optimizer first."
      );
      return;
    }

    try {
      setIsLoading(true);

      if (onImportLineups) {
        const sortedLineups = getSortedLineups();

        const formattedLineups = sortedLineups.map((lineup) => ({
          id: lineup.id,
          name: `${sortBy === "nexusScore" ? "NexusScore" : "Optimized"} ${
            sortBy === "nexusScore"
              ? Math.round(lineup.nexusScore || 100)
              : formatNumber(lineup.roi) + "x"
          } (${formatNumber(lineup.projectedPoints, 1)} pts)`,
          cpt: lineup.cpt,
          players: lineup.players,
          projectedPoints: lineup.projectedPoints,
          roi: lineup.roi,
          nexusScore: lineup.nexusScore,
          firstPlace: lineup.firstPlace ? Number(lineup.firstPlace) : 0,
          top10: lineup.top10 ? Number(lineup.top10) : 0,
        }));

        await onImportLineups(formattedLineups);

        setSavedLineups((prev) => [
          ...prev,
          ...formattedLineups.map((l) => l.id),
        ]);

        setSaveSuccess(true);
      } else {
        alert("Lineup generation function not available");
      }
    } catch (error) {
      console.error("Error generating lineups:", error);
      alert("Error generating lineups: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOptimizerSettings = (key, value) => {
    setOptimizerSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const calculateGlobalStats = () => {
    if (
      !optimizationResults ||
      !optimizationResults.lineups ||
      optimizationResults.lineups.length === 0
    ) {
      return {
        avgProjection: 0,
        avgOwnership: 0,
        avgSalary: 0,
        avgNexusScore: 0,
      };
    }

    const lineups = optimizationResults.lineups;

    const avgProjection =
      lineups.reduce((sum, l) => sum + (l.projectedPoints || 0), 0) /
      lineups.length;

    let totalOwnership = 0;
    let playerCount = 0;

    lineups.forEach((lineup) => {
      const allPlayers = lineup.cpt
        ? [lineup.cpt, ...(lineup.players || [])]
        : lineup.players || [];
      playerCount += allPlayers.length;

      allPlayers.forEach((player) => {
        const playerInfo = playerData.find((p) => p.id === player.id);
        const ownership =
          player.ownership || (playerInfo ? playerInfo.ownership : 0) || 0;
        totalOwnership += ownership;
      });
    });

    const avgOwnership = playerCount > 0 ? totalOwnership / playerCount : 0;

    let totalSalary = 0;

    lineups.forEach((lineup) => {
      const allPlayers = lineup.cpt
        ? [lineup.cpt, ...(lineup.players || [])]
        : lineup.players || [];

      allPlayers.forEach((player) => {
        totalSalary += player.salary || 0;
      });
    });

    const avgSalary = lineups.length > 0 ? totalSalary / lineups.length : 0;

    const avgNexusScore =
      lineups.reduce((sum, l) => sum + (l.nexusScore || 0), 0) / lineups.length;

    return {
      avgProjection,
      avgOwnership,
      avgSalary,
      avgNexusScore,
    };
  };

  const getProgressStatusMessage = () => {
    if (simulationStatus) {
      return simulationStatus;
    }

    if (simulationProgress < 5) {
      return "Initializing...";
    } else if (simulationProgress < 40) {
      return "Generating lineups...";
    } else if (simulationProgress < 70) {
      return "Running simulations...";
    } else if (simulationProgress < 90) {
      return "Calculating metrics...";
    } else {
      return "Finalizing results...";
    }
  };

  return (
    <div className="advanced-optimizer">
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="card-title" style={{ margin: 0 }}>
            Advanced Monte Carlo Optimizer
          </h2>

          <div>
            {optimizerReady ? (
              <span
                style={{
                  color: "#10b981",
                  fontWeight: "bold",
                  marginRight: "1rem",
                }}
              >
                Optimizer Ready
              </span>
            ) : (
              <span
                style={{
                  color: "#f59e0b",
                  fontWeight: "bold",
                  marginRight: "1rem",
                }}
              >
                Initializing...
              </span>
            )}

            <button
              className={`btn ${
                optimizerReady ? "btn-primary" : "btn-disabled"
              }`}
              onClick={runOptimizer}
              disabled={!optimizerReady || isLoading}
            >
              {isLoading ? "Running..." : "Run Optimizer"}
            </button>
          </div>
        </div>
      </div>

      <div className="tabs-container">
        <ul style={{ listStyle: "none", display: "flex" }}>
          {["settings", "results", "lineup-details"].map((tab) => (
            <li key={tab} style={{ marginRight: "0.5rem" }}>
              <button
                className={`tab ${activeTabInternal === tab ? "active" : ""}`}
                onClick={() => handleTabChange(tab)}
              >
                {tab === "settings"
                  ? "Optimizer Settings"
                  : tab === "results"
                  ? "Simulation Results"
                  : "Lineup Details"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {activeTabInternal === "settings" && (
        <div className="grid grid-cols-2" style={{ gap: "1.5rem" }}>
          <div className="card">
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Simulation Settings
            </h3>

            <div className="grid grid-cols-1" style={{ gap: "1rem" }}>
              <div>
                <label className="form-label">Simulation Iterations</label>
                <input
                  type="number"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={optimizerSettings.iterations}
                  onChange={(e) =>
                    updateOptimizerSettings(
                      "iterations",
                      parseInt(e.target.value)
                    )
                  }
                />
                <p style={{ color: "#90cdf4", fontSize: "0.875rem" }}>
                  Higher values provide more accurate results but take longer to
                  process.
                </p>
              </div>

              <div>
                <label className="form-label">Field Size</label>
                <input
                  type="number"
                  min="10"
                  max="100000"
                  step="100"
                  value={optimizerSettings.fieldSize}
                  onChange={(e) =>
                    updateOptimizerSettings(
                      "fieldSize",
                      parseInt(e.target.value)
                    )
                  }
                />
                <p style={{ color: "#90cdf4", fontSize: "0.875rem" }}>
                  Number of competitors in the tournament. Affects ROI
                  calculation.
                </p>
              </div>

              <div className="slider-container">
                <div className="slider-header">
                  <label className="slider-label">Randomness Factor</label>
                  <span className="slider-value">
                    {optimizerSettings.randomness.toFixed(2)}
                  </span>
                </div>

                <div className="slider-track">
                  <div
                    className="slider-fill"
                    style={{ width: `${optimizerSettings.randomness * 100}%` }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={optimizerSettings.randomness}
                    onChange={(e) =>
                      updateOptimizerSettings(
                        "randomness",
                        parseFloat(e.target.value)
                      )
                    }
                    className="slider-input"
                  />
                </div>

                <div className="slider-range-labels">
                  <span>Projection Heavy</span>
                  <span>More Random</span>
                </div>
              </div>

              <div className="slider-container">
                <div className="slider-header">
                  <label className="slider-label">Leverage Multiplier</label>
                  <span className="slider-value">
                    {optimizerSettings.leverageMultiplier.toFixed(1)}
                  </span>
                </div>

                <div className="slider-track">
                  <div
                    className="slider-fill"
                    style={{
                      width: `${
                        (optimizerSettings.leverageMultiplier / 2) * 100
                      }%`,
                    }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={optimizerSettings.leverageMultiplier}
                    onChange={(e) =>
                      updateOptimizerSettings(
                        "leverageMultiplier",
                        parseFloat(e.target.value)
                      )
                    }
                    className="slider-input"
                  />
                </div>

                <div className="slider-range-labels">
                  <span>Ignore Ownership</span>
                  <span>Max Leverage</span>
                </div>
              </div>

              <div className="slider-container">
                <div className="slider-header">
                  <label className="slider-label">Target Top Percentile</label>
                  <span className="slider-value">
                    Top {(optimizerSettings.targetTop * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="slider-track">
                  <div
                    className="slider-fill"
                    style={{
                      width: `${(optimizerSettings.targetTop / 0.5) * 100}%`,
                    }}
                  ></div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={optimizerSettings.targetTop}
                    onChange={(e) =>
                      updateOptimizerSettings(
                        "targetTop",
                        parseFloat(e.target.value)
                      )
                    }
                    className="slider-input"
                  />
                </div>

                <div className="slider-range-labels">
                  <span>Top 1%</span>
                  <span>Top 50%</span>
                </div>
              </div>

              <div>
                <label className="form-label">Lineups to Generate</label>
                <input
                  type="number"
                  min="1"
                  max="150"
                  value={optimizerSettings.simCount}
                  onChange={(e) =>
                    updateOptimizerSettings(
                      "simCount",
                      parseInt(e.target.value)
                    )
                  }
                />
                <p style={{ color: "#90cdf4", fontSize: "0.875rem" }}>
                  Number of optimized lineups to create.
                </p>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <button
                  className="btn btn-primary"
                  onClick={initializeOptimizer}
                  disabled={isLoading}
                >
                  {optimizerReady
                    ? "Reinitialize Optimizer"
                    : "Initialize Optimizer"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              {slateInfo.title}
            </h3>

            <div
              className="grid grid-cols-2"
              style={{ gap: "1rem", marginBottom: "1.5rem" }}
            >
              <div className="stat-card">
                <h4 style={{ color: "#90cdf4" }}>Total Players</h4>
                <p className="stat-value">{slateInfo.totalPlayers}</p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: "#90cdf4" }}>Average Salary</h4>
                <p className="stat-value">
                  ${slateInfo.avgSalary.toLocaleString()}
                </p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: "#90cdf4" }}>Avg Projection</h4>
                <p className="stat-value">{slateInfo.avgProjection}</p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: "#90cdf4" }}>Uploaded Lineups</h4>
                <p className="stat-value">{lineups.length}</p>
              </div>
            </div>

            <h4 style={{ color: "#4fd1c5", marginBottom: "0.5rem" }}>
              Top Teams by Projection
            </h4>
            <div
              className="table-container"
              style={{ maxHeight: "200px", overflow: "auto" }}
            >
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Total Projection</th>
                    <th>Avg Per Player</th>
                  </tr>
                </thead>
                <tbody>
                  {slateInfo.topTeams.map((team) => (
                    <tr key={team.name}>
                      <td>{team.name}</td>
                      <td style={{ color: "#10b981" }}>
                        {team.totalProjection.toFixed(1)}
                      </td>
                      <td>{team.avgProjection.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ color: "#4fd1c5", marginBottom: "0.5rem" }}>
                About This Optimizer
              </h4>
              <p style={{ color: "#90cdf4", fontSize: "0.875rem" }}>
                This optimizer uses advanced Monte Carlo simulation to generate
                lineups with the highest ROI potential. It considers player
                correlations, ownership leverage, and simulates thousands of
                potential outcomes to find the best lineups for tournaments.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTabInternal === "results" && optimizationResults && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span style={{ color: "#90cdf4", fontSize: "0.875rem" }}>
                Sort by:
              </span>
              <div
                style={{
                  display: "flex",
                  backgroundColor: "#1a365d",
                  borderRadius: "0.25rem",
                }}
              >
                <button
                  className={`btn ${sortBy === "nexusScore" ? "active" : ""}`}
                  onClick={() => handleSortChange("nexusScore")}
                  style={{
                    backgroundColor:
                      sortBy === "nexusScore" ? "#3182ce" : "transparent",
                    color: sortBy === "nexusScore" ? "white" : "#90cdf4",
                    border: "none",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  NexusScore
                </button>
                <button
                  className={`btn ${sortBy === "roi" ? "active" : ""}`}
                  onClick={() => handleSortChange("roi")}
                  style={{
                    backgroundColor:
                      sortBy === "roi" ? "#3182ce" : "transparent",
                    color: sortBy === "roi" ? "white" : "#90cdf4",
                    border: "none",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  ROI
                </button>
                <button
                  className={`btn ${sortBy === "projection" ? "active" : ""}`}
                  onClick={() => handleSortChange("projection")}
                  style={{
                    backgroundColor:
                      sortBy === "projection" ? "#3182ce" : "transparent",
                    color: sortBy === "projection" ? "white" : "#90cdf4",
                    border: "none",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Projection
                </button>
                <button
                  className={`btn ${sortBy === "ownership" ? "active" : ""}`}
                  onClick={() => handleSortChange("ownership")}
                  style={{
                    backgroundColor:
                      sortBy === "ownership" ? "#3182ce" : "transparent",
                    color: sortBy === "ownership" ? "white" : "#90cdf4",
                    border: "none",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Ownership
                </button>
                <button
                  className={`btn ${sortBy === "firstPlace" ? "active" : ""}`}
                  onClick={() => handleSortChange("firstPlace")}
                  style={{
                    backgroundColor:
                      sortBy === "firstPlace" ? "#3182ce" : "transparent",
                    color: sortBy === "firstPlace" ? "white" : "#90cdf4",
                    border: "none",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  First Place %
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ color: "#90cdf4", fontSize: "0.875rem" }}>
                {Object.keys(selectedLineups).length} lineups selected
              </span>
              <button
                className="btn"
                style={{ backgroundColor: "#38b2ac", color: "white" }}
                onClick={saveSelectedLineups}
                disabled={
                  Object.keys(selectedLineups).length === 0 || isLoading
                }
              >
                Save Selected
              </button>
              <button
                className="btn btn-primary"
                onClick={generateLineupsFromResults}
                disabled={isLoading}
              >
                Save All Lineups
              </button>
            </div>
          </div>

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

          <div
            style={{
              marginBottom: "1.5rem",
              backgroundColor: "#0d1829",
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid #2d3748",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h3
                style={{
                  color: "#4fd1c5",
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: "bold",
                }}
              >
                Global Lineup Statistics
              </h3>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                color: "#d1d5db",
                fontSize: "0.875rem",
              }}
            >
              <div
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
                  Average Projection
                </span>
                <span
                  style={{
                    color: "#48bb78",
                    fontWeight: "bold",
                    fontSize: "1.125rem",
                  }}
                >
                  {calculateGlobalStats().avgProjection.toFixed(2)}
                </span>
              </div>

              <div
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
                  Average Ownership
                </span>
                <span
                  style={{
                    color: "#f56565",
                    fontWeight: "bold",
                    fontSize: "1.125rem",
                  }}
                >
                  {calculateGlobalStats().avgOwnership.toFixed(1)}%
                </span>
              </div>

              <div
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
                  Average Salary
                </span>
                <span
                  style={{
                    color: "#ecc94b",
                    fontWeight: "bold",
                    fontSize: "1.125rem",
                  }}
                >
                  $
                  {Math.round(
                    calculateGlobalStats().avgSalary
                  ).toLocaleString()}
                </span>
              </div>

              <div
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
                  Average NexusScore
                </span>
                <span
                  style={{
                    color: "#4299e1",
                    fontWeight: "bold",
                    fontSize: "1.125rem",
                  }}
                >
                  {calculateGlobalStats().avgNexusScore.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
            Optimized Lineups
          </h3>

          <div style={{ marginBottom: "1rem" }}>
            {getSortedLineups().map((lineup, index) => (
              <div
                key={`${lineup.id}_${index}`}
                style={{
                  marginBottom: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div style={{ marginRight: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedLineups[lineup.id])}
                    onChange={() => toggleLineupSelection(lineup)}
                    style={{
                      width: "1.2rem",
                      height: "1.2rem",
                      cursor: "pointer",
                      accentColor: "#38b2ac",
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <NexusScoreLineup
                    lineup={{
                      ...lineup,
                      nexusScore: lineup.nexusScore,
                      roi: lineup.roi,
                    }}
                    playerData={playerData}
                    index={index + 1}
                    isStarred={
                      Boolean(selectedLineups[lineup.id]) ||
                      savedLineups.includes(lineup.id)
                    }
                    onStar={() => toggleLineupSelection(lineup)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "1rem",
            }}
          >
            <div>
              <button
                className="btn"
                style={{ backgroundColor: "#805ad5", color: "white" }}
                onClick={() => {
                  setSelectedLineups({});
                }}
                disabled={Object.keys(selectedLineups).length === 0}
              >
                Clear Selections
              </button>
            </div>

            <div>
              <button
                className="btn btn-success"
                onClick={saveSelectedLineups}
                disabled={
                  Object.keys(selectedLineups).length === 0 || isLoading
                }
              >
                Save Selected Lineups
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTabInternal === "lineup-details" && optimizationResults && (
        <div className="grid grid-cols-1" style={{ gap: "1.5rem" }}>
          <div className="card">
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Score Distributions
            </h3>

            <div className="chart-container" style={{ height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getSortedLineups()
                    .slice(0, 5)
                    .map((lineup, index) => ({
                      name: `L${index + 1}`,
                      min: lineup.min,
                      p10: lineup.p10,
                      p25: lineup.p25,
                      median: lineup.median,
                      p75: lineup.p75,
                      p90: lineup.p90,
                      max: lineup.max,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                  <XAxis dataKey="name" stroke="#90cdf4" />
                  <YAxis stroke="#90cdf4" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a365d",
                      border: "1px solid #2c5282",
                      color: "white",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="p10"
                    stroke="#f56565"
                    name="10th Percentile"
                  />
                  <Line
                    type="monotone"
                    dataKey="p25"
                    stroke="#ed8936"
                    name="25th Percentile"
                  />
                  <Line
                    type="monotone"
                    dataKey="median"
                    stroke="#3b82f6"
                    name="Median"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="p75"
                    stroke="#10b981"
                    name="75th Percentile"
                  />
                  <Line
                    type="monotone"
                    dataKey="p90"
                    stroke="#8b5cf6"
                    name="90th Percentile"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Player Exposures in Optimized Lineups
            </h3>

            <div
              className="table-container"
              style={{ maxHeight: "400px", overflow: "auto" }}
            >
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Position</th>
                    <th>Team</th>
                    <th>Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizationResults.summary &&
                    optimizationResults.summary.playerExposures
                      .filter((player) => player.exposure > 0)
                      .slice(0, 30)
                      .map((player) => (
                        <tr key={player.id}>
                          <td>{player.name}</td>
                          <td style={{ color: "#4fd1c5" }}>
                            {player.position}
                          </td>
                          <td>{player.team}</td>
                          <td style={{ fontWeight: "bold", color: "#10b981" }}>
                            {player.exposure}%
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <h3 className="loading-title">Running Advanced Simulation</h3>

            <div className="loading-progress">
              <div
                className="loading-bar"
                style={{ width: `${simulationProgress}%` }}
              ></div>
            </div>

            <p className="loading-text">
              {isCancelling
                ? "Cancelling operation..."
                : getProgressStatusMessage()}
            </p>

            {!isCancelling && (
              <button
                onClick={cancelOperation}
                style={{
                  marginTop: "10px",
                  padding: "4px 12px",
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#ef4444",
                  border: "1px solid #ef4444",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <NexusScoreExplainer
        isOpen={showNexusExplainer}
        onClose={() => setShowNexusExplainer(false)}
      />
    </div>
  );
};

export default AdvancedOptimizerUI;
