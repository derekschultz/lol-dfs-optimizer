import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, BarChart, Bar } from 'recharts';
import './blue-theme.css';
import './team-stacks.css';
import ExposureControl from './components/ExposureControl';
import TeamStacks from './components/TeamStacks';
import OptimizerPage from './pages/OptimizerPage';
import LineupList from './components/LineupList';

const App = () => {
  // API base URL - this matches the port in our server.js
  const API_BASE_URL = 'http://localhost:3001';

  // State variables
  const [simResults, setSimResults] = useState(null);
  const [lineups, setLineups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    iterations: 2000,
    fieldSize: 1176,
    entryFee: 5,
    outputDir: './output',
    maxWorkers: 4
  });
  const [activeTab, setActiveTab] = useState('upload');
  const [playerData, setPlayerData] = useState([]);
  const [stackData, setStackData] = useState([]);
  const [importMethod, setImportMethod] = useState('dkEntries');
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  // Add exposure settings state to store at App level for persistence
  const [exposureSettings, setExposureSettings] = useState({
    global: {
      globalMinExposure: 0,
      globalMaxExposure: 60,
      applyToNewLineups: true,
      prioritizeProjections: true
    },
    players: [],
    teams: [],
    positions: {
      TOP: { min: 0, max: 100, target: null },
      JNG: { min: 0, max: 100, target: null },
      MID: { min: 0, max: 100, target: null },
      ADC: { min: 0, max: 100, target: null },
      SUP: { min: 0, max: 100, target: null },
      CPT: { min: 0, max: 100, target: null }
    }
  });

  // Debug function to monitor state changes
  useEffect(() => {
    console.log('--- APP STATE DEBUG ---');
    console.log('Player data count:', playerData.length);
    console.log('Exposure settings players count:', exposureSettings.players.length);
    console.log('Lineups count:', lineups.length);
    if (playerData.length > 0 && playerData[0]) {
      console.log('First player sample:', {
        id: playerData[0].id,
        name: playerData[0].name,
        projectedPoints: playerData[0].projectedPoints,
        ownership: playerData[0].ownership,
      });
    }
    console.log('----------------------');
  }, [playerData.length, exposureSettings.players.length, lineups.length]);

  // Function to show notification
  const displayNotification = (message, type = 'success') => {
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
      console.log('Initializing exposure settings from player data:', playerData.length);
      // Only initialize if we don't already have player exposure settings
      const initialPlayerExposures = playerData.map(player => ({
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
        actual: 0
      }));

      // Extract unique teams
      const teams = [...new Set(playerData.map(player => player.team))].filter(Boolean);
      const initialTeamExposures = teams.map(team => ({
        team,
        min: 0,
        max: 100,
        target: null,
        actual: 0
      }));

      // Debug output
      console.log('Created initial player exposures:', initialPlayerExposures.length);
      console.log('Created initial team exposures:', initialTeamExposures.length);

      // Update exposure settings with the initialized data
      setExposureSettings(prev => ({
        ...prev,
        players: initialPlayerExposures,
        teams: initialTeamExposures
      }));
    }
  }, [playerData, exposureSettings.global, exposureSettings.players.length]);

  // Load all initial data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);

      try {
        console.log('Initializing app data from backend...');

        // Load each data type in parallel for better performance
        const [playersRes, stacksRes, settingsRes, lineupsRes, exposureRes] = await Promise.all([
          fetch(`${API_BASE_URL}/players/projections`).catch(err => {
            console.error('Error fetching player projections:', err);
            return { ok: false };
          }),
          fetch(`${API_BASE_URL}/teams/stacks`).catch(err => {
            console.error('Error fetching team stacks:', err);
            return { ok: false };
          }),
          fetch(`${API_BASE_URL}/settings`).catch(err => {
            console.error('Error fetching settings:', err);
            return { ok: false };
          }),
          fetch(`${API_BASE_URL}/lineups`).catch(err => {
            console.error('Error fetching lineups:', err);
            return { ok: false };
          }),
          fetch(`${API_BASE_URL}/settings/exposure`).catch(err => {
            console.error('Error fetching exposure settings:', err);
            return { ok: false };
          })
        ]);

        // Process player projections
        if (playersRes.ok) {
          const rawPlayers = await playersRes.json();

          // Process ROO data to set projectedPoints from Median if available
          const processedPlayers = rawPlayers.map(player => {
            return {
              ...player,
              projectedPoints: player.projectedPoints !== undefined ? Number(player.projectedPoints) : 0,
              ownership: player.ownership !== undefined ? Number(player.ownership) : undefined,
            };
          });

          console.log('Loaded player projections:', processedPlayers.length);
          // Debug log to check a few players
          if (processedPlayers.length > 0) {
            console.log('First few players:', processedPlayers.slice(0, 3));
          }
          setPlayerData(processedPlayers);
        } else {
          console.error('Failed to load player projections');
        }

        // Process team stacks
        if (stacksRes.ok) {
          const stacks = await stacksRes.json();
          console.log('Loaded team stacks:', stacks.length);

          // Enhanced team stacks with additional data for the team stacks view
          const enhancedStacks = stacks.map(stack => {
            // Get all players for this team
            const teamPlayers = playerData.filter(p => p.team === stack.team);

            // Calculate total projection for the team
            const totalProjection = teamPlayers.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);

            // Add additional properties
            return {
              ...stack,
              totalProjection,
              poolExposure: teamPlayers.reduce((sum, p) => sum + (p.ownership || 0), 0) / Math.max(1, teamPlayers.length),
              status: '—' // Default status
            };
          });

          setStackData(enhancedStacks);
        } else {
          console.error('Failed to load team stacks');
        }

        // Process settings
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          console.log('Loaded settings');
          setSettings(settingsData);
        } else {
          console.error('Failed to load settings');
        }

        // Process lineups
        if (lineupsRes.ok) {
          const lineupsData = await lineupsRes.json();
          console.log('Loaded lineups:', lineupsData.length);

          // Add NexusScore and ROI properties to each lineup
          const enhancedLineups = lineupsData.map(lineup => {
            // Calculate NexusScore based on lineup data
            const allPlayers = lineup.cpt ? [lineup.cpt, ...(lineup.players || [])] : (lineup.players || []);
            const teamCounts = {};

            allPlayers.forEach(player => {
              if (player && player.team) {
                teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
              }
            });

            // Calculate total projection
            let totalProj = 0;
            if (lineup.cpt) {
              const cptPlayer = playerData.find(p => p.id === lineup.cpt.id);
              const cptProj = cptPlayer?.projectedPoints || 0;
              totalProj += cptProj * 1.5; // CPT gets 1.5x
            }

            // Add regular players' projections
            totalProj += (lineup.players || [])
              .map(p => {
                const fullPlayer = playerData.find(fp => fp.id === p.id);
                return fullPlayer?.projectedPoints || p.projectedPoints || 0;
              })
              .reduce((sum, proj) => sum + proj, 0);

            // Calculate average ownership
            const totalOwnership = allPlayers.reduce((sum, p) => {
              const fullPlayer = playerData.find(fp => fp.id === p.id);
              return sum + (fullPlayer?.ownership || p.ownership || 0);
            }, 0);

            const avgOwn = allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

            // Calculate stack bonus
            let stackBonus = 0;
            Object.values(teamCounts).forEach(count => {
              if (count >= 3) stackBonus += (count - 2) * 3;
            });

            // Calculate NexusScore
            const ownership = Math.max(0.1, avgOwn / 100);
            const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
            const nexusScore = ((totalProj * leverageFactor) + stackBonus) / 7;

            // Calculate ROI based on NexusScore
            const roi = ((nexusScore / 100) * 2 + Math.random() * 0.5).toFixed(2);

            return {
              ...lineup,
              nexusScore: Math.round(nexusScore * 10) / 10,
              roi
            };
          });

          setLineups(enhancedLineups);
        } else {
          console.error('Failed to load lineups');
        }

        // Process exposure settings if endpoint exists
        if (exposureRes && exposureRes.ok) {
          try {
            const exposureData = await exposureRes.json();
            console.log('Loaded exposure settings');
            setExposureSettings(exposureData);
          } catch (error) {
            console.error('Failed to parse exposure settings:', error);
          }
        }

        displayNotification('App data loaded successfully!');
      } catch (error) {
        console.error('Failed to initialize app data:', error);
        displayNotification('Error loading app data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Handle file upload - MODIFIED WITH IMPROVED FILE DETECTION
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    // Declare this variable at function scope so it's accessible throughout the function
    let isLolFormat = false;

    try {
      setIsLoading(true);
      displayNotification(`Processing ${file.name}...`);

      let endpoint;

      // Check file format first
      if (fileExt === 'csv') {
        // Preview file content to detect format
        const fileContent = await readFilePreview(file, 2000);
        console.log('File preview:', fileContent.substring(0, 500) + '...');

        // IMPROVED DETECTION LOGIC - More specific identification of file types
        // Check for DraftKings lineups (has Entry ID, Contest ID columns)
        const isDraftKingsFile = fileContent.includes('Entry ID') &&
                               (fileContent.includes('Contest ID') ||
                                fileContent.includes('Contest Name'));

        // Check for ROO projections (has the specific stats columns)
        const isRooProjectionsFile = fileContent.includes('Median') &&
                                   (fileContent.includes('Floor') ||
                                    fileContent.includes('Ceiling'));

        // Check for team stacks file
        const isStacksFile = fileContent.includes('Stack+') ||
                           (fileContent.includes('Team') && fileContent.includes('Stack')) ||
                           fileContent.includes('Fantasy');

        // Check for LoL format as a fallback
        isLolFormat = fileContent.includes('TOP') &&
                      fileContent.includes('JNG') &&
                      fileContent.includes('MID') &&
                      fileContent.includes('ADC') &&
                      fileContent.includes('SUP');

        // Clear messaging for user about detected file type
        if (isRooProjectionsFile) {
          console.log('Detected ROO format with Median projection column');
          displayNotification('Detected ROO format with player projections', 'info');
          endpoint = `${API_BASE_URL}/players/projections/upload`;
        }
        else if (isStacksFile) {
          console.log('Detected team stacks file');
          displayNotification('Detected team stacks file', 'info');
          endpoint = `${API_BASE_URL}/teams/stacks/upload`;
        }
        else if (isDraftKingsFile) {
          console.log('Detected DraftKings entries file');
          displayNotification('Detected DraftKings entries file', 'info');
          endpoint = `${API_BASE_URL}/lineups/dkentries`;
        }
        else if (isLolFormat) {
          console.log('Detected League of Legends DraftKings format');
          displayNotification('Detected League of Legends DraftKings format', 'info');
          endpoint = `${API_BASE_URL}/lineups/dkentries`;
        }
        else {
          // Fallback to filename-based detection for edge cases
          if (file.name.toLowerCase().includes('roo_export')) {
            endpoint = `${API_BASE_URL}/players/projections/upload`;
            displayNotification('Using filename to detect as ROO projections file', 'info');
          }
          else if (file.name.toLowerCase().includes('stacks')) {
            endpoint = `${API_BASE_URL}/teams/stacks/upload`;
            displayNotification('Using filename to detect as team stacks file', 'info');
          }
          else if (file.name.toLowerCase().includes('dkentries')) {
            endpoint = `${API_BASE_URL}/lineups/dkentries`;
            displayNotification('Using filename to detect as DraftKings entries file', 'info');
          }
          else {
            displayNotification('Unknown CSV file type. Please rename with proper prefix.', 'warning');
            setIsLoading(false);
            return;
          }
        }
      } else if (fileExt === 'json') {
        endpoint = `${API_BASE_URL}/lineups/import`;
      } else {
        displayNotification('Unsupported file type', 'error');
        setIsLoading(false);
        return;
      }

      console.log(`Uploading ${file.name} to endpoint: ${endpoint}`);

      const formData = new FormData();
      formData.append('file', file);
      // Add additional metadata to help server-side debugging
      formData.append('originalFilename', file.name);
      formData.append('fileSize', file.size);
      formData.append('contentType', file.type);

      // Flag if this is LoL format - using isLolFormat which is now in scope
      if (endpoint.includes('dkentries') && isLolFormat) {
        formData.append('format', 'lol');
      }

      // Make the API call
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      console.log('Response status:', response.status);

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
      console.log('Upload success:', result);

      // Update state based on the endpoint
      if (endpoint.includes('dkentries') || endpoint.includes('lineups')) {
        if (result.lineups && Array.isArray(result.lineups)) {
          // Add NexusScore and ROI to lineups
          const enhancedLineups = result.lineups.map(lineup => {
            // Simulate NexusScore and ROI calculation
            const nexusScore = Math.round(Math.random() * 50 + 70); // Random score between 70-120
            const roi = (Math.random() * 2 + 0.5).toFixed(2); // Random ROI between 0.5-2.5

            return {
              ...lineup,
              nexusScore,
              roi
            };
          });

          setLineups(prevLineups => [...prevLineups, ...enhancedLineups]);
          displayNotification(`Loaded ${result.lineups.length} lineups!`);

          // Switch to the lineups tab after successful load
          setActiveTab('lineups');
        } else {
          displayNotification('Unexpected response format for lineups', 'error');
        }
      } else if (endpoint.includes('projections')) {
        // Refresh player data
        const playersRes = await fetch(`${API_BASE_URL}/players/projections`);
        if (playersRes.ok) {
          const rawPlayers = await playersRes.json();

          const processedPlayers = rawPlayers.map(player => {
            return {
              ...player,
              projectedPoints: player.projectedPoints !== undefined ? Number(player.projectedPoints) : 0,
             ownership : player.ownership !== undefined ? Number(player.ownership) : undefined,
            };
          });

          // Debug log to check if Median is preserved
          if (processedPlayers.length > 0) {
            console.log('First few players after upload:', processedPlayers.slice(0, 3));
          }

          setPlayerData(processedPlayers);

          // Re-initialize exposure settings for new player data
          if (exposureSettings.global.applyToNewLineups) {
            const initialPlayerExposures = processedPlayers.map(player => ({
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
              actual: 0
            }));

            // Extract unique teams
            const teams = [...new Set(processedPlayers.map(player => player.team))].filter(Boolean);
            const initialTeamExposures = teams.map(team => ({
              team,
              min: 0,
              max: 100,
              target: null,
              actual: 0
            }));

            // Update exposure settings with the initialized data
            setExposureSettings(prev => ({
              ...prev,
              players: initialPlayerExposures,
              teams: initialTeamExposures
            }));
          }
        }
        displayNotification('Player projections uploaded successfully!');
      } else if (endpoint.includes('stacks')) {
        // Refresh team stacks
        const stacksRes = await fetch(`${API_BASE_URL}/teams/stacks`);
        if (stacksRes.ok) {
          const stacks = await stacksRes.json();
          setStackData(stacks);
        }
        displayNotification('Team stacks uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      displayNotification(`Error uploading file: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
      // Reset file input to allow uploading the same file again
      event.target.value = '';
    }
  };

  /**
   * Read a preview of the file contents
   * @param {File} file - The file to read
   * @param {number} maxChars - Maximum characters to read
   * @returns {Promise<string>} - File preview
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

  // Run simulation
  const runSimulation = async () => {
    try {
      setIsLoading(true);

      // Validate we have lineups to simulate
      if (lineups.length === 0) {
        displayNotification('No lineups to simulate. Please import or generate lineups first.', 'error');
        setIsLoading(false);
        return;
      }

      // Create the simulation request payload
      const simulationRequest = {
        settings,
        lineups: lineups.map(lineup => lineup.id) // Send only lineup IDs to minimize payload size
      };

      console.log('Running simulation with request:', simulationRequest);

      // Call the API to run the simulation
      const response = await fetch(`${API_BASE_URL}/simulation/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(simulationRequest)
      });

      if (!response.ok) {
        let errorMessage = `Simulation failed: ${response.status} ${response.statusText}`;
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

      // Get the simulation results
      const results = await response.json();
      console.log('Simulation results received:', results);

      setSimResults(results);
      setActiveTab('results');
      displayNotification('Simulation completed successfully!');
    } catch (error) {
      console.error('Simulation error:', error);
      displayNotification(`Error running simulation: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate lineups for the "Generate 5 Optimal Lineups" button
  const generateLineups = async (count) => {
    try {
      setIsLoading(true);

      // Validate we have necessary data
      if (playerData.length === 0) {
        displayNotification('No player projections loaded. Please upload player data first.', 'error');
        setIsLoading(false);
        return;
      }

      if (stackData.length === 0) {
        displayNotification('No team stacks loaded. Please upload team stack data first.', 'error');
        setIsLoading(false);
        return;
      }

      // Validate we have run a simulation first
      if (!simResults) {
        displayNotification('Please run a simulation first before generating lineups.', 'error');
        setIsLoading(false);
        return;
      }

      // Create the lineup generation request
      const generationRequest = {
        count,
        settings
      };

      console.log('Generating lineups with request:', generationRequest);

      // Call the API to generate lineups
      const response = await fetch(`${API_BASE_URL}/lineups/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(generationRequest)
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
      console.log('Lineup generation results:', result);

      if (result.lineups && Array.isArray(result.lineups)) {
        // Add NexusScore and ROI to each lineup
        const enhancedLineups = result.lineups.map(lineup => {
          const nexusScore = Math.round(Math.random() * 50 + 70); // Random score between 70-120
          const roi = (Math.random() * 2 + 0.5).toFixed(2); // Random ROI between 0.5-2.5

          return {
            ...lineup,
            nexusScore,
            roi
          };
        });

        setLineups([...lineups, ...enhancedLineups]);
        displayNotification(`Generated ${result.lineups.length} new lineups!`);
      } else {
        throw new Error('Invalid response format for lineup generation');
      }
    } catch (error) {
      console.error('Lineup generation error:', error);
      displayNotification(`Error generating lineups: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate optimized lineups with exposure constraints
  // This function is used by the LineupOptimizer component and the ExposureControl component
 const generateOptimizedLineups = async (count, options = {}) => {
  try {
    setIsLoading(true);

    // Validate we have necessary data
    if (playerData.length === 0) {
      displayNotification('No player projections loaded. Please upload player data first.', 'error');
      setIsLoading(false);
      return;
    }

    // Create the lineup generation request with options (including exposure settings)
    const generationRequest = {
      count,
      settings: {
        ...settings,
        ...options
      },
      // Always include exposure settings
      exposureSettings: options.exposureSettings || exposureSettings
    };

    console.log('Generating optimized lineups with request:', generationRequest);

    // Call the API to generate lineups
    const response = await fetch(`${API_BASE_URL}/lineups/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generationRequest)
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
    console.log('Lineup generation results:', result);

    if (result.lineups && Array.isArray(result.lineups)) {
      // Add NexusScore and ROI to each lineup
      const enhancedLineups = result.lineups.map(lineup => {
        // Calculate NexusScore based on lineup data
        const allPlayers = lineup.cpt ? [lineup.cpt, ...(lineup.players || [])] : (lineup.players || []);
        const teamCounts = {};

        allPlayers.forEach(player => {
          if (player && player.team) {
            teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
          }
        });

        // Calculate total projection
        let totalProj = 0;
        if (lineup.cpt) {
          const cptPlayer = playerData.find(p => p.id === lineup.cpt.id);
          const cptProj = cptPlayer?.projectedPoints || 0;
          totalProj += cptProj * 1.5; // CPT gets 1.5x
        }

        // Add regular players' projections
        totalProj += (lineup.players || [])
          .map(p => {
            const fullPlayer = playerData.find(fp => fp.id === p.id);
            return fullPlayer?.projectedPoints || p.projectedPoints || 0;
          })
          .reduce((sum, proj) => sum + proj, 0);

        // Calculate average ownership
        const totalOwnership = allPlayers.reduce((sum, p) => {
          const fullPlayer = playerData.find(fp => fp.id === p.id);
          return sum + (fullPlayer?.ownership || p.ownership || 0);
        }, 0);

        const avgOwn = allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

        // Calculate stack bonus
        let stackBonus = 0;
        Object.values(teamCounts).forEach(count => {
          if (count >= 3) stackBonus += (count - 2) * 3;
        });

        // Calculate NexusScore
        const ownership = Math.max(0.1, avgOwn / 100);
        const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
        const nexusScore = ((totalProj * leverageFactor) + stackBonus) / 7;

        // Calculate ROI based on NexusScore
        const roi = ((nexusScore / 100) * 2 + Math.random() * 0.5).toFixed(2);

        return {
          ...lineup,
          nexusScore: Math.round(nexusScore * 10) / 10,
          roi
        };
      });

      setLineups([...lineups, ...enhancedLineups]);
      displayNotification(`Generated ${result.lineups.length} new lineups!`);

      // Switch to lineups tab after generation
      setActiveTab('lineups');
      return enhancedLineups;
    } else {
      throw new Error('Invalid response format for lineup generation');
    }
  } catch (error) {
    console.error('Lineup generation error:', error);
    displayNotification(`Error generating lineups: ${error.message}`, 'error');
    return null;
  } finally {
    setIsLoading(false);
  }
};

  // Save settings to backend
  const saveSettings = async () => {
    try {
      console.log('Saving settings:', settings);

      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      console.log('Settings save response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to save settings: ${response.status} ${response.statusText}`;
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

      displayNotification('Settings saved successfully!');
    } catch (error) {
      console.error('Settings save error:', error);
      displayNotification(`Error saving settings: ${error.message}`, 'error');
    }
  };

  // Export lineups to CSV or JSON
  const exportLineups = async (format = 'csv') => {
    try {
      if (lineups.length === 0) {
        displayNotification('No lineups to export', 'error');
        return;
      }

      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/lineups/export?format=${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lineups })
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `lol-dfs-lineups-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      displayNotification(`Lineups exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      displayNotification(`Error exporting lineups: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle exposure settings updates with improved error handling and type safety
  const handleExposureUpdate = (newExposureSettings) => {
    try {
      // 1. Log what we received
      console.log('Received exposure settings update:',
        newExposureSettings ? 'Valid settings object' : 'Invalid/empty settings');

      // 2. Create a completely new, clean object without any references to the original
      const cleanSettings = {
        global: {
          globalMinExposure: typeof newExposureSettings.global?.globalMinExposure === 'number' ?
            newExposureSettings.global.globalMinExposure : 0,
          globalMaxExposure: typeof newExposureSettings.global?.globalMaxExposure === 'number' ?
            newExposureSettings.global.globalMaxExposure : 60,
          applyToNewLineups: Boolean(newExposureSettings.global?.applyToNewLineups),
          prioritizeProjections: Boolean(newExposureSettings.global?.prioritizeProjections)
        },
        teams: Array.isArray(newExposureSettings.teams) ? newExposureSettings.teams.map(team => ({
          team: String(team.team || ''),
          // Preserve stackSize if it exists
          ...(team.stackSize !== undefined ? { stackSize: Number(team.stackSize) } : {}),
          min: team.min === null || team.min === '' ? null : Number(team.min),
          max: team.max === null || team.max === '' ? null : Number(team.max),
          target: team.target === null || team.target === '' ? null : Number(team.target),
          actual: Number(team.actual) || 0
        })) : [],
        players: Array.isArray(newExposureSettings.players) ? newExposureSettings.players.map(player => {
          // For debugging
          if (player.id === newExposureSettings.players[0]?.id) {
            console.log('Processing first player:', player);
          }

          return {
            id: String(player.id || ''),
            name: String(player.name || ''),
            team: String(player.team || ''),
            position: String(player.position || ''),
            salary: Number(player.salary) || 0,
            projectedPoints: player.projectedPoints !== undefined ? Number(player.projectedPoints) : 0,
            ownership: player.ownership !== undefined ? Number(player.ownership) : undefined,
            min: player.min === null || player.min === '' ? null : Number(player.min),
            max: player.max === null || player.max === '' ? null : Number(player.max),
            target: player.target === null || player.target === '' ? null : Number(player.target),
            actual: Number(player.actual) || 0
          };
        }) : [],
        positions: newExposureSettings.positions ? Object.fromEntries(
          Object.entries(newExposureSettings.positions).map(([position, settings]) => [
            position,
            {
              min: settings.min === null || settings.min === '' ? null : Number(settings.min),
              max: settings.max === null || settings.max === '' ? null : Number(settings.max),
              target: settings.target === null || settings.target === '' ? null : Number(settings.target)
            }
          ])
        ) : {},
        _isManualSave: Boolean(newExposureSettings._isManualSave)
      };

      // 3. Update state with the clean settings
      console.log('Setting new exposure settings with cleaned data');
      setExposureSettings(cleanSettings);

      // 4. Send to backend (wrapped in try/catch to prevent errors)
      const isManualSave = newExposureSettings._isManualSave;
      if (isManualSave) {
        console.log(`Sending exposure settings to backend (${cleanSettings.players.length} players, ${cleanSettings.teams.length} teams)`);

        // Use a more robust fetch with timeout and better error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
          console.log('Backend response received:', response.status, response.statusText);

          if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
          }
          return response.text().then(text => {
            // Try to parse as JSON if it looks like JSON
            if (text && text.trim().startsWith('{')) {
              try {
                return JSON.parse(text);
              } catch (e) {
                console.log('Response not valid JSON:', text);
                return text;
              }
            }
            return text;
          });
        })
        .then(data => {
          console.log('Backend save successful:', data);
          displayNotification('Exposure settings saved successfully!');
        })
        .catch(error => {
          console.error('Backend save error:', error.toString());
          // Log all available info about the error
          if (error.name === 'AbortError') {
            console.error('Request timed out after 10 seconds');
            displayNotification('Settings saved locally (server timeout)', 'warning');
          } else {
            console.error('Error type:', error.constructor.name);
            console.error('Error stack:', error.stack);
            displayNotification('Settings saved locally (server error)', 'warning');
          }
        });
      }
    } catch (error) {
      console.error('Critical error in handleExposureUpdate:', error);
      displayNotification('Error updating settings', 'error');
    }
  };

  // Handle edit lineup
  const handleEditLineup = (lineup) => {
    // For now, just log the edit request
    console.log("Editing lineup:", lineup);
    displayNotification("Lineup editing coming soon!", "info");
  };

  // Handle delete lineup
  const handleDeleteLineup = async (lineup) => {
    try {
      console.log('Deleting lineup with ID:', lineup.id);

      // Optimistically remove from UI
      setLineups(lineups.filter(l => l.id !== lineup.id));

      // Call API to delete from server
      const response = await fetch(`${API_BASE_URL}/lineups/${lineup.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete lineup error:', errorText);
        displayNotification('Lineup deleted locally (server error)', 'warning');
        return;
      }

      displayNotification('Lineup deleted successfully!');
    } catch (error) {
      console.error('Error deleting lineup:', error);
      displayNotification(`Lineup removed locally (${error.message})`, 'error');
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="container">
          <h1 className="app-title">LoL DFS Optimizer</h1>
          <p className="app-subtitle">Advanced Monte Carlo simulation and optimization for League of Legends DFS</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
        {/* Tabs */}
        <div className="tabs-container">
          <ul style={{ listStyle: 'none' }}>
            {['upload', 'lineups', 'optimizer', 'settings', 'results'].map(tab => (
              <li key={tab} style={{ display: 'inline-block' }}>
                <button
                  className={`tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'optimizer' ? 'Advanced Optimizer' :
                  tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <div className="grid grid-cols-2">
              <div className="card">
                <h2 className="card-title">Import Data</h2>
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
                <div>
                  <label className="form-label">
                    Team Stacks (Stacks CSV)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              <div className="card">
                <h2 className="card-title">Import Lineups</h2>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ marginRight: '1rem' }}>
                    <input
                      type="radio"
                      name="importMethod"
                      value="dkEntries"
                      checked={importMethod === 'dkEntries'}
                      onChange={() => setImportMethod('dkEntries')}
                    />
                    <span style={{ marginLeft: '0.5rem' }}>DraftKings Entries</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="importMethod"
                      value="jsonFile"
                      checked={importMethod === 'jsonFile'}
                      onChange={() => setImportMethod('jsonFile')}
                    />
                    <span style={{ marginLeft: '0.5rem' }}>JSON File</span>
                  </label>
                </div>

                {importMethod === 'dkEntries' ? (
                  <div>
                    <label className="form-label">
                      DraftKings Entries CSV
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="form-label">
                      Lineups JSON File
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Data Status</h2>
              <div className="grid grid-cols-3">
                <div className="stat-card">
                  <h3 style={{ color: '#90cdf4' }}>Player Projections</h3>
                  <p className="stat-value">{playerData.length}</p>
                  <p className="stat-label">players loaded</p>
                </div>
                <div className="stat-card">
                  <h3 style={{ color: '#90cdf4' }}>Team Stacks</h3>
                  <p className="stat-value">{stackData.length}</p>
                  <p className="stat-label">teams loaded</p>
                </div>
                <div className="stat-card">
                  <h3 style={{ color: '#90cdf4' }}>Lineups</h3>
                  <p className="stat-value">{lineups.length}</p>
                  <p className="stat-label">lineups loaded</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lineups Tab */}
        {activeTab === 'lineups' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="card-title">My Lineups ({lineups.length})</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="dropdown">
                  <button className="btn">Export</button>
                  <div className="dropdown-content">
                    <button onClick={() => exportLineups('csv')}>CSV Format</button>
                    <button onClick={() => exportLineups('json')}>JSON Format</button>
                    <button onClick={() => exportLineups('dk')}>DraftKings Format</button>
                  </div>
                </div>
                <button
                  className="btn"
                  style={{ backgroundColor: '#38b2ac', color: 'white' }}
                  onClick={() => setActiveTab('exposure')}
                >
                  Manage Exposure
                </button>
                <button
                  className={simResults ? 'btn btn-success' : 'btn btn-disabled'}
                  onClick={() => generateLineups(1)}
                  disabled={!simResults}
                >
                  Add Lineup
                </button>
                <button
                  className={lineups.length > 0 ? 'btn btn-primary' : 'btn btn-disabled'}
                  disabled={lineups.length === 0}
                  onClick={runSimulation}
                >
                  Run Simulation
                </button>
              </div>
            </div>

            {lineups.length > 0 ? (
              <LineupList
                lineups={lineups}
                playerData={playerData}
                onEdit={handleEditLineup}
                onDelete={handleDeleteLineup}
                onRunSimulation={runSimulation}
                onExport={exportLineups}
              />
            ) : (
              <div className="empty-state">
                <p style={{ marginBottom: '1rem' }}>No lineups have been imported or created yet.</p>
                <div>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="btn btn-primary"
                    style={{ marginRight: '0.5rem' }}
                  >
                    Import lineups
                  </button>
                  {simResults ? (
                    <button
                      onClick={() => generateLineups(5)}
                      className="btn btn-success"
                    >
                      Generate optimal lineups
                    </button>
                  ) : (
                    <button
                      className="btn btn-disabled"
                      disabled
                    >
                      Run simulation first
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Stacks Tab */}
        {activeTab === 'team-stacks' && (
          <TeamStacks
            API_BASE_URL={API_BASE_URL}
            teamData={stackData}
            playerData={playerData}
            lineups={lineups}
            exposureSettings={exposureSettings}
            onUpdateExposures={handleExposureUpdate}
            onGenerateLineups={generateOptimizedLineups}
          />
        )}

        {/* Exposure Control Tab */}
        {activeTab === 'exposure' && (
          <ExposureControl
            API_BASE_URL={API_BASE_URL}
            playerData={playerData}
            lineups={lineups}
            exposureSettings={exposureSettings}  // Pass the saved settings
            onUpdateExposures={handleExposureUpdate}
            onGenerateLineups={generateOptimizedLineups}
          />
        )}

        {/* Advanced Optimizer Tab */}
        {activeTab === 'optimizer' && (
          <OptimizerPage
            API_BASE_URL={API_BASE_URL}
            playerData={playerData}
            lineups={lineups}
            exposureSettings={exposureSettings}
            onUpdateExposures={handleExposureUpdate}
            onGenerateLineups={generateOptimizedLineups}
            onImportLineups={(optimizedLineups) => {
              // Add imported lineups to existing lineups
              setLineups(prev => [...prev, ...optimizedLineups]);
              displayNotification(`Imported ${optimizedLineups.length} optimized lineups!`);
              // Switch to lineups tab after import
              setActiveTab('lineups');
            }}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="card">
            <h2 className="card-title">Simulation Settings</h2>
            <div className="grid grid-cols-2">
              <div>
                <label className="form-label">
                  Simulation Iterations
                </label>
                <input
                  type="number"
                  value={settings.iterations}
                  onChange={(e) => setSettings({...settings, iterations: parseInt(e.target.value)})}
                  min="100"
                  max="10000"
                />
                <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                  Higher values give more accurate results but take longer to run.
                </p>
              </div>
              <div>
                <label className="form-label">
                  Field Size
                </label>
                <input
                  type="number"
                  value={settings.fieldSize}
                  onChange={(e) => setSettings({...settings, fieldSize: parseInt(e.target.value)})}
                  min="10"
                />
                <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                  Number of opponents in the simulation.
                </p>
              </div>
              <div>
                <label className="form-label">
                  Entry Fee
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', color: '#90cdf4' }}>$</div>
                  <input
                    type="number"
                    value={settings.entryFee}
                    onChange={(e) => setSettings({...settings, entryFee: parseInt(e.target.value)})}
                    style={{ paddingLeft: '1.5rem' }}
                    min="1"
                  />
                </div>
                <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                  DraftKings contest entry fee.
                </p>
              </div>
              <div>
                <label className="form-label">
                  Max Workers
                </label>
                <input
                  type="number"
                  value={settings.maxWorkers}
                  onChange={(e) => setSettings({...settings, maxWorkers: parseInt(e.target.value)})}
                  min="1"
                  max="16"
                />
                <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                  Number of parallel processes for simulation.
                </p>
              </div>
            </div>
            <div>
              <label className="form-label">
                Output Directory
              </label>
              <input
                type="text"
                value={settings.outputDir}
                onChange={(e) => setSettings({...settings, outputDir: e.target.value})}
              />
              <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                Directory where simulation results will be saved.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={saveSettings}
                className="btn btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div>
            {simResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card">
                  <h2 className="card-title">Lineup Performance</h2>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Lineup</th>
                          <th>ROI</th>
                          <th>1st Place %</th>
                          <th>Top 10 %</th>
                          <th>Min Cash %</th>
                          <th>Avg Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResults.lineupPerformance.map((lineup, index) => (
                          <tr key={lineup.id} style={index === 0 ? { backgroundColor: 'rgba(56, 178, 172, 0.2)' } : {}}>
                            <td>{index + 1}</td>
                            <td>{lineup.name}</td>
                            <td style={{ fontWeight: 'bold', color: '#4fd1c5' }}>{lineup.roi}x</td>
                            <td style={{ color: '#68d391' }}>{lineup.firstPlace}%</td>
                            <td style={{ color: '#4fd1c5' }}>{lineup.top10}%</td>
                            <td style={{ color: '#90cdf4' }}>{lineup.minCash}%</td>
                            <td style={{ color: '#68d391' }}>${lineup.averagePayout}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-2">
                  <div className="card">
                    <h2 className="card-title">Team Exposure</h2>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(simResults.exposures.team).map(([team, value]) => ({ team, value }))}
                          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                          <XAxis dataKey="team" stroke="#90cdf4" />
                          <YAxis tickFormatter={(tick) => `${tick}%`} stroke="#90cdf4" />
                          <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Exposure']}
                            contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }} />
                          <Bar dataKey="value" fill="#4fd1c5" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card">
                    <h2 className="card-title">Position Exposure</h2>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(simResults.exposures.position).map(([pos, value]) => ({ position: pos, value }))}
                          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                          <XAxis dataKey="position" stroke="#90cdf4" />
                          <YAxis tickFormatter={(tick) => `${tick}%`} stroke="#90cdf4" />
                          <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Exposure']}
                            contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }} />
                          <Bar dataKey="value" fill="#38b2ac" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2 className="card-title">Score Distributions</h2>
                  <div className="chart-container" style={{ height: '24rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={simResults.scoreDistributions}
                        margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                        <XAxis dataKey="lineup" stroke="#90cdf4" />
                        <YAxis stroke="#90cdf4" />
                        <Tooltip contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }} />
                        <Legend />
                        <Line type="monotone" dataKey="p10" stroke="#f56565" name="10th Percentile" />
                        <Line type="monotone" dataKey="p25" stroke="#ed8936" name="25th Percentile" />
                        <Line type="monotone" dataKey="p50" stroke="#3b82f6" name="Median" strokeWidth={2} />
                        <Line type="monotone" dataKey="p75" stroke="#10b981" name="75th Percentile" />
                        <Line type="monotone" dataKey="p90" stroke="#8b5cf6" name="90th Percentile" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <h2 className="card-title">Optimal Contest Strategy</h2>
                  <div className="grid grid-cols-3">
                    <div className="stat-card">
                      <h3 style={{ color: '#90cdf4', marginBottom: '0.5rem' }}>Single Entry</h3>
                      {simResults.lineupPerformance && simResults.lineupPerformance.length > 0 ? (
                        <>
                          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4fd1c5' }}>
                            Lineup {simResults.lineupPerformance[0]?.id || 'N/A'}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#90cdf4', marginTop: '0.5rem' }}>Highest overall ROI</p>
                        </>
                      ) : (
                        <p style={{ color: '#90cdf4' }}>No lineup data available</p>
                      )}
                    </div>
                    <div className="stat-card">
                      <h3 style={{ color: '#90cdf4', marginBottom: '0.5rem' }}>3-Max Contests</h3>
                      <p style={{ fontWeight: '600', color: '#4fd1c5' }}>Use these lineups:</p>
                      {simResults.lineupPerformance && simResults.lineupPerformance.length > 0 ? (
                        <ol style={{ listStylePosition: 'inside', marginTop: '0.5rem', color: '#90cdf4' }}>
                          {simResults.lineupPerformance[0] && <li>Lineup <span style={{ color: '#4fd1c5' }}>{simResults.lineupPerformance[0].id}</span></li>}
                          {simResults.lineupPerformance[1] && <li>Lineup <span style={{ color: '#4fd1c5' }}>{simResults.lineupPerformance[1].id}</span></li>}
                          {simResults.lineupPerformance[2] && <li>Lineup <span style={{ color: '#4fd1c5' }}>{simResults.lineupPerformance[2].id}</span></li>}
                        </ol>
                      ) : (
                        <p style={{ color: '#90cdf4' }}>No lineup data available</p>
                      )}
                    </div>
                    <div className="stat-card">
                      <h3 style={{ color: '#90cdf4', marginBottom: '0.5rem' }}>GPP/Tournaments</h3>
                      <p style={{ fontWeight: '600', color: '#4fd1c5' }}>Focus on:</p>
                      {simResults.lineupPerformance && simResults.lineupPerformance.length > 0 ? (
                        <p style={{ color: '#90cdf4', marginTop: '0.5rem' }}>
                          Lineup <span style={{ color: '#4fd1c5' }}>{simResults.lineupPerformance.slice().sort((a, b) =>
                            parseFloat(b.firstPlace) - parseFloat(a.firstPlace)
                          )[0]?.id || 'N/A'}</span> (highest 1st place %)
                        </p>
                      ) : (
                        <p style={{ color: '#90cdf4' }}>No lineup data available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: '#4fd1c5' }}>No simulation results yet</h2>
                <p style={{ color: '#90cdf4', marginBottom: '1.5rem' }}>Run a simulation to see detailed analysis and optimization recommendations</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('upload')}
                >
                  Go to Upload & Run Simulation
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>LoL DFS Optimizer &copy; {new Date().getFullYear()} | Enhanced for League of Legends</p>
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
            <p className="loading-text">
             This may take a moment...
            </p>
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