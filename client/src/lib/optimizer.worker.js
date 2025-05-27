/* eslint-disable no-restricted-globals */
const AdvancedOptimizer = require("./AdvancedOptimizer");

let optimizer = null;
let isRunning = false;
let shouldCancel = false;

self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "initialize":
      try {
        const { playerData, exposureSettings, existingLineups, config } = data;

        // Create optimizer instance
        optimizer = new AdvancedOptimizer({
          salaryCap: 50000,
          positionRequirements: {
            CPT: 1,
            TOP: 1,
            JNG: 1,
            MID: 1,
            ADC: 1,
            SUP: 1,
            TEAM: 1,
          },
          ...config,
        });

        // Setup callbacks
        optimizer.setProgressCallback((percent, stage) => {
          self.postMessage({ type: "progress", data: { percent, stage } });
        });

        optimizer.setStatusCallback((status) => {
          self.postMessage({ type: "status", data: { status } });
        });

        // Initialize optimizer
        const initSuccess = await optimizer.initialize(
          playerData,
          exposureSettings,
          existingLineups
        );

        if (initSuccess) {
          self.postMessage({ type: "initialized", data: { success: true } });
        } else {
          throw new Error("Failed to initialize optimizer");
        }
      } catch (error) {
        self.postMessage({
          type: "error",
          data: {
            message: error.message,
            stack: error.stack,
            phase: "initialization",
          },
        });
      }
      break;

    case "run":
      if (!optimizer) {
        self.postMessage({
          type: "error",
          data: {
            message: "Optimizer not initialized",
            phase: "run",
          },
        });
        return;
      }

      try {
        const { count } = data;
        isRunning = true;
        shouldCancel = false;

        // Check cancellation before running
        if (shouldCancel) {
          isRunning = false;
          self.postMessage({ type: "cancelled" });
          return;
        }

        // Run optimization
        const results = await optimizer.runSimulation(count);

        if (isRunning && !shouldCancel) {
          self.postMessage({ type: "completed", data: { results } });
        }

        isRunning = false;
      } catch (error) {
        isRunning = false;
        self.postMessage({
          type: "error",
          data: {
            message: error.message,
            stack: error.stack,
            phase: "run",
          },
        });
      }
      break;

    case "cancel":
      if (optimizer && isRunning) {
        shouldCancel = true;
        optimizer.cancel();
        isRunning = false;
        self.postMessage({ type: "cancelled" });
      }
      break;

    case "terminate":
      if (optimizer) {
        if (isRunning) {
          optimizer.cancel();
        }
        optimizer = null;
      }
      self.close();
      break;

    default:
      self.postMessage({
        type: "error",
        data: { message: `Unknown command: ${type}` },
      });
  }
});
