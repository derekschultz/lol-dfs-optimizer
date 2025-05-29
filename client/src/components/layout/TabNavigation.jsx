import React from "react";
import { useApp } from "../../contexts/AppContext";

const TabNavigation = () => {
  const { activeTab, setActiveTab } = useApp();

  const tabs = [
    { id: "upload", label: "Upload" },
    { id: "players", label: "Player Management" },
    { id: "lineups", label: "Lineups" },
    { id: "stack-exposure", label: "Stack Exposure" },
    { id: "ai-insights", label: "AI Insights" },
    { id: "hybrid", label: "Hybrid Optimizer v2.0" },
    { id: "optimizer", label: "Advanced Optimizer (Legacy)" },
    { id: "nexustest", label: "NexusScore Test" },
    { id: "performance", label: "Performance Test" },
  ];

  return (
    <div className="tabs-container">
      <ul style={{ listStyle: "none" }}>
        {tabs.map((tab) => (
          <li key={tab.id} style={{ display: "inline-block" }}>
            <button
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TabNavigation;
