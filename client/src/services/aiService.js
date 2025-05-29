import { aiApi } from "./api";

export const aiService = {
  async getRecommendations(data) {
    return aiApi.post("/api/ai/recommendations", data);
  },

  async getLiveRecommendations() {
    return aiApi.get("/api/ai/recommendations/live");
  },

  async getMetaInsights() {
    return aiApi.get("/api/ai/meta-insights");
  },

  async getPlayerPredictions(data) {
    return aiApi.post("/api/ai/player-predictions", data);
  },

  async getRiskAssessment(data) {
    return aiApi.post("/api/ai/risk-assessment", data);
  },

  async getSyncStatus() {
    return aiApi.get("/api/ai/sync-status");
  },

  async getCoachInsights() {
    return aiApi.get("/api/ai/coach");
  },

  async getCachedData() {
    return aiApi.get("/api/ai/collect-data");
  },

  async triggerDataCollection() {
    return aiApi.post("/api/ai/collect-data");
  },

  async getCollectionStatus() {
    return aiApi.get("/api/ai/collection-status");
  },

  async checkHealth() {
    return aiApi.get("/health");
  },
};
