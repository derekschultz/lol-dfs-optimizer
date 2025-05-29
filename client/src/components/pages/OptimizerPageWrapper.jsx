import React from "react";
import { useApp } from "../../contexts/AppContext";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useLineupGeneration } from "../../hooks/useLineupGeneration";
import OptimizerPage from "../../pages/OptimizerPage";

const OptimizerPageWrapper = () => {
  const { setActiveTab } = useApp();
  const { lineups, setLineups } = useLineup();
  const { playerData } = usePlayer();
  const { exposureSettings, setExposureSettings } = useExposure();
  const { displayNotification } = useNotification();
  const { generateOptimizedLineups } = useLineupGeneration();

  const handleUpdateExposures = (newExposureSettings) => {
    setExposureSettings(newExposureSettings);
  };

  // Pass through to the hook which handles everything including tab switching
  const handleGenerateLineups = generateOptimizedLineups;

  const handleImportLineups = (importedLineups) => {
    // Add imported lineups to existing lineups
    setLineups((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const newLineups = importedLineups.filter((l) => !existingIds.has(l.id));
      return [...prev, ...newLineups];
    });
    displayNotification(
      `Imported ${importedLineups.length} optimized lineups!`
    );
    // Switch to lineups tab after import
    setActiveTab("lineups");
  };

  return (
    <OptimizerPage
      API_BASE_URL="http://localhost:3001"
      playerData={playerData}
      lineups={lineups}
      exposureSettings={exposureSettings}
      onUpdateExposures={handleUpdateExposures}
      onGenerateLineups={generateOptimizedLineups}
      onImportLineups={handleImportLineups}
    />
  );
};

export default OptimizerPageWrapper;
