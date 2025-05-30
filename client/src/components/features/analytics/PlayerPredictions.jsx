import React from "react";

const PlayerPredictions = ({ coachingData }) => {
  if (
    !coachingData?.player_predictions ||
    coachingData.player_predictions.length === 0
  ) {
    return null;
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
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
        📊 Top Player Predictions
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        {coachingData.player_predictions.slice(0, 6).map((pred, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "#1a202c",
              borderRadius: "8px",
              padding: "12px",
              border: "1px solid #2d3748",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div>
                <div style={{ fontWeight: "600", color: "#e2e8f0" }}>
                  {pred.player.name}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#a0aec0",
                  }}
                >
                  {pred.player.team} - {pred.player.position}
                </div>
              </div>
              <div
                style={{
                  backgroundColor:
                    pred.confidence > 0.8
                      ? "#10b981"
                      : pred.confidence > 0.6
                        ? "#f59e0b"
                        : "#ef4444",
                  color: "white",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                }}
              >
                {(pred.confidence * 100).toFixed(0)}%
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#a0aec0",
                  }}
                >
                  Projected
                </div>
                <div style={{ fontWeight: "600", color: "#e2e8f0" }}>
                  {pred.projected.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#a0aec0",
                  }}
                >
                  Ceiling
                </div>
                <div style={{ fontWeight: "600", color: "#10b981" }}>
                  {pred.ceiling.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#a0aec0",
                  }}
                >
                  Floor
                </div>
                <div style={{ fontWeight: "600", color: "#ef4444" }}>
                  {pred.floor.toFixed(1)}
                </div>
              </div>
            </div>
            {pred.factors && pred.factors.length > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#a0aec0",
                  borderTop: "1px solid #2d3748",
                  paddingTop: "8px",
                }}
              >
                {pred.factors[0].factor}: {pred.factors[0].description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerPredictions;
