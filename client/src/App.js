import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, BarChart, Bar } from 'recharts';
import './blue-theme.css'; // Import the CSS file

/* eslint-disable react-hooks/exhaustive-deps */
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

  // Function to show notification
  const displayNotification = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setIsNotificationVisible(true);
    setTimeout(() => {
      setIsNotificationVisible(false);
    }, 3000);
  };

  // Load all initial data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);

      try {
        console.log('Initializing app data from backend...');

        // Load each data type in parallel for better performance
        const [playersRes, stacksRes, settingsRes, lineupsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/players/projections`),
          fetch(`${API_BASE_URL}/teams/stacks`),
          fetch(`${API_BASE_URL}/settings`),
          fetch(`${API_BASE_URL}/lineups`)
        ]);

        // Process player projections
        if (playersRes.ok) {
          const players = await playersRes.json();
          console.log('Loaded player projections:', players.length);
          setPlayerData(players);
        } else {
          console.error('Failed to load player projections');
        }

        // Process team stacks
        if (stacksRes.ok) {
          const stacks = await stacksRes.json();
          console.log('Loaded team stacks:', stacks.length);
          setStackData(stacks);
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
          setLineups(lineupsData);
        } else {
          console.error('Failed to load lineups');
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

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();

    try {
      setIsLoading(true);
      displayNotification(`Processing ${file.name}...`);

      let endpoint;
      let isLolFormat = false;

      // Check file format first
      if (fileExt === 'csv') {
        // Preview file content to detect format
        const fileContent = await readFilePreview(file, 2000);
        console.log('File preview:', fileContent.substring(0, 500) + '...');

        // Detect LoL format (has TOP, JNG, MID, ADC, SUP positions)
        isLolFormat = fileContent.includes('TOP') &&
                      fileContent.includes('JNG') &&
                      fileContent.includes('MID') &&
                      fileContent.includes('ADC') &&
                      fileContent.includes('SUP');

        // Determine the correct endpoint based on file name and detected format
        if (file.name.includes('DKEntries') || isLolFormat) {
          endpoint = `${API_BASE_URL}/lineups/dkentries`;

          if (isLolFormat) {
            console.log('Detected League of Legends DraftKings format');
            displayNotification('Detected League of Legends DraftKings format', 'info');
          }
        } else if (file.name.includes('ROO_export')) {
          endpoint = `${API_BASE_URL}/players/projections/upload`;
        } else if (file.name.includes('Stacks_export')) {
          endpoint = `${API_BASE_URL}/teams/stacks/upload`;
        } else {
          // Auto-detect file type based on content
          if (fileContent.includes('Player') && fileContent.includes('Projection')) {
            endpoint = `${API_BASE_URL}/players/projections/upload`;
            displayNotification('Auto-detected as player projections file', 'info');
          } else if (fileContent.includes('Team') && fileContent.includes('Stack')) {
            endpoint = `${API_BASE_URL}/teams/stacks/upload`;
            displayNotification('Auto-detected as team stacks file', 'info');
          } else {
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

      // Flag if this is LoL format
      if (isLolFormat) {
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
          setLineups(prevLineups => [...prevLineups, ...result.lineups]);
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
          const players = await playersRes.json();
          setPlayerData(players);
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

  // Generate lineups
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
        setLineups([...lineups, ...result.lineups]);
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
            {['upload', 'lineups', 'settings', 'results'].map(tab => (
              <li key={tab} style={{ display: 'inline-block' }}>
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
              <div className="btn-container">
                <button
                  className={playerData.length > 0 && stackData.length > 0 && lineups.length > 0
                    ? 'btn btn-primary'
                    : 'btn btn-disabled'}
                  onClick={runSimulation}
                  disabled={!(playerData.length > 0 && stackData.length > 0 && lineups.length > 0)}
                >
                  Run Simulation
                </button>
                <div className="tooltip">
                  <button
                    className={playerData.length > 0 && stackData.length > 0 && simResults
                      ? 'btn btn-success'
                      : 'btn btn-disabled'}
                    onClick={() => generateLineups(5)}
                    disabled={!(playerData.length > 0 && stackData.length > 0 && simResults)}
                  >
                    Generate 5 Optimal Lineups
                  </button>
                  {!simResults && playerData.length > 0 && stackData.length > 0 && (
                    <span className="tooltip-text">
                      Run a simulation first to enable lineup generation
                    </span>
                  )}
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
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>CPT</th>
                      <th>Players</th>
                      <th>Salary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineups.slice(0, 10).map((lineup) => {
                      // Calculate total salary
                      const cptSalary = lineup.cpt?.salary || 0;
                      const playersSalary = lineup.players?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;
                      const totalSalary = cptSalary + playersSalary;

                      return (
                        <tr key={lineup.id}>
                          <td>{lineup.id}</td>
                          <td>{lineup.name}</td>
                          <td>
                            {lineup.cpt?.name} <span className="table-position">({lineup.cpt?.position})</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.875rem' }}>
                              {lineup.players?.map(p => `${p.name} (${p.position})`).join(', ')}
                            </span>
                          </td>
                          <td className="table-salary">
                            ${totalSalary.toLocaleString()}
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                displayNotification('Edit functionality coming soon!');
                              }}
                              style={{ color: '#4fd1c5', marginRight: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  console.log('Deleting lineup with ID:', lineup.id);

                                  // Optimistically remove from UI
                                  setLineups(lineups.filter(l => l.id !== lineup.id));

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
                              }}
                              style={{ color: '#f56565', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {lineups.length > 10 && (
                  <div style={{ textAlign: 'center', padding: '0.5rem', color: '#90cdf4', fontSize: '0.875rem' }}>
                    Showing 10 of {lineups.length} lineups
                  </div>
                )}
              </div>
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
              Running advanced simulation. This may take a few moments...
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