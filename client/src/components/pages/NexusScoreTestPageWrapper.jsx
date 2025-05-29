import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import NexusScoreTestPage from "../../pages/NexusScoreTestPage";

const NexusScoreTestPageWrapper = () => {
  const { lineups, setLineups } = useLineup();
  const { playerData } = usePlayer();
  const { exposureSettings, setExposureSettings } = useExposure();

  const handleUpdateExposures = (newExposureSettings) => {
    setExposureSettings(newExposureSettings);
  };

  const handleImportLineups = (importedLineups) => {
    setLineups((prevLineups) => [...prevLineups, ...importedLineups]);
  };

  return (
    <NexusScoreTestPage
      API_BASE_URL="http://localhost:3001"
      playerData={playerData}
      lineups={lineups}
      exposureSettings={exposureSettings}
      onUpdateExposures={handleUpdateExposures}
      onImportLineups={handleImportLineups}
    />
  );
};

export default NexusScoreTestPageWrapper;
