import React from "react";
import { useApp } from "../../contexts/AppContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLineup } from "../../contexts/LineupContext";
import { useNotification } from "../../contexts/NotificationContext";
// import { playerService, teamService, lineupService } from "../../services";

const UploadPage = () => {
  const { setIsLoading, importMethod, setImportMethod, setActiveTab } =
    useApp();
  const { playerData, setPlayerData, stackData, setStackData } = usePlayer();
  const { lineups, setLineups } = useLineup();
  const { displayNotification } = useNotification();

  /**
   * Read a preview of the file contents
   */
  const readFilePreview = (file, maxChars = 1000) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        resolve(content.slice(0, maxChars));
      };
      reader.onerror = (error) => {
        reject(new Error(`Error reading file: ${error.message}`));
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop().toLowerCase();
    let isLolFormat = false;

    try {
      setIsLoading(true);
      displayNotification(`Processing ${file.name}...`);

      let endpoint;
      let successMessage = "";

      // Check file format first
      if (fileExt === "csv") {
        // Preview file content to detect format
        const fileContent = await readFilePreview(file, 2000);

        // Improved detection logic - more specific identification of file types
        const isDraftKingsFile =
          fileContent.includes("Entry ID") &&
          (fileContent.includes("Contest ID") ||
            fileContent.includes("Contest Name"));

        const isDraftKingsSalariesFile =
          fileContent.includes("Position") &&
          fileContent.includes("Name + ID") &&
          fileContent.includes("Salary") &&
          fileContent.includes("TeamAbbrev");

        const isRooProjectionsFile =
          fileContent.includes("Median") &&
          (fileContent.includes("Floor") || fileContent.includes("Ceiling"));

        const isStacksFile =
          fileContent.includes("Stack+") ||
          (fileContent.includes("Team") && fileContent.includes("Stack")) ||
          fileContent.includes("Fantasy");

        // Check for LoL format as a fallback
        isLolFormat =
          fileContent.includes("TOP") &&
          fileContent.includes("JNG") &&
          fileContent.includes("MID") &&
          fileContent.includes("ADC") &&
          fileContent.includes("SUP");

        // Set endpoint based on detected file type
        if (isRooProjectionsFile) {
          displayNotification(
            "Detected ROO format with player projections",
            "info"
          );
          endpoint = "/players/projections/upload";
          successMessage = "Player projections uploaded successfully!";
        } else if (isStacksFile) {
          displayNotification("Detected team stacks file", "info");
          endpoint = "/teams/stacks/upload";
          successMessage = "Team stacks uploaded successfully!";
        } else if (isDraftKingsSalariesFile || importMethod === "dkSalaries") {
          displayNotification(
            "Importing DraftKings salaries and player IDs",
            "info"
          );
          endpoint = "/draftkings/import";
          successMessage = "DraftKings salaries imported successfully!";
        } else if (isDraftKingsFile || importMethod === "dkImport") {
          displayNotification(
            "Importing DraftKings contest data and player IDs",
            "info"
          );
          endpoint = "/draftkings/import";
          successMessage = "DraftKings contest data imported successfully!";
        } else if (isLolFormat) {
          if (importMethod === "dkImport") {
            displayNotification(
              "Importing DraftKings contest data and player IDs",
              "info"
            );
            endpoint = "/draftkings/import";
            successMessage = "DraftKings contest data imported successfully!";
          } else {
            displayNotification(
              "Detected League of Legends DraftKings format",
              "info"
            );
            endpoint = "/lineups/dkentries";
            successMessage = "DraftKings entries uploaded successfully!";
          }
        } else {
          // If we can't detect the file type, show error
          displayNotification(
            "Unknown CSV file type. Unable to process the file.",
            "warning"
          );
          setIsLoading(false);
          return;
        }
      } else if (fileExt === "json") {
        endpoint = "/lineups/import";
        successMessage = "Lineups imported successfully!";
      } else {
        displayNotification("Unsupported file type", "error");
        setIsLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("originalFilename", file.name);
      formData.append("fileSize", file.size);
      formData.append("contentType", file.type);

      // Flag if this is LoL format
      if (endpoint.includes("dkentries") && isLolFormat) {
        formData.append("format", "lol");
      }

      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If we can't parse JSON, try text
          try {
            const errorText = await response.text();
            if (errorText) errorMessage += ` - ${errorText}`;
          } catch (textError) {
            // Ignore if we can't get text either
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (endpoint.includes("projections")) {
        // Refresh player data from the server after upload
        const playersRes = await fetch(
          `http://localhost:3001/players/projections`
        );
        if (playersRes.ok) {
          const rawPlayers = await playersRes.json();
          const processedPlayers = rawPlayers.map((player) => ({
            ...player,
            projectedPoints:
              player.projectedPoints !== undefined
                ? Number(player.projectedPoints)
                : 0,
            ownership:
              player.ownership !== undefined
                ? Number(player.ownership)
                : undefined,
          }));
          setPlayerData(processedPlayers);
        }
      } else if (endpoint.includes("stacks")) {
        // Refresh team stacks from the server after upload
        const stacksRes = await fetch(`http://localhost:3001/teams/stacks`);
        if (stacksRes.ok) {
          const stacks = await stacksRes.json();
          const enhancedStacks = stacks.map((stack) => {
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
          });
          setStackData(enhancedStacks);
        }
      }

      // Handle other upload types
      if (endpoint.includes("dkentries") || endpoint.includes("lineups")) {
        if (result.lineups && Array.isArray(result.lineups)) {
          // Add NexusScore to lineups
          const enhancedLineups = result.lineups.map((lineup) => {
            // Simulate NexusScore
            const nexusScore = Math.round(Math.random() * 50 + 70); // Random score between 70-120

            return {
              ...lineup,
              nexusScore,
            };
          });

          setLineups((prevLineups) => {
            const existingIds = new Set(prevLineups.map((l) => l.id));
            const newLineups = enhancedLineups.filter(
              (l) => !existingIds.has(l.id)
            );
            return [...prevLineups, ...newLineups];
          });
          displayNotification(`Loaded ${result.lineups.length} lineups!`);

          // Switch to the lineups tab after successful load
          setActiveTab("lineups");
        }
      }

      displayNotification(successMessage);
      setImportMethod("dkEntries");
    } catch (error) {
      console.error("Upload error:", error);
      displayNotification(`Error uploading file: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
      // Reset file input to allow uploading the same file again
      event.target.value = "";
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
