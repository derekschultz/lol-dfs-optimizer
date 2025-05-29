import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import { useNotification } from "../../contexts/NotificationContext";
import AIInsights from "../AIInsights";

const AIInsightsPage = () => {
  const { lineups, setLineups } = useLineup();
  const { playerData } = usePlayer();
  const { exposureSettings, setExposureSettings } = useExposure();
  const { displayNotification } = useNotification();

  const handleUpdateExposures = (newExposureSettings) => {
    setExposureSettings(newExposureSettings);
  };

  const handleGenerateOptimizedLineups = async (config) => {
    // TODO: Implement optimized lineup generation
    console.log("Generate optimized lineups:", config);
  };

  const handleLineupsUpdated = (updatedLineups) => {
    setLineups(updatedLineups);
  };

  return (
    <AIInsights
      API_BASE_URL="http://localhost:3001"
      lineups={lineups}
      playerData={playerData}
      displayNotification={displayNotification}
      exposureSettings={exposureSettings}
      onUpdateExposures={handleUpdateExposures}
      onGenerateOptimizedLineups={handleGenerateOptimizedLineups}
      onLineupsUpdated={handleLineupsUpdated}
    />
  );
};

export default AIInsightsPage;
