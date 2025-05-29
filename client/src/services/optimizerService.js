import { api } from "./api";

export const optimizerService = {
  async initializeOptimizer(config) {
    return api.post("/optimizer/initialize", config);
  },

  async getStrategies() {
    return api.get("/optimizer/strategies");
  },

  async getProgress(sessionId) {
    // This returns an EventSource for SSE
    return new EventSource(`${api.baseURL}/optimizer/progress/${sessionId}`);
  },

  async generateLineups(config) {
    return api.post("/optimizer/generate", config);
  },

  async simulateLineups(config) {
    return api.post("/optimizer/simulate", config);
  },

  async initializeHybridOptimizer(config) {
    return api.post("/optimizer/hybrid/initialize", config);
  },

  async generateHybridLineups(initId, config) {
    return api.post(`/optimizer/hybrid/generate/${initId}`, config);
  },

  async getAlgorithms() {
    return api.get("/optimizer/algorithms");
  },

  async getConstraints() {
    return api.get("/optimizer/constraints");
  },

  async validateLineupConfig(config) {
    return api.post("/optimizer/validate", config);
  },
};
