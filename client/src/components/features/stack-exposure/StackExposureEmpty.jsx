import React from "react";

const StackExposureEmpty = ({ playerData }) => {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "3rem 2rem",
        color: "#64748B",
        backgroundColor: "#1E293B",
        borderRadius: "8px",
        border: "1px solid #334155",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          style={{ margin: "0 auto", display: "block" }}
        >
          <path
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            stroke="#64748B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3
        style={{
          fontSize: "18px",
          fontWeight: "600",
          color: "#E2E8F0",
          margin: "0 0 8px 0",
        }}
      >
        Upload Data Required
      </h3>
      <p style={{ margin: "0 0 16px 0", lineHeight: "1.5" }}>
        {!playerData || playerData.length === 0
          ? "Upload player projections (ROO) and team stacks on the Upload tab to view teams and set target exposures."
          : "No team data available - check your uploaded player projections file."}
      </p>
      {(!playerData || playerData.length === 0) && (
        <p style={{ fontSize: "14px", color: "#94A3B8", margin: 0 }}>
          Once uploaded, you'll be able to set target stack exposures for each
          team before generating lineups.
        </p>
      )}
    </div>
  );
};

export default StackExposureEmpty;
