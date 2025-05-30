import React from "react";
import { getSortIcon } from "./utils/sortUtils";
import StackExposureRow from "./StackExposureRow";

const StackExposureTable = ({
  filteredExposures,
  activeStackSize,
  sortBy,
  sortDirection,
  handleSort,
  targetExposures,
  handleTargetExposureChange,
}) => {
  const getStackSizeLabel = () => {
    return activeStackSize === "all" ? "4" : activeStackSize;
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "transparent",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#1E293B" }}>
            <th
              style={{
                padding: "16px 20px",
                textAlign: "left",
                fontWeight: "600",
                color: "#94A3B8",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                userSelect: "none",
                borderBottom: "1px solid #334155",
              }}
              onClick={() => handleSort("team")}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Teams {getSortIcon("team", sortBy, sortDirection)}
              </span>
            </th>
            <th
              style={{
                padding: "16px 20px",
                textAlign: "center",
                fontWeight: "600",
                color: "#94A3B8",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                userSelect: "none",
                borderBottom: "1px solid #334155",
              }}
              onClick={() => handleSort("projPoints")}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  justifyContent: "center",
                }}
              >
                Proj Points {getSortIcon("projPoints", sortBy, sortDirection)}
              </span>
            </th>
            <th
              style={{
                padding: "16px 20px",
                textAlign: "center",
                fontWeight: "600",
                color: "#94A3B8",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                userSelect: "none",
                borderBottom: "1px solid #334155",
              }}
              onClick={() => handleSort("minExp")}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  justifyContent: "center",
                }}
              >
                {getStackSizeLabel()}-stacks Exp{" "}
                {getSortIcon("minExp", sortBy, sortDirection)}
              </span>
            </th>
            <th
              style={{
                padding: "16px 20px",
                textAlign: "center",
                fontWeight: "600",
                color: "#94A3B8",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid #334155",
              }}
            >
              Target
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredExposures.map((team, index) => (
            <StackExposureRow
              key={team.team}
              team={team}
              activeStackSize={activeStackSize}
              targetExposures={targetExposures}
              handleTargetExposureChange={handleTargetExposureChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StackExposureTable;
