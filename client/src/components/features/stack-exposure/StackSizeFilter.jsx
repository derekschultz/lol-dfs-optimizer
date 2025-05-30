import React from "react";

const StackSizeFilter = ({ activeStackSize, setActiveStackSize }) => {
  const tabs = [
    { key: "all", label: "All Stacks" },
    { key: "2", label: "2-stacks" },
    { key: "3", label: "3-stacks" },
    { key: "4", label: "4-stacks" },
  ];

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "flex",
          backgroundColor: "#1E293B",
          borderRadius: "8px",
          padding: "4px",
          gap: "4px",
          border: "1px solid #334155",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveStackSize(tab.key)}
            style={{
              flex: 1,
              padding: "12px 20px",
              border: "none",
              borderRadius: "6px",
              backgroundColor:
                activeStackSize === tab.key ? "#059669" : "transparent",
              color: activeStackSize === tab.key ? "white" : "#94A3B8",
              fontWeight: activeStackSize === tab.key ? "600" : "500",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StackSizeFilter;
