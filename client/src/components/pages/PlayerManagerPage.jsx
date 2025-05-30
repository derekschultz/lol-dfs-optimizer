import React from "react";
import { usePlayer } from "../../contexts/PlayerContext";
import { useNotification } from "../../contexts/NotificationContext";
import PlayerManager from "../features/player-manager/PlayerManager";

const PlayerManagerPage = () => {
  const { playerData, setPlayerData } = usePlayer();
  const { displayNotification } = useNotification();

  const handlePlayersUpdated = (updatedPlayers) => {
    setPlayerData(updatedPlayers);
  };

  return (
    <PlayerManager
      playerData={playerData}
      onPlayersUpdated={handlePlayersUpdated}
      displayNotification={displayNotification}
      API_BASE_URL="http://localhost:3001"
    />
  );
};

export default PlayerManagerPage;
