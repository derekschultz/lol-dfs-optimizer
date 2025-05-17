import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// LocalStorage key for saving exposure settings as fallback
const LOCAL_STORAGE_KEY = 'lol-dfs-exposure-settings';

// LocalStorage helper functions
const saveToLocalStorage = (settings) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
};

const loadFromLocalStorage = () => {
  try {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      return parsedSettings;
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  return null;
};

/**
 * Exposure Control component for managing player and team exposure percentages
 * across lineups in League of Legends DFS contests
 */
const ExposureControl = ({
  API_BASE_URL,
  playerData,
  lineups,
  exposureSettings: initialExposureSettings,
  onUpdateExposures,
  onGenerateLineups
}) => {
  // Store stable values to avoid race conditions
  const stableValuesRef = useRef({
    teamExposures: {},
    playerExposures: {},
    positionExposures: {}
  });

  // Global exposure settings
  const [globalSettings, setGlobalSettings] = useState(
    initialExposureSettings?.global || {
      globalMinExposure: 0,
      globalMaxExposure: 60,
      applyToNewLineups: true,
      prioritizeProjections: true
    }
  );

  // Player-specific exposure settings
  const [playerExposures, setPlayerExposures] = useState([]);

  // Team-specific exposure settings
  const [teamExposures, setTeamExposures] = useState([]);

  // Position-specific settings
  const [positionExposures, setPositionExposures] = useState({
    TOP: { min: 0, max: 100, target: null },
    JNG: { min: 0, max: 100, target: null },
    MID: { min: 0, max: 100, target: null },
    ADC: { min: 0, max: 100, target: null },
    SUP: { min: 0, max: 100, target: null },
    CPT: { min: 0, max: 100, target: null }
  });

  // Filter and sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('projection');
  const [sortDirection, setSortDirection] = useState('desc');

  // Tab selection state
  const [activeTab, setActiveTab] = useState('players');

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Timer ref for debouncing state updates
  const timersRef = useRef({});

  // Player data map for quick lookups
  const playerDataMap = useRef({});

  // Track if initial loading has completed
  const initialLoadDone = useRef(false);

  // Prevent simultaneous updates
  const isUpdatingRef = useRef(false);

  // Load from localStorage if no settings provided
  useEffect(() => {
    if (!initialExposureSettings && !playerData.length) {
      const localSettings = loadFromLocalStorage();
      if (localSettings) {
        // Update state with the loaded settings
        if (localSettings.global) {
          setGlobalSettings(localSettings.global);
        }

        if (localSettings.players && localSettings.players.length > 0) {
          setPlayerExposures(localSettings.players);
        }

        if (localSettings.teams && localSettings.teams.length > 0) {
          setTeamExposures(localSettings.teams);
        }

        if (localSettings.positions) {
          setPositionExposures(localSettings.positions);
        }
      }
    }
  }, [initialExposureSettings, playerData.length]);

  /**
   * Get the best available projection value from a player object
   * Prioritizes: Median from ROO > projectedPoints
   */
  const getPlayerProjection = useCallback((player) => {
    if (player && player.projectedPoints !== undefined && !isNaN(Number(player.projectedPoints))) {
      return Number(player.projectedPoints);
    }

    // Return 0 if no valid data found
    return 0;
  }, []);

  /**
   * Display projected points with appropriate formatting
   */
  const displayProjectedPoints = useCallback((player) => {
    const projection = getPlayerProjection(player);
    return projection.toFixed(1);
  }, [getPlayerProjection]);

  /**
   * Get player ownership from ROO data
   */
  const getPlayerOwnership = useCallback((player) => {
    if (player && player.ownership !== undefined && !isNaN(Number(player.ownership))) {
      return Number(player.ownership);
    }

    return 0; // Default if no ownership data found
  }, []);

  /**
   * Display ownership with appropriate formatting
   */
  const displayOwnership = useCallback((player) => {
    const ownership = getPlayerOwnership(player);
    return ownership.toFixed(1);
  }, [getPlayerOwnership]);

  // Initialize player exposures from player data
  const initializePlayerExposures = useCallback(() => {
    if (playerData && playerData.length > 0) {
      // Create initial player exposure settings
      try {
        const initialPlayerExposures = playerData.map(player => {
          return {
            id: player.id,
            name: player.name || 'Unknown',
            team: player.team || 'Unknown',
            position: player.position || 'Unknown',
            salary: player.salary || 0,
            projectedPoints: player.projectedPoints !== undefined ? Number(player.projectedPoints) : 0,
            ownership: player.ownership !== undefined ? Number(player.ownership) : undefined,
            min: globalSettings.globalMinExposure,
            max: globalSettings.globalMaxExposure,
            target: null, // Target percentage (optional)
            actual: 0 // Will be calculated from lineups
          };
        });

        setPlayerExposures(initialPlayerExposures);
      } catch (e) {
        console.error("Error initializing player exposures:", e);
      }
    } else {
      console.warn("Cannot initialize player exposures - no player data available");
    }
  }, [playerData, globalSettings]);

  // Initialize team exposures from player data
  const initializeTeamExposures = useCallback(() => {
    if (playerData && playerData.length > 0) {
      try {
        // Extract unique teams
        const teams = [...new Set(playerData.map(player => player.team))].filter(Boolean);

        const initialTeamExposures = teams.map(team => ({
          team,
          min: 0,
          max: 100,
          target: null,
          actual: 0
        }));

        setTeamExposures(initialTeamExposures);
      } catch (e) {
        console.error("Error initializing team exposures:", e);
      }
    } else {
      console.warn("Cannot initialize team exposures - no player data available");
    }
  }, [playerData]);

  // Initialize from props when component mounts or props change
  useEffect(() => {
    if (initialExposureSettings) {
      // Update state with the passed-in settings
      if (initialExposureSettings.global) {
        setGlobalSettings(initialExposureSettings.global);
      }

      if (initialExposureSettings.players && initialExposureSettings.players.length > 0) {
        setPlayerExposures(initialExposureSettings.players);
      } else if (playerData.length > 0) {
        // Initialize from player data if no settings exist
        initializePlayerExposures();
      }

      if (initialExposureSettings.teams && initialExposureSettings.teams.length > 0) {
        setTeamExposures(initialExposureSettings.teams);
      } else if (playerData.length > 0) {
        // Initialize from player data if no settings exist
        initializeTeamExposures();
      }

      if (initialExposureSettings.positions) {
        setPositionExposures(initialExposureSettings.positions);
      }
    } else if (playerData.length > 0) {
      // Initialize from scratch if no props and we have player data
      initializePlayerExposures();
      initializeTeamExposures();
    } else {
      console.warn("Cannot initialize - neither exposure settings nor player data is available");
    }

    // Build the player data map for efficient lookups
    const map = {};
    playerData.forEach(player => {
      map[player.id] = player;
    });
    playerDataMap.current = map;

    // Mark initialization as done
    initialLoadDone.current = true;
  }, [initialExposureSettings, playerData, initializePlayerExposures, initializeTeamExposures]);

  // Calculate current exposures whenever lineups change
  useEffect(() => {
    // Skip calculation if there are no lineups
    if (!lineups || lineups.length === 0) {
      // Just ensure actual values are set to 0
      if (playerExposures.length > 0) {
        setPlayerExposures(prev => prev.map(player => ({
          ...player,
          actual: 0
        })));
      }

      if (teamExposures.length > 0) {
        setTeamExposures(prev => prev.map(team => ({
          ...team,
          actual: 0
        })));
      }

      // Set empty values in the ref
      stableValuesRef.current = {
        playerExposures: {},
        teamExposures: {},
        positionExposures: {}
      };

      return;
    }

    if (playerData.length === 0) {
      console.warn("No player data available, skipping exposure calculation");
      return;
    }

    // Calculate player exposures
    const playerCounts = {};
    const teamCounts = {};
    const positionCounts = {};

    // Initialize counts
    playerData.forEach(player => {
      playerCounts[player.id] = 0;
      if (!teamCounts[player.team]) {
        teamCounts[player.team] = 0;
      }
      if (!positionCounts[player.position]) {
        positionCounts[player.position] = 0;
      }
    });

    // Count occurrences in lineups
    lineups.forEach(lineup => {
      // Count captain
      if (lineup.cpt && lineup.cpt.id) {
        playerCounts[lineup.cpt.id] = (playerCounts[lineup.cpt.id] || 0) + 1;
        teamCounts[lineup.cpt.team] = (teamCounts[lineup.cpt.team] || 0) + 1;
        positionCounts['CPT'] = (positionCounts['CPT'] || 0) + 1;
      }

      // Count regular players
      if (lineup.players) {
        lineup.players.forEach(player => {
          if (player && player.id) {
            playerCounts[player.id] = (playerCounts[player.id] || 0) + 1;
            teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
            positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
          }
        });
      }
    });

    // Calculate percentages
    const totalLineups = lineups.length;

    // Create maps for calculated exposures
    const playerExposureMap = {};
    const teamExposureMap = {};
    const positionExposureMap = {};

    // Calculate player exposure percentages
    playerData.forEach(player => {
      if (player && player.id) {
        const exposure = playerCounts[player.id]
          ? parseFloat(((playerCounts[player.id] / totalLineups) * 100).toFixed(1))
          : 0;
        playerExposureMap[player.id] = exposure;
      }
    });

    // Calculate team exposure percentages
    Object.keys(teamCounts).forEach(team => {
      if (team) {
        const exposure = parseFloat(((teamCounts[team] / (totalLineups * 6)) * 100).toFixed(1)); // 6 players per lineup (5 + CPT)
        teamExposureMap[team] = exposure;
      }
    });

    // Calculate position exposure percentages
    Object.keys(positionCounts).forEach(position => {
      if (position) {
        let exposure;
        if (position === 'CPT') {
          exposure = parseFloat(((positionCounts[position] / totalLineups) * 100).toFixed(1));
        } else {
          exposure = parseFloat(((positionCounts[position] / (totalLineups * 5)) * 100).toFixed(1)); // 5 regular positions
        }
        positionExposureMap[position] = exposure;
      }
    });

    // First, update the stable ref to avoid race conditions
    stableValuesRef.current = {
      playerExposures: playerExposureMap,
      teamExposures: teamExposureMap,
      positionExposures: positionExposureMap
    };

    // Update all state objects together in one batch to avoid flickering
    setPlayerExposures(prev => {
      return prev.map(player => ({
        ...player,
        actual: playerExposureMap[player.id] || 0
      }));
    });

    setTeamExposures(prev => {
      return prev.map(teamExposure => ({
        ...teamExposure,
        actual: teamExposureMap[teamExposure.team] || 0
      }));
    });

  }, [lineups, playerData]);

  // Save exposure settings function with error handling
  const saveExposureSettings = useCallback((isManual = false) => {
    // Prevent simultaneous saves
    if (isUpdatingRef.current) {
      return;
    }

    isUpdatingRef.current = true;

    try {
      // Create a clean copy of the settings with only the essential data
      const cleanSettings = {
        global: {
          globalMinExposure: globalSettings.globalMinExposure !== undefined ?
            Number(globalSettings.globalMinExposure) : 0,
          globalMaxExposure: globalSettings.globalMaxExposure !== undefined ?
            Number(globalSettings.globalMaxExposure) : 60,
          applyToNewLineups: Boolean(globalSettings.applyToNewLineups),
          prioritizeProjections: Boolean(globalSettings.prioritizeProjections)
        },
        teams: teamExposures.map(team => {
          return {
            team: String(team.team || ''),
            min: team.min === '' || team.min === null || team.min === undefined ? null :
                Number(team.min),
            max: team.max === '' || team.max === null || team.max === undefined ? null :
                Number(team.max),
            target: team.target === '' || team.target === null || team.target === undefined ? null :
                Number(team.target),
            actual: Number(team.actual) || 0
          };
        }),
        players: playerExposures.map(player => {
          return {
            id: String(player.id || ''),
            name: String(player.name || ''),
            team: String(player.team || ''),
            position: String(player.position || ''),
            salary: Number(player.salary) || 0,
            projectedPoints: player.projectedPoints !== undefined ? Number(player.projectedPoints) : 0,
            ownership: player.ownership !== undefined ? Number(player.ownership) : undefined,
            min: player.min === '' || player.min === null || player.min === undefined ? null :
                Number(player.min),
            max: player.max === '' || player.max === null || player.max === undefined ? null :
                Number(player.max),
            target: player.target === '' || player.target === null || player.target === undefined ? null :
                Number(player.target),
            actual: Number(player.actual) || 0
          };
        }),
        positions: Object.entries(positionExposures).reduce((acc, [position, settings]) => {
          acc[position] = {
            min: settings.min === '' || settings.min === null || settings.min === undefined ? null :
                Number(settings.min),
            max: settings.max === '' || settings.max === null || settings.max === undefined ? null :
                Number(settings.max),
            target: settings.target === '' || settings.target === null || settings.target === undefined ? null :
                Number(settings.target)
          };
          return acc;
        }, {}),
        _isManualSave: Boolean(isManual)
      };

      // Call the parent's update function
      if (typeof onUpdateExposures === 'function') {
        // First, save to localStorage as a fallback
        saveToLocalStorage(cleanSettings);

        if (isManual) {
          try {
            // First, save to App state via callback
            onUpdateExposures(cleanSettings);

            // Then try to save directly to the server
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

            fetch(`${API_BASE_URL}/settings/exposure`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(cleanSettings),
              signal: controller.signal
            })
            .then(response => {
              clearTimeout(timeoutId);

              if (!response.ok) {
                return response.text().then(text => {
                  throw new Error(`Server error (${response.status}): ${text || response.statusText}`);
                });
              }

              return response.text().then(text => {
                try {
                  // Try to parse as JSON
                  return text ? JSON.parse(text) : {};
                } catch (e) {
                  // Return as text if not JSON
                  return text || 'Success';
                }
              });
            })
            .then(data => {
              // UI feedback
              const saveButton = document.activeElement;
              if (saveButton && saveButton.classList) {
                const originalBg = saveButton.style.backgroundColor;
                saveButton.style.backgroundColor = '#38a169'; // Success green
                setTimeout(() => {
                  saveButton.style.backgroundColor = originalBg;
                }, 500);
              }

              // Show success notification
              alert('Exposure settings saved successfully!');
            })
            .catch(error => {
              // More debug info
              if (error.name === 'AbortError') {
                alert('Settings saved locally, but server request timed out. Try again or check server status.');
              } else {
                alert(`Settings saved locally, but server error occurred: ${error.message}`);
              }
            });
          } catch (error) {
            alert(`Error during save: ${error.message}`);
          }
        } else {
          // For non-manual saves, just update the App state
          onUpdateExposures(cleanSettings);
        }
      } else {
        // If no save function provided, save to localStorage as fallback
        if (saveToLocalStorage(cleanSettings) && isManual) {
          alert('Settings saved to browser storage (server save not available)');
        } else if (isManual) {
          alert('Unable to save settings - no save method available');
        }
      }
    } catch (error) {
      console.error('Critical error in saveExposureSettings:', error);
      // Show error to user
      if (isManual) {
        alert('Error saving settings. Check console for details.');
      }
    } finally {
      // Reset the updating flag regardless of outcome
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 300);
    }
  }, [globalSettings, playerExposures, teamExposures, positionExposures, onUpdateExposures, API_BASE_URL]);

  // Auto-save settings when tab changes
  useEffect(() => {
    if (initialLoadDone.current) {
      saveExposureSettings(false);
    }
  }, [activeTab, saveExposureSettings]);

  // Apply global exposure settings to all players
  const applyGlobalSettings = () => {
    setPlayerExposures(prev => prev.map(player => ({
      ...player,
      min: globalSettings.globalMinExposure,
      max: globalSettings.globalMaxExposure
    })));

    // Save after applying globals (as a manual save)
    setTimeout(() => saveExposureSettings(true), 100);
  };

  // Update player exposure with debouncing
  const updatePlayerExposure = (playerId, field, value) => {
    // Clear any pending timer first
    if (timersRef.current.playerTimer) {
      clearTimeout(timersRef.current.playerTimer);
    }

    // Parse value if it's a numeric string
    let processedValue = value;
    if (typeof value === 'string' && value !== '' && !isNaN(parseFloat(value))) {
      processedValue = parseFloat(value);
    }

    // Convert empty string to null
    if (value === '') {
      processedValue = null;
    }

    // Store the processed value in state
    setPlayerExposures(prev => {
      return prev.map(player => {
        if (player.id === playerId) {
          return { ...player, [field]: processedValue };
        }
        return player;
      });
    });

    // Save after a short delay
    timersRef.current.playerTimer = setTimeout(() => {
      saveExposureSettings(false);
    }, 800);
  };

  // Update team exposure with debouncing
  const updateTeamExposure = (teamName, field, value) => {
    // Clear any pending timer first
    if (timersRef.current.teamTimer) {
      clearTimeout(timersRef.current.teamTimer);
    }

    // Parse value if it's a numeric string
    let processedValue = value;
    if (typeof value === 'string' && value !== '' && !isNaN(parseFloat(value))) {
      processedValue = parseFloat(value);
    }

    // Convert empty string to null
    if (value === '') {
      processedValue = null;
    }

    // Store the processed value in state
    setTeamExposures(prev => {
      return prev.map(team => {
        if (team.team === teamName) {
          return { ...team, [field]: processedValue };
        }
        return team;
      });
    });

    // Save after a short delay
    timersRef.current.teamTimer = setTimeout(() => {
      saveExposureSettings(false);
    }, 800);
  };

  // Update position exposure with debouncing
  const updatePositionExposure = (position, field, value) => {
    // Clear any pending timer first
    if (timersRef.current.positionTimer) {
      clearTimeout(timersRef.current.positionTimer);
    }

    // Parse value if it's a numeric string
    let processedValue = value;
    if (typeof value === 'string' && value !== '' && !isNaN(parseFloat(value))) {
      processedValue = parseFloat(value);
    }

    // Convert empty string to null
    if (value === '') {
      processedValue = null;
    }

    // Store the processed value in state
    setPositionExposures(prev => {
      return {
        ...prev,
        [position]: { ...prev[position], [field]: processedValue }
      };
    });

    // Save after a short delay
    timersRef.current.positionTimer = setTimeout(() => {
      saveExposureSettings(false);
    }, 800);
  };

  // Generate lineups with current exposure settings
  const generateLineups = (count) => {
    // First save the settings (as a manual save)
    saveExposureSettings(true);

    // Then call the parent's function to generate lineups
    if (onGenerateLineups) {
      const options = {
        exposureSettings: {
          global: globalSettings,
          players: playerExposures,
          teams: teamExposures,
          positions: positionExposures
        }
      };

      onGenerateLineups(count, options);
    } else {
      alert('Lineup generation function not available');
    }
  };

  // Update global settings
  const updateGlobalSettings = (field, value) => {
    // Handle special case for numeric values
    let processedValue = value;
    if (typeof value === 'string' && !isNaN(parseFloat(value))) {
      processedValue = parseFloat(value);
    }

    setGlobalSettings(prev => ({
      ...prev,
      [field]: processedValue
    }));

    // Save after a short delay
    if (timersRef.current.globalTimer) {
      clearTimeout(timersRef.current.globalTimer);
    }

    timersRef.current.globalTimer = setTimeout(() => {
      saveExposureSettings(false);
    }, 800);
  };

  // Filter players based on search term and filters
  const filteredPlayers = playerExposures.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || player.position === positionFilter;
    const matchesTeam = teamFilter === 'ALL' || player.team === teamFilter;

    return matchesSearch && matchesPosition && matchesTeam;
  });

  // NEW SORTING FUNCTION
  // Create a more robust sorting function that creates a brand new array
  const getSortedPlayers = () => {
    console.log(`Sorting ${filteredPlayers.length} players by ${sortBy} in ${sortDirection} direction`);

    // Create a completely new array - important to avoid reference issues
    const newArray = JSON.parse(JSON.stringify(filteredPlayers));

    return newArray.sort((a, b) => {
      // For debugging - log a few values during sort
      if (a.id === newArray[0]?.id) {
        console.log(`First player before sort: ${a.name} (${a[sortBy]})`);
      }

      let comparison = 0;

      // Create sort logic based on field type
      switch (sortBy) {
        case 'name':
          comparison = String(a.name || '').localeCompare(String(b.name || ''));
          break;
        case 'team':
          comparison = String(a.team || '').localeCompare(String(b.team || ''));
          break;
        case 'position':
          comparison = String(a.position || '').localeCompare(String(b.position || ''));
          break;
        case 'salary':
          comparison = (Number(b.salary || 0) - Number(a.salary || 0));
          break;
        case 'projection':
          comparison = (Number(b.projectedPoints || 0) - Number(a.projectedPoints || 0));
          break;
        case 'ownership':
          comparison = (Number(b.ownership || 0) - Number(a.ownership || 0));
          break;
        case 'exposure':
          comparison = (Number(b.actual || 0) - Number(a.actual || 0));
          break;
        default:
          comparison = (Number(b.projectedPoints || 0) - Number(a.projectedPoints || 0));
      }

      // Apply sort direction
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  };

  // Create data arrays for charts and tables on demand from the stable ref
  const getTeamExposureData = useCallback(() => {
    const teamExposureValues = stableValuesRef.current.teamExposures;
    return Object.keys(teamExposureValues || {}).map(team => ({
      team,
      exposure: teamExposureValues[team] || 0
    })).sort((a, b) => b.exposure - a.exposure);
  }, []);

  const getPositionExposureData = useCallback(() => {
    const positionExposureValues = stableValuesRef.current.positionExposures;
    return Object.keys(positionExposureValues || {}).map(position => ({
      position,
      exposure: positionExposureValues[position] || 0
    }));
  }, []);

  // Get unique teams for filter
  const teams = ['ALL', ...new Set(playerData.map(player => player.team))].filter(Boolean);

  // Get unique positions for filter
  const positions = ['ALL', 'TOP', 'JNG', 'MID', 'ADC', 'SUP', 'CPT'];

  // Helper function to determine if exposure is outside limits
  const isExposureOutsideLimits = (player) => {
    if (player.min !== null && player.actual < player.min) return 'below';
    if (player.max !== null && player.actual > player.max) return 'above';
    return null;
  };

  // Helper function to get color based on exposure status
  const getExposureColor = (player) => {
    const status = isExposureOutsideLimits(player);
    if (status === 'below') return '#f56565'; // Red for below min
    if (status === 'above') return '#f6ad55'; // Orange for above max
    return '#4fd1c5'; // Default teal
  };

  // Helper for team exposures
  const getTeamExposureColor = (team) => {
    const actual = team.actual;
    if (team.min !== null && actual < team.min) return '#f56565'; // Red for below min
    if (team.max !== null && actual > team.max) return '#f6ad55'; // Orange for above max
    return '#4fd1c5'; // Default teal
  };

  // Helper for position exposures
  const getPositionExposureColor = (position, settings) => {
    const actual = stableValuesRef.current.positionExposures?.[position] || 0;
    if (settings.min !== null && actual < settings.min) return '#f56565'; // Red for below min
    if (settings.max !== null && actual > settings.max) return '#f6ad55'; // Orange for above max
    return '#4fd1c5'; // Default teal
  };

  // Batch update multiple player exposures
  const batchUpdatePlayerExposures = () => {
    // Open modal or expand a section for batch operations
    alert('Batch update functionality coming soon!');
  };

  // Import exposure settings from CSV or JSON
  const importExposureSettings = () => {
    // Open file dialog or drag-drop area
    alert('Import functionality coming soon!');
  };

  // Export exposure settings to CSV or JSON
  const exportExposureSettings = () => {
    // Generate file and trigger download
    alert('Export functionality coming soon!');
  };

  return (
    <div>
      <h2 className="card-title">Exposure Control</h2>

      <div className="tabs-container">
        <ul style={{ listStyle: 'none', display: 'flex' }}>
          {['players', 'teams', 'positions', 'settings'].map(tab => (
            <li key={tab} style={{ marginRight: '0.5rem' }}>
              <button
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#4fd1c5' }}>Player Exposure</h3>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div>
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  style={{ width: '100px' }}
                >
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  style={{ width: '120px' }}
                >
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ width: '140px' }}
                >
                  <option value="projection">Projection</option>
                  <option value="ownership">Ownership</option>
                  <option value="exposure">Current Exposure</option>
                  <option value="name">Name</option>
                  <option value="team">Team</option>
                  <option value="position">Position</option>
                  <option value="salary">Salary</option>
                </select>
              </div>
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="btn"
                style={{ backgroundColor: 'transparent', border: '1px solid #90cdf4', color: '#90cdf4' }}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="table-container" style={{ height: '400px', overflow: 'auto' }}>
            <table key={`player-table-${sortBy}-${sortDirection}`}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Team</th>
                  <th>Salary</th>
                  <th>Proj. Pts</th>
                  <th>Ownership</th>
                  <th>Current</th>
                  <th>Min %</th>
                  <th>Max %</th>
                  <th>Target %</th>
                </tr>
              </thead>
              <tbody>
                {getSortedPlayers().length > 0 ? (
                  getSortedPlayers().map((player, index) => (
                    <tr key={`${player.id}-${index}-${sortBy}-${sortDirection}`}>
                      <td>{player.name}</td>
                      <td style={{ color: '#4fd1c5' }}>{player.position}</td>
                      <td>{player.team}</td>
                      <td>${(player.salary || 0).toLocaleString()}</td>
                      <td style={{ fontWeight: 'bold', color: '#10b981' }}>
                        {player.projectedPoints !== undefined && player.projectedPoints !== null
                            ? Number(player.projectedPoints).toFixed(1)
                            : "0.0"}
                      </td>
                      <td style={{ color: '#9f7aea' }}>
                        {player.ownership !== undefined && player.ownership !== null
                          ? Number(player.ownership).toFixed(1)
                          : "0.0"}%
                      </td>
                      <td style={{
                        fontWeight: 'bold',
                        color: getExposureColor(player)
                      }}>
                        {player.actual}%
                      </td>
                      <td>
                        <input
                          type="text"
                          value={player.min === null ? '' : player.min}
                          onChange={(e) => {
                            // Store input directly as string until blur
                            const inputValue = e.target.value;
                            setPlayerExposures(prev => prev.map(p =>
                              p.id === player.id ? { ...p, min: inputValue } : p
                            ));
                          }}
                          onBlur={(e) => {
                            // On blur, convert to number if valid
                            const value = e.target.value === '' ? null :
                                        !isNaN(parseFloat(e.target.value)) ?
                                        parseFloat(e.target.value) : player.min;
                            updatePlayerExposure(player.id, 'min', value);
                          }}
                          style={{ width: '60px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={player.max === null ? '' : player.max}
                          onChange={(e) => {
                            // Store input directly as string until blur
                            const inputValue = e.target.value;
                            setPlayerExposures(prev => prev.map(p =>
                              p.id === player.id ? { ...p, max: inputValue } : p
                            ));
                          }}
                          onBlur={(e) => {
                            // On blur, convert to number if valid
                            const value = e.target.value === '' ? null :
                                        !isNaN(parseFloat(e.target.value)) ?
                                        parseFloat(e.target.value) : player.max;
                            updatePlayerExposure(player.id, 'max', value);
                          }}
                          style={{ width: '60px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={player.target === null ? '' : player.target}
                          onChange={(e) => {
                            // Store input directly as string until blur
                            const inputValue = e.target.value;
                            setPlayerExposures(prev => prev.map(p =>
                              p.id === player.id ? { ...p, target: inputValue } : p
                            ));
                          }}
                          onBlur={(e) => {
                            // On blur, convert to number if valid
                            const value = e.target.value === '' ? null :
                                        !isNaN(parseFloat(e.target.value)) ?
                                        parseFloat(e.target.value) : player.target;
                            updatePlayerExposure(player.id, 'target', value);
                          }}
                          style={{ width: '60px' }}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                      No player data available. Please ensure player projections are loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <div>
              <span style={{ color: '#4fd1c5', marginRight: '0.5rem' }}>
                {filteredPlayers.length}
              </span>
              players shown out of {playerExposures.length} total
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPositionFilter('ALL');
                  setTeamFilter('ALL');
                }}
                className="btn"
                style={{ backgroundColor: 'transparent', border: '1px solid #90cdf4', color: '#90cdf4' }}
              >
                Reset Filters
              </button>
              <button
                onClick={batchUpdatePlayerExposures}
                className="btn"
                style={{ backgroundColor: '#805ad5', color: 'white' }}
              >
                Batch Update
              </button>
              <button
                onClick={() => saveExposureSettings(true)}
                className="btn btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="card">
          <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Team Exposure</h3>

          <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getTeamExposureData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                  <XAxis type="number" tickFormatter={(tick) => `${tick}%`} stroke="#90cdf4" />
                  <YAxis dataKey="team" type="category" stroke="#90cdf4" width={80} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Exposure']}
                    contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }}
                  />
                  <Bar dataKey="exposure" fill="#4fd1c5" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-container" style={{ height: '300px', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Current</th>
                    <th>Min %</th>
                    <th>Max %</th>
                    <th>Target %</th>
                  </tr>
                </thead>
                <tbody>
                  {teamExposures.length > 0 ? (
                    teamExposures.map(team => (
                      <tr key={team.team}>
                        <td>{team.team}</td>
                        <td style={{
                          fontWeight: 'bold',
                          color: getTeamExposureColor(team)
                        }}>
                          {team.actual}%
                        </td>
                        <td>
                          <input
                            type="text"
                            value={team.min === null ? '' : team.min}
                            onChange={(e) => {
                              // Store input directly as string until blur
                              const inputValue = e.target.value;
                              setTeamExposures(prev => prev.map(t =>
                                t.team === team.team ? { ...t, min: inputValue } : t
                              ));
                            }}
                            onBlur={(e) => {
                              // On blur, convert to number if valid
                              const value = e.target.value === '' ? null :
                                          !isNaN(parseFloat(e.target.value)) ?
                                          parseFloat(e.target.value) : team.min;
                              updateTeamExposure(team.team, 'min', value);
                            }}
                            style={{ width: '60px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={team.max === null ? '' : team.max}
                            onChange={(e) => {
                              // Store input directly as string until blur
                              const inputValue = e.target.value;
                              setTeamExposures(prev => prev.map(t =>
                                t.team === team.team ? { ...t, max: inputValue } : t
                              ));
                            }}
                            onBlur={(e) => {
                              // On blur, convert to number if valid
                              const value = e.target.value === '' ? null :
                                          !isNaN(parseFloat(e.target.value)) ?
                                          parseFloat(e.target.value) : team.max;
                              updateTeamExposure(team.team, 'max', value);
                            }}
                            style={{ width: '60px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={team.target === null ? '' : team.target}
                            onChange={(e) => {
                              // Store input directly as string until blur
                              const inputValue = e.target.value;
                              setTeamExposures(prev => prev.map(t =>
                                t.team === team.team ? { ...t, target: inputValue } : t
                              ));
                            }}
                            onBlur={(e) => {
                              // On blur, convert to number if valid
                              const value = e.target.value === '' ? null :
                                          !isNaN(parseFloat(e.target.value)) ?
                                          parseFloat(e.target.value) : team.target;
                              updateTeamExposure(team.team, 'target', value);
                            }}
                            style={{ width: '60px' }}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                        No team data available. Please ensure player projections are loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              onClick={() => saveExposureSettings(true)}
              className="btn btn-primary"
            >
              Save Team Settings
            </button>
          </div>
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="card">
          <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Position Exposure</h3>

          <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getPositionExposureData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                  <XAxis dataKey="position" stroke="#90cdf4" />
                  <YAxis tickFormatter={(tick) => `${tick}%`} stroke="#90cdf4" />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Exposure']}
                    contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }}
                  />
                  <Bar dataKey="exposure" fill="#38b2ac" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Current</th>
                    <th>Min %</th>
                    <th>Max %</th>
                    <th>Target %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(positionExposures).map(([position, settings]) => {
                    return (
                      <tr key={position}>
                        <td style={{ color: '#4fd1c5' }}>{position}</td>
                        <td style={{
                          fontWeight: 'bold',
                          color: getPositionExposureColor(position, settings)
                        }}>
                          {stableValuesRef.current.positionExposures?.[position] || 0}%
                        </td>
                        <td>
                          <input
                            type="text"
                            value={settings.min === null ? '' : settings.min}
                            onChange={(e) => {
                              // Store input directly as string until blur
                              const inputValue = e.target.value;
                              setPositionExposures(prev => ({
                                ...prev,
                                [position]: { ...prev[position], min: inputValue }
                              }));
                            }}
                            onBlur={(e) => {
                              // On blur, convert to number if valid
                              const value = e.target.value === '' ? null :
                                          !isNaN(parseFloat(e.target.value)) ?
                                          parseFloat(e.target.value) : settings.min;
                              updatePositionExposure(position, 'min', value);
                            }}
                            style={{ width: '60px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={settings.max === null ? '' : settings.max}
                            onChange={(e) => {
                              // Store input directly as string until blur
                              const inputValue = e.target.value;
                              setPositionExposures(prev => ({
                                ...prev,
                                [position]: { ...prev[position], max: inputValue }
                              }));
                            }}
                            onBlur={(e) => {
                              // On blur, convert to number if valid
                              const value = e.target.value === '' ? null :
                                          !isNaN(parseFloat(e.target.value)) ?
                                          parseFloat(e.target.value) : settings.max;
                              updatePositionExposure(position, 'max', value);
                            }}
                            style={{ width: '60px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={settings.target === null ? '' : settings.target}
                            onChange={(e) => {
                              // Store input directly as string until blur
                              const inputValue = e.target.value;
                              setPositionExposures(prev => ({
                                ...prev,
                                [position]: { ...prev[position], target: inputValue }
                              }));
                            }}
                            onBlur={(e) => {
                              // On blur, convert to number if valid
                              const value = e.target.value === '' ? null :
                                          !isNaN(parseFloat(e.target.value)) ?
                                          parseFloat(e.target.value) : settings.target;
                              updatePositionExposure(position, 'target', value);
                            }}
                            style={{ width: '60px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              onClick={() => saveExposureSettings(true)}
              className="btn btn-primary"
            >
              Save Position Settings
            </button>
          </div>
        </div>
      )}

      {/* Global Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Global Exposure Settings</h3>

          <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
            <div>
              <label className="form-label">Default Min Exposure %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={globalSettings.globalMinExposure}
                onChange={(e) => {
                  // Store as a proper number, not a string
                  const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  updateGlobalSettings('globalMinExposure', newValue);
                }}
              />
              <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                Minimum exposure percentage for any player
              </p>
            </div>

            <div>
              <label className="form-label">Default Max Exposure %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={globalSettings.globalMaxExposure}
                onChange={(e) => {
                  // Store as a proper number, not a string
                  const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  updateGlobalSettings('globalMaxExposure', newValue);
                }}
              />
              <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                Maximum exposure percentage for any player
              </p>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={globalSettings.applyToNewLineups}
                onChange={(e) => updateGlobalSettings('applyToNewLineups', e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              Apply exposure constraints to newly generated lineups
            </label>
            <p style={{ color: '#90cdf4', fontSize: '0.875rem', marginLeft: '1.5rem' }}>
              When enabled, the optimizer will enforce these exposure settings when generating new lineups
            </p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={globalSettings.prioritizeProjections}
                onChange={(e) => updateGlobalSettings('prioritizeProjections', e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              Prioritize higher projected players when enforcing exposure limits
            </label>
            <p style={{ color: '#90cdf4', fontSize: '0.875rem', marginLeft: '1.5rem' }}>
              When enabled, the optimizer will prioritize players with higher projections when enforcing exposure constraints
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <div>
              <button
                onClick={applyGlobalSettings}
                className="btn"
                style={{ backgroundColor: 'transparent', border: '1px solid #90cdf4', color: '#90cdf4', marginRight: '0.5rem' }}
              >
                Apply Global Settings to All Players
              </button>
              <button
                onClick={importExposureSettings}
                className="btn"
                style={{ backgroundColor: '#805ad5', color: 'white', marginRight: '0.5rem' }}
              >
                Import Settings
              </button>
              <button
                onClick={exportExposureSettings}
                className="btn"
                style={{ backgroundColor: '#3182ce', color: 'white' }}
              >
                Export Settings
              </button>
            </div>

            <button
              onClick={() => saveExposureSettings(true)}
              className="btn btn-primary"
            >
              Save All Settings
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Exposure Status</h3>

        <div className="grid grid-cols-3">
          <div className="stat-card">
            <h4 style={{ color: '#90cdf4' }}>Players Over Max</h4>
            <p className="stat-value" style={{ color: '#f6ad55' }}>
              {playerExposures.filter(p => p.max !== null && p.actual > p.max).length}
            </p>
            <p className="stat-label">players exceed max exposure</p>
          </div>

          <div className="stat-card">
            <h4 style={{ color: '#90cdf4' }}>Players Under Min</h4>
            <p className="stat-value" style={{ color: '#f56565' }}>
              {playerExposures.filter(p => p.min !== null && p.actual < p.min).length}
            </p>
            <p className="stat-label">players below min exposure</p>
          </div>

          <div className="stat-card">
            <h4 style={{ color: '#90cdf4' }}>Teams Unbalanced</h4>
            <p className="stat-value" style={{ color: '#4fd1c5' }}>
              {teamExposures.filter(t =>
                (t.min !== null && t.actual < t.min) ||
                (t.max !== null && t.actual > t.max)
              ).length}
            </p>
            <p className="stat-label">teams need attention</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          {/* Show a "No Lineups" message if there are no lineups */}
          {lineups.length === 0 ? (
            <div style={{ width: '100%', textAlign: 'center', padding: '1rem', color: '#f56565' }}>
              No lineups imported or generated yet. Import lineups or generate new lineups to see exposure data.
            </div>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={() => generateLineups(5)}
              >
                Generate 5 New Optimal Lineups
              </button>

              <button
                className="btn btn-success"
                onClick={() => alert('Rebalance functionality coming soon')}
              >
                Rebalance Lineups to Meet Exposure Goals
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExposureControl;