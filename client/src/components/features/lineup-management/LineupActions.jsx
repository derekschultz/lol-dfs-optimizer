import React from "react";

const LineupActions = ({
  lineupsCount,
  showExportMenu,
  setShowExportMenu,
  showStarredOnly,
  setShowStarredOnly,
  onExport,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem",
        backgroundColor: "#10141e",
        padding: "0.75rem 1rem",
        borderRadius: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span
          style={{
            color: "#a0aec0",
            marginRight: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          Lineups
        </span>
        <div
          style={{
            backgroundColor: "#1a202c",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            color: "#e2e8f0",
            fontSize: "0.875rem",
            fontWeight: "500",
          }}
        >
          {lineupsCount}
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ position: "relative" }} data-export-menu>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              background: "none",
              border: "none",
              color: "#4fd1c5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: showExportMenu ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {showExportMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "0",
                backgroundColor: "#1a202c",
                border: "1px solid #2d3748",
                borderRadius: "4px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                zIndex: 1000,
                minWidth: "180px",
                marginTop: "0.25rem",
              }}
            >
              <button
                onClick={() => {
                  onExport("csv");
                  setShowExportMenu(false);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#e2e8f0",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#2d3748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "transparent";
                }}
              >
                📊 Export as CSV
              </button>
              <button
                onClick={() => {
                  onExport("json");
                  setShowExportMenu(false);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#e2e8f0",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#2d3748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "transparent";
                }}
              >
                📄 Export as JSON
              </button>
              <button
                onClick={() => {
                  onExport("draftkings");
                  setShowExportMenu(false);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#e2e8f0",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#2d3748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "transparent";
                }}
              >
                🏀 Export for DraftKings
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowStarredOnly(!showStarredOnly)}
          style={{
            background: "none",
            border: "none",
            color: showStarredOnly ? "#f59e0b" : "#4fd1c5",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={showStarredOnly ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>{showStarredOnly ? "All Lineups" : "Starred Only"}</span>
        </button>
      </div>
    </div>
  );
};

export default LineupActions;
