const { PythonShell } = require('python-shell');
const path = require('path');

class RecommendationEngine {
  constructor() {
    this.ready = false;
    this.models = null;
    this.cache = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🧠 Initializing Recommendation Engine...');
      // Load pre-trained models or initialize new ones
      this.ready = true;
      console.log('✅ Recommendation Engine ready');
    } catch (error) {
      console.error('❌ Failed to initialize Recommendation Engine:', error);
    }
  }

  isReady() {
    return this.ready;
  }

  async generateRecommendations(data) {
    if (!this.ready) {
      throw new Error('Recommendation Engine not ready');
    }

    const { lineups, playerData, contestData } = data;
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(data);
    if (this.cache.has(cacheKey)) {
      console.log('🔄 Returning cached recommendations');
      return this.cache.get(cacheKey);
    }

    console.log('🔍 Analyzing lineup portfolio...');
    
    const recommendations = [];

    // 1. Analyze current portfolio composition
    const portfolioAnalysis = this.analyzePortfolio(lineups, playerData);
    
    // 2. Identify opportunities
    const opportunities = this.identifyOpportunities(portfolioAnalysis, playerData, contestData);
    
    // 3. Generate specific recommendations
    for (const opportunity of opportunities) {
      if (opportunity.confidence > 0.6) {
        recommendations.push(this.formatRecommendation(opportunity));
      }
    }

    // 4. Add meta-based recommendations
    const metaRecommendations = await this.generateMetaRecommendations(playerData);
    recommendations.push(...metaRecommendations);

    // Cache results for 5 minutes
    this.cache.set(cacheKey, recommendations);
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

    return recommendations;
  }

  analyzePortfolio(lineups, playerData) {
    if (!lineups || lineups.length === 0) {
      return {
        playerExposure: {},
        teamExposure: {},
        positionExposure: {},
        totalLineups: 0,
        averageSalary: 0,
        averageProjection: 0
      };
    }

    const analysis = {
      playerExposure: {},
      teamExposure: {},
      positionExposure: {},
      totalLineups: lineups.length,
      totalSalary: 0,
      totalProjection: 0
    };

    // Analyze each lineup
    lineups.forEach(lineup => {
      // Add salary
      analysis.totalSalary += lineup.salary || 0;
      analysis.totalProjection += lineup.projectedPoints || 0;

      // Count captain
      if (lineup.cpt || lineup.captain) {
        const captain = lineup.cpt || lineup.captain;
        const playerKey = `${captain.name}_${captain.team}`;
        analysis.playerExposure[playerKey] = (analysis.playerExposure[playerKey] || 0) + 1;
        analysis.teamExposure[captain.team] = (analysis.teamExposure[captain.team] || 0) + 1;
        analysis.positionExposure['CPT'] = (analysis.positionExposure['CPT'] || 0) + 1;
      }

      // Count regular players
      if (lineup.players) {
        lineup.players.forEach(player => {
          const playerKey = `${player.name}_${player.team}`;
          analysis.playerExposure[playerKey] = (analysis.playerExposure[playerKey] || 0) + 1;
          analysis.teamExposure[player.team] = (analysis.teamExposure[player.team] || 0) + 1;
          analysis.positionExposure[player.position] = (analysis.positionExposure[player.position] || 0) + 1;
        });
      }
    });

    // Calculate averages
    analysis.averageSalary = analysis.totalSalary / analysis.totalLineups;
    analysis.averageProjection = analysis.totalProjection / analysis.totalLineups;

    // Convert counts to percentages
    Object.keys(analysis.playerExposure).forEach(player => {
      analysis.playerExposure[player] = (analysis.playerExposure[player] / analysis.totalLineups) * 100;
    });

    Object.keys(analysis.teamExposure).forEach(team => {
      analysis.teamExposure[team] = (analysis.teamExposure[team] / analysis.totalLineups) * 100;
    });

    return analysis;
  }

  identifyOpportunities(portfolioAnalysis, playerData, contestData) {
    const opportunities = [];

    // 1. Check for over/under exposure
    Object.entries(portfolioAnalysis.playerExposure).forEach(([playerKey, exposure]) => {
      const [name, team] = playerKey.split('_');
      const player = playerData?.find(p => p.name === name && p.team === team);
      
      if (player) {
        // High exposure opportunity
        if (exposure > 40) {
          opportunities.push({
            type: 'reduce_exposure',
            player: { name, team },
            current_exposure: exposure,
            recommended_exposure: 25,
            reason: 'High concentration risk',
            confidence: 0.8,
            priority: 'high',
            impact: 'Reduce portfolio risk by diversifying player exposure'
          });
        }
        
        // Low exposure opportunity for high-value players
        if (exposure < 10 && player.projectedPoints > 8.5) {
          opportunities.push({
            type: 'increase_exposure',
            player: { name, team },
            current_exposure: exposure,
            recommended_exposure: 20,
            reason: 'Undervalued high-projection player',
            confidence: 0.75,
            priority: 'medium',
            impact: 'Increase upside potential with quality player'
          });
        }
      }
    });

    // 2. Team stack opportunities
    Object.entries(portfolioAnalysis.teamExposure).forEach(([team, exposure]) => {
      if (team === 'T1' && exposure < 30) {
        opportunities.push({
          type: 'increase_team_stack',
          team: team,
          current_exposure: exposure,
          recommended_exposure: 35,
          reason: 'T1 historically outperforms in high-stakes matches',
          confidence: 0.82,
          priority: 'high',
          impact: 'Capitalize on proven championship team synergy'
        });
      }
    });

    // 3. Salary optimization
    if (portfolioAnalysis.averageSalary < 49000) {
      opportunities.push({
        type: 'salary_optimization',
        current_avg: portfolioAnalysis.averageSalary,
        recommended_avg: 49500,
        reason: 'Leaving salary cap value on the table',
        confidence: 0.9,
        priority: 'medium',
        impact: 'Maximize talent acquisition within budget constraints'
      });
    }

    return opportunities;
  }

  async generateMetaRecommendations(playerData) {
    const recommendations = [];

    // Simulated meta insights (in production, this would come from real data)
    const currentMeta = {
      favoredPositions: ['MID', 'ADC'],
      emergingPlayers: ['Zeus', 'Keria'],
      teamTrends: { 'T1': 'rising', 'GEN': 'stable', 'DK': 'declining' }
    };

    // Meta-based recommendations
    if (currentMeta.teamTrends['T1'] === 'rising') {
      recommendations.push({
        type: 'meta_insight',
        category: 'team_trend',
        message: 'T1 showing strong recent form - consider increasing stack exposure',
        confidence: 0.78,
        priority: 'medium',
        data: {
          team: 'T1',
          trend: 'rising',
          recommended_action: 'Increase T1 player exposure by 10-15%'
        }
      });
    }

    currentMeta.emergingPlayers.forEach(playerName => {
      recommendations.push({
        type: 'meta_insight',
        category: 'emerging_player',
        message: `${playerName} emerging as meta-defining player - consider captain usage`,
        confidence: 0.72,
        priority: 'medium',
        data: {
          player: playerName,
          recommended_action: `Consider ${playerName} as captain in 20%+ of lineups`
        }
      });
    });

    return recommendations;
  }

  formatRecommendation(opportunity) {
    const icons = {
      'reduce_exposure': '⚠️',
      'increase_exposure': '📈',
      'increase_team_stack': '🔗',
      'salary_optimization': '💰',
      'meta_insight': '🧠'
    };

    const priorityColors = {
      'high': 'red',
      'medium': 'yellow',
      'low': 'green'
    };

    // Generate actionable data based on opportunity type
    let actionableData = {};
    
    switch (opportunity.type) {
      case 'reduce_exposure':
        actionableData = {
          player_id: opportunity.player.name, // In production, use actual player ID
          player_name: opportunity.player.name,
          current_exposure: opportunity.current_exposure,
          reduce_by: Math.min(25, opportunity.current_exposure - opportunity.recommended_exposure)
        };
        break;
      case 'increase_exposure':
        actionableData = {
          player_id: opportunity.player.name,
          player_name: opportunity.player.name,
          current_exposure: opportunity.current_exposure,
          increase_by: opportunity.recommended_exposure - opportunity.current_exposure
        };
        break;
      case 'increase_team_stack':
        actionableData = {
          team: opportunity.team,
          current_exposure: opportunity.current_exposure,
          increase_by: opportunity.recommended_exposure - opportunity.current_exposure,
          stack_size: 3
        };
        break;
      case 'salary_optimization':
        actionableData = {
          current_avg_salary: opportunity.current_avg,
          salary_range: [48000, 50000],
          optimization_target: 'value'
        };
        break;
      case 'meta_insight':
        actionableData = opportunity.data || {};
        break;
    }

    return {
      id: this.generateId(),
      type: opportunity.type,
      icon: icons[opportunity.type] || '💡',
      title: this.generateTitle(opportunity),
      message: this.generateMessage(opportunity),
      confidence: Math.round(opportunity.confidence * 100),
      priority: opportunity.priority,
      priority_color: priorityColors[opportunity.priority],
      impact: opportunity.impact,
      data: actionableData,
      timestamp: new Date().toISOString(),
      actionable: true
    };
  }

  generateTitle(opportunity) {
    switch (opportunity.type) {
      case 'reduce_exposure':
        return `Reduce ${opportunity.player.name} Exposure`;
      case 'increase_exposure':
        return `Increase ${opportunity.player.name} Exposure`;
      case 'increase_team_stack':
        return `Boost ${opportunity.team} Stack`;
      case 'salary_optimization':
        return 'Optimize Salary Usage';
      case 'meta_insight':
        return opportunity.data?.title || 'Meta Insight';
      default:
        return 'AI Recommendation';
    }
  }

  generateMessage(opportunity) {
    switch (opportunity.type) {
      case 'reduce_exposure':
        return `Currently at ${opportunity.current_exposure.toFixed(1)}% exposure. Recommend reducing to ${opportunity.recommended_exposure}% to minimize risk.`;
      case 'increase_exposure':
        return `Currently at ${opportunity.current_exposure.toFixed(1)}% exposure. Consider increasing to ${opportunity.recommended_exposure}% for better upside.`;
      case 'increase_team_stack':
        return `${opportunity.team} exposure at ${opportunity.current_exposure.toFixed(1)}%. Recommend increasing to ${opportunity.recommended_exposure}% based on recent performance.`;
      case 'salary_optimization':
        return `Average salary: $${opportunity.current_avg.toLocaleString()}. Consider targeting $${opportunity.recommended_avg.toLocaleString()} to maximize value.`;
      case 'meta_insight':
        return opportunity.message;
      default:
        return opportunity.reason || 'AI-generated recommendation';
    }
  }

  generateCacheKey(data) {
    const { lineups, playerData } = data;
    const lineupHash = lineups ? lineups.length.toString() : '0';
    const playerHash = playerData ? playerData.length.toString() : '0';
    const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute buckets
    return `rec_${lineupHash}_${playerHash}_${timestamp}`;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = RecommendationEngine;