# 🤖 AI-Powered DFS Optimizer User Guide

## Overview

The AI-Powered DFS Optimizer uses advanced machine learning and analytics to help you create winning Daily Fantasy Sports lineups for League of Legends contests. This guide will help you understand and use all the AI features effectively.

## 🚀 Getting Started

### Starting the Application

1. Open your terminal and navigate to the project directory
2. Run the following command:
   ```bash
   npm start
   ```
3. This will start:

   - Main server (port 3000)
   - Client application (port 3001)
   - AI service (port 3002)

4. Open your browser and go to `http://localhost:3001`

## 🎯 AI Features

### 1. AI Insights Panel

Located in the main interface, the AI Insights panel provides real-time recommendations for your lineups.

#### How to Use:

- Click the **🔄 Refresh** button to get the latest AI recommendations
- Each recommendation shows:
  - **Title**: What the AI suggests
  - **Impact**: How much this change could improve your lineup
  - **Confidence**: How certain the AI is about this recommendation
  - **Details**: Specific information about the recommendation

#### Types of Recommendations:

- **Exposure Reduction**: When a player appears in too many lineups
- **Exposure Increase**: When you should use a high-value player more
- **Team Stack Optimization**: Improve team synergies
- **Salary Optimization**: Better salary cap management
- **Meta Insights**: Adapt to current game trends

### 2. Portfolio Grading

Get an instant grade for your entire lineup portfolio.

#### How to Use:

1. Generate at least one lineup
2. Click the **🎓 Grade** button in the AI Insights panel
3. View your grade (A+ to D) with detailed feedback

#### What the Grades Mean:

- **A+ (90-100)**: Exceptional portfolio with optimal diversification
- **A (80-89)**: Excellent balance and strong potential
- **B (70-79)**: Good portfolio with room for improvement
- **C (60-69)**: Average portfolio, consider AI recommendations
- **D (Below 60)**: Needs significant optimization

### 3. One-Click Optimization

Apply AI recommendations instantly with a single click.

#### How to Use:

1. Review the AI recommendation
2. Click the **Apply** button on any recommendation
3. The AI will automatically update your lineups
4. Changes are highlighted in the lineup list

#### What Happens:

- Players are swapped intelligently
- Salary cap is maintained
- Team stacking rules are respected
- You'll see a notification confirming the change

### 4. Real-Time Meta Analysis

The AI continuously analyzes the current game meta to keep your lineups competitive.

#### Features:

- **Meta Strength Indicator**: Shows how well your lineups align with current trends
- **Player Performance Predictions**: Forecasts based on recent performance
- **Risk Assessment**: Identifies potential volatility in your portfolio

## 📊 Understanding AI Metrics

### Confidence Scores

- **90-100%**: Highly recommended, strong data support
- **70-89%**: Good recommendation, likely beneficial
- **50-69%**: Moderate confidence, worth considering
- **Below 50%**: Low confidence, optional change

### Impact Ratings

- **High**: Could improve lineup score by 10+ points
- **Medium**: Could improve lineup score by 5-10 points
- **Low**: Minor optimization, 1-5 point improvement

### Risk Levels

- **Low Risk**: Stable, consistent performance expected
- **Medium Risk**: Some variance, balanced approach
- **High Risk**: High ceiling but volatile

## 🛠️ Troubleshooting

### AI Service Not Responding

1. Check if all services are running (you should see output in terminal)
2. Restart the application with `npm start`
3. Clear your browser cache and refresh

### Recommendations Not Updating

1. Click the **Refresh** button to force an update
2. Make sure you have player data uploaded
3. Ensure you have at least one lineup generated

### Grade Button Not Working

1. Verify you have lineups generated
2. Check that the AI service is running (port 3002)
3. Look for error messages in the browser console

## 💡 Pro Tips

1. **Start with AI Recommendations**: Let the AI analyze your initial lineups before making manual changes

2. **Apply High-Impact Changes First**: Focus on recommendations with high impact and confidence

3. **Monitor Your Grade**: After applying changes, re-grade your portfolio to see improvement

4. **Use Meta Insights**: Pay attention to meta trends, especially close to game time

5. **Balance Risk**: Mix high-risk/high-reward plays with stable picks

6. **Refresh Regularly**: Game conditions change, so refresh AI insights periodically

## 🔧 Advanced Features

### Custom Exposure Targets

- The AI respects your manual exposure settings
- Set player/team exposure limits before generating lineups
- AI will optimize within your constraints

### Stack Optimization

- AI identifies optimal team stacking opportunities
- Considers correlation between players
- Maximizes upside while managing risk

### Salary Efficiency

- AI finds value plays automatically
- Identifies overpaid/underpaid players
- Optimizes salary allocation across positions

## 📈 Maximizing AI Benefits

1. **Upload Fresh Data**: Always use the latest player projections
2. **Generate Multiple Lineups**: AI works best with 20+ lineups
3. **Apply Recommendations Iteratively**: Make changes one at a time
4. **Trust High-Confidence Suggestions**: The AI learns from patterns
5. **Review Before Contests**: Do a final AI check before lock

## Need Help?

- Check the terminal for detailed logs
- AI recommendations include explanations
- Each feature has hover tooltips for guidance
- Error messages provide specific solutions

---

_The AI system continuously improves its recommendations based on data patterns and results. Use it as a powerful tool to enhance your DFS strategy!_
