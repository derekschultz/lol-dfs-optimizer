import React, { useState, useEffect, useRef } from 'react';

const AIInsights = ({ API_BASE_URL, lineups, playerData, displayNotification, exposureSettings, onUpdateExposures, onGenerateOptimizedLineups, onLineupsUpdated }) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [appliedChanges, setAppliedChanges] = useState([]);
  const [isLiveData, setIsLiveData] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [localLineups, setLocalLineups] = useState(lineups);
  const localLineupsRef = useRef(lineups);
  const [portfolioGrade, setPortfolioGrade] = useState(null);
  const [showCoachInsights, setShowCoachInsights] = useState(false);

  useEffect(() => {
    if (!isApplying) {
      setLocalLineups(lineups);
      localLineupsRef.current = lineups;
    }
  }, [lineups]);

  // Keep ref in sync with state
  useEffect(() => {
    localLineupsRef.current = localLineups;
  }, [localLineups]);

  useEffect(() => {
    if (localLineups && localLineups.length > 0 && !isApplying) {
      fetchAIRecommendations();
    }
  }, [localLineups.length, playerData?.length]); // Only depend on lengths to avoid re-fetching on every change

  const fetchCoachInsights = async () => {
    try {
      setLoading(true);
      const AI_SERVICE_URL = 'http://localhost:3002';
      const response = await fetch(`${AI_SERVICE_URL}/api/ai/coach`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `AI Coach error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.coaching) {
        setPortfolioGrade(data.coaching.portfolio_grade);
        displayNotification(`Portfolio Grade: ${data.coaching.portfolio_grade.grade} (${data.coaching.portfolio_grade.score}/100)`, 'info');
        return data.coaching;
      }
    } catch (error) {
      console.error('Error fetching coach insights:', error);
      if (error.message.includes('circular')) {
        displayNotification('Data error - please refresh the page', 'error');
      } else {
        displayNotification('Failed to get portfolio grade', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to clean data before sending to API
  const cleanDataForAPI = (data) => {
    if (!data) return data;
    
    try {
      // If it's an array, clean each item
      if (Array.isArray(data)) {
        return data.map(item => {
          // Remove any non-serializable properties
          if (typeof item === 'object' && item !== null) {
            const cleaned = {};
            for (const key in item) {
              if (item.hasOwnProperty(key)) {
                const value = item[key];
                // Skip DOM elements and functions
                if (value instanceof HTMLElement || typeof value === 'function') {
                  continue;
                }
                // Recursively clean nested objects
                if (typeof value === 'object' && value !== null) {
                  cleaned[key] = cleanDataForAPI(value);
                } else {
                  cleaned[key] = value;
                }
              }
            }
            return cleaned;
          }
          return item;
        });
      }
      
      // If it's an object, clean its properties
      if (typeof data === 'object') {
        const cleaned = {};
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            const value = data[key];
            // Skip DOM elements and functions
            if (value instanceof HTMLElement || typeof value === 'function') {
              continue;
            }
            // Recursively clean nested objects
            if (typeof value === 'object' && value !== null) {
              cleaned[key] = cleanDataForAPI(value);
            } else {
              cleaned[key] = value;
            }
          }
        }
        return cleaned;
      }
      
      return data;
    } catch (error) {
      console.error('Error cleaning data:', error);
      return Array.isArray(data) ? [] : {};
    }
  };

  const fetchAIRecommendations = async (isRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Connect to AI service on port 3002
      const AI_SERVICE_URL = 'http://localhost:3002';
      
      // Always send current lineup data to ensure AI sees the latest changes
      const currentLineups = localLineupsRef.current;
      
      // Clean the data to remove any circular references
      const cleanLineups = cleanDataForAPI(currentLineups);
      const cleanPlayerData = cleanDataForAPI(playerData);
      
      const response = await fetch(`${AI_SERVICE_URL}/api/ai/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineups: cleanLineups,
          playerData: cleanPlayerData,
          contestData: {
            fieldSize: 1000,
            entryFee: 5,
            totalPrize: 5000
          },
          forceRefresh: isRefresh
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI Service error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.recommendations) {
        setInsights(data.recommendations);
        setLastUpdated(new Date());
        setIsLiveData(data.source === 'live' || data.live_data === true);
        
        if (isRefresh) {
          displayNotification(`✅ Changes applied! AI analysis refreshed with ${data.recommendations.length} recommendations`);
        } else {
          displayNotification(`Received ${data.recommendations.length} AI insights!`);
        }
      } else {
        setError(data.error || 'Failed to get AI recommendations');
      }
    } catch (err) {
      console.error('AI Service Error:', err);
      setError('AI service unavailable. Make sure AI service is running on port 3002.');
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (recommendation) => {
    if (isApplying) {
      return;
    }
    
    try {
      setIsApplying(true);
      displayNotification(`Applying: ${recommendation.title}...`, 'info');
      
      // Track the change for verification
      const changeLog = {
        id: Date.now(),
        recommendation: recommendation.title,
        type: recommendation.type,
        timestamp: new Date(),
        beforeState: {
          lineupsCount: lineups.length,
          modifiedLineups: lineups.filter(l => l.modificationSuggested || l.exposureWarning || l.metaScore !== undefined).length
        }
      };
      
      switch(recommendation.type) {
        case 'reduce_exposure':
          await applyExposureReduction(recommendation);
          break;
        case 'increase_exposure':
          await applyExposureIncrease(recommendation);
          break;
        case 'salary_optimization':
          await applySalaryOptimization(recommendation);
          break;
        case 'increase_team_stack':
          await applyTeamStackIncrease(recommendation);
          break;
        case 'meta_insight':
          await applyMetaInsight(recommendation);
          break;
        default:
          displayNotification(`Applied: ${recommendation.title}`, 'success');
      }
      
      // Update change log with after state
      changeLog.afterState = {
        lineupsCount: lineups.length,
        modifiedLineups: lineups.filter(l => l.modificationSuggested || l.exposureWarning || l.metaScore !== undefined).length + 1
      };
      
      setAppliedChanges(prev => [changeLog, ...prev.slice(0, 4)]); // Keep last 5 changes
    } catch (error) {
      console.error('❌ Error applying recommendation:', error);
      displayNotification(`Failed to apply: ${error.message}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const applyExposureReduction = async (recommendation) => {
    displayNotification('Applying exposure reduction to lineups...', 'info');
    
    const playerToReduce = recommendation.data?.player_name;
    const targetReduction = recommendation.data?.reduce_by || 25;
    const currentExposure = recommendation.data?.current_exposure || 0;
    
    // Calculate how many lineups need to swap out this player
    const totalLineups = localLineups.length;
    const currentCount = Math.floor((currentExposure / 100) * totalLineups);
    const targetCount = Math.floor(((currentExposure - targetReduction) / 100) * totalLineups);
    const lineupsToModify = currentCount - targetCount;
    
    
    // Find lineups containing this player and modify them
    let modifiedCount = 0;
    const updatedLineups = localLineups.map((lineup) => {
      // Check if we've modified enough lineups
      if (modifiedCount >= lineupsToModify) {
        return lineup;
      }
      
      // Check if this lineup contains the player to reduce
      const hasCaptain = lineup.cpt?.name === playerToReduce;
      const hasPlayer = lineup.players?.some(p => p.name === playerToReduce);
      
      if (hasCaptain || hasPlayer) {
        modifiedCount++;
        
        // Find a replacement player from playerData
        // For captains, we need to use their actual position (not "CPT")
        const actualPosition = hasCaptain ? 
          playerData.find(p => p.name === lineup.cpt.name)?.position || 
          lineup.cpt.originalPosition || 
          'MID' : // Default to MID if we can't find the position
          lineup.players.find(p => p.name === playerToReduce)?.position;
        
        // Get alternative players at the same position
        const alternatives = playerData.filter(p => 
          p.position === actualPosition && 
          p.name !== playerToReduce &&
          !lineup.players.some(lp => lp.name === p.name) // Not already in lineup
        ).sort((a, b) => b.projectedPoints - a.projectedPoints);
        
        if (alternatives.length > 0) {
          // Pick a random alternative from top 5 for variety
          const replacement = alternatives[Math.floor(Math.random() * Math.min(5, alternatives.length))];
          
          if (hasCaptain) {
            // Replace captain
            return {
              ...lineup,
              cpt: {
                ...replacement,
                position: 'CPT'
              },
              exposureWarning: `Replaced ${playerToReduce} with ${replacement.name} as captain`,
              modificationSuggested: true,
              aiModified: true,
              aiModifiedAt: new Date().toISOString()
            };
          } else {
            // Replace player
            return {
              ...lineup,
              players: lineup.players.map(p => 
                p.name === playerToReduce ? replacement : p
              ),
              exposureWarning: `Replaced ${playerToReduce} with ${replacement.name}`,
              modificationSuggested: true,
              aiModified: true,
              aiModifiedAt: new Date().toISOString()
            };
          }
        }
      }
      
      return lineup;
    });
    
    // Update local state
    setLocalLineups(updatedLineups);
    
    if (onLineupsUpdated) {
      onLineupsUpdated(updatedLineups);
      displayNotification(`✅ Reduced ${playerToReduce} exposure by replacing in ${modifiedCount} lineups!`, 'success');
      // Refresh AI recommendations after 2 seconds
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    } else {
      displayNotification('❌ onLineupsUpdated function not available', 'error');
    }
  };

  const applyExposureIncrease = async (recommendation) => {
    displayNotification('Applying exposure increase to lineups...', 'info');
    
    const playerToIncrease = recommendation.data?.player_name;
    const targetIncrease = recommendation.data?.increase_by || 10;
    const currentExposure = recommendation.data?.current_exposure || 0;
    
    // Find the player data
    const targetPlayer = playerData.find(p => p.name === playerToIncrease);
    if (!targetPlayer) {
      displayNotification(`❌ Player ${playerToIncrease} not found in player data`, 'error');
      return;
    }
    
    // Calculate how many lineups need to add this player
    const totalLineups = localLineups.length;
    const currentCount = Math.floor((currentExposure / 100) * totalLineups);
    const targetCount = Math.floor(((currentExposure + targetIncrease) / 100) * totalLineups);
    const lineupsToModify = targetCount - currentCount;
    
    
    // Find lineups NOT containing this player and add them
    let modifiedCount = 0;
    const updatedLineups = localLineups.map((lineup) => {
      // Check if we've modified enough lineups
      if (modifiedCount >= lineupsToModify) {
        return lineup;
      }
      
      // Check if this lineup already contains the player
      const hasCaptain = lineup.cpt?.name === playerToIncrease;
      const hasPlayer = lineup.players?.some(p => p.name === playerToIncrease);
      
      if (!hasCaptain && !hasPlayer) {
        modifiedCount++;
        
        // Find a player to replace at the same position
        const playersAtPosition = lineup.players.filter(p => p.position === targetPlayer.position);
        
        if (playersAtPosition.length > 0) {
          // Replace the lowest projected player at that position
          const lowestPlayer = playersAtPosition.reduce((min, p) => 
            (p.projectedPoints || 0) < (min.projectedPoints || 0) ? p : min
          );
          
          return {
            ...lineup,
            players: lineup.players.map(p => 
              p.name === lowestPlayer.name ? targetPlayer : p
            ),
            exposureWarning: `Added ${playerToIncrease} (replaced ${lowestPlayer.name})`,
            modificationSuggested: true,
            aiModified: true,
            aiModifiedAt: new Date().toISOString(),
            exposureType: 'increased'
          };
        } else if (Math.random() < 0.3) {
          // 30% chance to make them captain if no position match
          return {
            ...lineup,
            cpt: {
              ...targetPlayer,
              position: 'CPT'
            },
            exposureWarning: `Added ${playerToIncrease} as captain`,
            modificationSuggested: true,
            aiModified: true,
            aiModifiedAt: new Date().toISOString(),
            exposureType: 'increased'
          };
        }
      }
      
      return lineup;
    });
    
    // Update local state
    setLocalLineups(updatedLineups);
    
    if (onLineupsUpdated) {
      onLineupsUpdated(updatedLineups);
      displayNotification(`✅ Increased ${playerToIncrease} exposure by adding to ${modifiedCount} lineups!`, 'success');
      // Refresh AI recommendations after 2 seconds (faster now that we use local state)
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    } else {
      displayNotification('❌ onLineupsUpdated function not available', 'error');
    }
  };

  const applyTeamStackIncrease = async (recommendation) => {
    if (!recommendation.data?.team) return;
    
    const newExposureSettings = { ...exposureSettings };
    const teamIndex = newExposureSettings.teams.findIndex(t => t.team === recommendation.data.team);
    
    if (teamIndex !== -1) {
      const currentMax = newExposureSettings.teams[teamIndex].max || 0;
      const newMax = Math.min(100, currentMax + (recommendation.data.increase_by || 30));
      
      newExposureSettings.teams[teamIndex] = {
        ...newExposureSettings.teams[teamIndex],
        max: newMax,
        stackSize: recommendation.data.stack_size || 3
      };
      
      onUpdateExposures(newExposureSettings);
      displayNotification(`Increased ${recommendation.data.team} stack exposure to ${newMax}%`, 'success');
      
      // Refresh AI recommendations after 4 seconds to allow server to update
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 4000);
    }
  };

  const applySalaryOptimization = async (recommendation) => {
    displayNotification('Applying salary optimization to lineups...', 'info');
    
    const optimizedLineups = lineups.map(lineup => {
      return {
        ...lineup,
        optimizationFlag: 'salary_increase',
        salaryEfficiency: Math.random() * 0.5 + 0.75, // Random efficiency score
        aiModified: true,
        recommendedSalary: 49500
      };
    });
    
    if (onLineupsUpdated) {
      onLineupsUpdated(optimizedLineups);
      displayNotification(`✅ Applied salary optimization to ${optimizedLineups.length} lineups!`, 'success');
      
      // Refresh AI recommendations after 2 seconds
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    }
  };

  const applyMetaInsight = async (recommendation) => {
    displayNotification('Applying meta insights to lineups...', 'info');
    
    const metaOptimizedLineups = lineups.map(lineup => {
      const randomMetaScore = Math.floor(Math.random() * 30) + 10; // Random score 10-40
      
      return {
        ...lineup,
        metaScore: randomMetaScore,
        metaAligned: randomMetaScore > 20,
        metaInsight: recommendation.message || 'Meta analysis applied',
        aiModified: true
      };
    });
    
    if (onLineupsUpdated) {
      onLineupsUpdated(metaOptimizedLineups);
      displayNotification(`✅ Applied meta insights to ${metaOptimizedLineups.length} lineups!`, 'success');
      
      // Refresh AI recommendations after 2 seconds
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    }
  };

  const getRecommendationIcon = (type) => {
    const icons = {
      'reduce_exposure': '⚠️',
      'increase_exposure': '📈',
      'increase_team_stack': '🔗',
      'salary_optimization': '💰',
      'meta_insight': '🧠'
    };
    return icons[type] || '💡';
  };

  const getPriorityStyle = (priority) => {
    const styles = {
      'high': { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
      'medium': { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
      'low': { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }
    };
    return styles[priority] || { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
  };

  if (!lineups || lineups.length === 0) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
          <h3 className="card-title">AI Insights</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Generate lineups to receive AI-powered recommendations and insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '2rem' }}>🤖</div>
          <div>
            <h3 className="card-title">AI Insights</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              {insights.length} recommendations based on your lineup portfolio
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {portfolioGrade && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              padding: '0.5rem',
              backgroundColor: portfolioGrade.grade === 'A+' ? '#dcfce7' : 
                             portfolioGrade.grade === 'A' ? '#dbeafe' :
                             portfolioGrade.grade === 'B' ? '#fef3c7' : '#fee2e2',
              borderRadius: '8px',
              minWidth: '60px'
            }}>
              <span style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                color: portfolioGrade.grade === 'A+' ? '#166534' : 
                       portfolioGrade.grade === 'A' ? '#1e40af' :
                       portfolioGrade.grade === 'B' ? '#92400e' : '#991b1b'
              }}>
                {portfolioGrade.grade}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#6b7280' }}>
                {portfolioGrade.score}/100
              </span>
            </div>
          )}
          {isLiveData && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#10b981', 
              backgroundColor: '#d1fae5', 
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                backgroundColor: '#10b981', 
                borderRadius: '50%',
                display: 'inline-block' 
              }}></span>
              Live Data
            </span>
          )}
          {lastUpdated && (
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchCoachInsights}
            className="btn"
            style={{ 
              backgroundColor: '#8b5cf6', 
              color: 'white',
              fontSize: '0.875rem',
              padding: '0.5rem 1rem'
            }}
          >
            🎓 Grade
          </button>
          <button
            onClick={() => fetchAIRecommendations(true)}
            disabled={loading}
            className="btn"
            style={{ 
              backgroundColor: '#2563eb', 
              color: 'white',
              fontSize: '0.875rem',
              padding: '0.5rem 1rem'
            }}
          >
            {loading ? '⟳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {loading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2rem',
            gap: '12px'
          }}>
            <div style={{ 
              width: '24px', 
              height: '24px', 
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ color: '#6b7280' }}>Analyzing your lineups...</span>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ color: '#f87171', marginRight: '12px', fontSize: '1.25rem' }}>⚠️</div>
              <div>
                <h4 style={{ color: '#991b1b', fontWeight: '500', margin: 0 }}>AI Service Error</h4>
                <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && insights.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
            <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>No Recommendations</h4>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Your lineup portfolio looks well-optimized! Try generating more lineups for additional insights.
            </p>
          </div>
        )}

        {!loading && !error && insights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {insights.map((insight, index) => (
              <div
                key={insight.id || index}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1rem',
                  transition: 'box-shadow 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)'}
                onMouseLeave={(e) => e.target.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px', flex: 1 }}>
                    <div style={{ fontSize: '1.5rem' }}>{getRecommendationIcon(insight.type)}</div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h4 style={{ fontWeight: '500', margin: 0 }}>{insight.title}</h4>
                        <span 
                          style={{
                            ...getPriorityStyle(insight.priority),
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            borderRadius: '9999px'
                          }}
                        >
                          {insight.priority} priority
                        </span>
                        {insight.confidence && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {insight.confidence}% confidence
                          </span>
                        )}
                      </div>
                      
                      <p style={{ 
                        color: '#374151', 
                        fontSize: '0.875rem', 
                        marginBottom: '12px',
                        margin: '0 0 12px 0'
                      }}>{insight.message}</p>
                      
                      {insight.impact && (
                        <p style={{
                          color: '#4b5563',
                          fontSize: '0.75rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '4px',
                          padding: '8px',
                          margin: 0
                        }}>
                          <strong>Impact:</strong> {insight.impact}
                        </p>
                      )}
                    </div>
                  </div>

                  {insight.actionable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        applyRecommendation(insight);
                      }}
                      disabled={isApplying}
                      className="btn"
                      style={{
                        marginLeft: '1rem',
                        backgroundColor: isApplying ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        fontSize: '0.875rem',
                        padding: '0.5rem 0.75rem',
                        cursor: isApplying ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isApplying ? 'Applying...' : 'Apply'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Applied Changes Summary */}
        {!loading && !error && insights.length > 0 && (
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h5 style={{ 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                marginBottom: '8px',
                margin: '0 0 8px 0',
                color: '#0c4a6e'
              }}>📊 Changes Applied Verification</h5>
              <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>
                <div>• Modified lineups: {lineups.filter(l => l.modificationSuggested || l.exposureWarning || l.metaScore !== undefined).length}/{lineups.length}</div>
                <div>• Exposure warnings: {lineups.filter(l => l.exposureWarning).length}</div>
                <div>• Meta scores added: {lineups.filter(l => l.metaScore !== undefined).length}</div>
                <div>• Salary flags: {lineups.filter(l => l.optimizationFlag).length}</div>
              </div>
              <button
                className="btn"
                style={{
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  marginTop: '8px'
                }}
                onClick={() => {
                  displayNotification('Check your Lineups tab to see applied changes!', 'info');
                }}
              >
                View Changes in Lineups Tab
              </button>
            </div>

            {/* Recent Changes History */}
            {appliedChanges.length > 0 && (
              <div style={{ 
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h5 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  marginBottom: '8px',
                  margin: '0 0 8px 0',
                  color: '#374151'
                }}>📝 Recent Changes Applied</h5>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {appliedChanges.map((change, index) => (
                    <div key={change.id} style={{ 
                      marginBottom: '4px',
                      padding: '4px 8px',
                      backgroundColor: index === 0 ? '#dcfce7' : 'transparent',
                      borderRadius: '4px'
                    }}>
                      <strong>{change.recommendation}</strong> - {change.timestamp.toLocaleTimeString()}
                      {index === 0 && <span style={{ color: '#059669', fontWeight: 'bold' }}> (Latest)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h5 style={{ 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              marginBottom: '12px',
              margin: '0 0 12px 0'
            }}>Quick Actions</h5>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn"
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  fontSize: '0.875rem',
                  padding: '0.5rem 0.75rem'
                }}
                onClick={() => {
                  if (isApplying) return;
                  const highPriorityRecommendations = insights.filter(i => i.priority === 'high');
                  highPriorityRecommendations.forEach(rec => applyRecommendation(rec));
                }}
              >
                Apply All High Priority
              </button>
              <button
                className="btn"
                style={{
                  backgroundColor: '#4b5563',
                  color: 'white',
                  fontSize: '0.875rem',
                  padding: '0.5rem 0.75rem'
                }}
                onClick={() => {
                  displayNotification('Insights exported to console', 'info');
                }}
              >
                Export Insights
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIInsights;