import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * NexusScoreTester - Component for A/B testing different NexusScore formulations
 */
const NexusScoreTester = ({ playerData = [], lineups = [], onSaveFormula }) => {
  // State for tracking tested formulas
  const [formulas, setFormulas] = useState([
    {
      id: "current",
      name: "Current Formula",
      description:
        "Baseline: (baseProjection * leverageFactor + stackBonus + positionBonus) / 7",
      implementation: calculateCurrentNexusScore,
      results: null,
      active: true,
    },
    {
      id: "multiplicative",
      name: "Multiplicative",
      description:
        "All factors multiply: projection * leverage * stacks * positions",
      implementation: calculateMultiplicativeNexusScore,
      results: null,
      active: true,
    },
    {
      id: "weighted",
      name: "Weighted Components",
      description: "60% projection, 20% leverage, 15% stacks, 5% position",
      implementation: calculateWeightedNexusScore,
      results: null,
      active: true,
    },
    {
      id: "ceiling",
      name: "Ceiling Focused",
      description:
        "Emphasizes high ceilings with stack powers and position boosts",
      implementation: calculateCeilingNexusScore,
      results: null,
      active: true,
    },
    {
      id: "ownership",
      name: "Ownership Dominant",
      description: "Heavily weights ownership leverage with squared effect",
      implementation: calculateOwnershipNexusScore,
      results: null,
      active: true,
    },
  ]);

  const [testResults, setTestResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedLineup, setSelectedLineup] = useState(null);
  const [selectedFormula, setSelectedFormula] = useState(null);

  // Run the A/B test when requested
  const runTest = useCallback(async () => {
    if (!playerData.length || !lineups.length) {
      alert("Cannot run test: Player data or lineups are missing");
      return;
    }

    setIsCalculating(true);

    try {
      // Create a copy of lineups for testing
      const testLineups = [...lineups];

      // Apply each active formula to all lineups
      const activeFormulas = formulas.filter((f) => f.active);

      // Process in small batches to avoid locking the UI
      const results = await processFormulasBatched(
        activeFormulas,
        testLineups,
        playerData
      );

      // Update formulas with their results
      setFormulas((prevFormulas) => {
        return prevFormulas.map((formula) => {
          const resultData = results.find((r) => r.formulaId === formula.id);
          return {
            ...formula,
            results: resultData ? resultData.scores : null,
          };
        });
      });

      // Calculate comparison metrics
      const comparisonData = calculateComparisonMetrics(results, testLineups);
      setTestResults(comparisonData);
    } catch (error) {
      console.error("Error running NexusScore test:", error);
      alert(`Test failed: ${error.message}`);
    } finally {
      setIsCalculating(false);
    }
  }, [playerData, lineups, formulas]);

  // Process formulas in batches to keep UI responsive
  const processFormulasBatched = async (
    activeFormulas,
    testLineups,
    playerData
  ) => {
    return new Promise((resolve) => {
      const batchSize = 10; // Process 10 lineups at a time
      const results = activeFormulas.map((formula) => ({
        formulaId: formula.id,
        formulaName: formula.name,
        scores: [],
      }));

      let processed = 0;

      function processBatch() {
        const end = Math.min(processed + batchSize, testLineups.length);

        // Process this batch
        for (let i = processed; i < end; i++) {
          const lineup = testLineups[i];

          // Apply each formula to this lineup
          activeFormulas.forEach((formula, formulaIndex) => {
            const score = formula.implementation(lineup, playerData);
            results[formulaIndex].scores.push({
              lineupId: lineup.id,
              score: score.score,
              components: score.components,
            });
          });
        }

        processed = end;

        // If we're done, resolve
        if (processed >= testLineups.length) {
          resolve(results);
        } else {
          // Schedule next batch
          setTimeout(processBatch, 0);
        }
      }

      // Start processing
      processBatch();
    });
  };

  // Calculate comparison metrics between different formulas
  const calculateComparisonMetrics = (results, lineups) => {
    if (!results || results.length < 2) return null;

    // Calculate correlation between formulas
    const correlationMatrix = [];

    for (let i = 0; i < results.length; i++) {
      const row = [];
      for (let j = 0; j < results.length; j++) {
        if (i === j) {
          row.push(1); // Correlation with self is 1
        } else {
          // Calculate correlation between formula i and formula j
          const correlation = calculateCorrelation(
            results[i].scores.map((s) => s.score),
            results[j].scores.map((s) => s.score)
          );
          row.push(correlation);
        }
      }
      correlationMatrix.push(row);
    }

    // Calculate top lineup agreement
    const topN = Math.min(10, lineups.length);
    const topLineupAgreement = [];

    for (let i = 0; i < results.length; i++) {
      const row = [];
      for (let j = 0; j < results.length; j++) {
        if (i === j) {
          row.push(100); // Agreement with self is 100%
        } else {
          // Get top N lineups according to each formula
          const topILineups = results[i].scores
            .sort((a, b) => b.score - a.score)
            .slice(0, topN)
            .map((s) => s.lineupId);

          const topJLineups = results[j].scores
            .sort((a, b) => b.score - a.score)
            .slice(0, topN)
            .map((s) => s.lineupId);

          // Calculate overlap
          const intersection = topILineups.filter((id) =>
            topJLineups.includes(id)
          );
          const agreement = (intersection.length / topN) * 100;
          row.push(agreement);
        }
      }
      topLineupAgreement.push(row);
    }

    // Calculate distribution statistics
    const distributions = results.map((result) => {
      const scores = result.scores.map((s) => s.score);
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);

      // Calculate percentiles
      const sortedScores = [...scores].sort((a, b) => a - b);
      const p25 = sortedScores[Math.floor(sortedScores.length * 0.25)];
      const p50 = sortedScores[Math.floor(sortedScores.length * 0.5)];
      const p75 = sortedScores[Math.floor(sortedScores.length * 0.75)];

      return {
        formulaId: result.formulaId,
        formulaName: result.formulaName,
        avg,
        min,
        max,
        p25,
        p50,
        p75,
        range: max - min,
        stdDev: calculateStdDev(scores, avg),
      };
    });

    // Calculate ranking volatility - how much top rankings change
    const rankingChanges = [];

    // Get a sample of lineups
    const sampleSize = Math.min(30, lineups.length);
    const sampleLineups = lineups.slice(0, sampleSize);

    for (let i = 0; i < results.length; i++) {
      const row = [];
      for (let j = 0; j < results.length; j++) {
        if (i === j) {
          row.push(0); // No change with self
        } else {
          // Get all rankings according to each formula
          const rankingsI = getRankings(results[i].scores);
          const rankingsJ = getRankings(results[j].scores);

          // Average absolute rank change
          let totalChange = 0;
          let count = 0;

          sampleLineups.forEach((lineup) => {
            const rankI = rankingsI[lineup.id] || 0;
            const rankJ = rankingsJ[lineup.id] || 0;
            totalChange += Math.abs(rankI - rankJ);
            count++;
          });

          const avgChange = count > 0 ? totalChange / count : 0;
          row.push(avgChange);
        }
      }
      rankingChanges.push(row);
    }

    return {
      formulaNames: results.map((r) => r.formulaName),
      formulaIds: results.map((r) => r.formulaId),
      correlationMatrix,
      topLineupAgreement,
      distributions,
      rankingChanges,
      timestamp: new Date().toISOString(),
    };
  };

  // Helper to get all lineup rankings
  const getRankings = (scores) => {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const rankings = {};

    sorted.forEach((item, index) => {
      rankings[item.lineupId] = index + 1;
    });

    return rankings;
  };

  // Calculate standard deviation
  const calculateStdDev = (values, mean) => {
    const squaredDiffs = values.map((x) => Math.pow(x - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  };

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x, y) => {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate covariance and variances
    let covariance = 0;
    let xVariance = 0;
    let yVariance = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      covariance += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }

    // Calculate correlation
    if (xVariance === 0 || yVariance === 0) return 0;
    return covariance / (Math.sqrt(xVariance) * Math.sqrt(yVariance));
  };

  // Toggle a formula's active state
  const toggleFormulaActive = (formulaId) => {
    setFormulas((prev) =>
      prev.map((f) => (f.id === formulaId ? { ...f, active: !f.active } : f))
    );
  };

  // View a specific lineup with all formula scores
  const viewLineupComparison = (lineupId) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    if (!lineup) return;

    setSelectedLineup(lineup);
  };

  // View a specific formula's details
  const viewFormulaDetails = (formulaId) => {
    const formula = formulas.find((f) => f.id === formulaId);
    if (!formula) return;

    setSelectedFormula(formula);
  };

  // Save a formula as the new default
  const saveAsDefault = (formulaId) => {
    const formula = formulas.find((f) => f.id === formulaId);
    if (!formula) return;

    // Call the parent's save handler
    if (onSaveFormula) {
      onSaveFormula(formula);
      alert(
        `Formula "${formula.name}" set as the new default NexusScore calculation`
      );
    }
  };

  // IMPLEMENTATION OF DIFFERENT NEXUSSCORE CALCULATION FORMULAS

  // Variant A: Current implementation (baseline)
  function calculateCurrentNexusScore(lineup, playerPool) {
    return calculateNexusScoreBase(lineup, playerPool, (components) => {
      const { baseProjection, leverageFactor, stackBonus, positionBonus } =
        components;
      const score =
        (baseProjection * leverageFactor + stackBonus + positionBonus) / 7;
      return Math.round(score * 10) / 10; // Round to 1 decimal
    });
  }

  // Variant B: Multiplicative approach
  function calculateMultiplicativeNexusScore(lineup, playerPool) {
    return calculateNexusScoreBase(lineup, playerPool, (components) => {
      const { baseProjection, leverageFactor, stackBonus, positionBonus } =
        components;
      // Convert bonuses to multipliers
      const stackMultiplier = 1 + stackBonus / 100;
      const positionMultiplier = 1 + positionBonus / 100;

      const score =
        (baseProjection *
          leverageFactor *
          stackMultiplier *
          positionMultiplier) /
        5;
      return Math.round(score * 10) / 10;
    });
  }

  // Variant C: Weighted components
  function calculateWeightedNexusScore(lineup, playerPool) {
    return calculateNexusScoreBase(lineup, playerPool, (components) => {
      const {
        baseProjection,
        leverageFactor,
        stackBonus,
        positionBonus,
        avgOwnership,
      } = components;
      const leverageValue = baseProjection * leverageFactor;

      // 60% projection, 20% leverage, 15% stacks, 5% position
      const score =
        0.6 * baseProjection +
        0.2 * (baseProjection * (leverageFactor - 1)) +
        0.15 * stackBonus +
        0.05 * positionBonus;
      return Math.round(score * 10) / 10;
    });
  }

  // Variant D: Ceiling focused
  function calculateCeilingNexusScore(lineup, playerPool) {
    return calculateNexusScoreBase(lineup, playerPool, (components) => {
      const {
        baseProjection,
        leverageFactor,
        stackBonus,
        positionBonus,
        consistencyFactor,
      } = components;

      // Emphasis on high ceilings with boosted stacks and positions
      const score =
        (baseProjection * leverageFactor +
          Math.pow(stackBonus, 1.5) +
          positionBonus * 1.5 -
          consistencyFactor * 0.2) /
        6;

      return Math.round(score * 10) / 10;
    });
  }

  // Variant E: Ownership dominant
  function calculateOwnershipNexusScore(lineup, playerPool) {
    return calculateNexusScoreBase(lineup, playerPool, (components) => {
      const { baseProjection, leverageFactor, stackBonus, avgOwnership } =
        components;

      // Heavy weight on ownership leverage with non-linear scaling
      const leverageBonus =
        baseProjection * Math.pow(Math.max(0, leverageFactor - 1), 1.5) * 3;

      const score = (baseProjection + leverageBonus + stackBonus * 0.5) / 6;
      return Math.round(score * 10) / 10;
    });
  }

  // Base calculation function that extracts common components
  function calculateNexusScoreBase(lineup, playerPool, scoreFormula) {
    // If no lineup or player pool, return 0
    if (!lineup || !playerPool || playerPool.length === 0) {
      return { score: 0, components: {} };
    }

    // 1. Calculate base projection (sum of all players' projected points)
    let baseProjection = 0;
    let totalOwnership = 0;
    let playerCount = 0;

    // Captain's points (1.5x)
    const cptPlayer = playerPool.find((p) => p.id === lineup.cpt?.id);
    if (cptPlayer) {
      baseProjection += safeParseFloat(cptPlayer.projectedPoints, 0) * 1.5;
      totalOwnership += safeParseFloat(cptPlayer.ownership, 0);
      playerCount++;
    }

    // Regular players' points
    for (const player of lineup.players || []) {
      const poolPlayer = playerPool.find((p) => p.id === player.id);
      if (poolPlayer) {
        baseProjection += safeParseFloat(poolPlayer.projectedPoints, 0);
        totalOwnership += safeParseFloat(poolPlayer.ownership, 0);
        playerCount++;
      }
    }

    // 2. Calculate ownership leverage
    const avgOwnership = playerCount > 0 ? totalOwnership / playerCount : 0;

    // Calculate average field ownership (this could be more accurate with real field data)
    const fieldAvgOwnership =
      playerPool.reduce((sum, p) => sum + safeParseFloat(p.ownership, 0), 0) /
      Math.max(1, playerPool.length);

    // Leverage factor - reward lineups with lower ownership
    // Scale: 0.5 at 2x avg ownership, 1.5 at 0.5x avg ownership
    const ownershipRatio =
      fieldAvgOwnership > 0 ? avgOwnership / fieldAvgOwnership : 1;
    const leverageFactor = Math.max(0.5, Math.min(1.5, 2 - ownershipRatio));

    // 3. Team stacking bonus
    const teamCounts = {};

    // Count captain's team
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = 1;
    }

    // Count regular players' teams
    for (const player of lineup.players || []) {
      if (player && player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    }

    // Calculate stack bonus
    let stackBonus = 0;
    const stackInfo = [];

    for (const [team, count] of Object.entries(teamCounts)) {
      // Bonus for larger stacks
      if (count >= 2) {
        // Exponential bonus: 2-stack=1, 3-stack=3, 4-stack=6, 5-stack=10
        stackBonus += Math.pow(count - 1, 1.5);
        stackInfo.push(`${team} (${count})`);
      }
    }

    // 4. Position impact weighting
    let positionBonus = 0;

    // Position impact values
    const positionImpact = {
      MID: 2.0, // High carry potential
      ADC: 1.8, // High carry potential
      JNG: 1.5, // Game influence
      TOP: 1.2, // Moderate impact
      SUP: 1.0, // Lower ceiling
      TEAM: 0.8, // Consistent but limited upside
    };

    // Check captain's position impact
    if (cptPlayer) {
      const posImpact = positionImpact[cptPlayer.position] || 1;
      positionBonus += (posImpact - 1) * 2; // Double impact for captain
    }

    // Check position distribution
    const positions = {};
    (lineup.players || []).forEach((player) => {
      if (player.position) {
        positions[player.position] = (positions[player.position] || 0) + 1;
      }
    });

    for (const [pos, count] of Object.entries(positions)) {
      const posValue = positionImpact[pos] || 1;
      if (posValue > 1) {
        positionBonus += (posValue - 1) * count * 0.5;
      }
    }

    // 5. Consistency factor (placeholder - would be better with real variance data)
    let consistencyFactor = 1;

    // Build components object
    const components = {
      baseProjection,
      leverageFactor,
      avgOwnership,
      fieldAvgOwnership,
      stackBonus,
      positionBonus,
      consistencyFactor,
      teamStacks: stackInfo.join(", "),
    };

    // Apply the specific formula calculation
    const score = scoreFormula(components);

    return {
      score,
      components,
    };
  }

  // Safe parsing of float values
  function safeParseFloat(value, fallback = 0) {
    if (value == null) return fallback;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }

  return (
    <div className="nexus-score-tester">
      <div className="card">
        <h2 className="card-title">NexusScore A/B Testing</h2>

        <div
          className="grid grid-cols-2"
          style={{ gap: "1.5rem", marginBottom: "1.5rem" }}
        >
          <div className="formula-selection">
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Test Formulations
            </h3>

            <div className="formulas-list">
              {formulas.map((formula) => (
                <div
                  key={formula.id}
                  className="formula-card"
                  style={{
                    padding: "1rem",
                    marginBottom: "0.75rem",
                    border: `1px solid ${
                      formula.active ? "#4fd1c5" : "#2d3748"
                    }`,
                    borderRadius: "0.5rem",
                    backgroundColor: formula.active
                      ? "rgba(79, 209, 197, 0.1)"
                      : "transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h4
                      style={{
                        color: formula.active ? "#4fd1c5" : "#a0aec0",
                        margin: 0,
                      }}
                    >
                      {formula.name}
                    </h4>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formula.active}
                        onChange={() => toggleFormulaActive(formula.id)}
                        style={{ marginRight: "0.5rem" }}
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  <p
                    style={{
                      color: "#90cdf4",
                      fontSize: "0.875rem",
                      margin: "0.5rem 0",
                    }}
                  >
                    {formula.description}
                  </p>

                  {formula.results && (
                    <div style={{ fontSize: "0.875rem", color: "#e2e8f0" }}>
                      Calculated: {formula.results.length} lineups
                    </div>
                  )}
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
              <button
                className={`btn ${
                  isCalculating ? "btn-disabled" : "btn-primary"
                }`}
                onClick={runTest}
                disabled={isCalculating}
              >
                {isCalculating ? "Calculating..." : "Run A/B Test"}
              </button>

              {testResults && (
                <button
                  className="btn"
                  style={{ backgroundColor: "#805ad5", color: "white" }}
                  onClick={() => {
                    const dataStr = JSON.stringify(testResults, null, 2);
                    const dataUri =
                      "data:application/json;charset=utf-8," +
                      encodeURIComponent(dataStr);
                    const downloadAnchorNode = document.createElement("a");
                    downloadAnchorNode.setAttribute("href", dataUri);
                    downloadAnchorNode.setAttribute(
                      "download",
                      "nexusscore-test-results.json"
                    );
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                  }}
                >
                  Export Results
                </button>
              )}
            </div>
          </div>

          <div className="test-results">
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Test Results
            </h3>

            {testResults ? (
              <div className="results-container">
                <div className="stat-card">
                  <h4 style={{ color: "#90cdf4", marginBottom: "0.5rem" }}>
                    Formula Correlation Matrix
                  </h4>
                  <div
                    className="correlation-matrix"
                    style={{ overflowX: "auto" }}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th style={{ color: "#4fd1c5" }}>Formula</th>
                          {testResults.formulaNames.map((name) => (
                            <th key={name} style={{ color: "#4fd1c5" }}>
                              {name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.correlationMatrix.map((row, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: "bold" }}>
                              {testResults.formulaNames[i]}
                            </td>
                            {row.map((value, j) => (
                              <td
                                key={j}
                                style={{
                                  backgroundColor: `rgba(79, 209, 197, ${Math.abs(
                                    value
                                  )})`,
                                  color: value >= 0 ? "#e2e8f0" : "#f56565",
                                }}
                              >
                                {value.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="stat-card" style={{ marginTop: "1.5rem" }}>
                  <h4 style={{ color: "#90cdf4", marginBottom: "0.5rem" }}>
                    Top 10 Lineup Agreement (%)
                  </h4>
                  <div
                    className="agreement-matrix"
                    style={{ overflowX: "auto" }}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th style={{ color: "#4fd1c5" }}>Formula</th>
                          {testResults.formulaNames.map((name) => (
                            <th key={name} style={{ color: "#4fd1c5" }}>
                              {name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.topLineupAgreement.map((row, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: "bold" }}>
                              {testResults.formulaNames[i]}
                            </td>
                            {row.map((value, j) => (
                              <td
                                key={j}
                                style={{
                                  backgroundColor: `rgba(79, 209, 197, ${
                                    value / 100
                                  })`,
                                  color: "#e2e8f0",
                                }}
                              >
                                {value.toFixed(0)}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="stat-card" style={{ marginTop: "1.5rem" }}>
                  <h4 style={{ color: "#90cdf4", marginBottom: "0.5rem" }}>
                    Score Distributions
                  </h4>
                  <div style={{ height: "250px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={testResults.distributions}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                        <XAxis dataKey="formulaName" stroke="#90cdf4" />
                        <YAxis stroke="#90cdf4" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1a365d",
                            border: "1px solid #2c5282",
                            color: "white",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="p25"
                          name="25th Percentile"
                          fill="#f56565"
                        />
                        <Bar dataKey="p50" name="Median" fill="#3182ce" />
                        <Bar
                          dataKey="p75"
                          name="75th Percentile"
                          fill="#38b2ac"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem" }}>
                  <h4 style={{ color: "#90cdf4", marginBottom: "0.5rem" }}>
                    Set as Default Formula
                  </h4>
                  <div
                    style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                  >
                    {testResults.formulaIds.map((id, index) => (
                      <button
                        key={id}
                        className="btn"
                        style={{
                          backgroundColor: "transparent",
                          border: "1px solid #4fd1c5",
                          color: "#4fd1c5",
                        }}
                        onClick={() => saveAsDefault(id)}
                      >
                        Use {testResults.formulaNames[index]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="empty-state"
                style={{ textAlign: "center", padding: "3rem 0" }}
              >
                <p>
                  Run the A/B test to see results comparing different NexusScore
                  formulations.
                </p>
                <p
                  style={{
                    color: "#90cdf4",
                    marginTop: "1rem",
                    fontSize: "0.875rem",
                  }}
                >
                  The test will evaluate all active formulas against your
                  current lineup data.
                </p>
              </div>
            )}
          </div>
        </div>

        {selectedLineup && (
          <div className="comparison-card" style={{ marginTop: "1.5rem" }}>
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Lineup Comparison
            </h3>
            {/* Lineup comparison UI would go here */}
            <button
              className="btn"
              style={{
                backgroundColor: "transparent",
                border: "1px solid #90cdf4",
                color: "#90cdf4",
              }}
              onClick={() => setSelectedLineup(null)}
            >
              Close
            </button>
          </div>
        )}

        {selectedFormula && (
          <div className="formula-detail-card" style={{ marginTop: "1.5rem" }}>
            <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
              Formula Details: {selectedFormula.name}
            </h3>
            {/* Formula detail UI would go here */}
            <button
              className="btn"
              style={{
                backgroundColor: "transparent",
                border: "1px solid #90cdf4",
                color: "#90cdf4",
              }}
              onClick={() => setSelectedFormula(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NexusScoreTester;
