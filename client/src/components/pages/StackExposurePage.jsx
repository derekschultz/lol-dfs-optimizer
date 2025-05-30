import React from "react";
import { useLineup } from "../../contexts/LineupContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useExposure } from "../../contexts/ExposureContext";
import { useNotification } from "../../contexts/NotificationContext";
import { StackExposure } from "../features/stack-exposure";

const StackExposurePage = () => {
  const { lineups } = useLineup();
  const { playerData } = usePlayer();
  const { setExposureSettings } = useExposure();
  const { displayNotification } = useNotification();

  const handleTargetExposureUpdate = (newTargets) => {
    setExposureSettings((prev) => ({
      ...prev,
      stackExposureTargets: newTargets,
    }));

    // Count how many targets were set
    const targetCount = Object.values(newTargets).reduce(
      (total, teamTargets) => total + Object.keys(teamTargets).length,
      0
    );

    if (targetCount > 0) {
      displayNotification(
        `Applied ${targetCount} stack exposure target${targetCount > 1 ? "s" : ""} successfully`,
        "success"
      );
    } else {
      displayNotification("Cleared all stack exposure targets", "info");
    }
  };

  return (
    <StackExposure
      lineups={lineups}
      playerData={playerData}
      onTargetExposureUpdate={handleTargetExposureUpdate}
      displayNotification={displayNotification}
    />
  );
};

export default StackExposurePage;
