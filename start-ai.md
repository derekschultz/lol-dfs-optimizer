# Starting the AI-Enhanced LoL DFS Optimizer

## Quick Start

1. **Start the AI Service** (in terminal 1):
```bash
cd ai-service
npm install  # (if not done already)
npm run dev
```

2. **Start the Main App** (in terminal 2):
```bash
npm start  # (runs both server and client)
```

## Services Running

- **Main App**: http://localhost:3000 (React frontend)
- **Main API**: http://localhost:3001 (Express backend)
- **AI Service**: http://localhost:3002 (AI recommendation service)

## Using AI Insights

1. Upload player data and team stacks in the "Upload" tab
2. Generate some lineups using the "Hybrid Optimizer v2.0" tab
3. Go to the new "AI Insights" tab to see AI-powered recommendations
4. The AI will analyze your lineup portfolio and suggest optimizations

## AI Features

- **Smart Recommendations**: Exposure analysis, salary optimization
- **Meta Insights**: Champion pick rates and trending strategies  
- **Risk Assessment**: Portfolio risk scoring across multiple dimensions
- **Player Predictions**: Performance forecasting with confidence intervals
- **Real-time Updates**: Live refresh of insights as you modify lineups

## Troubleshooting

- If AI Insights shows "service unavailable", make sure the AI service is running on port 3002
- Check the browser console for any error messages
- Restart the AI service if it becomes unresponsive