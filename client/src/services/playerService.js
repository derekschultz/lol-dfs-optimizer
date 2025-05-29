import { api } from "./api";

export const playerService = {
  async getPlayers() {
    return api.get("/players");
  },

  async getProjections() {
    return api.get("/players/projections");
  },

  async uploadProjections(file) {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload("/players/projections/upload", formData);
  },

  async getPlayerById(id) {
    return api.get(`/players/${id}`);
  },

  async createPlayer(playerData) {
    return api.post("/players", playerData);
  },

  async updatePlayer(id, playerData) {
    return api.put(`/players/${id}`, playerData);
  },

  async deletePlayer(id) {
    return api.delete(`/players/${id}`);
  },

  async getTeamStats() {
    return api.get("/players/stats/teams");
  },

  async getOverviewStats() {
    return api.get("/players/stats/overview");
  },

  async searchPlayers(filters) {
    return api.post("/players/search", filters);
  },
};
