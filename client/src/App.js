import React, { useState, useEffect } from "react";
import "./blue-theme.css";
import "./slider-styles.css";
import OptimizerPage from "./pages/OptimizerPage";
import LineupList from "./components/LineupList";
import NexusScoreTestPage from "./pages/NexusScoreTestPage";
import HybridOptimizerUI from "./components/HybridOptimizerUI";
import PlayerManagerUI from "./components/PlayerManagerUI";
import AIInsights from "./components/AIInsights";

const App = () => {
  // API base URL - this matches the port in our server.js
  const API_BASE_URL = "http://localhost:3001";
  const AI_API_BASE_URL = "http://localhost:3002";

  // State variables
  const [lineups, setLineups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [playerData, setPlayerData] = useState([]);
  const [stackData, setStackData] = useState([]);
  const [importMethod, setImportMethod] = useState("dkEntries");
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("success");

  // Add exposure settings state to store at App level for persistence
  const [exposureSettings, setExposureSettings] = useState({
    global: {
      globalMinExposure: 0,
      globalMaxExposure: 60,
      applyToNewLineups: true,
      prioritizeProjections: true,
    },
    players: [],
    teams: [],
    positions: {
      TOP: { min: 0, max: 100, target: null },
      JNG: { min: 0, max: 100, target: null },
      MID: { min: 0, max: 100, target: null },
      ADC: { min: 0, max: 100, target: null },
      SUP: { min: 0, max: 100, target: null },
      CPT: { min: 0, max: 100, target: null },
    },
  });

  // Function to show notification
  const displayNotification = (message, type = "success") => {
    setNotificationMessage(message);
    setNotificationType(type);
    setIsNotificationVisible(true);
    setTimeout(() => {
      setIsNotificationVisible(false);
    }, 3000);
  };

  // Initialize exposure settings when player data is loaded
  useEffect(() => {
    if (playerData.length > 0 && exposureSettings.players.length === 0) {
      // Only initialize if we don't already have player exposure settings
      const initialPlayerExposures = playerData.map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        salary: player.salary,
        projectedPoints: player.projectedPoints,
        ownership: player.ownership,
        min: exposureSettings.global.globalMinExposure,
        max: exposureSettings.global.globalMaxExposure,
        target: null,
        actual: 0,
      }));

      // Extract unique teams
      const teams = [
        ...new Set(playerData.map((player) => player.team)),
      ].filter(Boolean);
      const initialTeamExposures = teams.map((team) => ({
        team,
        min: 0,
        max: 100,
        target: null,
        actual: 0,
      }));

      // Update exposure settings with the initialized data
      setExposureSettings((prev) => ({
        ...prev,
        players: initialPlayerExposures,
        teams: initialTeamExposures,
      }));
    }
  }, [playerData, exposureSettings.global, exposureSettings.players.length]);

  // Recalculate actual exposures when lineups change
  useEffect(() => {
    if (lineups.length > 0 && exposureSettings.players.length > 0) {
      // Calculate player exposures
      const playerExposureMap = new Map();
      const teamExposureMap = new Map();
      const positionExposureMap = new Map();
      
      // Count occurrences
      lineups.forEach(lineup => {
        // Count captain
        if (lineup.cpt) {
          const key = `${lineup.cpt.name}_${lineup.cpt.team}`;
          playerExposureMap.set(key, (playerExposureMap.get(key) || 0) + 1);
          teamExposureMap.set(lineup.cpt.team, (teamExposureMap.get(lineup.cpt.team) || 0) + 1);
          positionExposureMap.set('CPT', (positionExposureMap.get('CPT') || 0) + 1);
        }
        
        // Count regular players
        if (lineup.players) {
          lineup.players.forEach(player => {
            const key = `${player.name}_${player.team}`;
            playerExposureMap.set(key, (playerExposureMap.get(key) || 0) + 1);
            teamExposureMap.set(player.team, (teamExposureMap.get(player.team) || 0) + 1);
            positionExposureMap.set(player.position, (positionExposureMap.get(player.position) || 0) + 1);
          });
        }
      });
      
      // Update exposure settings with actual values
      setExposureSettings(prev => ({
        ...prev,
        players: prev.players.map(player => {
          const key = `${player.name}_${player.team}`;
          const count = playerExposureMap.get(key) || 0;
          const actual = (count / lineups.length) * 100;
          return { ...player, actual };
        }),
        teams: prev.teams.map(team => {
          const count = teamExposureMap.get(team.team) || 0;
          const actual = (count / lineups.length) * 100;
          return { ...team, actual };
        }),
        positions: Object.fromEntries(
          Object.entries(prev.positions).map(([pos, settings]) => {
            const count = positionExposureMap.get(pos) || 0;
            const actual = (count / lineups.length) * 100;
            return [pos, { ...settings, actual }];
          })
        )
      }));
    }
  }, [lineups]); // Recalculate whenever lineups change

  // Load all initial data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);

      try {
        // Load each data type in parallel for better performance
        const [playersRes, stacksRes, lineupsRes] =
          await Promise.all([
            fetch(`${API_BASE_URL}/players/projections`).catch((err) => {
              console.error("Error fetching player projections:", err);
              return { ok: false };
            }),
            fetch(`${API_BASE_URL}/teams/stacks`).catch((err) => {
              console.error("Error fetching team stacks:", err);
              return { ok: false };
            }),
            fetch(`${API_BASE_URL}/lineups`).catch((err) => {
              console.error("Error fetching lineups:", err);
              return { ok: false };
            }),
          ]);

        // Process player projections
        if (playersRes.ok) {
          const rawPlayers = await playersRes.json();

          // Process ROO data to set projectedPoints from Median if available
          const processedPlayers = rawPlayers.map((player) => {
            return {
              ...player,
              projectedPoints:
                player.projectedPoints !== undefined
                  ? Number(player.projectedPoints)
                  : 0,
              ownership:
                player.ownership !== undefined
                  ? Number(player.ownership)
                  : undefined,
            };
          });

          setPlayerData(processedPlayers);
        } else {
          console.error("Failed to load player projections");
        }

        // Process team stacks
        if (stacksRes.ok) {
          const stacks = await stacksRes.json();

          // Enhanced team stacks with additional data for the team stacks view
          const enhancedStacks = stacks.map((stack) => {
            // Get all players for this team
            const teamPlayers = playerData.filter((p) => p.team === stack.team);

            // Calculate total projection for the team
            const totalProjection = teamPlayers.reduce(
              (sum, p) => sum + (p.projectedPoints || 0),
              0
            );

            // Add additional properties
            return {
              ...stack,
              totalProjection,
              poolExposure:
                teamPlayers.reduce((sum, p) => sum + (p.ownership || 0), 0) /
                Math.max(1, teamPlayers.length),
              status: "—", // Default status
            };
          });

          setStackData(enhancedStacks);
        } else {
          console.error("Failed to load team stacks");
        }

        // Process lineups
        if (lineupsRes.ok) {
          const lineupsData = await lineupsRes.json();

          // Add NexusScore and ROI properties to each lineup
          const enhancedLineups = lineupsData.map((lineup) => {
            // Calculate NexusScore based on lineup data
            const allPlayers = lineup.cpt
              ? [lineup.cpt, ...(lineup.players || [])]
              : lineup.players || [];
            const teamCounts = {};

            allPlayers.forEach((player) => {
              if (player && player.team) {
                teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
              }
            });

            // Calculate total projection
            let totalProj = 0;
            if (lineup.cpt) {
              const cptPlayer = playerData.find((p) => p.id === lineup.cpt.id);
              const cptProj = cptPlayer?.projectedPoints || 0;
              totalProj += cptProj * 1.5; // CPT gets 1.5x
            }

            // Add regular players' projections
            totalProj += (lineup.players || [])
              .map((p) => {
                const fullPlayer = playerData.find((fp) => fp.id === p.id);
                return fullPlayer?.projectedPoints || p.projectedPoints || 0;
              })
              .reduce((sum, proj) => sum + proj, 0);

            // Calculate average ownership
            const totalOwnership = allPlayers.reduce((sum, p) => {
              const fullPlayer = playerData.find((fp) => fp.id === p.id);
              return sum + (fullPlayer?.ownership || p.ownership || 0);
            }, 0);

            const avgOwn =
              allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

            // Calculate stack bonus
            let stackBonus = 0;
            Object.values(teamCounts).forEach((count) => {
              if (count >= 3) stackBonus += (count - 2) * 3;
            });

            // Calculate NexusScore
            const ownership = Math.max(0.1, avgOwn / 100);
            const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
            const nexusScore = (totalProj * leverageFactor + stackBonus) / 7;

            // Calculate ROI based on NexusScore
            const roi = ((nexusScore / 100) * 2 + Math.random() * 0.5).toFixed(
              2
            );

            return {
              ...lineup,
              nexusScore: Math.round(nexusScore * 10) / 10,
              roi,
            };
          });

          setLineups(enhancedLineups);
        } else {
          console.error("Failed to load lineups");
        }


        displayNotification("App data loaded successfully!");
      } catch (error) {
        console.error("Failed to initialize app data:", error);
        displayNotification("Error loading app data", "error");
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle file upload with improved file detection
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop().toLowerCase();
    let isLolFormat = false;

    try {
      setIsLoading(true);
      displayNotification(`Processing ${file.name}...`);

      let endpoint;

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
          endpoint = `${API_BASE_URL}/players/projections/upload`;
        } else if (isStacksFile) {
          displayNotification("Detected team stacks file", "info");
          endpoint = `${API_BASE_URL}/teams/stacks/upload`;
        } else if (isDraftKingsSalariesFile || importMethod === "dkSalaries") {
          displayNotification("Importing DraftKings salaries and player IDs", "info");
          endpoint = `${API_BASE_URL}/draftkings/import`;
        } else if (isDraftKingsFile || importMethod === "dkImport") {
          displayNotification("Importing DraftKings contest data and player IDs", "info");
          endpoint = `${API_BASE_URL}/draftkings/import`;
        } else if (isLolFormat) {
          if (importMethod === "dkImport") {
            displayNotification("Importing DraftKings contest data and player IDs", "info");
            endpoint = `${API_BASE_URL}/draftkings/import`;
          } else {
            displayNotification(
              "Detected League of Legends DraftKings format",
              "info"
            );
            endpoint = `${API_BASE_URL}/lineups/dkentries`;
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
        endpoint = `${API_BASE_URL}/lineups/import`;
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

      // Make the API call
      const response = await fetch(endpoint, {
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

      // Process successful response
      const result = await response.json();

      // Update state based on the endpoint
      if (endpoint.includes("draftkings/import")) {
        // Handle DraftKings import response (contest metadata + player ID mapping)
        displayNotification(
          `Imported contest data: ${result.contestMetadata?.contestName || 'Unknown'} (${result.playersWithIds}/${result.totalPlayers} players mapped)`
        );
      } else if (endpoint.includes("dkentries") || endpoint.includes("lineups")) {
        if (result.lineups && Array.isArray(result.lineups)) {
          // Add NexusScore and ROI to lineups
          const enhancedLineups = result.lineups.map((lineup) => {
            // Simulate NexusScore and ROI calculation
            const nexusScore = Math.round(Math.random() * 50 + 70); // Random score between 70-120
            const roi = (Math.random() * 2 + 0.5).toFixed(2); // Random ROI between 0.5-2.5

            return {
              ...lineup,
              nexusScore,
              roi,
            };
          });

          setLineups((prevLineups) => [...prevLineups, ...enhancedLineups]);
          displayNotification(`Loaded ${result.lineups.length} lineups!`);

          // Switch to the lineups tab after successful load
          setActiveTab("lineups");
        } else {
          displayNotification(
            "Unexpected response format for lineups",
            "error"
          );
        }
      } else if (endpoint.includes("projections")) {
        // Refresh player data
        const playersRes = await fetch(`${API_BASE_URL}/players/projections`);
        if (playersRes.ok) {
          const rawPlayers = await playersRes.json();

          const processedPlayers = rawPlayers.map((player) => {
            return {
              ...player,
              projectedPoints:
                player.projectedPoints !== undefined
                  ? Number(player.projectedPoints)
                  : 0,
              ownership:
                player.ownership !== undefined
                  ? Number(player.ownership)
                  : undefined,
            };
          });

          setPlayerData(processedPlayers);

          // Re-initialize exposure settings for new player data
          if (exposureSettings.global.applyToNewLineups) {
            const initialPlayerExposures = processedPlayers.map((player) => ({
              id: player.id,
              name: player.name,
              team: player.team,
              position: player.position,
              salary: player.salary,
              projectedPoints: player.projectedPoints,
              ownership: player.ownership,
              min: exposureSettings.global.globalMinExposure,
              max: exposureSettings.global.globalMaxExposure,
              target: null,
              actual: 0,
            }));

            // Extract unique teams
            const teams = [
              ...new Set(processedPlayers.map((player) => player.team)),
            ].filter(Boolean);
            const initialTeamExposures = teams.map((team) => ({
              team,
              min: 0,
              max: 100,
              target: null,
              actual: 0,
            }));

            // Update exposure settings with the initialized data
            setExposureSettings((prev) => ({
              ...prev,
              players: initialPlayerExposures,
              teams: initialTeamExposures,
            }));
          }
        }
        displayNotification("Player projections uploaded successfully!");
      } else if (endpoint.includes("stacks")) {
        // Refresh team stacks
        const stacksRes = await fetch(`${API_BASE_URL}/teams/stacks`);
        if (stacksRes.ok) {
          const stacks = await stacksRes.json();
          setStackData(stacks);
        }
        displayNotification("Team stacks uploaded successfully!");
      }
    } catch (error) {
      console.error("Upload error:", error);
      displayNotification(`Error uploading file: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
      // Reset file input to allow uploading the same file again
      event.target.value = "";
    }
  };

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


  // Generate lineups
  const generateLineups = async (count) => {
    try {
      setIsLoading(true);

      // Validate we have necessary data
      if (playerData.length === 0) {
        displayNotification(
          "No player projections loaded. Please upload player data first.",
          "error"
        );
        setIsLoading(false);
        return;
      }

      if (stackData.length === 0) {
        displayNotification(
          "No team stacks loaded. Please upload team stack data first.",
          "error"
        );
        setIsLoading(false);
        return;
      }

      // Validate we have run a simulation first

      // Create the lineup generation request
      const generationRequest = {
        count,
      };

      // Call the API to generate lineups
      const response = await fetch(`${API_BASE_URL}/lineups/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generationRequest),
      });

      if (!response.ok) {
        let errorMessage = `Lineup generation failed: ${response.status} ${response.statusText}`;
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

      // Get the generated lineups
      const result = await response.json();

      if (result.lineups && Array.isArray(result.lineups)) {
        // Add NexusScore and ROI to each lineup
        const enhancedLineups = result.lineups.map((lineup) => {
          const nexusScore = Math.round(Math.random() * 50 + 70); // Random score between 70-120
          const roi = (Math.random() * 2 + 0.5).toFixed(2); // Random ROI between 0.5-2.5

          return {
            ...lineup,
            nexusScore,
            roi,
          };
        });

        setLineups([...lineups, ...enhancedLineups]);
        displayNotification(`Generated ${result.lineups.length} new lineups!`);
      } else {
        throw new Error("Invalid response format for lineup generation");
      }
    } catch (error) {
      console.error("Lineup generation error:", error);
      displayNotification(
        `Error generating lineups: ${error.message}`,
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Generate optimized lineups with exposure constraints
  const generateOptimizedLineups = async (count, options = {}) => {
    try {
      setIsLoading(true);

      // Validate we have necessary data
      if (playerData.length === 0) {
        displayNotification(
          "No player projections loaded. Please upload player data first.",
          "error"
        );
        setIsLoading(false);
        return;
      }

      // Create the lineup generation request with options (including exposure settings)
      const generationRequest = {
        count,
        settings: {
          ...options,
        },
        // Always include exposure settings
        exposureSettings: options.exposureSettings || exposureSettings,
      };

      // Call the API to generate lineups
      const response = await fetch(`${API_BASE_URL}/lineups/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generationRequest),
      });

      if (!response.ok) {
        let errorMessage = `Lineup generation failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          try {
            const errorText = await response.text();
            if (errorText) errorMessage += ` - ${errorText}`;
          } catch (textError) {
            // Ignore if we can't get text either
          }
        }
        throw new Error(errorMessage);
      }

      // Get the generated lineups
      const result = await response.json();

      if (result.lineups && Array.isArray(result.lineups)) {
        // Add NexusScore and ROI to each lineup
        const enhancedLineups = result.lineups.map((lineup) => {
          // Calculate NexusScore based on lineup data
          const allPlayers = lineup.cpt
            ? [lineup.cpt, ...(lineup.players || [])]
            : lineup.players || [];
          const teamCounts = {};

          allPlayers.forEach((player) => {
            if (player && player.team) {
              teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
            }
          });

          // Calculate total projection
          let totalProj = 0;
          if (lineup.cpt) {
            const cptPlayer = playerData.find((p) => p.id === lineup.cpt.id);
            const cptProj = cptPlayer?.projectedPoints || 0;
            totalProj += cptProj * 1.5; // CPT gets 1.5x
          }

          // Add regular players' projections
          totalProj += (lineup.players || [])
            .map((p) => {
              const fullPlayer = playerData.find((fp) => fp.id === p.id);
              return fullPlayer?.projectedPoints || p.projectedPoints || 0;
            })
            .reduce((sum, proj) => sum + proj, 0);

          // Calculate average ownership
          const totalOwnership = allPlayers.reduce((sum, p) => {
            const fullPlayer = playerData.find((fp) => fp.id === p.id);
            return sum + (fullPlayer?.ownership || p.ownership || 0);
          }, 0);

          const avgOwn =
            allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

          // Calculate stack bonus
          let stackBonus = 0;
          Object.values(teamCounts).forEach((count) => {
            if (count >= 3) stackBonus += (count - 2) * 3;
          });

          // Calculate NexusScore
          const ownership = Math.max(0.1, avgOwn / 100);
          const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
          const nexusScore = (totalProj * leverageFactor + stackBonus) / 7;

          // Calculate ROI as a percentage (can be negative)
          const roi = (
            (nexusScore / 100) * 200 -
            100 +
            Math.random() * 50
          ).toFixed(2);

          return {
            ...lineup,
            nexusScore: Math.round(nexusScore * 10) / 10,
            roi,
          };
        });

        setLineups([...lineups, ...enhancedLineups]);
        displayNotification(`Generated ${result.lineups.length} new lineups!`);

        // Switch to lineups tab after generation
        setActiveTab("lineups");
        return enhancedLineups;
      } else {
        throw new Error("Invalid response format for lineup generation");
      }
    } catch (error) {
      console.error("Lineup generation error:", error);
      displayNotification(
        `Error generating lineups: ${error.message}`,
        "error"
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Export lineups to CSV or JSON
  const exportLineups = async (format = "csv") => {
    try {
      if (lineups.length === 0) {
        displayNotification("No lineups to export", "error");
        return;
      }

      setIsLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/lineups/export?format=${format}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lineups }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Export failed: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `lol-dfs-lineups-${
        new Date().toISOString().split("T")[0]
      }.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      displayNotification(
        `Lineups exported successfully as ${format.toUpperCase()}`
      );
    } catch (error) {
      console.error("Export error:", error);
      displayNotification(`Error exporting lineups: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle exposure settings updates
  const handleExposureUpdate = (newExposureSettings) => {
    try {
      // Create a completely new, clean object without any references to the original
      const cleanSettings = {
        global: {
          globalMinExposure:
            typeof newExposureSettings.global?.globalMinExposure === "number"
              ? newExposureSettings.global.globalMinExposure
              : 0,
          globalMaxExposure:
            typeof newExposureSettings.global?.globalMaxExposure === "number"
              ? newExposureSettings.global.globalMaxExposure
              : 60,
          applyToNewLineups: Boolean(
            newExposureSettings.global?.applyToNewLineups
          ),
          prioritizeProjections: Boolean(
            newExposureSettings.global?.prioritizeProjections
          ),
        },
        teams: Array.isArray(newExposureSettings.teams)
          ? newExposureSettings.teams.map((team) => ({
              team: String(team.team || ""),
              // Preserve stackSize if it exists
              ...(team.stackSize !== undefined
                ? { stackSize: Number(team.stackSize) }
                : {}),
              min:
                team.min === null || team.min === "" ? null : Number(team.min),
              max:
                team.max === null || team.max === "" ? null : Number(team.max),
              target:
                team.target === null || team.target === ""
                  ? null
                  : Number(team.target),
              actual: Number(team.actual) || 0,
            }))
          : [],
        players: Array.isArray(newExposureSettings.players)
          ? newExposureSettings.players.map((player) => {
              return {
                id: String(player.id || ""),
                name: String(player.name || ""),
                team: String(player.team || ""),
                position: String(player.position || ""),
                salary: Number(player.salary) || 0,
                projectedPoints:
                  player.projectedPoints !== undefined
                    ? Number(player.projectedPoints)
                    : 0,
                ownership:
                  player.ownership !== undefined
                    ? Number(player.ownership)
                    : undefined,
                min:
                  player.min === null || player.min === ""
                    ? null
                    : Number(player.min),
                max:
                  player.max === null || player.max === ""
                    ? null
                    : Number(player.max),
                target:
                  player.target === null || player.target === ""
                    ? null
                    : Number(player.target),
                actual: Number(player.actual) || 0,
              };
            })
          : [],
        positions: newExposureSettings.positions
          ? Object.fromEntries(
              Object.entries(newExposureSettings.positions).map(
                ([position, settings]) => [
                  position,
                  {
                    min:
                      settings.min === null || settings.min === ""
                        ? null
                        : Number(settings.min),
                    max:
                      settings.max === null || settings.max === ""
                        ? null
                        : Number(settings.max),
                    target:
                      settings.target === null || settings.target === ""
                        ? null
                        : Number(settings.target),
                  },
                ]
              )
            )
          : {},
        _isManualSave: Boolean(newExposureSettings._isManualSave),
      };

      // Update state with the clean settings
      setExposureSettings(cleanSettings);

      // Send to backend if it's a manual save
      const isManualSave = newExposureSettings._isManualSave;
      if (isManualSave) {
        // Use a more robust fetch with timeout and better error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        fetch(`${API_BASE_URL}/settings/exposure`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cleanSettings),
          signal: controller.signal,
        })
          .then((response) => {
            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(
                `Server returned ${response.status}: ${response.statusText}`
              );
            }
            return response.text().then((text) => {
              // Try to parse as JSON if it looks like JSON
              if (text && text.trim().startsWith("{")) {
                try {
                  return JSON.parse(text);
                } catch (e) {
                  return text;
                }
              }
              return text;
            });
          })
          .then(() => {
            displayNotification("Exposure settings saved successfully!");
          })
          .catch((error) => {
            console.error("Backend save error:", error.toString());
            if (error.name === "AbortError") {
              displayNotification(
                "Settings saved locally (server timeout)",
                "warning"
              );
            } else {
              displayNotification(
                "Settings saved locally (server error)",
                "warning"
              );
            }
          });
      }
    } catch (error) {
      console.error("Critical error in handleExposureUpdate:", error);
      displayNotification("Error updating settings", "error");
    }
  };

  // Handle edit lineup
  const handleEditLineup = (lineup) => {
    console.log("Editing lineup:", lineup);
    displayNotification("Lineup editing coming soon!", "info");
  };

  // Handle delete lineup
  const handleDeleteLineup = async (lineup) => {
    try {
      console.log("Deleting lineup with ID:", lineup.id);

      // Optimistically remove from UI
      setLineups(lineups.filter((l) => l.id !== lineup.id));

      // Call API to delete from server
      const response = await fetch(`${API_BASE_URL}/lineups/${lineup.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Delete lineup error:", errorText);
        displayNotification("Lineup deleted locally (server error)", "warning");
        return;
      }

      displayNotification("Lineup deleted successfully!");
    } catch (error) {
      console.error("Error deleting lineup:", error);
      displayNotification(`Lineup removed locally (${error.message})`, "error");
    }
  };

  // Handle player data updates (when players are deleted)
  const handlePlayersUpdated = (updatedPlayers) => {
    setPlayerData(updatedPlayers);
    
    // Update exposure settings to remove deleted players
    if (exposureSettings.players.length > 0) {
      const updatedPlayerIds = new Set(updatedPlayers.map(p => p.id));
      const filteredPlayerExposures = exposureSettings.players.filter(
        playerExp => updatedPlayerIds.has(playerExp.id)
      );
      
      setExposureSettings(prev => ({
        ...prev,
        players: filteredPlayerExposures
      }));
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="container">
          <h1 className="app-title">LoL DFS Optimizer</h1>
          <p className="app-subtitle">
            Advanced Monte Carlo simulation and optimization for League of
            Legends DFS
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
        {/* Tabs */}
        <div className="tabs-container">
          <ul style={{ listStyle: "none" }}>
            {["upload", "players", "lineups", "ai-insights", "hybrid", "optimizer", "nexustest"].map((tab) => (
              <li key={tab} style={{ display: "inline-block" }}>
                <button
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "players"
                    ? "Player Management"
                    : tab === "ai-insights"
                    ? "AI Insights"
                    : tab === "hybrid"
                    ? "Hybrid Optimizer v2.0"
                    : tab === "optimizer"
                    ? "Advanced Optimizer (Legacy)"
                    : tab === "nexustest"
                    ? "NexusScore Test"
                    : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div>
            <div className="grid grid-cols-2">
              <div className="card">
                <h2 className="card-title">Import Player/Stack Data</h2>
                <div>
                  <label className="form-label">
                    Player Projections (ROO CSV)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                  />
                </div>
                <div style={{ marginTop: '15px' }}>
                  <label className="form-label">Team Stacks (Stacks CSV)</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              <div className="card">
                <h2 className="card-title">Import DraftKings Data</h2>
                <div>
                  <label className="form-label">DraftKings Contest CSV (Contest + Entry IDs)</label>
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
          </div>
        )}

        {/* Player Management Tab */}
        {activeTab === "players" && (
          <PlayerManagerUI
            playerData={playerData}
            onPlayersUpdated={handlePlayersUpdated}
            displayNotification={displayNotification}
            API_BASE_URL={API_BASE_URL}
          />
        )}

        {/* Lineups Tab */}
        {activeTab === "lineups" && (
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2 className="card-title">My Lineups ({lineups.length})</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div className="dropdown">
                  <button className="btn">Export</button>
                  <div className="dropdown-content">
                    <button onClick={() => exportLineups("csv")}>
                      CSV Format
                    </button>
                    <button onClick={() => exportLineups("json")}>
                      JSON Format
                    </button>
                    <button onClick={() => exportLineups("dk")}>
                      DraftKings Format
                    </button>
                  </div>
                </div>
                <button
                  className="btn"
                  style={{ backgroundColor: "#38b2ac", color: "white" }}
                  onClick={() => setActiveTab("exposure")}
                >
                  Manage Exposure
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => generateLineups(1)}
                >
                  Add Lineup
                </button>
              </div>
            </div>

            {lineups.length > 0 ? (
              <LineupList
                lineups={lineups}
                playerData={playerData}
                onEdit={handleEditLineup}
                onDelete={handleDeleteLineup}
                onExport={exportLineups}
              />
            ) : (
              <div className="empty-state">
                <p style={{ marginBottom: "1rem" }}>
                  No lineups have been imported or created yet.
                </p>
                <div>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="btn btn-primary"
                    style={{ marginRight: "0.5rem" }}
                  >
                    Import lineups
                  </button>
                  <button
                    onClick={() => generateLineups(5)}
                    className="btn btn-success"
                  >
                    Generate optimal lineups
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Insights Tab */}
        {activeTab === "ai-insights" && (
          <AIInsights
            API_BASE_URL={AI_API_BASE_URL}
            lineups={lineups}
            playerData={playerData}
            displayNotification={displayNotification}
            exposureSettings={exposureSettings}
            onUpdateExposures={handleExposureUpdate}
            onGenerateOptimizedLineups={generateOptimizedLineups}
            onLineupsUpdated={setLineups}
          />
        )}

        {/* Hybrid Optimizer v2.0 Tab */}
        {activeTab === "hybrid" && (
          <HybridOptimizerUI
            API_BASE_URL={API_BASE_URL}
            playerProjections={playerData}
            teamStacks={stackData}
            exposureSettings={exposureSettings}
            onLineupsGenerated={(generatedLineups, result) => {
              // Replace existing lineups with newly generated ones
              setLineups(generatedLineups);
              displayNotification(
                `Generated ${generatedLineups.length} lineups using ${result.strategy?.name} strategy!`
              );
              // Switch to lineups tab after generation
              setActiveTab("lineups");
            }}
          />
        )}

        {/* Advanced Optimizer Tab (Legacy) */}
        {activeTab === "optimizer" && (
          <OptimizerPage
            API_BASE_URL={API_BASE_URL}
            playerData={playerData}
            lineups={lineups}
            exposureSettings={exposureSettings}
            onUpdateExposures={handleExposureUpdate}
            onGenerateLineups={generateOptimizedLineups}
            onImportLineups={(optimizedLineups) => {
              // Add imported lineups to existing lineups
              setLineups((prev) => [...prev, ...optimizedLineups]);
              displayNotification(
                `Imported ${optimizedLineups.length} optimized lineups!`
              );
              // Switch to lineups tab after import
              setActiveTab("lineups");
            }}
          />
        )}

        {/* NexusScore Test Tab */}
        {activeTab === "nexustest" && (
          <NexusScoreTestPage
            API_BASE_URL={API_BASE_URL}
            playerData={playerData}
            lineups={lineups}
            exposureSettings={exposureSettings}
            onUpdateExposures={handleExposureUpdate}
            onImportLineups={(optimizedLineups) => {
              // Add imported lineups to existing lineups
              setLineups((prev) => [...prev, ...optimizedLineups]);
              displayNotification(
                `Imported ${optimizedLineups.length} optimized lineups!`
              );
              // Switch to lineups tab after import
              setActiveTab("lineups");
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>
            LoL DFS Optimizer &copy; {new Date().getFullYear()} | Enhanced for
            League of Legends
          </p>
        </div>
      </footer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <h3 className="loading-title">Processing...</h3>
            <div className="loading-progress">
              <div className="loading-bar"></div>
            </div>
            <p className="loading-text">This may take a moment...</p>
          </div>
        </div>
      )}

      {/* Notification */}
      {isNotificationVisible && (
        <div className={`notification notification-${notificationType}`}>
          {notificationMessage}
        </div>
      )}
    </div>
  );
};

export default App;
