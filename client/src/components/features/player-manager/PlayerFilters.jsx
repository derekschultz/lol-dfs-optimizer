import React from "react";

const PlayerFilters = ({
  searchTerm,
  setSearchTerm,
  filterTeam,
  setFilterTeam,
  filterPosition,
  setFilterPosition,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  teams,
  positions,
}) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
        gap: "2rem",
        marginBottom: "1rem",
      }}
    >
      <div>
        <label className="form-label">Search</label>
        <input
          type="text"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>
      <div>
        <label className="form-label">Team</label>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
        >
          <option value="">All Teams</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Position</label>
        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
        >
          <option value="">All Positions</option>
          {positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Sort By</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
        >
          <option value="projectedPoints">Projected Points</option>
          <option value="name">Name</option>
          <option value="team">Team</option>
          <option value="position">Position</option>
          <option value="salary">Salary</option>
          <option value="ownership">Ownership</option>
          <option value="value">Value</option>
        </select>
      </div>
      <div>
        <label className="form-label">Order</label>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
    </div>
  );
};

export default PlayerFilters;
