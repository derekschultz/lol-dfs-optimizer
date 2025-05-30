import { useState, useMemo } from "react";

/**
 * Custom hook for handling sorting logic in stack exposure data
 */
export const useStackExposureSort = (stackExposures, activeStackSize) => {
  const [sortBy, setSortBy] = useState("team");
  const [sortDirection, setSortDirection] = useState("asc");

  const filteredExposures = useMemo(() => {
    let filtered = [...stackExposures];

    // Sort the data
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "team":
          aVal = a.team;
          bVal = b.team;
          break;
        case "projPoints":
          aVal = parseFloat(a.projPoints);
          bVal = parseFloat(b.projPoints);
          break;
        case "minExp":
        case "maxExp":
          // Sort by the currently displayed exposure based on active stack size
          if (activeStackSize === "all" || activeStackSize === "4") {
            aVal = parseInt(a.fourManExp);
            bVal = parseInt(b.fourManExp);
          } else if (activeStackSize === "3") {
            aVal = parseInt(a.threeManExp);
            bVal = parseInt(b.threeManExp);
          } else if (activeStackSize === "2") {
            aVal = parseInt(a.twoManExp);
            bVal = parseInt(b.twoManExp);
          } else {
            aVal = parseInt(a.fourManExp);
            bVal = parseInt(b.fourManExp);
          }
          break;
        case "twoManExp":
          aVal = parseInt(a.twoManExp);
          bVal = parseInt(b.twoManExp);
          break;
        case "threeManExp":
          aVal = parseInt(a.threeManExp);
          bVal = parseInt(b.threeManExp);
          break;
        case "fourManExp":
          aVal = parseInt(a.fourManExp);
          bVal = parseInt(b.fourManExp);
          break;
        case "overallExp":
          aVal = parseInt(a.overallExp);
          bVal = parseInt(b.overallExp);
          break;
        default:
          aVal = a.team;
          bVal = b.team;
      }

      // Handle NaN values
      if (isNaN(aVal)) aVal = 0;
      if (isNaN(bVal)) bVal = 0;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [stackExposures, sortBy, sortDirection, activeStackSize]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  return {
    sortBy,
    sortDirection,
    filteredExposures,
    handleSort,
  };
};
