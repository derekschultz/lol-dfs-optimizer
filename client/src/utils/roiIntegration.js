/**
 * ROI Integration Helper
 * 
 * This module shows how to integrate the real ROI calculator
 * into the existing application components
 */

import DFSROICalculator from './dfsROICalculator';

// Create a singleton instance
const roiCalculator = new DFSROICalculator();

/**
 * Calculate ROI for a lineup with contest context
 * 
 * @param {Object} lineup - The lineup object
 * @param {Object} contestInfo - Contest information
 * @returns {Object} ROI calculation results
 */
function calculateLineupROI(lineup, contestInfo = {}) {
  // Default contest info if not provided
  const contest = {
    name: contestInfo.name || 'GPP Tournament',
    type: contestInfo.type || 'gpp',
    fieldSize: contestInfo.fieldSize || 1000,
    entryFee: contestInfo.entryFee || 5,
    prizePool: contestInfo.prizePool || null,
    maxEntries: contestInfo.maxEntries || 1
  };

  // Calculate prize pool if not provided
  if (!contest.prizePool) {
    contest.prizePool = contest.fieldSize * contest.entryFee * 0.85; // 15% rake
  }

  // Get historical data if available (placeholder for now)
  const historicalData = getHistoricalData(lineup);

  // Calculate ROI
  const roiResult = roiCalculator.calculateROI(lineup, contest, historicalData);

  return roiResult;
}

/**
 * Get historical data for players (placeholder)
 * In a real implementation, this would fetch from a database
 */
function getHistoricalData(lineup) {
  // This would be replaced with actual historical data fetching
  return {
    sampleSize: 500,
    daysOld: 14,
    players: {}
  };
}

/**
 * Format ROI for display
 */
function formatROI(roiValue) {
  if (roiValue === null || roiValue === undefined) return 'N/A';
  
  const sign = roiValue >= 0 ? '+' : '';
  return `${sign}${roiValue.toFixed(1)}%`;
}

/**
 * Get ROI color based on value
 */
function getROIColor(roiValue) {
  if (roiValue >= 20) return '#10b981'; // Green - Excellent
  if (roiValue >= 10) return '#3b82f6'; // Blue - Good
  if (roiValue >= 0) return '#f59e0b';  // Yellow - Break-even
  return '#ef4444';                     // Red - Negative
}

/**
 * Example usage in a component:
 * 
 * const roiData = calculateLineupROI(lineup, {
 *   type: 'gpp',
 *   fieldSize: 5000,
 *   entryFee: 20,
 *   name: 'Sunday Million'
 * });
 * 
 * console.log('Expected ROI:', formatROI(roiData.roi));
 * console.log('Confidence:', (roiData.confidence * 100).toFixed(0) + '%');
 * console.log('Cash Probability:', roiData.breakdown.breakEvenProbability.toFixed(1) + '%');
 */

export {
  calculateLineupROI,
  formatROI,
  getROIColor,
  roiCalculator
};