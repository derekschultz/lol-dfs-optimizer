import React from "react";
import { useApp } from "../../contexts/AppContext";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import { useNotification } from "../../contexts/NotificationContext";
import HybridOptimizerUI from "../HybridOptimizerUI";

const HybridOptimizerPage = () => {
  const { setActiveTab } = useApp();
  const { setLineups } = useLineup();
  const { playerData, stackData, setContestInfo } = usePlayer();
  const { exposureSettings } = useExposure();
  const { displayNotification } = useNotification();

  const handleLineupsGenerated = (generatedLineups, result) => {
    // Replace existing lineups with newly generated ones
    setLineups(generatedLineups);
    // Store contest info if provided
    if (result?.contestInfo) {
      setContestInfo(result.contestInfo);
    }
    displayNotification(
      `Generated ${generatedLineups.length} lineups using ${result?.strategy?.name || "selected"} strategy!`
    );
    // Switch to lineups tab after generation
    setActiveTab("lineups");
  };

  return (
    <HybridOptimizerUI
      API_BASE_URL="http://localhost:3001"
      playerProjections={playerData}
      teamStacks={stackData}
      exposureSettings={exposureSettings}
      onLineupsGenerated={handleLineupsGenerated}
    />
  );
};

export default HybridOptimizerPage;
