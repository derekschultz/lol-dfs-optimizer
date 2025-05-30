import React, { useState } from "react";
import { useStackExposureData } from "./hooks/useStackExposureData";
import { useStackExposureSort } from "./hooks/useStackExposureSort";
import { useTargetExposures } from "./hooks/useTargetExposures";
import StackExposureHeader from "./StackExposureHeader";
import StackSizeFilter from "./StackSizeFilter";
import StackExposureStats from "./StackExposureStats";
import StackExposureEmpty from "./StackExposureEmpty";
import StackExposureTable from "./StackExposureTable";
import StackExposureActions from "./StackExposureActions";

const StackExposure = ({
  lineups = [],
  playerData = [],
  onTargetExposureUpdate,
  displayNotification,
}) => {
  const [activeStackSize, setActiveStackSize] = useState("4");

  // Use custom hooks for data and state management
  const stackExposures = useStackExposureData(lineups, playerData);
  const { sortBy, sortDirection, filteredExposures, handleSort } =
    useStackExposureSort(stackExposures, activeStackSize);
  const {
    targetExposures,
    isEditMode,
    setIsEditMode,
    handleTargetExposureChange,
    saveTargetExposures,
    cancelEdit,
    clearTargets,
    applyTargets,
  } = useTargetExposures(onTargetExposureUpdate, displayNotification);

  return (
    <div
      style={{
        backgroundColor: "#0F172A",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #1E293B",
      }}
    >
      <StackExposureHeader playerData={playerData} lineups={lineups} />

      <StackSizeFilter
        activeStackSize={activeStackSize}
        setActiveStackSize={setActiveStackSize}
      />

      <StackExposureStats
        lineups={lineups}
        filteredExposures={filteredExposures}
        activeStackSize={activeStackSize}
      />

      {filteredExposures.length === 0 ? (
        <StackExposureEmpty playerData={playerData} />
      ) : (
        <>
          <StackExposureTable
            filteredExposures={filteredExposures}
            activeStackSize={activeStackSize}
            sortBy={sortBy}
            sortDirection={sortDirection}
            handleSort={handleSort}
            targetExposures={targetExposures}
            handleTargetExposureChange={handleTargetExposureChange}
          />

          <StackExposureActions
            clearTargets={clearTargets}
            applyTargets={applyTargets}
          />
        </>
      )}
    </div>
  );
};

export default StackExposure;
