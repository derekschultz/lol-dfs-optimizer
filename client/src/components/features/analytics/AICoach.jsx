import React from "react";
import PlayerPredictions from "./PlayerPredictions";

const AICoach = ({ showCoachInsights, setShowCoachInsights, coachingData }) => {
  if (!showCoachInsights || !coachingData) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "1px solid #6b7399",
        borderRadius: "12px",
        backgroundColor: "#0f111a",
        overflow: "hidden",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Coach Header */}
      <div
        style={{
          backgroundColor: "#7c3aed",
          backgroundImage: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
          color: "white",
          padding: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.5rem" }}>🎓</span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: "700",
                letterSpacing: "-0.025em",
              }}
            >
              AI Coach Analysis
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                opacity: 0.95,
                marginTop: "2px",
              }}
            >
              Comprehensive portfolio review
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCoachInsights(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: "1.5rem",
            cursor: "pointer",
            padding: "0.25rem",
          }}
        >
          ×
        </button>
      </div>

      {/* Coach Content */}
      <div style={{ padding: "1.5rem" }}>
        {/* Portfolio Grade Section */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "1rem",
                backgroundColor:
                  coachingData.portfolio_grade.grade === "A+"
                    ? "#dcfce7"
                    : coachingData.portfolio_grade.grade === "A"
                      ? "#dbeafe"
                      : coachingData.portfolio_grade.grade === "B"
                        ? "#fef3c7"
                        : "#fee2e2",
                borderRadius: "12px",
                minWidth: "80px",
                border: "2px solid",
                borderColor:
                  coachingData.portfolio_grade.grade === "A+"
                    ? "#166534"
                    : coachingData.portfolio_grade.grade === "A"
                      ? "#1e40af"
                      : coachingData.portfolio_grade.grade === "B"
                        ? "#92400e"
                        : "#991b1b",
              }}
            >
              <span
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color:
                    coachingData.portfolio_grade.grade === "A+"
                      ? "#166534"
                      : coachingData.portfolio_grade.grade === "A"
                        ? "#1e40af"
                        : coachingData.portfolio_grade.grade === "B"
                          ? "#92400e"
                          : "#991b1b",
                }}
              >
                {coachingData.portfolio_grade.grade}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#4b5563",
                  fontWeight: "600",
                }}
              >
                {coachingData.portfolio_grade.score}/100
              </span>
            </div>
            <div>
              <h4
                style={{
                  margin: "0 0 8px 0",
                  color: "#e2e8f0",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                }}
              >
                Portfolio Grade
              </h4>
              <p
                style={{
                  margin: 0,
                  color: "#a0aec0",
                  fontSize: "0.875rem",
                  lineHeight: "1.5",
                }}
              >
                {coachingData.portfolio_grade.description}
              </p>
            </div>
          </div>
        </div>

        {/* Key Strengths */}
        {coachingData.key_strengths &&
          coachingData.key_strengths.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "#10b981",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                ✅ Key Strengths
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {coachingData.key_strengths.map((strength, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "600",
                        color: "#10b981",
                        marginBottom: "4px",
                      }}
                    >
                      {strength.area}
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "#e2e8f0",
                        marginBottom: "4px",
                      }}
                    >
                      {strength.description}
                    </div>
                    {strength.impact && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6ee7b7",
                          fontStyle: "italic",
                        }}
                      >
                        Impact: {strength.impact}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Areas for Improvement */}
        {coachingData.areas_for_improvement &&
          coachingData.areas_for_improvement.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "#dc2626",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                🔧 Areas for Improvement
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {coachingData.areas_for_improvement
                  .slice(0, 5)
                  .map((improvement, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: "8px",
                        padding: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <div style={{ fontWeight: "500", color: "#ef4444" }}>
                          {improvement.area}
                        </div>
                        {improvement.priority && (
                          <span
                            style={{
                              backgroundColor:
                                improvement.priority === "high"
                                  ? "#dc2626"
                                  : "#f59e0b",
                              color: "white",
                              fontSize: "0.75rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: "500",
                            }}
                          >
                            {improvement.priority}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: "#fca5a5",
                          marginBottom: "4px",
                        }}
                      >
                        {improvement.description}
                      </div>
                      {improvement.action && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#fbbf24",
                            fontStyle: "italic",
                          }}
                        >
                          Action: {improvement.action}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

        {/* Meta Alignment */}
        {coachingData.meta_alignment && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h4
              style={{
                color: "#e2e8f0",
                fontSize: "1rem",
                fontWeight: "600",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🎯 Meta Alignment
            </h4>
            <div
              style={{
                backgroundColor:
                  coachingData.meta_alignment.status === "excellent"
                    ? "rgba(16, 185, 129, 0.1)"
                    : coachingData.meta_alignment.status === "good"
                      ? "rgba(245, 158, 11, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                border: "1px solid",
                borderColor:
                  coachingData.meta_alignment.status === "excellent"
                    ? "rgba(16, 185, 129, 0.3)"
                    : coachingData.meta_alignment.status === "good"
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color:
                      coachingData.meta_alignment.status === "excellent"
                        ? "#047857"
                        : coachingData.meta_alignment.status === "good"
                          ? "#92400e"
                          : "#991b1b",
                  }}
                >
                  {Math.round(coachingData.meta_alignment.percentage)}%
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: "500",
                      textTransform: "capitalize",
                    }}
                  >
                    {coachingData.meta_alignment.status} Meta Alignment
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#a0aec0" }}>
                    {coachingData.meta_alignment.aligned_players} of{" "}
                    {coachingData.meta_alignment.total_players} players align
                    with current meta
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#e2e8f0" }}>
                {coachingData.meta_alignment.description}
              </div>
            </div>
          </div>
        )}

        {/* Actionable Tips */}
        {coachingData.actionable_tips &&
          coachingData.actionable_tips.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "#7c3aed",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                💡 Pro Tips
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {coachingData.actionable_tips.map((tip, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: "rgba(148, 163, 184, 0.1)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      <div style={{ fontWeight: "500", color: "#a78bfa" }}>
                        {tip.category}
                      </div>
                      {tip.difficulty && (
                        <span
                          style={{
                            backgroundColor:
                              tip.difficulty === "Easy"
                                ? "#10b981"
                                : tip.difficulty === "Medium"
                                  ? "#f59e0b"
                                  : "#ef4444",
                            color: "white",
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: "500",
                          }}
                        >
                          {tip.difficulty}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#e2e8f0" }}>
                      {tip.tip}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Next Steps */}
        {coachingData.next_steps && coachingData.next_steps.length > 0 && (
          <div>
            <h4
              style={{
                color: "#e2e8f0",
                fontSize: "1rem",
                fontWeight: "600",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🎯 Next Steps
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {coachingData.next_steps.map((step, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "rgba(75, 85, 99, 0.2)",
                    border: "1px solid rgba(75, 85, 99, 0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <div style={{ fontWeight: "500", color: "#a78bfa" }}>
                      {step.timeframe}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#e2e8f0" }}>
                      {step.action}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#a0aec0" }}>
                    {step.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player Predictions moved inside coach insights */}
        <PlayerPredictions coachingData={coachingData} />
      </div>
    </div>
  );
};

export default AICoach;
