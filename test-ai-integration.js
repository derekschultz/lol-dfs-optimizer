const axios = require('axios');

const MAIN_SERVER_URL = 'http://localhost:3000';
const AI_SERVICE_URL = 'http://localhost:3002';

async function testIntegration() {
  console.log('🧪 Testing AI Service Integration with Main Server\n');
  
  try {
    // Test 1: Check if main server is running
    console.log('1️⃣ Checking main server health...');
    try {
      const mainHealth = await axios.get(`${MAIN_SERVER_URL}/settings`);
      console.log('✅ Main server is running');
    } catch (error) {
      console.log('❌ Main server is not running. Please start it with: npm start');
      return;
    }
    
    // Test 2: Check if AI service is running
    console.log('\n2️⃣ Checking AI service health...');
    try {
      const aiHealth = await axios.get(`${AI_SERVICE_URL}/health`);
      console.log('✅ AI service is running');
      console.log('   Services status:', aiHealth.data.services);
    } catch (error) {
      console.log('❌ AI service is not running. Please start it with: npm run ai-service');
      return;
    }
    
    // Test 3: Check main server data endpoints
    console.log('\n3️⃣ Checking main server data endpoints...');
    const endpoints = [
      '/api/data/players',
      '/api/data/lineups',
      '/api/data/exposures',
      '/api/data/contest'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${MAIN_SERVER_URL}${endpoint}`);
        console.log(`✅ ${endpoint} - Status: ${response.data.success ? 'OK' : 'Failed'}`);
        
        if (endpoint === '/api/data/players') {
          console.log(`   Players count: ${response.data.data?.length || 0}`);
        } else if (endpoint === '/api/data/lineups') {
          console.log(`   Lineups count: ${response.data.count || 0}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
      }
    }
    
    // Test 4: Test AI service live recommendations endpoint
    console.log('\n4️⃣ Testing AI service live recommendations...');
    try {
      const liveRecs = await axios.get(`${AI_SERVICE_URL}/api/ai/recommendations/live`);
      
      if (liveRecs.data.success) {
        console.log('✅ AI service successfully fetched live data from main server');
        console.log(`   Players: ${liveRecs.data.data_summary.players_count}`);
        console.log(`   Lineups: ${liveRecs.data.data_summary.lineups_count}`);
        console.log(`   Recommendations: ${liveRecs.data.recommendations.length}`);
        
        if (liveRecs.data.recommendations.length > 0) {
          console.log('\n   Sample recommendations:');
          liveRecs.data.recommendations.slice(0, 3).forEach((rec, i) => {
            console.log(`   ${i + 1}. ${rec.icon} ${rec.title} (${rec.confidence}% confidence)`);
          });
        }
      } else {
        console.log('⚠️  AI service returned no data. Make sure player data and lineups are uploaded.');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️  No data available. Please upload player projections and generate lineups first.');
      } else {
        console.log('❌ Failed to get live recommendations:', error.message);
      }
    }
    
    console.log('\n✨ Integration test complete!');
    console.log('\nNext steps:');
    console.log('1. Upload player projections in the main app');
    console.log('2. Generate some lineups');
    console.log('3. Open the AI Insights panel to see live recommendations');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testIntegration();