import React from "react";
import { useApp } from "../../contexts/AppContext";
import UploadPage from "../pages/UploadPage";
import PlayerManagerPage from "../pages/PlayerManagerPage";
import LineupManagerPage from "../pages/LineupManagerPage";
import StackExposurePage from "../pages/StackExposurePage";
import AIInsightsPage from "../pages/AIInsightsPage";
import HybridOptimizerPage from "../pages/HybridOptimizerPage";
import PerformanceTestPage from "../pages/PerformanceTestPage";
import OptimizerPageWrapper from "../pages/OptimizerPageWrapper";
import NexusScoreTestPageWrapper from "../pages/NexusScoreTestPageWrapper";

const TabContent = () => {
  const { activeTab } = useApp();

  const renderActiveTab = () => {
    switch (activeTab) {
      case "upload":
        return <UploadPage />;
      case "players":
        return <PlayerManagerPage />;
      case "lineups":
        return <LineupManagerPage />;
      case "stack-exposure":
        return <StackExposurePage />;
      case "ai-insights":
        return <AIInsightsPage />;
      case "hybrid":
        return <HybridOptimizerPage />;
      case "optimizer":
        return <OptimizerPageWrapper />;
      case "nexustest":
        return <NexusScoreTestPageWrapper />;
      case "performance":
        return <PerformanceTestPage />;
      default:
        return <UploadPage />;
    }
  };

  return <div className="tab-content">{renderActiveTab()}</div>;
};

export default TabContent;
