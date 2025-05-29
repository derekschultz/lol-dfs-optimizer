import { api } from "./api";

export const lineupService = {
  async getLineups() {
    return api.get("/lineups");
  },

  async getLineupById(id) {
    return api.get(`/lineups/${id}`);
  },

  async createLineup(lineupData) {
    return api.post("/lineups", lineupData);
  },

  async updateLineup(id, lineupData) {
    return api.put(`/lineups/${id}`, lineupData);
  },

  async deleteLineup(id) {
    return api.delete(`/lineups/${id}`);
  },

  async bulkDeleteLineups(ids) {
    return api.delete("/lineups/bulk", { body: JSON.stringify({ ids }) });
  },

  async searchLineups(filters) {
    return api.post("/lineups/search", filters);
  },

  async getLineupStats() {
    return api.get("/lineups/stats/overview");
  },

  async exportLineups(format, options = {}) {
    return api.post("/lineups/export", { format, ...options });
  },

  async uploadDraftKingsEntries(file) {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload("/lineups/dkentries", formData);
  },

  async importLineups(data) {
    return api.post("/lineups/import", data);
  },

  async simulateLineups(lineups, options = {}) {
    return api.post("/lineups/simulate", { lineups, ...options });
  },

  async generateHybridLineups(config) {
    return api.post("/lineups/generate-hybrid", config);
  },
};
