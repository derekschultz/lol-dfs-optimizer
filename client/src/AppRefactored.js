import React from "react";
import "./blue-theme.css";
import "./slider-styles.css";
import { CombinedProvider } from "./contexts";
import AppLayout from "./components/layout/AppLayout";
import TabContent from "./components/layout/TabContent";
import { useDataInitialization } from "./hooks/useDataInitialization";

const AppContent = () => {
  useDataInitialization();

  return (
    <AppLayout>
      <TabContent />
    </AppLayout>
  );
};

const App = () => {
  return (
    <CombinedProvider>
      <AppContent />
    </CombinedProvider>
  );
};

export default App;
