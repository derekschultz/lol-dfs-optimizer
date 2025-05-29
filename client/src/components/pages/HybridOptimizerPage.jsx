import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import HybridOptimizerUI from "../HybridOptimizerUI";

const HybridOptimizerPage = () => {
  const { setLineups } = useLineup();
  const { playerData, stackData } = usePlayer();
  const { exposureSettings } = useExposure();

  const handleLineupsGenerated = (newLineups) => {
    setLineups((prevLineups) => [...prevLineups, ...newLineups]);
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
