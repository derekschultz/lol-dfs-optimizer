import { api } from "./api";

export const teamService = {
  async getTeamStacks() {
    return api.get("/teams/stacks");
  },

  async getRawTeamStacks() {
    return api.get("/teams/stacks/raw");
  },

  async getStackById(id) {
    return api.get(`/teams/stacks/${id}`);
  },

  async getStacksByTeam(team) {
    return api.get(`/teams/${team}/stacks`);
  },

  async createStack(stackData) {
    return api.post("/teams/stacks", stackData);
  },

  async updateStack(id, stackData) {
    return api.put(`/teams/stacks/${id}`, stackData);
  },

  async deleteStack(id) {
    return api.delete(`/teams/stacks/${id}`);
  },

  async bulkDeleteStacks(ids) {
    return api.delete("/teams/stacks/bulk", { body: JSON.stringify({ ids }) });
  },

  async searchStacks(filters) {
    return api.post("/teams/stacks/search", filters);
  },

  async getStackStats() {
    return api.get("/teams/stacks/stats/overview");
  },

  async getTopStacks(limit = 10) {
    return api.get(`/teams/stacks/top/${limit}`);
  },

  async getStackTiers() {
    return api.get("/teams/stacks/tiers");
  },

  async exportStacks(format, options = {}) {
    return api.post("/teams/stacks/export", { format, ...options });
  },

  async uploadStacks(file) {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload("/teams/stacks/upload", formData);
  },
};
