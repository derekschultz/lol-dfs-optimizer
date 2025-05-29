import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import OptimizerPage from "../../pages/OptimizerPage";

const OptimizerPageWrapper = () => {
  const { lineups, setLineups } = useLineup();
  const { playerData } = usePlayer();
  const { exposureSettings, setExposureSettings } = useExposure();

  const handleUpdateExposures = (newExposureSettings) => {
    setExposureSettings(newExposureSettings);
  };

  const handleGenerateLineups = (newLineups) => {
    setLineups((prevLineups) => [...prevLineups, ...newLineups]);
  };

  const handleImportLineups = (importedLineups) => {
    setLineups((prevLineups) => [...prevLineups, ...importedLineups]);
  };

  return (
    <OptimizerPage
      API_BASE_URL="http://localhost:3001"
      playerData={playerData}
      lineups={lineups}
      exposureSettings={exposureSettings}
      onUpdateExposures={handleUpdateExposures}
      onGenerateLineups={handleGenerateLineups}
      onImportLineups={handleImportLineups}
    />
  );
};

export default OptimizerPageWrapper;
