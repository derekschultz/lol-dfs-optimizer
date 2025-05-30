import React from "react";

const AppliedChangesHistory = ({
  insights,
  lineups,
  appliedChanges,
  displayNotification,
  isApplying,
  applyRecommendation,
}) => {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "1.5rem",
        paddingTop: "1.25rem",
        borderTop: "1px solid #2d3748",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(45, 212, 191, 0.1)",
          border: "1px solid rgba(45, 212, 191, 0.3)",
          borderRadius: "12px",
          padding: "1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <h5
          style={{
            fontSize: "0.875rem",
            fontWeight: "600",
            marginBottom: "10px",
            margin: "0 0 10px 0",
            color: "#2dd4bf",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "1.125rem" }}>📊</span> Changes Applied
          Verification
        </h5>
        <div style={{ fontSize: "0.75rem", color: "#a0aec0" }}>
          <div>
            • Modified lineups:{" "}
            {
              lineups.filter(
                (l) =>
                  l.modificationSuggested ||
                  l.exposureWarning ||
                  l.metaScore !== undefined
              ).length
            }
            /{lineups.length}
          </div>
          <div>
            • Exposure warnings:{" "}
            {lineups.filter((l) => l.exposureWarning).length}
          </div>
          <div>
            • Meta scores added:{" "}
            {lineups.filter((l) => l.metaScore !== undefined).length}
          </div>
          <div>
            • Salary flags: {lineups.filter((l) => l.optimizationFlag).length}
          </div>
        </div>
        <button
          className="btn"
          style={{
            backgroundColor: "#2dd4bf",
            color: "#0f172a",
            fontSize: "0.75rem",
            padding: "0.375rem 0.75rem",
            marginTop: "10px",
            border: "none",
            fontWeight: "500",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#5eead4";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#2dd4bf";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onClick={() => {
            displayNotification(
              "Check your Lineups tab to see applied changes!",
              "info"
            );
          }}
        >
          View Changes in Lineups Tab
        </button>
      </div>

      {/* Recent Changes History */}
      {appliedChanges.length > 0 && (
        <div
          style={{
            backgroundColor: "#10141e",
            border: "1px solid #1a202c",
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <h5
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              marginBottom: "10px",
              margin: "0 0 10px 0",
              color: "#e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "1.125rem" }}>📝</span> Recent Changes
            Applied
          </h5>
          <div style={{ fontSize: "0.75rem", color: "#a0aec0" }}>
            {appliedChanges.map((change, index) => (
              <div
                key={change.id}
                style={{
                  marginBottom: "4px",
                  padding: "4px 8px",
                  backgroundColor:
                    index === 0
                      ? "rgba(45, 212, 191, 0.1)"
                      : "rgba(255, 255, 255, 0.02)",
                  borderRadius: "4px",
                }}
              >
                <strong>{change.recommendation}</strong> -{" "}
                {change.timestamp.toLocaleTimeString()}
                {index === 0 && (
                  <span style={{ color: "#2dd4bf", fontWeight: "bold" }}>
                    {" "}
                    (Latest)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h5
        style={{
          fontSize: "0.875rem",
          fontWeight: "600",
          marginBottom: "12px",
          margin: "0 0 12px 0",
          color: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "1.125rem" }}>⚡</span> Quick Actions
      </h5>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          className="btn"
          style={{
            backgroundColor: "#ef4444",
            color: "white",
            fontSize: "0.875rem",
            padding: "0.5rem 1rem",
            border: "none",
            fontWeight: "500",
            transition: "all 0.2s ease",
            opacity: isApplying ? 0.6 : 1,
            cursor: isApplying ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isApplying) {
              e.currentTarget.style.backgroundColor = "#dc2626";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ef4444";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onClick={() => {
            if (isApplying) return;
            const highPriorityRecommendations = insights.filter(
              (i) => i.priority === "high"
            );
            highPriorityRecommendations.forEach((rec) =>
              applyRecommendation(rec)
            );
          }}
        >
          Apply All High Priority
        </button>
        <button
          className="btn"
          style={{
            backgroundColor: "#1a202c",
            color: "#a0aec0",
            fontSize: "0.875rem",
            padding: "0.5rem 1rem",
            border: "1px solid #2d3748",
            fontWeight: "500",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2d3748";
            e.currentTarget.style.color = "#e2e8f0";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1a202c";
            e.currentTarget.style.color = "#a0aec0";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onClick={() => {
            displayNotification("Insights exported to console", "info");
          }}
        >
          Export Insights
        </button>
      </div>
    </div>
  );
};

export default AppliedChangesHistory;
