import React, { useState, useEffect, useCallback, useRef } from 'react';

// Add this constant at the top level
const LOCAL_STORAGE_KEY = 'lol-dfs-team-exposures';

/**
 * TeamStacks component displays and manages team stacks for LoL DFS
 * Updated to display Stack+ values from CSV
 */
const TeamStacks = ({
  API_BASE_URL,
  teamData = [],
  lineups = [],
  exposureSettings,
  onUpdateExposures,
  onGenerateLineups,
  playerData = [] // Added playerData to props to fix reference issue
}) => {
  // Active stack filter - INITIALIZE TO 'all'
  const [activeStackSize, setActiveStackSize] = useState('all');

  // Filtered team data
  const [filteredTeams, setFilteredTeams] = useState([]);

  // Team exposure settings
  const [teamExposures, setTeamExposures] = useState([]);

  // Track if changes need to be saved
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Debug information
  const [debugInfo, setDebugInfo] = useState({
    teamDataReceived: 0,
    filteredTeamsCount: 0,
    lastError: null
  });

  // For importing exposures from file
  const fileInputRef = useRef(null);

  // Debug panel visibility
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // A ref to track if we have initialized exposures
  const exposuresInitialized = useRef(false);

  // Add localStorage helper functions
  const saveToLocalStorage = (exposures) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exposures));
      return true;
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
      return false;
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return null;
  };

  // Check localStorage and force load if needed
  const checkLocalStorage = () => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (savedData) {
        const parsed = JSON.parse(savedData);

        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setTeamExposures(parsed);
          return true;
        }
      }
    } catch (e) {
      console.error("Error checking localStorage:", e);
    }
    return false;
  };

  // Add this debug function to check the lineup structure
  const debugLineupStructure = () => {
    if (!lineups || lineups.length === 0) {
      console.log('No lineups available to debug');
      return;
    }

    // Check the first lineup as a sample
    const sampleLineup = lineups[0];
    console.log('Sample lineup structure:', sampleLineup);

    // Count lineups with potential structure issues
    const issueCount = {
      missingCpt: 0,
      missingPlayers: 0,
      missingTeams: 0
    };

    lineups.forEach((lineup, index) => {
      if (!lineup.cpt) {
        issueCount.missingCpt++;
      } else if (!lineup.cpt.team) {
        issueCount.missingTeams++;
      }

      if (!lineup.players || !Array.isArray(lineup.players)) {
        issueCount.missingPlayers++;
      } else {
        const missingTeamPlayers = lineup.players.filter(p => !p || !p.team).length;
        if (missingTeamPlayers > 0) {
          issueCount.missingTeams++;
        }
      }
    });

    console.log('Lineup structure issues:', issueCount);

    // Count teams in lineups
    const teamCounts = {};
    lineups.forEach(lineup => {
      if (lineup.cpt && lineup.cpt.team) {
        teamCounts[lineup.cpt.team] = (teamCounts[lineup.cpt.team] || 0) + 1;
      }

      if (lineup.players && Array.isArray(lineup.players)) {
        lineup.players.forEach(player => {
          if (player && player.team) {
            teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
          }
        });
      }
    });

    console.log('Team counts in lineups:', teamCounts);

    // Also check the team exposures state
    console.log('Current team exposures state:', teamExposures);

    // Log teams with zero exposure
    const zeroExposures = teamExposures.filter(t => t.actual === 0).map(t => `${t.team}${t.stackSize ? ` (${t.stackSize}-stack)` : ''}`);
    console.log('Teams with zero exposure:', zeroExposures);

    return {
      sampleLineup,
      issueCount,
      teamCounts,
      zeroExposures
    };
  };

  // Track when values change to force save
  useEffect(() => {
    if (teamExposures.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [teamExposures]);

  // Debug player data when the component mounts
  useEffect(() => {
    console.log("============== PLAYER DATA DEBUG ==============");
    console.log("playerData prop received:", {
      isArray: Array.isArray(playerData),
      length: playerData?.length || 0,
      firstThreeTeams: playerData?.slice(0, 3).map(p => p.team),
      uniqueTeams: [...new Set(playerData?.map(p => p.team) || [])]
    });

    // Check first player to see if it has Median instead of projectedPoints
    if (playerData && playerData.length > 0) {
      const firstPlayer = playerData[0];
      console.log("First player:", {
        name: firstPlayer.name,
        team: firstPlayer.team,
        projectedPoints: firstPlayer.projectedPoints,
        Median: firstPlayer.Median
      });
    }

    console.log("============== END PLAYER DATA DEBUG ==============");
  }, [playerData]);

  // Fetch team stacks directly if not provided via props
  useEffect(() => {
    const fetchTeamStacks = async () => {
      if (teamData.length === 0) {
        try {
          setIsLoading(true);
          const response = await fetch(`${API_BASE_URL}/teams/stacks`);

          if (!response.ok) {
            throw new Error(`Failed to fetch team stacks: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();

          setDebugInfo(prev => ({
            ...prev,
            teamDataReceived: data.length,
            directFetch: true
          }));

          processTeamData(data);
        } catch (error) {
          console.error('Error fetching team stacks:', error);
          setDebugInfo(prev => ({
            ...prev,
            lastError: error.message
          }));
        } finally {
          setIsLoading(false);
        }
      } else {
        processTeamData(teamData);
      }
    };

    fetchTeamStacks();
  }, [API_BASE_URL, teamData]);

  // Process team data from props or direct fetch - Modified to handle Stack+ values
  const processTeamData = (data) => {
    setDebugInfo(prev => ({
      ...prev,
      teamDataReceived: data?.length || 0,
      rawData: data && data.length > 0 ? data.slice(0, 2) : []
    }));

    // Handle empty or invalid data
    if (!data || !Array.isArray(data) || data.length === 0) {
      setFilteredTeams([]);
      return;
    }

    // Debug the stack data to see what fields are available
    if (data.length > 0) {
      console.log('Sample team stack data:', data[0]);
      // Look for Stack+ fields
      const stackPlusFields = Object.keys(data[0]).filter(key =>
        key.includes('Stack+') || key.includes('StackPlus') || key === 'stackPlus' || key === 'Fantasy'
      );
      console.log('Potential Stack+ fields:', stackPlusFields);
    }

    // If player data is available, enhance the team data with projections
    let enhancedData = [...data];

    if (playerData && playerData.length > 0) {
      console.log('Enhancing team data with projections from player data:', playerData.length);

      // Create a map of player projections by team for faster lookup
      const teamProjections = {};
      const teamPlayerCounts = {};

      // First pass: Calculate team projections from player data
      playerData.forEach(player => {
        if (!player.team) return;

        if (!teamProjections[player.team]) {
          teamProjections[player.team] = {
            totalProjection: 0,
            playerCount: 0,
            playerProjections: [] // Store individual player projections
          };
        }

        // CRITICAL FIX: Check for BOTH projectedPoints AND Median
        const projPoints = player.projectedPoints !== undefined && player.projectedPoints !== null ?
          Number(player.projectedPoints) :
          (player.Median !== undefined && player.Median !== null ? Number(player.Median) : 0);

        teamProjections[player.team].totalProjection += projPoints;
        teamProjections[player.team].playerCount++;

        // Store player projection for detailed stats
        teamProjections[player.team].playerProjections.push({
          name: player.name,
          position: player.position,
          projection: projPoints
        });
      });

      // Calculate average projections per team
      const teamAvgProjections = {};
      Object.keys(teamProjections).forEach(team => {
        const count = teamProjections[team].playerCount;
        teamAvgProjections[team] = count > 0 ?
          teamProjections[team].totalProjection / count : 0;
      });

      console.log('Team projections calculated:',
        Object.keys(teamProjections).map(team => ({
          team,
          totalProjection: teamProjections[team].totalProjection,
          avgProjection: teamAvgProjections[team],
          playerCount: teamProjections[team].playerCount
        }))
      );

      // Second pass: Enhance team data with calculated projections and extract Stack+ values
      enhancedData = data.map(team => {
        const teamName = team.team || team.name;
        const projectionData = teamProjections[teamName] || {
          totalProjection: 0,
          playerCount: 0,
          playerProjections: []
        };

        // Try all possible field names for Stack+ value
        let stackPlusValue = 0;

        // Check for various formats of Stack+ fields
        if (team['Stack+'] !== undefined && !isNaN(parseFloat(team['Stack+']))) {
          stackPlusValue = parseFloat(team['Stack+']);
          console.log(`Found Stack+ value for ${teamName}: ${stackPlusValue}`);
        }
        else if (team.stackPlus !== undefined && !isNaN(parseFloat(team.stackPlus))) {
          stackPlusValue = parseFloat(team.stackPlus);
          console.log(`Found stackPlus value for ${teamName}: ${stackPlusValue}`);
        }
        else if (team['Stack+ All Wins'] !== undefined && !isNaN(parseFloat(team['Stack+ All Wins']))) {
          stackPlusValue = parseFloat(team['Stack+ All Wins']);
          console.log(`Found Stack+ All Wins value for ${teamName}: ${stackPlusValue}`);
        }
        else if (team.Fantasy !== undefined && !isNaN(parseFloat(team.Fantasy))) {
          stackPlusValue = parseFloat(team.Fantasy);
          console.log(`Found Fantasy value for ${teamName}: ${stackPlusValue}`);
        }
        else {
          // Log that no Stack+ value was found
          console.log(`No Stack+ value found for ${teamName}, using default 0`);
        }

        // For objects from the uploaded CSV that do have a Stack+ field
        // Add a new property for direct access in the component
        return {
          ...team,
          // Add totalProjection if it doesn't exist or is zero
          totalProjection: team.totalProjection > 0 ?
            team.totalProjection : projectionData.totalProjection,
          // Add stackPlusValue with explicit new property
          stackPlusValue: stackPlusValue,
          // Ensure Stack+ is available
          'Stack+': stackPlusValue,
          // Also set stackPlus for consistency
          stackPlus: stackPlusValue,
          // Add avgProjection for convenience
          avgProjection: projectionData.playerCount > 0 ?
            projectionData.totalProjection / projectionData.playerCount : 0,
          // Add player count for reference
          playerCount: projectionData.playerCount,
          // Add player projections for detailed breakdown
          playerProjections: projectionData.playerProjections
        };
      });

      console.log('Enhanced team data with Stack+ and projections (first 3 teams):',
        enhancedData.slice(0, 3).map(t => ({
          team: t.team,
          stackPlusValue: t.stackPlusValue,
          'Stack+': t['Stack+'],
          stackPlus: t.stackPlus,
          totalProjection: t.totalProjection,
          avgProjection: t.avgProjection,
          playerCount: t.playerCount
        }))
      );
    } else {
      console.log('No player data available to enhance team projections');
    }

    // Always set the full data first to ensure we have it available
    setFilteredTeams(enhancedData);

    // Then filter based on active stack size, if a specific size is selected
    if (activeStackSize !== 'all') {
      filterTeamData(enhancedData, activeStackSize);
    }
  };

  // Initialize team exposures from settings - MODIFIED to try localStorage
  useEffect(() => {
    if (exposureSettings?.teams && exposureSettings.teams.length > 0) {
      // Make a deep copy to avoid reference issues
      const teamExposuresCopy = JSON.parse(JSON.stringify(exposureSettings.teams));
      setTeamExposures(teamExposuresCopy);
    } else {
      // Try loading from localStorage if parent doesn't have settings
      const localStorageSettings = loadFromLocalStorage();
      if (localStorageSettings && localStorageSettings.length > 0) {
        setTeamExposures(localStorageSettings);
      } else if (filteredTeams.length > 0) {
        // Create default team exposures if none exist
        const defaultExposures = filteredTeams.map(team => ({
          team: team.team || team.name,
          min: 0,
          max: 100,
          target: null,
          actual: 0
        }));
        setTeamExposures(defaultExposures);
      }
    }

    // After setting initial exposures, immediately calculate from lineups
    if (lineups && lineups.length > 0 && !exposuresInitialized.current) {
      exposuresInitialized.current = true;

      console.log('Initial calculation of exposures from lineups');
      // Immediately calculate actual exposures from lineups
      // We need to setTimeout because React state updates are asynchronous
      setTimeout(() => {
        const teamCounts = {};
        const teamStackCounts = {};
        const totalLineups = lineups.length;

        lineups.forEach(lineup => {
          if (!lineup || !lineup.cpt || !Array.isArray(lineup.players)) return;

          const lineupTeamCounts = {};

          if (lineup.cpt && lineup.cpt.team) {
            const cptTeam = lineup.cpt.team;
            lineupTeamCounts[cptTeam] = (lineupTeamCounts[cptTeam] || 0) + 1;
            teamCounts[cptTeam] = (teamCounts[cptTeam] || 0) + 1;
          }

          if (lineup.players && Array.isArray(lineup.players)) {
            lineup.players.forEach(player => {
              if (player && player.team) {
                const playerTeam = player.team;
                lineupTeamCounts[playerTeam] = (lineupTeamCounts[playerTeam] || 0) + 1;
                teamCounts[playerTeam] = (teamCounts[playerTeam] || 0) + 1;
              }
            });
          }

          Object.entries(lineupTeamCounts).forEach(([team, count]) => {
            const stackKey = `${team}_${count}`;
            teamStackCounts[stackKey] = (teamStackCounts[stackKey] || 0) + 1;
          });
        });

        console.log('Initial team counts:', teamCounts);
        console.log('Initial stack counts:', teamStackCounts);

        setTeamExposures(prev => {
          return prev.map(exposure => {
            const team = exposure.team;
            let actual = 0;

            if (exposure.stackSize !== undefined) {
              const stackKey = `${team}_${exposure.stackSize}`;
              const stackCount = teamStackCounts[stackKey] || 0;
              actual = totalLineups > 0 ? (stackCount / totalLineups) * 100 : 0;
            } else {
              const teamCount = teamCounts[team] || 0;
              // FIX: Properly normalize by total player slots
              actual = totalLineups > 0 ? (teamCount / (totalLineups * 6)) * 100 : 0;
            }

            return {
              ...exposure,
              actual: actual
            };
          });
        });
      }, 100);
    }
  }, [exposureSettings, filteredTeams, lineups]);

  // Calculate actual team exposures from lineups - IMPROVED VERSION
  useEffect(() => {
    if (!lineups || lineups.length === 0) {
      console.log('No lineups available for exposure calculation');
      return;
    }

    console.log('=== EXPOSURE CALCULATION DEBUG ===');
    const debugResult = debugLineupStructure();
    console.log('Lineup debug result:', debugResult);

    console.log(`Calculating team exposures from ${lineups.length} lineups`);

    // Track team occurrences and stack sizes
    const teamCounts = {};
    const teamStackCounts = {};
    const totalLineups = lineups.length;

    // Process each lineup
    lineups.forEach(lineup => {
      // Skip invalid lineups
      if (!lineup || !lineup.cpt || !Array.isArray(lineup.players)) {
        console.log('Skipping invalid lineup:', lineup);
        return;
      }

      // Count players by team for this lineup
      const lineupTeamCounts = {};

      // Count captain's team
      if (lineup.cpt && lineup.cpt.team) {
        const cptTeam = lineup.cpt.team;
        lineupTeamCounts[cptTeam] = (lineupTeamCounts[cptTeam] || 0) + 1;

        // Also increment overall team counts
        teamCounts[cptTeam] = (teamCounts[cptTeam] || 0) + 1;
      }

      // Count regular players' teams
      if (lineup.players && Array.isArray(lineup.players)) {
        lineup.players.forEach(player => {
          if (player && player.team) {
            const playerTeam = player.team;
            lineupTeamCounts[playerTeam] = (lineupTeamCounts[playerTeam] || 0) + 1;

            // Also increment overall team counts
            teamCounts[playerTeam] = (teamCounts[playerTeam] || 0) + 1;
          }
        });
      }

      // Now record the stack information for each team in this lineup
      Object.entries(lineupTeamCounts).forEach(([team, count]) => {
        // Track this team+count as a stack
        const stackKey = `${team}_${count}`;
        teamStackCounts[stackKey] = (teamStackCounts[stackKey] || 0) + 1;
      });
    });

    console.log('Team counts:', teamCounts);
    console.log('Team stack counts:', teamStackCounts);

    // Now update our exposure settings with the calculated values
    setTeamExposures(prev => {
      // Create a new array to avoid mutation
      const updatedExposures = prev.map(exposure => {
        const team = exposure.team;
        let actual = 0;

        // Calculate actual exposure based on whether this is a stack-specific entry
        if (exposure.stackSize !== undefined) {
          // Stack-specific exposure
          const stackKey = `${team}_${exposure.stackSize}`;
          const stackCount = teamStackCounts[stackKey] || 0;

          // Calculate as percentage of total lineups
          actual = totalLineups > 0 ? (stackCount / totalLineups) * 100 : 0;

          console.log(`Stack exposure for ${team} (${exposure.stackSize}-stack): ${actual.toFixed(1)}% (${stackCount}/${totalLineups})`);
        } else {
          // General team exposure - FIX IS HERE
          const teamCount = teamCounts[team] || 0;
          // Divide by (lineups * 6) since there are 6 players per lineup (5 players + CPT)
          // This properly normalizes the percentages to prevent values over 100%
          actual = totalLineups > 0 ? (teamCount / (totalLineups * 6)) * 100 : 0;

          console.log(`Team exposure for ${team}: ${actual.toFixed(1)}% (${teamCount}/${totalLineups * 6})`);
        }

        return {
          ...exposure,
          actual: actual
        };
      });

      console.log('Updated team exposures:', updatedExposures);
      return updatedExposures;
    });

  }, [lineups]);

  // Filter teams based on stack size
  const filterTeamData = (data, stackSize) => {
    // Safety check for data
    if (!data || !Array.isArray(data) || data.length === 0) {
      setFilteredTeams([]);
      return;
    }

    // ALWAYS return all data when filtering by 'all'
    if (stackSize === 'all') {
      setFilteredTeams(data);
      setDebugInfo(prev => ({
        ...prev,
        filteredTeamsCount: data.length,
        activeStackSize: 'all'
      }));
      return;
    }

    // For specific stack sizes, filter as normal
    const size = parseInt(stackSize);
    const filtered = data.filter(team => {
      // Handle different possible stack formats
      if (!team.stack) return false;

      if (Array.isArray(team.stack)) {
        return team.stack.length === size;
      }

      if (typeof team.stack === 'string') {
        return team.stack.split(',').filter(Boolean).length === size;
      }

      return false;
    });

    // Only update if we actually have filtered teams
    if (filtered.length > 0) {
      setFilteredTeams(filtered);
    }

    setDebugInfo(prev => ({
      ...prev,
      filteredTeamsCount: filtered.length,
      activeStackSize: stackSize
    }));
  };

  // Update when active stack size changes
  useEffect(() => {
    if (teamData && teamData.length > 0) {
      if (activeStackSize === 'all') {
        setFilteredTeams(teamData);
      } else {
        filterTeamData(teamData, activeStackSize);
      }
    }
  }, [teamData, activeStackSize]);

  // Update min exposure with stack size awareness
  const updateMinExposure = (teamName, value) => {
    const numValue = value === '' ? 0 : parseInt(value);

    setTeamExposures(prev => {
      // Create a deep copy of the previous exposures to avoid reference issues
      const newExposures = JSON.parse(JSON.stringify(prev));

      // Check if we're on a specific stack tab
      if (activeStackSize !== 'all') {
        const stackSize = parseInt(activeStackSize);

        // Look for stack-specific entry
        const stackSpecificIndex = newExposures.findIndex(t =>
          t.team === teamName && t.stackSize === stackSize
        );

        if (stackSpecificIndex >= 0) {
          // Update existing stack-specific entry
          newExposures[stackSpecificIndex].min = numValue;
        } else {
          // Add new stack-specific entry
          newExposures.push({
            team: teamName,
            stackSize: stackSize, // THIS IS CRUCIAL
            min: numValue,
            max: 100,
            target: null,
            actual: 0
          });
        }
      } else {
        // We're on the "All" tab, update general settings
        const existingIndex = newExposures.findIndex(t =>
          t.team === teamName && !t.stackSize
        );

        if (existingIndex >= 0) {
          // Update existing general entry
          newExposures[existingIndex].min = numValue;
        } else {
          // Add new general entry
          newExposures.push({
            team: teamName,
            min: numValue,
            max: 100,
            target: null,
            actual: 0
          });
        }
      }

      return newExposures;
    });

    // Mark as needing to be saved
    setHasUnsavedChanges(true);
  };

  // Update max exposure with stack size awareness
  const updateMaxExposure = (teamName, value) => {
    const numValue = value === '' ? 100 : parseInt(value);

    setTeamExposures(prev => {
      // Create a deep copy of the previous exposures to avoid reference issues
      const newExposures = JSON.parse(JSON.stringify(prev));

      // Check if we're on a specific stack tab
      if (activeStackSize !== 'all') {
        const stackSize = parseInt(activeStackSize);

        // Look for stack-specific entry
        const stackSpecificIndex = newExposures.findIndex(t =>
          t.team === teamName && t.stackSize === stackSize
        );

        if (stackSpecificIndex >= 0) {
          // Update existing stack-specific entry
          newExposures[stackSpecificIndex].max = numValue;
        } else {
          // Add new stack-specific entry
          newExposures.push({
            team: teamName,
            stackSize: stackSize, // THIS IS CRUCIAL
            min: 0,
            max: numValue,
            target: null,
            actual: 0
          });
        }
      } else {
        // We're on the "All" tab, update general settings
        const existingIndex = newExposures.findIndex(t =>
          t.team === teamName && !t.stackSize
        );

        if (existingIndex >= 0) {
          // Update existing general entry
          newExposures[existingIndex].max = numValue;
        } else {
          // Add new general entry
          newExposures.push({
            team: teamName,
            min: 0,
            max: numValue,
            target: null,
            actual: 0
          });
        }
      }

      return newExposures;
    });

    // Mark as needing to be saved
    setHasUnsavedChanges(true);
  };

  // Reset exposure settings to defaults
  const resetExposureSettings = () => {
    try {
      setIsLoading(true);

      // Create default settings for all teams
      const defaultTeamExposures = filteredTeams.map(team => ({
        team: team.team || team.name,
        // Add stack size if we're on a specific stack tab
        ...(activeStackSize !== 'all' ? { stackSize: parseInt(activeStackSize) } : {}),
        min: 0,
        max: 100,
        target: null,
        actual: 0
      }));

      // Update local state
      setTeamExposures(defaultTeamExposures);

      // Save to localStorage as a fallback
      saveToLocalStorage(defaultTeamExposures);

      // Also save to parent to ensure persistence
      if (typeof onUpdateExposures === 'function') {
        const resetSettings = {
          ...exposureSettings,
          teams: defaultTeamExposures,
          _isManualSave: true
        };

        try {
          // Safe call to avoid Promise errors
          const result = onUpdateExposures(resetSettings);

          // If it's a Promise, handle it properly
          if (result && typeof result.then === 'function') {
            result
              .then(() => {
                alert('Team exposure settings reset to defaults!');
              })
              .catch(error => {
                console.error("Error saving reset settings:", error);
                alert(`Error saving reset settings: ${error.message}`);
              })
              .finally(() => {
                setIsLoading(false);
              });
          } else {
            // Not a Promise, handle synchronously
            alert('Team exposure settings reset to defaults!');
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Error calling reset:", error);
          alert(`Error resetting exposure settings: ${error.message}`);
          setIsLoading(false);
        }
      } else {
        alert('Warning: Reset applied locally but unable to save to parent component');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error resetting team exposures:', error);
      alert(`Error resetting exposure settings: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Improved save function with localStorage backup
  const saveExposureSettings = async () => {
    try {
      setIsLoading(true);

      // Create a clean copy of the exposure settings for saving
      const updatedSettings = {
        global: (exposureSettings?.global || {
          globalMinExposure: 0,
          globalMaxExposure: 60,
          applyToNewLineups: true,
          prioritizeProjections: true
        }),
        teams: teamExposures.map(team => ({
          team: team.team,
          // Preserve stack size if it exists
          ...(team.stackSize !== undefined ? { stackSize: team.stackSize } : {}),
          min: typeof team.min === 'number' ? team.min : 0,
          max: typeof team.max === 'number' ? team.max : 100,
          target: team.target !== undefined ? team.target : null,
          actual: team.actual || 0
        })),
        // Make sure to include other existing settings
        players: exposureSettings?.players || [],
        positions: exposureSettings?.positions || {
          TOP: { min: 0, max: 100, target: null },
          JNG: { min: 0, max: 100, target: null },
          MID: { min: 0, max: 100, target: null },
          ADC: { min: 0, max: 100, target: null },
          SUP: { min: 0, max: 100, target: null },
          CPT: { min: 0, max: 100, target: null }
        },
        _isManualSave: true
      };

      // ALWAYS save to localStorage first as a reliable backup
      try {
        // Save to localStorage as backup
        const teamsToSave = updatedSettings.teams.map(team => ({
          team: team.team,
          ...(team.stackSize !== undefined ? { stackSize: team.stackSize } : {}),
          min: team.min,
          max: team.max,
          target: team.target,
          actual: team.actual
        }));
        saveToLocalStorage(teamsToSave);
      } catch (localStorageError) {
        console.error("Failed to save to localStorage:", localStorageError);
      }

      // 1. Try direct API call to ensure server receives the settings
      try {
        const serverResponse = await fetch(`${API_BASE_URL}/settings/exposure`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedSettings)
        });

        if (!serverResponse.ok) {
          // Try to get error details
          let errorDetails = '';
          try {
            const errorText = await serverResponse.text();
            errorDetails = errorText;
          } catch (e) {
            // Ignore if we can't read the response
          }

          throw new Error(`Server error: ${serverResponse.status} ${serverResponse.statusText} ${errorDetails}`);
        }
      } catch (serverError) {
        console.error("Error saving to server:", serverError);
      }

      // 2. Now update parent component state
      if (typeof onUpdateExposures === 'function') {
        try {
          await onUpdateExposures(updatedSettings);
        } catch (parentError) {
          console.error("Error updating parent:", parentError);
          throw new Error(`Failed to update parent component: ${parentError.message}`);
        }
      }

      // 3. If both succeeded or at least one succeeded, mark as saved
      setHasUnsavedChanges(false);
      alert('Team exposure settings saved successfully!');

    } catch (error) {
      console.error('Error in save process:', error);
      alert(`Error saving exposure settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Get exposure value based on team and current stack size
  const getTeamExposure = useCallback((teamName) => {
    // Find the team in exposures (without stackSize for general exposure)
    const teamExposure = teamExposures.find(t => t.team === teamName && t.stackSize === undefined);
    return teamExposure?.actual || 0;
  }, [teamExposures]);

  // Get stack-specific exposure
  const getTeamStackExposure = useCallback((teamName, stackSize) => {
    if (!stackSize) return getTeamExposure(teamName);

    // Find the team+stackSize in exposures
    const stackExposure = teamExposures.find(
      t => t.team === teamName && t.stackSize === stackSize
    );

    return stackExposure?.actual || 0;
  }, [teamExposures, getTeamExposure]);

  // Get min exposure for a team based on active stack size
  const getTeamMinExposure = useCallback((teamName) => {
    if (activeStackSize !== 'all') {
      // Look for stack-specific setting first
      const stackSize = parseInt(activeStackSize);
      const stackSetting = teamExposures.find(t =>
        t.team === teamName && t.stackSize === stackSize
      );

      if (stackSetting) {
        return stackSetting.min;
      }
    }

    // Fall back to general setting
    const generalSetting = teamExposures.find(t =>
      t.team === teamName && t.stackSize === undefined
    );

    return generalSetting?.min || 0;
  }, [teamExposures, activeStackSize]);

  // Get max exposure for a team based on active stack size
  const getTeamMaxExposure = useCallback((teamName) => {
    if (activeStackSize !== 'all') {
      // Look for stack-specific setting first
      const stackSize = parseInt(activeStackSize);
      const stackSetting = teamExposures.find(t =>
        t.team === teamName && t.stackSize === stackSize
      );

      if (stackSetting) {
        return stackSetting.max;
      }
    }

    // Fall back to general setting
    const generalSetting = teamExposures.find(t =>
      t.team === teamName && t.stackSize === undefined
    );

    return generalSetting?.max || 100;
  }, [teamExposures, activeStackSize]);

  // Get pool exposure for a team (from stats in teamData)
  const getPoolExposure = useCallback((teamName) => {
    const team = teamData.find(t => t.team === teamName || t.name === teamName);
    return team?.poolExposure || team?.ownership || team?.avgTeamOwnership || 0;
  }, [teamData]);

  // Generate lineups with current exposures and stack specificity
  const handleGenerateLineups = async (count = 5) => {
    setIsLoading(true);

    try {
      // First save current exposures
      if (hasUnsavedChanges) {
        await saveExposureSettings();
      }

      // Call the parent component's generate function with team preferences
      if (onGenerateLineups) {
        // Create options with stack size information
        const options = {
          exposureSettings: {
            // Clone the existing settings but ensure we pass stack size info
            teams: teamExposures.map(team => ({
              ...team,
              // If we're on a specific tab, all teams in this view should use that stack size
              stackSize: activeStackSize !== 'all' ? parseInt(activeStackSize) : team.stackSize
            }))
          },
          // Include active stack size in preferences
          preferredTeams: filteredTeams.map(t => ({
            team: t.team || t.name,
            stackSize: activeStackSize !== 'all' ? parseInt(activeStackSize) : null
          })),
          // Pass the current active stack size for context
          activeStackSize: activeStackSize !== 'all' ? parseInt(activeStackSize) : null
        };

        const newLineups = await onGenerateLineups(count, options);

        // After generating lineups, schedule an immediate exposure recalculation
        if (newLineups && newLineups.length > 0) {
          // Force exposure update after a small delay to ensure lineups state is updated
          setTimeout(() => {
            // Re-calculate actual exposures from lineups
            const teamCounts = {};
            const teamStackCounts = {};
            const allLineups = lineups || []; // Use the latest lineups prop
            const totalLineups = allLineups.length;

            // Count teams in all lineups, including new ones
            allLineups.forEach(lineup => {
              if (!lineup || !lineup.cpt || !Array.isArray(lineup.players)) return;

              // Count players by team
              const teamPlayerCounts = {};

              // Count captain's team
              if (lineup.cpt && lineup.cpt.team) {
                const cptTeam = lineup.cpt.team;
                teamPlayerCounts[cptTeam] = (teamPlayerCounts[cptTeam] || 0) + 1;

                // Increment general team counts
                teamCounts[cptTeam] = (teamCounts[cptTeam] || 0) + 1;
              }

              // Count players' teams
              lineup.players.forEach(player => {
                if (player && player.team) {
                  const playerTeam = player.team;
                  teamPlayerCounts[playerTeam] = (teamPlayerCounts[playerTeam] || 0) + 1;

                  // Increment general team counts
                  teamCounts[playerTeam] = (teamCounts[playerTeam] || 0) + 1;
                }
              });

              // Now analyze stacks - teams with multiple players
              Object.entries(teamPlayerCounts).forEach(([team, count]) => {
                // Create a key for team+stackSize
                const stackKey = `${team}_${count}`;
                teamStackCounts[stackKey] = (teamStackCounts[stackKey] || 0) + 1;
              });
            });

            // Update team exposures with recalculated values
            setTeamExposures(prev => {
              return prev.map(teamExposure => {
                const team = teamExposure.team;

                // Handle stack-specific exposure
                if (teamExposure.stackSize !== undefined) {
                  const stackKey = `${team}_${teamExposure.stackSize}`;
                  const stackCount = teamStackCounts[stackKey] || 0;
                  const actualExposure = totalLineups > 0 ? (stackCount / totalLineups) * 100 : 0;

                  return {
                    ...teamExposure,
                    actual: actualExposure
                  };
                }
                // Handle general team exposure
                else {
                  const teamCount = teamCounts[team] || 0;
                  // FIX APPLIED HERE - Divide by total player slots, not just lineup count
                  const actualExposure = totalLineups > 0 ? (teamCount / (totalLineups * 6)) * 100 : 0;

                  return {
                    ...teamExposure,
                    actual: actualExposure
                  };
                }
              });
            });

            console.log('Updated team exposures after lineup generation');
          }, 300);
        }
      } else {
        alert('Lineup generation function not available');
      }
    } catch (error) {
      console.error('Error generating lineups:', error);
      alert(`Error generating lineups: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate default time based on team index (for demo purposes)
  const getTeamTime = useCallback((index) => {
    const times = ['1:00 AM', '2:00 AM', '4:00 AM', '11:00 PM'];
    return times[index % times.length];
  }, []);

  // Force reload team stacks from server
  const reloadTeamStacks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/teams/stacks`);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Set active tab to 'all' to ensure all stacks are shown
      setActiveStackSize('all');

      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        teamDataReceived: data.length,
        reloadedData: true,
        lastError: null
      }));

      // Process the fresh data
      processTeamData(data);

      alert(`Reloaded ${data.length} team stacks from server`);
    } catch (error) {
      console.error('Error reloading team stacks:', error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: error.message
      }));
      alert(`Error reloading team stacks: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Add file input for importing exposures
  const importExposuresFromFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const importedExposures = JSON.parse(content);

        if (Array.isArray(importedExposures) && importedExposures.length > 0) {
          // Validate the structure
          const isValid = importedExposures.every(item =>
            item.team &&
            (typeof item.min === 'number' || item.min === null) &&
            (typeof item.max === 'number' || item.max === null)
          );

          if (isValid) {
            setTeamExposures(importedExposures);

            // Save imported exposures to localStorage
            saveToLocalStorage(importedExposures);

            alert(`Successfully imported ${importedExposures.length} team exposures!`);
          } else {
            alert("Invalid exposures file format. File must contain valid team exposures.");
          }
        } else {
          alert("No valid team exposures found in the file.");
        }
      } catch (error) {
        console.error("Error importing exposures:", error);
        alert(`Error importing file: ${error.message}`);
      }
    };

    reader.readAsText(file);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Debug panel that shows all exposure information
  const DebugPanel = () => {
    const [debugState, setDebugState] = useState({
      exposureCount: teamExposures.length,
      windowObjectState: Boolean(window.__teamExposuresArray),
      sessionStorageState: false,
      localStorageState: Boolean(localStorage.getItem(LOCAL_STORAGE_KEY)),
      hiddenDomState: false,
      parentPropsState: Boolean(exposureSettings?.teams?.length)
    });

    useEffect(() => {
      // Check all storage locations
      try {
        const sessionData = sessionStorage.getItem('__teamExposures');
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        const hiddenElement = document.getElementById('__exposure_storage');

        setDebugState({
          exposureCount: teamExposures.length,
          windowObjectState: Boolean(window.__teamExposuresArray),
          sessionStorageState: Boolean(sessionData),
          localStorageState: Boolean(localData),
          hiddenDomState: Boolean(hiddenElement?.getAttribute('data-exposures')),
          parentPropsState: Boolean(exposureSettings?.teams?.length)
        });
      } catch (e) {
        console.error("Error checking storage states:", e);
      }
    }, [teamExposures]);

    return (
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: 'rgba(26, 54, 93, 0.95)',
        border: '1px solid #4fd1c5',
        borderRadius: '4px',
        padding: '10px',
        zIndex: 9999,
        width: '300px',
        color: 'white',
        fontSize: '12px'
      }}>
        <div style={{ borderBottom: '1px solid #4fd1c5', paddingBottom: '5px', marginBottom: '5px' }}>
          <strong style={{ color: '#4fd1c5' }}>Exposure Debug Panel</strong>
          <button
            onClick={() => setShowDebugPanel(false)}
            style={{ float: 'right', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >×</button>
        </div>

        <div>Current exposures count: <span style={{ color: '#4fd1c5' }}>{debugState.exposureCount}</span></div>
        <div>Window object storage: <span style={{ color: debugState.windowObjectState ? '#10b981' : '#f56565' }}>
          {debugState.windowObjectState ? 'Available' : 'Not Found'}
        </span></div>
        <div>Session storage: <span style={{ color: debugState.sessionStorageState ? '#10b981' : '#f56565' }}>
          {debugState.sessionStorageState ? 'Available' : 'Not Found'}
        </span></div>
        <div>Local storage: <span style={{ color: debugState.localStorageState ? '#10b981' : '#f56565' }}>
          {debugState.localStorageState ? 'Available' : 'Not Found'}
        </span></div>
        <div>Hidden DOM storage: <span style={{ color: debugState.hiddenDomState ? '#10b981' : '#f56565' }}>
          {debugState.hiddenDomState ? 'Available' : 'Not Found'}
        </span></div>
        <div>Parent props: <span style={{ color: debugState.parentPropsState ? '#10b981' : '#f56565' }}>
          {debugState.parentPropsState ? 'Available' : 'Not Found'}
        </span></div>

        <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
          <button
            onClick={() => {
              // Force save current state to all storage methods
              saveExposureSettings();
            }}
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '2px',
              fontSize: '10px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Force Save
          </button>

          <button
            onClick={() => {
              // Export settings to JSON file
              try {
                const dataStr = JSON.stringify(teamExposures);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

                const exportFileDefaultName = 'team-exposures.json';

                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
              } catch (e) {
                console.error("Error exporting exposures:", e);
                alert("Failed to export settings: " + e.message);
              }
            }}
            style={{
              backgroundColor: '#805ad5',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '2px',
              fontSize: '10px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Export JSON
          </button>
        </div>

        <button
          onClick={debugLineupStructure}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '2px',
            fontSize: '10px',
            cursor: 'pointer',
            width: '100%',
            marginTop: '5px'
          }}
        >
          Debug Lineup Structure
        </button>
      </div>
    );
  };

  // Check if we have stacks to show
  const hasStacks = filteredTeams && filteredTeams.length > 0;
  const teamsToDisplay = hasStacks ? filteredTeams : [];
  const hasTeamsData = debugInfo.teamDataReceived > 0;

  return (
    <div className="team-stacks-container">
      <div className="card">
        <h2 className="card-title">Team Stacks</h2>

        {/* Stack Size Filters */}
        <div className="stack-filter-tabs">
          <button
            className={`tab ${activeStackSize === 'all' ? 'active' : ''}`}
            onClick={() => setActiveStackSize('all')}
          >
            All Stacks
          </button>
          <button
            className={`tab ${activeStackSize === '2' ? 'active' : ''}`}
            onClick={() => setActiveStackSize('2')}
          >
            2-stacks
          </button>
          <button
            className={`tab ${activeStackSize === '3' ? 'active' : ''}`}
            onClick={() => setActiveStackSize('3')}
          >
            3-stacks
          </button>
          <button
            className={`tab ${activeStackSize === '4' ? 'active' : ''}`}
            onClick={() => setActiveStackSize('4')}
          >
            4-stacks
          </button>
        </div>

        {/* Team Stacks Table */}
        <div className="table-container">
          {/* Debug Button */}
          <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
            <button
              className="btn"
              onClick={() => {
                console.log("Debug Team Data:");
                if (teamsToDisplay.length > 0) {
                  // Log all properties of the first few teams
                  console.log("First teams data:", teamsToDisplay.slice(0, 3));

                  // Check Stack+ fields specifically
                  teamsToDisplay.slice(0, 3).forEach((team, i) => {
                    console.log(`Team ${i+1} (${team.team || team.name}) Stack+ fields:`, {
                      'Stack+': team['Stack+'],
                      stackPlus: team.stackPlus,
                      stackPlusValue: team.stackPlusValue,
                      'Stack+ All Wins': team['Stack+ All Wins'],
                      Fantasy: team.Fantasy,
                      // Check if any field has a numerically valid value
                      hasValidValue:
                        (team['Stack+'] && !isNaN(Number(team['Stack+']))) ||
                        (team.stackPlus && !isNaN(Number(team.stackPlus))) ||
                        (team.stackPlusValue && !isNaN(Number(team.stackPlusValue))) ||
                        (team['Stack+ All Wins'] && !isNaN(Number(team['Stack+ All Wins']))) ||
                        (team.Fantasy && !isNaN(Number(team.Fantasy)))
                    });
                  });

                  // Check filtered teams data
                  console.log("Filtered teams count:", filteredTeams.length);
                  console.log("filteredTeams === teamsToDisplay:", filteredTeams === teamsToDisplay);

                  alert(`Team data logged to console. Found ${teamsToDisplay.length} teams.`);
                } else {
                  console.log("No teams available to debug");
                  alert("No team data available");
                }
              }}
              style={{ backgroundColor: '#805ad5', color: 'white', fontSize: '0.8rem' }}
            >
              Debug Stack+ Values
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th style={{ textAlign: 'left' }}>Teams</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '100px' }}>Time</th>
                <th style={{ width: '100px' }}>Stack+</th>
                <th style={{ width: '80px' }}>Min Exp</th>
                <th style={{ width: '80px' }}>Max Exp</th>
                <th style={{ width: '120px' }}>Lineup Exp</th>
                <th style={{ width: '120px' }}>Pool Exp</th>
              </tr>
            </thead>
            <tbody>
              {teamsToDisplay.length > 0 ? (
                teamsToDisplay.map((team, index) => {
                  const teamName = team.team || team.name;
                  const stackSize = activeStackSize !== 'all' ? parseInt(activeStackSize) : null;

                  // Directly find the appropriate exposure object
                  let exposureObj;
                  if (stackSize) {
                    // Look for stack-specific exposure
                    exposureObj = teamExposures.find(
                      t => t.team === teamName && t.stackSize === stackSize
                    );
                  } else {
                    // Look for general team exposure
                    exposureObj = teamExposures.find(
                      t => t.team === teamName && t.stackSize === undefined
                    );
                  }

                  // Default values if not found
                  const teamExposure = exposureObj?.actual || 0;

                  // Calculate lineup count
                  let lineupCount = 0;
                  if (lineups && lineups.length > 0) {
                    if (stackSize) {
                      // For stack-specific, calculate from percentage
                      lineupCount = Math.floor((teamExposure / 100) * lineups.length);
                    } else {
                      // For general, count lineups with this team
                      lineupCount = lineups.filter(l =>
                        (l.cpt && l.cpt.team === teamName) ||
                        (l.players && l.players.some(p => p && p.team === teamName))
                      ).length;
                    }
                  }

                  // Get pool exposure from teamData
                  const poolExposure = teamData.find(t =>
                    (t.team === teamName || t.name === teamName))?.poolExposure || 0;

                  // Get min/max settings
                  const teamMinExposure = getTeamMinExposure(teamName);
                  const teamMaxExposure = getTeamMaxExposure(teamName);

                  return (
                    <tr key={teamName + "-" + index}>
                      <td>
                        <input type="checkbox" />
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        {teamName}
                        {stackSize && (
                          <span style={{
                            fontSize: '0.75rem',
                            color: '#90cdf4',
                            marginLeft: '0.5rem',
                            padding: '2px 4px',
                            backgroundColor: 'rgba(56, 178, 172, 0.2)',
                            borderRadius: '4px'
                          }}>
                            {stackSize}-stack
                          </span>
                        )}
                      </td>
                      <td>{team.status || '—'}</td>
                      <td>{team.time || getTeamTime(index)}</td>

                      {/* DISPLAY STACK+ VALUE WITH FALLBACKS */}
                      <td>
                        <div>
                          {/* Stack+ value with prominent styling */}
                          <div style={{
                            color: '#10b981',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            {(() => {
                              // Try all possible field names in order of preference
                              const stackValue =
                                team.stackPlusValue || // New reliable field
                                team.stackPlus ||
                                team['Stack+'] ||
                                team.fantasy ||
                                team.stackPlusAllWins ||
                                team.Fantasy ||
                                team['Stack+ All Wins'] ||
                                0;

                              return typeof stackValue === 'number'
                                ? stackValue.toFixed(1)
                                : parseFloat(stackValue || 0).toFixed(1);
                            })()}
                          </div>
                        </div>
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={teamMinExposure}
                          onChange={(e) => updateMinExposure(teamName, e.target.value)}
                          style={{ width: '60px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={teamMaxExposure}
                          onChange={(e) => updateMaxExposure(teamName, e.target.value)}
                          style={{ width: '60px' }}
                        />
                      </td>
                      <td style={{
                        color: teamExposure < teamMinExposure ? '#f56565' :
                              teamExposure > teamMaxExposure ? '#f6ad55' : '#4fd1c5',
                        fontWeight: 'bold'
                      }}>
                        {teamExposure.toFixed(1)}% ({lineupCount})
                      </td>
                      <td>
                        {poolExposure ?
                          `${parseFloat(poolExposure).toFixed(1)}% (${Math.floor(poolExposure * 5)})` :
                          '0.0% (0)'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                    No team stacks available. Please upload team stacks data.
                    {debugInfo.lastError && (
                      <div style={{ color: '#f56565', marginTop: '0.5rem' }}>
                        Error: {debugInfo.lastError}
                      </div>
                    )}
                    {hasTeamsData && activeStackSize !== 'all' && (
                      <div style={{ color: '#90cdf4', marginTop: '0.5rem' }}>
                        Note: Received {debugInfo.teamDataReceived} teams but none match current filter ({activeStackSize !== 'all' ? activeStackSize + '-stacks' : 'any size'})
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(26, 54, 93, 0.7)',
            border: '1px solid #2c5282',
            borderRadius: '0.25rem',
            textAlign: 'center'
          }}>
            <span style={{ color: '#4fd1c5' }}>Loading team stacks...</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn"
              onClick={reloadTeamStacks}
              style={{ backgroundColor: 'transparent', border: '1px solid #90cdf4', color: '#90cdf4' }}
            >
              Reload Stacks
            </button>

            {/* File input for JSON import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={importExposuresFromFile}
              accept=".json"
              style={{ display: 'none' }}
              id="json-import-input"
            />
            <button
              className="btn"
              onClick={() => document.getElementById('json-import-input').click()}
              style={{ backgroundColor: '#805ad5', color: 'white' }}
            >
              Import Exposures
            </button>

            {/* Force Load button to reload from localStorage */}
            <button
              className="btn"
              onClick={() => {
                if (checkLocalStorage()) {
                  alert("Loaded from localStorage successfully");
                } else {
                  alert("No valid data in localStorage or failed to load");
                }
              }}
              style={{ backgroundColor: '#38a169', color: 'white', fontSize: '0.75rem' }}
            >
              Force Load
            </button>

            <button
              className="btn"
              onClick={() => setShowDebugPanel(true)}
              style={{ backgroundColor: '#2c5282', color: 'white', fontSize: '0.75rem' }}
            >
              Debug Panel
            </button>
          </div>

          <div>
            <button
              className="btn"
              onClick={resetExposureSettings}
              disabled={isLoading}
              style={{ backgroundColor: '#718096', color: 'white', marginRight: '0.5rem' }}
            >
              Reset Exposures
            </button>
            <button
              className="btn btn-primary"
              onClick={saveExposureSettings}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Exposures'}
            </button>
          </div>
        </div>

        {/* Show debug panel if enabled */}
        {showDebugPanel && <DebugPanel />}
      </div>
    </div>
  );
};

export default TeamStacks;