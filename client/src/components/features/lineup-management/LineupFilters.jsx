import React from "react";

const LineupFilters = ({
  searchTerm,
  setSearchTerm,
  itemsPerPage,
  setItemsPerPage,
  filteredCount,
  totalCount,
  onResetFilters,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem",
        padding: "0.75rem 1rem",
        backgroundColor: "#10141e",
        borderRadius: "4px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexGrow: 1,
        }}
      >
        <div style={{ flexGrow: 1, maxWidth: "300px" }}>
          <input
            type="text"
            placeholder="Search lineups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "#1a202c",
              border: "1px solid #2d3748",
              borderRadius: "4px",
              color: "white",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: "20px",
          }}
        >
          <span
            style={{
              color: "#a0aec0",
              marginRight: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            Items per page:
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: "#1a202c",
              color: "#e2e8f0",
              border: "1px solid #2d3748",
              borderRadius: "4px",
            }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
          </select>
        </div>

        <div>
          <button
            onClick={onResetFilters}
            style={{
              background: "none",
              border: "1px solid #4fd1c5",
              color: "#4fd1c5",
              padding: "0.25rem 0.75rem",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default LineupFilters;
