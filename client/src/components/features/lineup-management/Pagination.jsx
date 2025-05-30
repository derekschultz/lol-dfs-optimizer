import React from "react";

const Pagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1rem",
        padding: "1rem",
        backgroundColor: "#10141e",
        borderRadius: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ color: "#a0aec0", fontSize: "0.875rem" }}>
          Showing {startItem}-{endItem} of {totalItems} lineups
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#a0aec0", fontSize: "0.875rem" }}>
            Per page:
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: "#1a202c",
              border: "1px solid #2d3748",
              borderRadius: "4px",
              color: "white",
              fontSize: "0.875rem",
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: currentPage === 1 ? "#1a202c" : "#2d3748",
            border: "1px solid #4a5568",
            borderRadius: "4px",
            color: currentPage === 1 ? "#4a5568" : "#e2e8f0",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
          }}
        >
          Previous
        </button>

        <span
          style={{ color: "#a0aec0", fontSize: "0.875rem", padding: "0 1rem" }}
        >
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: currentPage === totalPages ? "#1a202c" : "#2d3748",
            border: "1px solid #4a5568",
            borderRadius: "4px",
            color: currentPage === totalPages ? "#4a5568" : "#e2e8f0",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
