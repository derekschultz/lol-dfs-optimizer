class MetaDetector {
  constructor() {
    this.ready = false;
    this.metaCache = null;
    this.lastUpdate = null;
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🎯 Initializing Meta Detector...');
      await this.loadHistoricalData();
      this.ready = true;
      console.log('✅ Meta Detector ready');
    } catch (error) {
      console.error('❌ Failed to initialize Meta Detector:', error);
    }
  }

  isReady() {
    return this.ready;
  }

  async loadHistoricalData() {
    // In production, this would load from database
    // For now, we'll use simulated data
    this.historicalMeta = {
      patches: [
        {
          version: '13.20',
          startDate: '2024-10-15',
          championTrends: {
            'Azir': { pickRate: 0.45, winRate: 0.52, priority: 'high' },
            'Jinx': { pickRate: 0.38, winRate: 0.55, priority: 'high' },
            'Thresh': { pickRate: 0.42, winRate: 0.48, priority: 'medium' }
          },
          teamTrends: {
            'T1': { avgGameLength: 32.5, winRate: 0.71 },
            'GEN': { avgGameLength: 35.2, winRate: 0.68 },
            'DK': { avgGameLength: 29.8, winRate: 0.58 }
          }
        }
      ],
      playerPerformance: {
        'Faker': {
          recentForm: [8.2, 7.8, 9.1, 8.5, 7.9], // Last 5 games
          metaFit: 0.85,
          championPool: ['Azir', 'Orianna', 'Sylas', 'LeBlanc']
        },
        'Chovy': {
          recentForm: [9.0, 8.7, 8.9, 9.2, 8.8],
          metaFit: 0.92,
          championPool: ['Azir', 'Corki', 'Orianna', 'Viktor']
        }
      }
    };
  }

  async getCurrentMetaInsights() {
    if (!this.ready) {
      throw new Error('Meta Detector not ready');
    }

    // Check if we need to update cache
    const now = new Date();
    if (!this.metaCache || !this.lastUpdate || (now - this.lastUpdate) > 30 * 60 * 1000) {
      await this.updateMetaInsights();
    }

    return this.metaCache;
  }

  async updateMetaInsights() {
    console.log('🔄 Updating meta insights...');
    
    const insights = {
      timestamp: new Date().toISOString(),
      patch: '13.20',
      metaStrength: 'stable',
      trends: await this.analyzeTrends(),
      playerInsights: await this.analyzePlayerMeta(),
      teamInsights: await this.analyzeTeamMeta(),
      predictions: await this.generateMetaPredictions()
    };

    this.metaCache = insights;
    this.lastUpdate = new Date();
    
    return insights;
  }

  async analyzeTrends() {
    // Analyze champion and strategy trends
    return {
      rising_champions: [
        {
          name: 'Azir',
          pickRate: 0.45,
          winRate: 0.52,
          trend: '+15% pick rate over last 2 weeks',
          dfsImpact: 'Mid laners picking Azir showing +12% fantasy performance'
        },
        {
          name: 'Jinx',
          pickRate: 0.38,
          winRate: 0.55,
          trend: '+22% win rate in recent patches',
          dfsImpact: 'ADC position gaining value, especially in longer games'
        }
      ],
      declining_champions: [
        {
          name: 'Zeri',
          pickRate: 0.12,
          winRate: 0.41,
          trend: '-28% pick rate after nerfs',
          dfsImpact: 'ADC players avoiding Zeri, reducing variance'
        }
      ],
      strategy_trends: [
        {
          name: 'Late game scaling',
          prevalence: 0.65,
          trend: 'increasing',
          impact: 'Longer games favoring scaling picks and team fight comps'
        },
        {
          name: 'Early aggression',
          prevalence: 0.35,
          trend: 'decreasing',
          impact: 'Early game specialists seeing reduced priority'
        }
      ]
    };
  }

  async analyzePlayerMeta() {
    const playerInsights = [];

    // Analyze each player's meta fitness
    Object.entries(this.historicalMeta.playerPerformance).forEach(([playerName, data]) => {
      const insight = {
        player: playerName,
        metaFit: data.metaFit,
        recentForm: data.recentForm,
        formTrend: this.calculateFormTrend(data.recentForm),
        championPoolStrength: this.assessChampionPool(data.championPool),
        recommendation: this.generatePlayerRecommendation(playerName, data)
      };
      
      playerInsights.push(insight);
    });

    return playerInsights;
  }

  async analyzeTeamMeta() {
    const teamInsights = [];

    Object.entries(this.historicalMeta.patches[0].teamTrends).forEach(([teamName, data]) => {
      const insight = {
        team: teamName,
        avgGameLength: data.avgGameLength,
        winRate: data.winRate,
        metaAlignment: this.assessTeamMetaAlignment(teamName, data),
        stackValue: this.calculateStackValue(teamName, data),
        recommendation: this.generateTeamRecommendation(teamName, data)
      };
      
      teamInsights.push(insight);
    });

    return teamInsights;
  }

  async generateMetaPredictions() {
    return {
      shortTerm: [
        {
          prediction: 'T1 stack value increasing',
          confidence: 0.78,
          timeframe: '1-2 weeks',
          reasoning: 'Strong performance in scaling meta + favorable matchups'
        },
        {
          prediction: 'Mid lane captain usage rising',
          confidence: 0.82,
          timeframe: '1 week',
          reasoning: 'Control mage meta favoring star mid laners'
        }
      ],
      longTerm: [
        {
          prediction: 'Support captain strategies emerging',
          confidence: 0.65,
          timeframe: '3-4 weeks',
          reasoning: 'Low ownership + high impact in team fight meta'
        }
      ]
    };
  }

  calculateFormTrend(recentForm) {
    if (recentForm.length < 3) return 'insufficient_data';
    
    const recent = recentForm.slice(-3);
    const earlier = recentForm.slice(0, -3);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg;
    
    const change = recentAvg - earlierAvg;
    
    if (change > 0.5) return 'improving';
    if (change < -0.5) return 'declining';
    return 'stable';
  }

  assessChampionPool(championPool) {
    // Simple meta alignment check
    const metaChampions = ['Azir', 'Orianna', 'Jinx', 'Thresh'];
    const alignment = championPool.filter(champ => metaChampions.includes(champ)).length / metaChampions.length;
    
    if (alignment > 0.7) return 'excellent';
    if (alignment > 0.5) return 'good';
    if (alignment > 0.3) return 'moderate';
    return 'poor';
  }

  assessTeamMetaAlignment(teamName, data) {
    // Teams that adapt well to current meta
    if (data.winRate > 0.65 && data.avgGameLength > 30) {
      return 'excellent'; // Good at current scaling meta
    }
    if (data.winRate > 0.55) {
      return 'good';
    }
    return 'moderate';
  }

  calculateStackValue(teamName, data) {
    // Higher win rate + meta alignment = higher stack value
    const baseValue = data.winRate * 100;
    const metaBonus = data.avgGameLength > 32 ? 10 : 0; // Bonus for scaling meta
    
    return Math.min(100, baseValue + metaBonus);
  }

  generatePlayerRecommendation(playerName, data) {
    const formTrend = this.calculateFormTrend(data.recentForm);
    const championPoolStrength = this.assessChampionPool(data.championPool);
    
    if (formTrend === 'improving' && championPoolStrength === 'excellent') {
      return `Strong captain candidate - improving form in favorable meta`;
    }
    if (data.metaFit > 0.8) {
      return `High exposure recommended - excellent meta alignment`;
    }
    if (formTrend === 'declining') {
      return `Consider reducing exposure - recent form concerning`;
    }
    
    return `Solid option - moderate exposure recommended`;
  }

  generateTeamRecommendation(teamName, data) {
    const metaAlignment = this.assessTeamMetaAlignment(teamName, data);
    
    if (metaAlignment === 'excellent') {
      return `Premium stack option - excelling in current meta`;
    }
    if (data.winRate > 0.6) {
      return `Strong stack candidate - consistent performance`;
    }
    
    return `Moderate stack value - consider matchup dependent`;
  }
}

module.exports = MetaDetector;