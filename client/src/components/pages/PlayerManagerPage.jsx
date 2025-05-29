import React from "react";
import { usePlayer } from "../../contexts/PlayerContext";
import { useNotification } from "../../contexts/NotificationContext";
import PlayerManagerUI from "../PlayerManagerUI";

const PlayerManagerPage = () => {
  const { playerData, setPlayerData } = usePlayer();
  const { displayNotification } = useNotification();

  const handlePlayersUpdated = (updatedPlayers) => {
    setPlayerData(updatedPlayers);
  };

  return (
    <PlayerManagerUI
      playerData={playerData}
      onPlayersUpdated={handlePlayersUpdated}
      displayNotification={displayNotification}
      API_BASE_URL="http://localhost:3001"
    />
  );
};

export default PlayerManagerPage;
