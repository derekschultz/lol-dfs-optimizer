import React from "react";

const StackExposureActions = ({ clearTargets, applyTargets }) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px",
        marginTop: "24px",
      }}
    >
      <button
        onClick={clearTargets}
        style={{
          padding: "10px 20px",
          backgroundColor: "transparent",
          color: "#94A3B8",
          border: "1px solid #334155",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "500",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = "#334155";
          e.target.style.color = "#F1F5F9";
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = "transparent";
          e.target.style.color = "#94A3B8";
        }}
      >
        Clear Targets
      </button>
      <button
        onClick={applyTargets}
        style={{
          padding: "10px 20px",
          backgroundColor: "#059669",
          color: "white",
          border: "none",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "500",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = "#047857";
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = "#059669";
        }}
      >
        Apply Targets
      </button>
    </div>
  );
};

export default StackExposureActions;
