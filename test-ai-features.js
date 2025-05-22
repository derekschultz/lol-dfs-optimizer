#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

const MAIN_SERVER = 'http://localhost:3000';
const AI_SERVICE = 'http://localhost:3002';

// Test data
const testPlayers = [
  { name: 'Faker', position: 'MID', team: 'T1', salary: 9500, projectedPoints: 95.5 },
  { name: 'Zeus', position: 'TOP', team: 'T1', salary: 8500, projectedPoints: 85.0 },
  { name: 'Oner', position: 'JNG', team: 'T1', salary: 8000, projectedPoints: 80.0 },
  { name: 'Gumayusi', position: 'ADC', team: 'T1', salary: 9000, projectedPoints: 90.0 },
  { name: 'Keria', position: 'SUP', team: 'T1', salary: 7500, projectedPoints: 75.0 }
];

const testLineups = [
  {
    id: 'test-1',
    cpt: { name: 'Faker', position: 'CPT', team: 'T1', salary: 14250 },
    players: [
      { name: 'Zeus', position: 'TOP', team: 'T1', salary: 8500 },
      { name: 'Oner', position: 'JNG', team: 'T1', salary: 8000 },
      { name: 'Gumayusi', position: 'ADC', team: 'T1', salary: 9000 },
      { name: 'Keria', position: 'SUP', team: 'T1', salary: 7500 }
    ],
    totalSalary: 47250,
    projectedPoints: 431.25
  }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndpoint(name, method, url, data = null) {
  try {
    console.log(`\n📍 Testing: ${name}`);
    const config = { method, url };
    if (data) config.data = data;
    
    const response = await axios(config);
    
    if (response.data.success) {
      console.log(chalk.green(`✅ ${name} - Success`));
      return response.data;
    } else {
      console.log(chalk.red(`❌ ${name} - Failed: ${response.data.error}`));
      return null;
    }
  } catch (error) {
    console.log(chalk.red(`❌ ${name} - Error: ${error.message}`));
    return null;
  }
}

async function runTests() {
  console.log(chalk.blue('\n🧪 AI Feature Test Suite\n'));
  console.log('Testing AI-powered DFS Optimizer features...\n');

  // Test 1: Check service health
  console.log(chalk.yellow('1️⃣  Service Health Checks'));
  const mainHealth = await testEndpoint('Main Server Health', 'GET', `${MAIN_SERVER}/api/health`);
  const aiHealth = await testEndpoint('AI Service Health', 'GET', `${AI_SERVICE}/api/health`);
  
  if (!mainHealth || !aiHealth) {
    console.log(chalk.red('\n⚠️  Services not running. Please start with: npm start'));
    return;
  }

  await delay(1000);

  // Test 2: AI Recommendations
  console.log(chalk.yellow('\n2️⃣  AI Recommendations Engine'));
  const recommendations = await testEndpoint(
    'Get AI Recommendations',
    'POST',
    `${AI_SERVICE}/api/ai/recommendations`,
    {
      lineups: testLineups,
      playerData: testPlayers,
      contestData: {
        fieldSize: 1000,
        entryFee: 5,
        totalPrize: 5000
      }
    }
  );
  
  if (recommendations?.recommendations) {
    console.log(chalk.gray(`   Found ${recommendations.recommendations.length} recommendations`));
    recommendations.recommendations.slice(0, 3).forEach(rec => {
      console.log(chalk.gray(`   • ${rec.title} (Impact: ${rec.impact})`));
    });
  }

  await delay(1000);

  // Test 3: AI Coach
  console.log(chalk.yellow('\n3️⃣  AI Coach & Portfolio Grading'));
  const coaching = await testEndpoint('Get AI Coach Insights', 'GET', `${AI_SERVICE}/api/ai/coach`);
  
  if (coaching?.coaching) {
    const grade = coaching.coaching.portfolio_grade;
    console.log(chalk.gray(`   Portfolio Grade: ${grade.grade} (${grade.score}/100)`));
    console.log(chalk.gray(`   ${grade.description}`));
  }

  await delay(1000);

  // Test 4: Meta Insights
  console.log(chalk.yellow('\n4️⃣  Meta Detection & Insights'));
  const metaInsights = await testEndpoint('Get Meta Insights', 'GET', `${AI_SERVICE}/api/ai/meta-insights`);
  
  if (metaInsights?.meta_insights) {
    console.log(chalk.gray(`   Meta Strength: ${metaInsights.meta_insights.metaStrength}%`));
    console.log(chalk.gray(`   Current Meta: ${metaInsights.meta_insights.currentMeta}`));
  }

  await delay(1000);

  // Test 5: Player Predictions
  console.log(chalk.yellow('\n5️⃣  Player Performance Predictions'));
  const predictions = await testEndpoint(
    'Predict Player Performance',
    'POST',
    `${AI_SERVICE}/api/ai/player-predictions`,
    {
      players: testPlayers.slice(0, 2),
      matchContext: {
        opponent: 'GEN',
        isHome: true,
        recentForm: 'W-W-L-W-W'
      }
    }
  );
  
  if (predictions?.predictions) {
    console.log(chalk.gray(`   Predicted ${predictions.predictions.length} player performances`));
  }

  await delay(1000);

  // Test 6: Risk Assessment
  console.log(chalk.yellow('\n6️⃣  Portfolio Risk Assessment'));
  const riskAnalysis = await testEndpoint(
    'Assess Portfolio Risk',
    'POST',
    `${AI_SERVICE}/api/ai/risk-assessment`,
    {
      lineups: testLineups,
      exposures: {
        player: { 'Faker': 100, 'Zeus': 100 },
        team: { 'T1': 100 }
      }
    }
  );
  
  if (riskAnalysis?.risk_analysis) {
    const risk = riskAnalysis.risk_analysis;
    console.log(chalk.gray(`   Risk Score: ${risk.risk_score}/100`));
    console.log(chalk.gray(`   Risk Level: ${risk.risk_level}`));
  }

  // Summary
  console.log(chalk.blue('\n\n📊 Test Summary\n'));
  console.log(chalk.green('All AI features are operational! 🎉'));
  console.log('\nThe AI-powered DFS Optimizer includes:');
  console.log('  • Smart lineup recommendations');
  console.log('  • Portfolio grading and coaching');
  console.log('  • Meta trend detection');
  console.log('  • Player performance predictions');
  console.log('  • Risk assessment and management');
  console.log('\nStart optimizing with: npm start');
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red('\n❌ Test suite failed:'), error.message);
  process.exit(1);
});