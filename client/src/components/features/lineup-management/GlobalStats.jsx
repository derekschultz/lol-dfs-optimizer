import React, { useState } from "react";

const GlobalStats = ({ globalStats }) => {
  const [showTooltip, setShowTooltip] = useState(null);

  return (
    <div
      id="global-stats-panel"
      style={{
        marginBottom: "1.5rem",
        backgroundColor: "#0d1829",
        padding: "1rem",
        borderRadius: "0.5rem",
        border: "1px solid #2d3748",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        position: "relative",
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <h3
          style={{
            color: "#4fd1c5",
            margin: 0,
            fontSize: "1rem",
            fontWeight: "bold",
          }}
        >
          Global Lineup Statistics
        </h3>
      </div>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          color: "#d1d5db",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
            Average Projection
          </span>
          <span
            style={{
              color: "#48bb78",
              fontWeight: "bold",
              fontSize: "1.125rem",
            }}
          >
            {globalStats.avgProjection.toFixed(2)}
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
            Average Ownership
          </span>
          <span
            style={{
              color: "#f56565",
              fontWeight: "bold",
              fontSize: "1.125rem",
            }}
          >
            {globalStats.avgOwnership.toFixed(1)}%
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
            Average Salary
          </span>
          <span
            style={{
              color: "#ecc94b",
              fontWeight: "bold",
              fontSize: "1.125rem",
            }}
          >
            ${Math.round(globalStats.avgSalary).toLocaleString()}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <span
            style={{
              color: "#90cdf4",
              marginBottom: "0.25rem",
              cursor: "help",
            }}
            onMouseEnter={() => setShowTooltip("nexusScore")}
            onMouseLeave={() => setShowTooltip(null)}
            title="NexusScore: A proprietary scoring algorithm that evaluates lineup quality based on projections, ownership leverage, and team stacking"
          >
            Average NexusScore ⓘ
          </span>
          {showTooltip === "nexusScore" && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "0",
                backgroundColor: "#1a202c",
                border: "1px solid #2d3748",
                borderRadius: "4px",
                padding: "8px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
                zIndex: 1000,
                maxWidth: "250px",
                fontSize: "0.75rem",
                color: "#e2e8f0",
                lineHeight: "1.4",
              }}
            >
              NexusScore: A proprietary scoring algorithm that evaluates lineup
              quality based on projections, ownership leverage, and team
              stacking
            </div>
          )}
          <span
            style={{
              color: "#a78bfa",
              fontWeight: "bold",
              fontSize: "1.125rem",
            }}
          >
            {globalStats.avgNexusScore.toFixed(1)}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <span
            style={{
              color: "#90cdf4",
              marginBottom: "0.25rem",
              cursor: "help",
            }}
            onMouseEnter={() => setShowTooltip("roi")}
            onMouseLeave={() => setShowTooltip(null)}
            title="ROI: Return on Investment calculated using expected value from finish distributions, considering lineup strength, correlation, and contest payout structure"
          >
            Average ROI ⓘ
          </span>
          {showTooltip === "roi" && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "0",
                backgroundColor: "#1a202c",
                border: "1px solid #2d3748",
                borderRadius: "4px",
                padding: "8px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
                zIndex: 1000,
                maxWidth: "250px",
                fontSize: "0.75rem",
                color: "#e2e8f0",
                lineHeight: "1.4",
              }}
            >
              Return on Investment calculated using expected value from finish
              distributions, considering lineup strength, correlation, and
              contest payout structure
            </div>
          )}
          <span
            style={{
              color: "#9f7aea",
              fontWeight: "bold",
              fontSize: "1.125rem",
            }}
          >
            {globalStats.avgROI.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalStats;
