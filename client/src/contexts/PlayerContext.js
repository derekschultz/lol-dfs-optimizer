import React, { createContext, useContext, useState } from "react";

const PlayerContext = createContext();

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return context;
};

export const PlayerProvider = ({ children }) => {
  const [playerData, setPlayerData] = useState([]);
  const [stackData, setStackData] = useState([]);
  const [contestInfo, setContestInfo] = useState(null);

  const value = {
    playerData,
    setPlayerData,
    stackData,
    setStackData,
    contestInfo,
    setContestInfo,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};
