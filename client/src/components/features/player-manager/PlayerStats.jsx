import React from "react";

const PlayerStats = ({ totalPlayers }) => {
  return (
    <h2 className="card-title">Player Management ({totalPlayers} players)</h2>
  );
};

export default PlayerStats;
