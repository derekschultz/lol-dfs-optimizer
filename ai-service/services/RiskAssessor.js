class RiskAssessor {
  constructor() {
    this.ready = false;
    this.riskThresholds = {
      player_exposure: { low: 15, medium: 25, high: 35 },
      team_exposure: { low: 20, medium: 35, high: 50 },
      correlation: { low: 0.3, medium: 0.6, high: 0.8 },
      variance: { low: 0.8, medium: 1.2, high: 1.8 }
    };
    this.initialize();
  }

  async initialize() {
    try {
      console.log('⚖️ Initializing Risk Assessor...');
      this.ready = true;
      console.log('✅ Risk Assessor ready');
    } catch (error) {
      console.error('❌ Failed to initialize Risk Assessor:', error);
    }
  }

  isReady() {
    return this.ready;
  }

  async assessPortfolioRisk(lineups, exposureData = {}) {
    if (!this.ready) {
      throw new Error('Risk Assessor not ready');
    }

    console.log('🔍 Assessing portfolio risk...');

    const analysis = {
      overall_risk: 'medium',
      risk_score: 0,
      max_risk_score: 100,
      risk_factors: [],
      recommendations: [],
      detailed_analysis: {
        concentration_risk: this.assessConcentrationRisk(lineups, exposureData),
        correlation_risk: this.assessCorrelationRisk(lineups),
        variance_risk: this.assessVarianceRisk(lineups),
        meta_risk: this.assessMetaRisk(lineups),
        ownership_risk: this.assessOwnershipRisk(lineups, exposureData)
      },
      risk_distribution: this.calculateRiskDistribution(lineups),
      generated_at: new Date().toISOString()
    };

    // Calculate overall risk score
    analysis.risk_score = this.calculateOverallRiskScore(analysis.detailed_analysis);
    analysis.overall_risk = this.categorizeRisk(analysis.risk_score);

    // Generate risk factors and recommendations
    analysis.risk_factors = this.identifyRiskFactors(analysis.detailed_analysis);
    analysis.recommendations = this.generateRiskRecommendations(analysis.detailed_analysis);

    return analysis;
  }

  assessConcentrationRisk(lineups, exposureData) {
    const playerExposure = this.calculatePlayerExposure(lineups);
    const teamExposure = this.calculateTeamExposure(lineups);

    const risks = [];
    let maxPlayerExposure = 0;
    let maxTeamExposure = 0;
    let highExposurePlayers = 0;
    let highExposureTeams = 0;

    // Check player concentration
    Object.entries(playerExposure).forEach(([player, exposure]) => {
      maxPlayerExposure = Math.max(maxPlayerExposure, exposure);
      
      if (exposure > this.riskThresholds.player_exposure.high) {
        highExposurePlayers++;
        risks.push({
          type: 'high_player_exposure',
          player: player,
          exposure: exposure,
          threshold: this.riskThresholds.player_exposure.high,
          severity: 'high'
        });
      } else if (exposure > this.riskThresholds.player_exposure.medium) {
        risks.push({
          type: 'medium_player_exposure',
          player: player,
          exposure: exposure,
          threshold: this.riskThresholds.player_exposure.medium,
          severity: 'medium'
        });
      }
    });

    // Check team concentration
    Object.entries(teamExposure).forEach(([team, exposure]) => {
      maxTeamExposure = Math.max(maxTeamExposure, exposure);
      
      if (exposure > this.riskThresholds.team_exposure.high) {
        highExposureTeams++;
        risks.push({
          type: 'high_team_exposure',
          team: team,
          exposure: exposure,
          threshold: this.riskThresholds.team_exposure.high,
          severity: 'high'
        });
      }
    });

    return {
      type: 'concentration_risk',
      risks: risks,
      metrics: {
        max_player_exposure: maxPlayerExposure,
        max_team_exposure: maxTeamExposure,
        high_exposure_players: highExposurePlayers,
        high_exposure_teams: highExposureTeams
      },
      score: this.scoreConcentrationRisk(maxPlayerExposure, maxTeamExposure, highExposurePlayers, highExposureTeams)
    };
  }

  assessCorrelationRisk(lineups) {
    // Calculate correlation between players/teams in portfolio
    const correlations = this.calculatePortfolioCorrelations(lineups);
    
    const risks = [];
    let highCorrelationPairs = 0;

    correlations.forEach(correlation => {
      if (correlation.value > this.riskThresholds.correlation.high) {
        highCorrelationPairs++;
        risks.push({
          type: 'high_correlation',
          pair: correlation.pair,
          correlation: correlation.value,
          severity: 'high'
        });
      } else if (correlation.value > this.riskThresholds.correlation.medium) {
        risks.push({
          type: 'medium_correlation',
          pair: correlation.pair,
          correlation: correlation.value,
          severity: 'medium'
        });
      }
    });

    return {
      type: 'correlation_risk',
      risks: risks,
      metrics: {
        avg_correlation: correlations.reduce((sum, c) => sum + c.value, 0) / correlations.length,
        max_correlation: Math.max(...correlations.map(c => c.value)),
        high_correlation_pairs: highCorrelationPairs
      },
      score: this.scoreCorrelationRisk(correlations)
    };
  }

  assessVarianceRisk(lineups) {
    // Assess portfolio variance and boom/bust potential
    const playerVariances = this.calculatePlayerVariances(lineups);
    
    const risks = [];
    let highVariancePlayers = 0;
    let totalVariance = 0;

    Object.entries(playerVariances).forEach(([player, variance]) => {
      totalVariance += variance;
      
      if (variance > this.riskThresholds.variance.high) {
        highVariancePlayers++;
        risks.push({
          type: 'high_variance_player',
          player: player,
          variance: variance,
          severity: 'medium' // High variance can be good or bad
        });
      }
    });

    const avgVariance = totalVariance / Object.keys(playerVariances).length;

    return {
      type: 'variance_risk',
      risks: risks,
      metrics: {
        avg_portfolio_variance: avgVariance,
        high_variance_players: highVariancePlayers,
        total_variance: totalVariance
      },
      score: this.scoreVarianceRisk(avgVariance, highVariancePlayers)
    };
  }

  assessMetaRisk(lineups) {
    // Assess risk from meta shifts
    const metaFits = this.calculateMetaFits(lineups);
    
    const risks = [];
    let poorMetaFitPlayers = 0;
    let totalMetaFit = 0;

    Object.entries(metaFits).forEach(([player, metaFit]) => {
      totalMetaFit += metaFit;
      
      if (metaFit < 0.6) {
        poorMetaFitPlayers++;
        risks.push({
          type: 'poor_meta_fit',
          player: player,
          meta_fit: metaFit,
          severity: 'medium'
        });
      }
    });

    const avgMetaFit = totalMetaFit / Object.keys(metaFits).length;

    return {
      type: 'meta_risk',
      risks: risks,
      metrics: {
        avg_meta_fit: avgMetaFit,
        poor_meta_fit_players: poorMetaFitPlayers
      },
      score: this.scoreMetaRisk(avgMetaFit, poorMetaFitPlayers)
    };
  }

  assessOwnershipRisk(lineups, exposureData) {
    // Assess risk from ownership levels
    const ownershipLevels = this.calculateOwnershipLevels(lineups);
    
    const risks = [];
    let highOwnershipPlayers = 0;
    let chalkiness = 0;

    Object.entries(ownershipLevels).forEach(([player, ownership]) => {
      if (ownership > 30) { // High ownership threshold
        highOwnershipPlayers++;
        chalkiness += ownership;
        risks.push({
          type: 'high_ownership',
          player: player,
          ownership: ownership,
          severity: 'low' // High ownership reduces upside but is safer
        });
      }
    });

    return {
      type: 'ownership_risk',
      risks: risks,
      metrics: {
        avg_ownership: Object.values(ownershipLevels).reduce((a, b) => a + b, 0) / Object.values(ownershipLevels).length,
        high_ownership_players: highOwnershipPlayers,
        chalkiness_score: chalkiness
      },
      score: this.scoreOwnershipRisk(chalkiness, highOwnershipPlayers)
    };
  }

  calculatePlayerExposure(lineups) {
    const exposure = {};
    const totalLineups = lineups.length;

    lineups.forEach(lineup => {
      // Count captain
      if (lineup.cpt || lineup.captain) {
        const captain = lineup.cpt || lineup.captain;
        const key = `${captain.name} (${captain.team})`;
        exposure[key] = (exposure[key] || 0) + 1;
      }

      // Count regular players
      if (lineup.players) {
        lineup.players.forEach(player => {
          const key = `${player.name} (${player.team})`;
          exposure[key] = (exposure[key] || 0) + 1;
        });
      }
    });

    // Convert to percentages
    Object.keys(exposure).forEach(player => {
      exposure[player] = (exposure[player] / totalLineups) * 100;
    });

    return exposure;
  }

  calculateTeamExposure(lineups) {
    const exposure = {};
    const totalLineups = lineups.length;

    lineups.forEach(lineup => {
      const teamsInLineup = new Set();
      
      // Add captain team
      if (lineup.cpt || lineup.captain) {
        const captain = lineup.cpt || lineup.captain;
        teamsInLineup.add(captain.team);
      }

      // Add player teams
      if (lineup.players) {
        lineup.players.forEach(player => {
          teamsInLineup.add(player.team);
        });
      }

      // Count each team once per lineup
      teamsInLineup.forEach(team => {
        exposure[team] = (exposure[team] || 0) + 1;
      });
    });

    // Convert to percentages
    Object.keys(exposure).forEach(team => {
      exposure[team] = (exposure[team] / totalLineups) * 100;
    });

    return exposure;
  }

  calculatePortfolioCorrelations(lineups) {
    // Simplified correlation calculation
    // In production, this would use historical performance data
    const correlations = [];
    
    // Simulate some correlations
    correlations.push({ pair: 'T1 Players', value: 0.75 });
    correlations.push({ pair: 'GEN Players', value: 0.68 });
    correlations.push({ pair: 'Mid-ADC Same Team', value: 0.45 });
    
    return correlations;
  }

  calculatePlayerVariances(lineups) {
    // Simulate player variance data
    const variances = {};
    
    lineups.forEach(lineup => {
      if (lineup.cpt || lineup.captain) {
        const captain = lineup.cpt || lineup.captain;
        const key = `${captain.name} (${captain.team})`;
        variances[key] = this.getPlayerVariance(captain.name);
      }

      if (lineup.players) {
        lineup.players.forEach(player => {
          const key = `${player.name} (${player.team})`;
          variances[key] = this.getPlayerVariance(player.name);
        });
      }
    });

    return variances;
  }

  calculateMetaFits(lineups) {
    // Simulate meta fit data
    const metaFits = {};
    
    lineups.forEach(lineup => {
      if (lineup.cpt || lineup.captain) {
        const captain = lineup.cpt || lineup.captain;
        const key = `${captain.name} (${captain.team})`;
        metaFits[key] = this.getPlayerMetaFit(captain.name);
      }

      if (lineup.players) {
        lineup.players.forEach(player => {
          const key = `${player.name} (${player.team})`;
          metaFits[key] = this.getPlayerMetaFit(player.name);
        });
      }
    });

    return metaFits;
  }

  calculateOwnershipLevels(lineups) {
    // Simulate ownership data
    const ownership = {};
    
    lineups.forEach(lineup => {
      if (lineup.cpt || lineup.captain) {
        const captain = lineup.cpt || lineup.captain;
        const key = `${captain.name} (${captain.team})`;
        ownership[key] = this.getPlayerOwnership(captain.name);
      }

      if (lineup.players) {
        lineup.players.forEach(player => {
          const key = `${player.name} (${player.team})`;
          ownership[key] = this.getPlayerOwnership(player.name);
        });
      }
    });

    return ownership;
  }

  getPlayerVariance(playerName) {
    const variances = {
      'Faker': 0.8,
      'Zeus': 1.4,
      'Chovy': 0.6,
      'Ruler': 1.0,
      'Canyon': 1.2
    };
    return variances[playerName] || 1.0;
  }

  getPlayerMetaFit(playerName) {
    const metaFits = {
      'Faker': 0.88,
      'Chovy': 0.92,
      'Zeus': 0.75,
      'Ruler': 0.85,
      'Canyon': 0.80
    };
    return metaFits[playerName] || 0.75;
  }

  getPlayerOwnership(playerName) {
    const ownership = {
      'Faker': 45,
      'Chovy': 38,
      'Zeus': 25,
      'Ruler': 32,
      'Canyon': 28
    };
    return ownership[playerName] || 20;
  }

  scoreConcentrationRisk(maxPlayerExp, maxTeamExp, highExpPlayers, highExpTeams) {
    let score = 0;
    
    // Player concentration score (0-40 points)
    if (maxPlayerExp > 50) score += 40;
    else if (maxPlayerExp > 35) score += 25;
    else if (maxPlayerExp > 25) score += 10;
    
    // Team concentration score (0-30 points)
    if (maxTeamExp > 60) score += 30;
    else if (maxTeamExp > 45) score += 20;
    else if (maxTeamExp > 30) score += 10;
    
    // Multiple high exposure penalties (0-30 points)
    score += Math.min(30, (highExpPlayers * 5) + (highExpTeams * 10));
    
    return Math.min(100, score);
  }

  scoreCorrelationRisk(correlations) {
    const avgCorrelation = correlations.reduce((sum, c) => sum + c.value, 0) / correlations.length;
    const maxCorrelation = Math.max(...correlations.map(c => c.value));
    
    let score = 0;
    
    // Average correlation penalty
    if (avgCorrelation > 0.7) score += 30;
    else if (avgCorrelation > 0.5) score += 15;
    
    // Max correlation penalty
    if (maxCorrelation > 0.8) score += 25;
    else if (maxCorrelation > 0.6) score += 10;
    
    return Math.min(100, score);
  }

  scoreVarianceRisk(avgVariance, highVariancePlayers) {
    let score = 0;
    
    // High variance can be good (upside) or bad (inconsistency)
    // We score it as moderate risk
    if (avgVariance > 1.5) score += 20;
    else if (avgVariance < 0.8) score += 15; // Too low variance also risky (low ceiling)
    
    score += Math.min(25, highVariancePlayers * 5);
    
    return Math.min(100, score);
  }

  scoreMetaRisk(avgMetaFit, poorMetaPlayers) {
    let score = 0;
    
    if (avgMetaFit < 0.6) score += 40;
    else if (avgMetaFit < 0.75) score += 20;
    
    score += Math.min(30, poorMetaPlayers * 8);
    
    return Math.min(100, score);
  }

  scoreOwnershipRisk(chalkiness, highOwnershipPlayers) {
    let score = 0;
    
    // High ownership reduces upside but increases safety
    // We score it as low-medium risk
    if (chalkiness > 200) score += 15;
    else if (chalkiness > 150) score += 10;
    
    return Math.min(100, score);
  }

  calculateOverallRiskScore(detailedAnalysis) {
    const weights = {
      concentration_risk: 0.35,
      correlation_risk: 0.25,
      variance_risk: 0.15,
      meta_risk: 0.15,
      ownership_risk: 0.10
    };

    let totalScore = 0;
    Object.entries(weights).forEach(([risk, weight]) => {
      totalScore += (detailedAnalysis[risk]?.score || 0) * weight;
    });

    return Math.round(totalScore);
  }

  categorizeRisk(score) {
    if (score < 25) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'very_high';
  }

  calculateRiskDistribution(lineups) {
    return {
      low_risk_lineups: Math.round(lineups.length * 0.3),
      medium_risk_lineups: Math.round(lineups.length * 0.5),
      high_risk_lineups: Math.round(lineups.length * 0.2)
    };
  }

  identifyRiskFactors(detailedAnalysis) {
    const factors = [];

    Object.entries(detailedAnalysis).forEach(([riskType, analysis]) => {
      if (analysis.score > 30) {
        factors.push({
          type: riskType,
          severity: analysis.score > 60 ? 'high' : 'medium',
          score: analysis.score,
          description: this.getRiskDescription(riskType, analysis)
        });
      }
    });

    return factors.sort((a, b) => b.score - a.score);
  }

  generateRiskRecommendations(detailedAnalysis) {
    const recommendations = [];

    // Concentration risk recommendations
    if (detailedAnalysis.concentration_risk.score > 40) {
      recommendations.push({
        type: 'reduce_concentration',
        priority: 'high',
        message: 'Reduce player/team concentration to minimize portfolio risk',
        action: 'Diversify exposure across more players and teams'
      });
    }

    // Correlation risk recommendations
    if (detailedAnalysis.correlation_risk.score > 35) {
      recommendations.push({
        type: 'reduce_correlation',
        priority: 'medium',
        message: 'High correlation between players increases portfolio volatility',
        action: 'Mix players from different teams and game styles'
      });
    }

    // Meta risk recommendations
    if (detailedAnalysis.meta_risk.score > 30) {
      recommendations.push({
        type: 'improve_meta_fit',
        priority: 'medium',
        message: 'Some players poorly aligned with current meta',
        action: 'Focus on players who excel in current patch/meta'
      });
    }

    return recommendations;
  }

  getRiskDescription(riskType, analysis) {
    const descriptions = {
      concentration_risk: `High exposure to individual players/teams (max: ${analysis.metrics.max_player_exposure?.toFixed(1)}%)`,
      correlation_risk: `Players moving together reduces diversification (avg correlation: ${analysis.metrics.avg_correlation?.toFixed(2)})`,
      variance_risk: `Portfolio variance level affects consistency (avg: ${analysis.metrics.avg_portfolio_variance?.toFixed(2)})`,
      meta_risk: `Some players misaligned with current meta (avg fit: ${analysis.metrics.avg_meta_fit?.toFixed(2)})`,
      ownership_risk: `High ownership reduces tournament upside (avg: ${analysis.metrics.avg_ownership?.toFixed(1)}%)`
    };
    
    return descriptions[riskType] || 'Risk factor identified';
  }
}

module.exports = RiskAssessor;