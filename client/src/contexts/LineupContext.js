import React, { createContext, useContext, useState } from "react";

const LineupContext = createContext();

export const useLineup = () => {
  const context = useContext(LineupContext);
  if (!context) {
    throw new Error("useLineup must be used within LineupProvider");
  }
  return context;
};

export const LineupProvider = ({ children }) => {
  const [lineups, setLineups] = useState([]);

  const value = {
    lineups,
    setLineups,
  };

  return (
    <LineupContext.Provider value={value}>{children}</LineupContext.Provider>
  );
};
