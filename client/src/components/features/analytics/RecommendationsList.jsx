import React from "react";

// Add the spin animation CSS
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject the style into the document
if (
  typeof document !== "undefined" &&
  !document.getElementById("recommendations-spinner-style")
) {
  const style = document.createElement("style");
  style.id = "recommendations-spinner-style";
  style.textContent = spinnerStyle;
  document.head.appendChild(style);
}

const RecommendationsList = ({
  insights,
  loading,
  error,
  isApplying,
  applyRecommendation,
}) => {
  const getRecommendationIcon = (type) => {
    const icons = {
      reduce_exposure: "⚠️",
      increase_exposure: "📈",
      increase_team_stack: "🔗",
      salary_optimization: "💰",
      meta_insight: "🧠",
    };
    return icons[type] || "💡";
  };

  const getPriorityStyle = (priority) => {
    const styles = {
      high: {
        backgroundColor: "rgba(245, 101, 101, 0.15)",
        color: "#f56565",
        border: "1px solid rgba(245, 101, 101, 0.3)",
      },
      medium: {
        backgroundColor: "rgba(236, 201, 75, 0.15)",
        color: "#ecc94b",
        border: "1px solid rgba(236, 201, 75, 0.3)",
      },
      low: {
        backgroundColor: "rgba(72, 187, 120, 0.15)",
        color: "#48bb78",
        border: "1px solid rgba(72, 187, 120, 0.3)",
      },
    };
    return (
      styles[priority] || {
        backgroundColor: "rgba(160, 174, 192, 0.15)",
        color: "#a0aec0",
        border: "1px solid rgba(160, 174, 192, 0.3)",
      }
    );
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            border: "2px solid #2d3748",
            borderTop: "2px solid #4fd1c5",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <span style={{ color: "#a0aec0" }}>Analyzing your lineups...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          backgroundColor: "rgba(245, 101, 101, 0.1)",
          border: "1px solid rgba(245, 101, 101, 0.3)",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              color: "#f87171",
              marginRight: "12px",
              fontSize: "1.25rem",
            }}
          >
            ⚠️
          </div>
          <div>
            <h4 style={{ color: "#f56565", fontWeight: "600", margin: 0 }}>
              AI Service Error
            </h4>
            <p
              style={{
                color: "#fc8181",
                fontSize: "0.875rem",
                margin: "0.25rem 0 0 0",
              }}
            >
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎯</div>
        <h4
          style={{
            fontWeight: "600",
            marginBottom: "8px",
            color: "#e2e8f0",
          }}
        >
          No Recommendations
        </h4>
        <p style={{ color: "#a0aec0", fontSize: "0.875rem" }}>
          Your lineup portfolio looks well-optimized! Try generating more
          lineups for additional insights.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {insights.map((insight, index) => (
        <div
          key={insight.id || index}
          style={{
            backgroundColor: "#10141e",
            border: "1px solid #1a202c",
            borderRadius: "8px",
            padding: "1.25rem",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(79, 209, 197, 0.15)";
            e.currentTarget.style.borderColor = "#2d3748";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
            e.currentTarget.style.borderColor = "#1a202c";
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "start",
                gap: "12px",
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: "1.25rem",
                  backgroundColor: "rgba(79, 209, 197, 0.1)",
                  borderRadius: "8px",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {getRecommendationIcon(insight.type)}
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                  }}
                >
                  <h4
                    style={{
                      fontWeight: "600",
                      margin: 0,
                      color: "#f7fafc",
                      fontSize: "1.05rem",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {insight.title}
                  </h4>
                  <span
                    style={{
                      ...getPriorityStyle(insight.priority),
                      padding: "3px 10px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      borderRadius: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.025em",
                    }}
                  >
                    {insight.priority} priority
                  </span>
                  {insight.confidence && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#a0aec0",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span
                        style={{
                          width: "4px",
                          height: "4px",
                          backgroundColor: "#4fd1c5",
                          borderRadius: "50%",
                          display: "inline-block",
                        }}
                      />
                      {insight.confidence}% confidence
                    </span>
                  )}
                </div>

                <p
                  style={{
                    color: "#a0aec0",
                    fontSize: "0.875rem",
                    marginBottom: "12px",
                    margin: "0 0 12px 0",
                    lineHeight: "1.5",
                  }}
                >
                  {insight.message}
                </p>

                {insight.impact && (
                  <div
                    style={{
                      color: "#4fd1c5",
                      fontSize: "0.75rem",
                      backgroundColor: "rgba(79, 209, 197, 0.1)",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      margin: 0,
                      border: "1px solid rgba(79, 209, 197, 0.2)",
                    }}
                  >
                    <strong style={{ color: "#e2e8f0" }}>Impact:</strong>{" "}
                    <span style={{ color: "#a0aec0" }}>{insight.impact}</span>
                  </div>
                )}
              </div>
            </div>

            {insight.actionable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  applyRecommendation(insight);
                }}
                disabled={isApplying}
                className="btn btn-primary"
                style={{
                  marginLeft: "1rem",
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem",
                  cursor: isApplying ? "not-allowed" : "pointer",
                  opacity: isApplying ? 0.7 : 1,
                  transition: "all 0.2s ease",
                  minWidth: "80px",
                }}
              >
                {isApplying ? "Applying..." : "Apply"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecommendationsList;
