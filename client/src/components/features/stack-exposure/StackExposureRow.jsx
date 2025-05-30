import React from "react";

const StackExposureRow = ({
  team,
  activeStackSize,
  targetExposures,
  handleTargetExposureChange,
}) => {
  const getExposureValue = () => {
    if (activeStackSize === "all" || activeStackSize === "4") {
      return team.fourManExp;
    }
    if (activeStackSize === "3") {
      return team.threeManExp;
    }
    return team.twoManExp;
  };

  const getExposureColor = (exposureValue) => {
    if (exposureValue > 30) return "#10B981"; // Green
    if (exposureValue > 15) return "#F59E0B"; // Yellow
    return "#EF4444"; // Red
  };

  const exposureValue = getExposureValue();

  return (
    <tr
      style={{
        backgroundColor: "#1E293B",
        borderBottom: "1px solid #334155",
      }}
    >
      <td
        style={{
          padding: "16px 20px",
          fontWeight: "600",
          color: "#F1F5F9",
          fontSize: "14px",
        }}
      >
        {team.team}
      </td>
      <td
        style={{
          padding: "16px 20px",
          textAlign: "center",
          fontWeight: "500",
          color: "#F1F5F9",
          fontSize: "14px",
        }}
      >
        {team.projPoints}
      </td>
      <td
        style={{
          padding: "16px 20px",
          textAlign: "center",
          fontWeight: "600",
          fontSize: "14px",
        }}
      >
        <span style={{ color: getExposureColor(exposureValue) }}>
          {exposureValue}%
        </span>
      </td>
      <td
        style={{
          padding: "16px 20px",
          textAlign: "center",
          fontWeight: "500",
          fontSize: "14px",
        }}
      >
        <input
          type="number"
          min="0"
          max="100"
          value={
            targetExposures[`${team.team}_${activeStackSize}_target`] || ""
          }
          onChange={(e) =>
            handleTargetExposureChange(
              team.team,
              `${activeStackSize}_target`,
              e.target.value
            )
          }
          placeholder="—"
          style={{
            width: "60px",
            padding: "6px 8px",
            border: "1px solid #334155",
            borderRadius: "4px",
            backgroundColor: "#0F172A",
            color: "#F1F5F9",
            textAlign: "center",
            fontSize: "14px",
            outline: "none",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#059669";
            e.target.style.backgroundColor = "#1E293B";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#334155";
            e.target.style.backgroundColor = "#0F172A";
          }}
        />
      </td>
    </tr>
  );
};

export default StackExposureRow;
