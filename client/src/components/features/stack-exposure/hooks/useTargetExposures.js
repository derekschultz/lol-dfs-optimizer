import { useState } from "react";

/**
 * Custom hook for managing target exposure state and actions
 */
export const useTargetExposures = (
  onTargetExposureUpdate,
  displayNotification
) => {
  const [targetExposures, setTargetExposures] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  const handleTargetExposureChange = (team, stackSize, value) => {
    const newTargetExposures = {
      ...targetExposures,
      [`${team}_${stackSize}`]: value === "" ? null : parseInt(value),
    };
    setTargetExposures(newTargetExposures);

    // Don't call onTargetExposureUpdate here - only call it when "Apply Targets" is clicked
    // This allows users to enter multiple values before applying them
  };

  const saveTargetExposures = () => {
    setIsEditMode(false);
    // Send all target exposures to parent component
    if (onTargetExposureUpdate) {
      Object.entries(targetExposures).forEach(([key, value]) => {
        const parts = key.split("_");
        if (parts.length >= 2) {
          const team = parts[0];
          const stackSizeRaw = parts[1].replace("_target", "");
          const numericStackSize = stackSizeRaw === "all" ? "4" : stackSizeRaw;

          onTargetExposureUpdate({
            team,
            stackSize: numericStackSize,
            targetExposure: value,
          });
        }
      });
    }
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    // Reset any unsaved changes if needed
  };

  const clearTargets = () => {
    const hadTargets = Object.keys(targetExposures).length > 0;
    setTargetExposures({});

    if (hadTargets && displayNotification) {
      displayNotification("Cleared all target exposures", "info");
    }
  };

  const applyTargets = () => {
    // Build accumulated targets object and send to parent
    if (onTargetExposureUpdate) {
      const accumulatedTargets = {};

      Object.entries(targetExposures).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          const parts = key.split("_");
          if (parts.length >= 2) {
            const team = parts[0];
            const stackSizeRaw = parts[1].replace("_target", "");
            const numericStackSize =
              stackSizeRaw === "all" ? "4" : stackSizeRaw;

            // Use a nested structure: { teamName: { stackSize: targetValue } }
            if (!accumulatedTargets[team]) {
              accumulatedTargets[team] = {};
            }
            accumulatedTargets[team][numericStackSize] = value;
          }
        }
      });

      // Send the complete targets object to parent
      onTargetExposureUpdate(accumulatedTargets);
    }
  };

  return {
    targetExposures,
    isEditMode,
    setIsEditMode,
    handleTargetExposureChange,
    saveTargetExposures,
    cancelEdit,
    clearTargets,
    applyTargets,
  };
};
