/**
 * Utility functions for generating IDs and other common operations
 */

// Generate random ID (same logic as in original server.js)
const generateRandomId = () => Date.now() + Math.floor(Math.random() * 1000);

// Generate unique lineup ID with counter
let lineupCounter = 0;
const generateLineupId = () => {
  lineupCounter++;
  return `lineup_${Date.now()}_${lineupCounter}`;
};

// Generate player ID from name and team
const generatePlayerId = (name, team) => {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const cleanTeam = team.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${cleanTeam}_${cleanName}_${Date.now()}`;
};

// Generate contest entry ID
const generateEntryId = (baseId = 4732704849, index = 0) => {
  return baseId + index;
};

module.exports = {
  generateRandomId,
  generateLineupId,
  generatePlayerId,
  generateEntryId,
};
