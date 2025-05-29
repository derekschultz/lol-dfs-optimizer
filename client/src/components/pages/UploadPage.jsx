import React from "react";
import { useApp } from "../../contexts/AppContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLineup } from "../../contexts/LineupContext";
import { useNotification } from "../../contexts/NotificationContext";
// import { playerService, teamService, lineupService } from "../../services";

const UploadPage = () => {
  const { setIsLoading, importMethod, setImportMethod } = useApp();
  const { playerData, setPlayerData, stackData, setStackData } = usePlayer();
  const { lineups } = useLineup();
  const { displayNotification } = useNotification();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const fileName = file.name.toLowerCase();
      let endpoint = "";
      let successMessage = "";

      if (fileName.includes("roo") || fileName.includes("projections")) {
        endpoint = "/players/projections/upload";
        successMessage = "Player projections uploaded successfully!";
      } else if (fileName.includes("stack")) {
        endpoint = "/teams/stacks/upload";
        successMessage = "Team stacks uploaded successfully!";
      } else if (
        fileName.includes("draftkings") ||
        fileName.includes("dk") ||
        importMethod === "dkImport" ||
        importMethod === "dkSalaries"
      ) {
        if (importMethod === "dkSalaries") {
          endpoint = "/players/projections/upload";
          successMessage = "DraftKings salaries uploaded successfully!";
        } else {
          endpoint = "/lineups/dkentries";
          successMessage = "DraftKings entries uploaded successfully!";
        }
      } else {
        endpoint = "/players/projections/upload";
        successMessage = "File uploaded successfully!";
      }

      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (endpoint.includes("projections")) {
        const processedPlayers =
          result.players?.map((player) => ({
            ...player,
            projectedPoints:
              player.projectedPoints !== undefined
                ? Number(player.projectedPoints)
                : 0,
            ownership:
              player.ownership !== undefined
                ? Number(player.ownership)
                : undefined,
          })) || [];
        setPlayerData(processedPlayers);
      } else if (endpoint.includes("stacks")) {
        const enhancedStacks =
          result.stacks?.map((stack) => {
            const teamPlayers = playerData.filter((p) => p.team === stack.team);
            const totalProjection = teamPlayers.reduce(
              (sum, p) => sum + (p.projectedPoints || 0),
              0
            );

            return {
              ...stack,
              totalProjection,
              poolExposure:
                teamPlayers.reduce((sum, p) => sum + (p.ownership || 0), 0) /
                Math.max(1, teamPlayers.length),
              status: "—",
            };
          }) || [];
        setStackData(enhancedStacks);
      }

      displayNotification(successMessage);
      setImportMethod("dkEntries");
    } catch (error) {
      console.error("Upload error:", error);
      displayNotification(`Error uploading file: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2">
        <div className="card">
          <h2 className="card-title">Import Player/Stack Data</h2>
          <div>
            <label className="form-label">Player Projections (ROO CSV)</label>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
          <div style={{ marginTop: "15px" }}>
            <label className="form-label">Team Stacks (Stacks CSV)</label>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Import DraftKings Data</h2>
          <div>
            <label className="form-label">
              DraftKings Contest CSV (Contest + Entry IDs)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                setImportMethod("dkImport");
                handleFileUpload(e);
              }}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label className="form-label">DraftKings Salaries CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                setImportMethod("dkSalaries");
                handleFileUpload(e);
              }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Data Status</h2>
        <div className="grid grid-cols-3">
          <div className="stat-card">
            <h3 style={{ color: "#90cdf4" }}>Player Projections</h3>
            <p className="stat-value">{playerData.length}</p>
            <p className="stat-label">players loaded</p>
          </div>
          <div className="stat-card">
            <h3 style={{ color: "#90cdf4" }}>Team Stacks</h3>
            <p className="stat-value">{stackData.length}</p>
            <p className="stat-label">teams loaded</p>
          </div>
          <div className="stat-card">
            <h3 style={{ color: "#90cdf4" }}>Lineups</h3>
            <p className="stat-value">{lineups.length}</p>
            <p className="stat-label">lineups loaded</p>
          </div>
        </div>
      </div>

      {/* Stack+ Ratings Display */}
      {stackData.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ color: "#90cdf4", marginBottom: "1rem" }}>
            Stack+ Ratings
          </h3>
          <div
            className="table-container"
            style={{ maxHeight: "400px", overflowY: "auto" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #4a5568" }}>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      color: "#90cdf4",
                    }}
                  >
                    Team
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "#90cdf4",
                    }}
                  >
                    Stack+
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "#90cdf4",
                    }}
                  >
                    Stack+ All Wins
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "#90cdf4",
                    }}
                  >
                    Stack+ All Losses
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "#90cdf4",
                    }}
                  >
                    Rating Tier
                  </th>
                </tr>
              </thead>
              <tbody>
                {stackData
                  .sort((a, b) => (b.stackPlus || 0) - (a.stackPlus || 0))
                  .map((stack, index) => {
                    const rating = stack.stackPlus || 0;
                    let tier = "Poor";
                    let tierColor = "#ef4444";

                    if (rating >= 200) {
                      tier = "Elite";
                      tierColor = "#10b981";
                    } else if (rating >= 150) {
                      tier = "Very Strong";
                      tierColor = "#34d399";
                    } else if (rating >= 100) {
                      tier = "Strong";
                      tierColor = "#60a5fa";
                    } else if (rating >= 50) {
                      tier = "Above Average";
                      tierColor = "#93c5fd";
                    } else if (rating >= 20) {
                      tier = "Slightly Above";
                      tierColor = "#cbd5e1";
                    } else if (rating >= 10) {
                      tier = "Average";
                      tierColor = "#94a3b8";
                    } else if (rating >= 5) {
                      tier = "Below Average";
                      tierColor = "#f59e0b";
                    }

                    return (
                      <tr
                        key={index}
                        style={{ borderBottom: "1px solid #4a5568" }}
                      >
                        <td style={{ padding: "12px", color: "#e2e8f0" }}>
                          {stack.team}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#e2e8f0",
                          }}
                        >
                          {stack.stackPlus?.toFixed(2) || "0.00"}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#10b981",
                          }}
                        >
                          {stack.stackPlusAllWins?.toFixed(2) || "0.00"}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#ef4444",
                          }}
                        >
                          {stack.stackPlusAllLosses?.toFixed(2) || "0.00"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <span
                            style={{
                              backgroundColor: tierColor + "20",
                              color: tierColor,
                              padding: "4px 12px",
                              borderRadius: "12px",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                            }}
                          >
                            {tier}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
