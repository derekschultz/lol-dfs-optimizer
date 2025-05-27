class OptimizerWorkerService {
  constructor() {
    this.worker = null;
    this.callbacks = {
      onProgress: null,
      onStatus: null,
      onError: null,
      onCompleted: null,
      onInitialized: null,
      onCancelled: null,
    };
    this.isInitialized = false;
    this.isRunning = false;
  }

  /**
   * Initialize the worker
   */
  init() {
    if (this.worker) {
      this.terminate();
    }

    try {
      // Create a new worker
      this.worker = new Worker(
        new URL("./optimizer.worker.js", import.meta.url)
      );

      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);

      // Set up error handler
      this.worker.onerror = (error) => {
        console.error("Worker error:", error);
        if (this.callbacks.onError) {
          this.callbacks.onError({
            message: error.message || "Unknown worker error",
            phase: "worker",
          });
        }
        this.isRunning = false;
      };

      console.log("Optimizer worker initialized successfully");
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      if (this.callbacks.onError) {
        this.callbacks.onError({
          message: `Failed to initialize worker: ${error.message}`,
          phase: "initialization",
        });
      }
    }
  }

  /**
   * Handle messages from the worker
   */
  handleWorkerMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case "progress":
        if (this.callbacks.onProgress) {
          this.callbacks.onProgress(data.percent, data.stage);
        }
        break;

      case "status":
        if (this.callbacks.onStatus) {
          this.callbacks.onStatus(data.status);
        }
        break;

      case "initialized":
        this.isInitialized = true;
        if (this.callbacks.onInitialized) {
          this.callbacks.onInitialized(data);
        }
        break;

      case "completed":
        this.isRunning = false;
        if (this.callbacks.onCompleted) {
          this.callbacks.onCompleted(data.results);
        }
        break;

      case "cancelled":
        this.isRunning = false;
        if (this.callbacks.onCancelled) {
          this.callbacks.onCancelled();
        }
        break;

      case "error":
        this.isRunning = false;
        console.error("Optimizer worker error:", data);
        if (this.callbacks.onError) {
          this.callbacks.onError(data);
        }
        break;

      default:
        console.warn("Unknown message from worker:", type, data);
    }
  }

  /**
   * Initialize the optimizer with player data and settings
   * @returns {Promise} A promise that resolves when initialization is complete
   */
  initializeOptimizer(playerData, exposureSettings, existingLineups, config) {
    if (!this.worker) {
      this.init();
    }

    this.isInitialized = false;

    // Return a promise that resolves when initialization is complete
    return new Promise((resolve, reject) => {
      // Store the original callbacks
      const originalCallbacks = { ...this.callbacks };

      // Set up temporary callbacks for this initialization
      this.setCallbacks({
        ...this.callbacks,
        onInitialized: (data) => {
          // Call the original onInitialized callback if it exists
          if (originalCallbacks.onInitialized) {
            originalCallbacks.onInitialized(data);
          }

          // Resolve the promise
          resolve(data);
        },
        onError: (error) => {
          // Call the original onError callback if it exists
          if (originalCallbacks.onError) {
            originalCallbacks.onError(error);
          }

          // Reject the promise
          reject(error);
        },
      });

      // Send the initialization message
      this.worker.postMessage({
        type: "initialize",
        data: {
          playerData,
          exposureSettings,
          existingLineups,
          config,
        },
      });
    });
  }

  /**
   * Run the optimizer to generate lineups
   * @param {number} count - Number of lineups to generate
   * @returns {Promise} A promise that resolves when optimization is complete
   */
  runOptimizer(count) {
    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    if (!this.isInitialized) {
      throw new Error("Optimizer not initialized");
    }

    if (this.isRunning) {
      throw new Error("Optimizer is already running");
    }

    this.isRunning = true;

    // Return a promise that resolves when optimization is complete
    return new Promise((resolve, reject) => {
      // Store the original callbacks
      const originalCallbacks = { ...this.callbacks };

      // Set up temporary callbacks for this run
      this.setCallbacks({
        ...this.callbacks,
        onCompleted: (results) => {
          // Call the original onCompleted callback if it exists
          if (originalCallbacks.onCompleted) {
            originalCallbacks.onCompleted(results);
          }

          // Resolve the promise
          resolve(results);
        },
        onError: (error) => {
          // Call the original onError callback if it exists
          if (originalCallbacks.onError) {
            originalCallbacks.onError(error);
          }

          // Reject the promise
          reject(error);
        },
        onCancelled: () => {
          // Call the original onCancelled callback if it exists
          if (originalCallbacks.onCancelled) {
            originalCallbacks.onCancelled();
          }

          // Resolve with cancelled status
          resolve({ cancelled: true });
        },
      });

      // Send the run message
      this.worker.postMessage({
        type: "run",
        data: { count },
      });
    });
  }

  /**
   * Cancel the current optimization
   */
  cancelOptimization() {
    if (this.worker && this.isRunning) {
      this.worker.postMessage({ type: "cancel" });
    }
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.postMessage({ type: "terminate" });
      this.worker = null;
      this.isInitialized = false;
      this.isRunning = false;
    }
  }

  /**
   * Set callback functions
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Check if the optimizer is running
   */
  isOptimizerRunning() {
    return this.isRunning;
  }

  /**
   * Check if the optimizer is initialized
   */
  isOptimizerInitialized() {
    return this.isInitialized;
  }
}

// Create a singleton instance
const optimizerWorkerService = new OptimizerWorkerService();

export default optimizerWorkerService;
