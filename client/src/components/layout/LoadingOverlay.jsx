import React from "react";
import { useApp } from "../../contexts/AppContext";

const LoadingOverlay = () => {
  const { isLoading } = useApp();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <h3 className="loading-title">Processing...</h3>
        <div className="loading-progress">
          <div className="loading-bar"></div>
        </div>
        <p className="loading-text">This may take a moment...</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
