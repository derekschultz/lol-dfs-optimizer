import React from "react";

/**
 * Generate sort icon based on current sort state
 */
export const getSortIcon = (column, sortBy, sortDirection) => {
  if (sortBy !== column)
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        style={{ marginLeft: "8px", opacity: 0.4 }}
      >
        <path d="M10 6L13 9H7L10 6Z" fill="#64748B" />
        <path d="M10 14L7 11H13L10 14Z" fill="#64748B" />
      </svg>
    );
  return sortDirection === "asc" ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ marginLeft: "8px" }}
    >
      <path
        d="M10 5L14 10H6L10 5Z"
        fill="#38BDF8"
        stroke="#0EA5E9"
        strokeWidth="0.5"
      />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ marginLeft: "8px" }}
    >
      <path
        d="M10 15L6 10H14L10 15Z"
        fill="#38BDF8"
        stroke="#0EA5E9"
        strokeWidth="0.5"
      />
    </svg>
  );
};
