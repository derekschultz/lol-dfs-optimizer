import React, { createContext, useContext, useState } from "react";

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [importMethod, setImportMethod] = useState("dkEntries");

  const value = {
    activeTab,
    setActiveTab,
    isLoading,
    setIsLoading,
    importMethod,
    setImportMethod,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
