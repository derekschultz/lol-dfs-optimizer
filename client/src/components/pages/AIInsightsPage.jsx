import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useLineupGeneration } from "../../hooks/useLineupGeneration";
import AIInsights from "../AIInsights";

const AIInsightsPage = () => {
  const { lineups, setLineups } = useLineup();
  const { playerData } = usePlayer();
  const { exposureSettings, setExposureSettings } = useExposure();
  const { displayNotification } = useNotification();
  const { generateOptimizedLineups } = useLineupGeneration();

  const handleUpdateExposures = (newExposureSettings) => {
    setExposureSettings(newExposureSettings);
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
      onGenerateOptimizedLineups={generateOptimizedLineups}
      onLineupsUpdated={handleLineupsUpdated}
    />
  );
};

export default AIInsightsPage;
