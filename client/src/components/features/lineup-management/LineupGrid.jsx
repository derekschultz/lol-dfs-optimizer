import React from "react";
import NexusScoreLineup from "../../NexusScoreLineup";

const LineupGrid = ({
  currentLineups,
  playerData,
  contestInfo,
  currentPage,
  itemsPerPage,
  starredLineups,
  onEdit,
  onDelete,
  onToggleStar,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {currentLineups.map((lineup, index) => (
        <NexusScoreLineup
          key={`${lineup.id || `lineup-${index}`}-${index}`}
          lineup={{
            ...lineup,
            // Pass the calculated metrics
            nexusScore: lineup.metrics.nexusScore,
            firstPlace: lineup.metrics.firstPlace,
            roi: lineup.metrics.roi,
            // Pass AI modification flags
            exposureWarning: lineup.exposureWarning,
            modificationSuggested: lineup.modificationSuggested,
            metaScore: lineup.metaScore,
            metaAligned: lineup.metaAligned,
            optimizationFlag: lineup.optimizationFlag,
            salaryEfficiency: lineup.salaryEfficiency,
          }}
          playerData={playerData}
          contestInfo={contestInfo}
          index={(currentPage - 1) * itemsPerPage + index + 1}
          onEdit={onEdit}
          onStar={() => onToggleStar(lineup)}
          onDelete={onDelete}
          isStarred={!!starredLineups[lineup.id]}
        />
      ))}
    </div>
  );
};

export default LineupGrid;
