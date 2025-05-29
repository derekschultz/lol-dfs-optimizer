import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import StackExposure from "../StackExposure";

const StackExposurePage = () => {
  const { lineups } = useLineup();
  const { playerData } = usePlayer();
  const { setExposureSettings } = useExposure();

  const handleTargetExposureUpdate = (newTargets) => {
    setExposureSettings((prev) => ({
      ...prev,
      stackExposureTargets: newTargets,
    }));
  };

  return (
    <StackExposure
      lineups={lineups}
      playerData={playerData}
      onTargetExposureUpdate={handleTargetExposureUpdate}
    />
  );
};

export default StackExposurePage;
