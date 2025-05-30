import React, { useState } from "react";

const DataCollectionStatus = ({
  dataFetchStatus,
  setDataFetchStatus,
  showStatus,
  setShowStatus,
  collectionStatus,
}) => {
  const [showAllErrors, setShowAllErrors] = useState(false);

  return (
    <>
      {/* Data Collection Status */}
      {dataFetchStatus && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid",
            borderColor:
              dataFetchStatus.phase === "error"
                ? "#fecaca"
                : dataFetchStatus.phase === "completed"
                  ? "#d1fae5"
                  : "#dbeafe",
            backgroundColor:
              dataFetchStatus.phase === "error"
                ? "#fef2f2"
                : dataFetchStatus.phase === "completed"
                  ? "#ecfdf5"
                  : "#eff6ff",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {dataFetchStatus.phase !== "completed" &&
            dataFetchStatus.phase !== "error" && (
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #e5e7eb",
                  borderTop: "2px solid #2563eb",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              ></div>
            )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.875rem",
                color:
                  dataFetchStatus.phase === "error"
                    ? "#991b1b"
                    : dataFetchStatus.phase === "completed"
                      ? "#166534"
                      : "#1e40af",
                fontWeight: "500",
              }}
            >
              {dataFetchStatus.message}
            </div>
            {dataFetchStatus.data && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "4px",
                  display: "flex",
                  gap: "16px",
                }}
              >
                <span>
                  Source: {dataFetchStatus.data.matches?.source || "unknown"}
                </span>
                {dataFetchStatus.data.errors?.length > 0 && (
                  <span style={{ color: "#dc2626" }}>
                    {dataFetchStatus.data.errors.length} warnings
                  </span>
                )}
              </div>
            )}
            {dataFetchStatus.errors && dataFetchStatus.errors.length > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#dc2626",
                  marginTop: "4px",
                }}
              >
                {dataFetchStatus.errors.slice(0, 2).map((error, idx) => (
                  <div key={idx}>
                    • {error.source}: {error.error}
                  </div>
                ))}
                {dataFetchStatus.errors.length > 2 && (
                  <div>+ {dataFetchStatus.errors.length - 2} more errors</div>
                )}
              </div>
            )}
          </div>
          {dataFetchStatus.phase === "completed" && (
            <button
              onClick={() => setDataFetchStatus(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#6b7280",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Collection Status Panel */}
      {showStatus && collectionStatus && (
        <div
          style={{
            marginBottom: "1.5rem",
            border: "2px solid #6b7280",
            borderRadius: "12px",
            backgroundColor: "var(--bg-card)",
            overflow: "hidden",
          }}
        >
          {/* Status Header */}
          <div
            style={{
              backgroundColor: "#6b7280",
              color: "white",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>📊</span>
              <div>
                <h3
                  style={{ margin: 0, fontSize: "1.125rem", fontWeight: "600" }}
                >
                  Data Collection Status
                </h3>
                <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>
                  Background collection monitoring
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStatus(false)}
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

          {/* Status Content */}
          <div style={{ padding: "1.5rem" }}>
            {/* Current Status */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Current Status
              </h4>
              <div
                style={{
                  backgroundColor: collectionStatus.status.isCollecting
                    ? "rgba(236, 201, 75, 0.1)"
                    : "rgba(72, 187, 120, 0.1)",
                  border: "1px solid",
                  borderColor: collectionStatus.status.isCollecting
                    ? "var(--accent-yellow)"
                    : "var(--accent-green)",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                  }}
                >
                  {collectionStatus.status.isCollecting ? "🔄" : "✅"}
                </div>
                <div>
                  <div
                    style={{ fontWeight: "500", color: "var(--text-primary)" }}
                  >
                    {collectionStatus.status.isCollecting
                      ? "Collection in Progress"
                      : "Collection Complete"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {collectionStatus.status.isCollecting
                      ? "Background collection is currently running..."
                      : `Last completed: ${
                          collectionStatus.status.lastCollection
                            ? new Date(
                                collectionStatus.status.lastCollection
                              ).toLocaleString()
                            : "Never"
                        }`}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Details */}
            {collectionStatus.progress && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h4
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                    fontWeight: "600",
                    marginBottom: "12px",
                  }}
                >
                  Latest Progress
                </h4>
                <div
                  style={{
                    backgroundColor: "var(--bg-card-darker)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      marginBottom: "4px",
                      color: "var(--text-primary)",
                    }}
                  >
                    Phase: {collectionStatus.progress.phase}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    {collectionStatus.progress.message}
                  </div>
                  {collectionStatus.progress.data && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Results: {collectionStatus.progress.data.matches || 0}{" "}
                      matches, {collectionStatus.progress.data.playerStats || 0}{" "}
                      player stats, {collectionStatus.progress.data.errors || 0}{" "}
                      errors
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      marginTop: "8px",
                    }}
                  >
                    Updated:{" "}
                    {new Date(
                      collectionStatus.progress.timestamp
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Info */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Schedule
              </h4>
              <div
                style={{
                  backgroundColor: "var(--bg-card-darker)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    marginBottom: "4px",
                    color: "var(--text-primary)",
                  }}
                >
                  <strong>Next Collection:</strong>{" "}
                  {collectionStatus.status.nextCollection === "Soon"
                    ? "Soon"
                    : new Date(
                        collectionStatus.status.nextCollection
                      ).toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    marginBottom: "4px",
                    color: "var(--text-primary)",
                  }}
                >
                  <strong>Frequency:</strong> Every 30 minutes
                </div>
                <div
                  style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}
                >
                  <strong>Cache Available:</strong>{" "}
                  {collectionStatus.status.cacheAvailable ? "✅ Yes" : "❌ No"}
                </div>
              </div>
            </div>

            {/* Errors */}
            {collectionStatus.status.errors &&
              collectionStatus.status.errors.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <h4
                      style={{
                        color: "#dc2626",
                        fontSize: "1rem",
                        fontWeight: "600",
                        margin: 0,
                      }}
                    >
                      Recent Errors ({collectionStatus.status.errors.length})
                    </h4>
                    {collectionStatus.status.errors.length > 3 && (
                      <button
                        onClick={() => setShowAllErrors(!showAllErrors)}
                        style={{
                          background: "var(--accent-red)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontWeight: "500",
                        }}
                      >
                        {showAllErrors ? "Show Less" : "Show All"}
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--bg-card-darker)",
                      border: "1px solid var(--accent-red)",
                      borderRadius: "8px",
                      padding: "12px",
                      maxHeight: showAllErrors ? "none" : "200px",
                      overflowY: showAllErrors ? "visible" : "auto",
                    }}
                  >
                    {(showAllErrors
                      ? collectionStatus.status.errors
                      : collectionStatus.status.errors.slice(0, 3)
                    ).map((error, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: "0.875rem",
                          marginBottom: "4px",
                          color: "var(--accent-red)",
                        }}
                      >
                        • {error.player} ({error.type}): {error.error}
                      </div>
                    ))}
                    {!showAllErrors &&
                      collectionStatus.status.errors.length > 3 && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginTop: "8px",
                          }}
                        >
                          + {collectionStatus.status.errors.length - 3} more
                          errors (click "Show All" to view)
                        </div>
                      )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </>
  );
};

export default DataCollectionStatus;
