/**
 * ProgressService
 * Handles real-time progress tracking and Server-Sent Events (SSE)
 */

const { AppError } = require('../middleware/errorHandler');
const { generateRandomId } = require('../utils/generators');

class ProgressService {
  constructor() {
    this.progressSessions = new Map(); // sessionId -> { res, progress, status, isActive }
    this.progressCallbacks = new Map(); // sessionId -> { progressCallback, statusCallback }
  }

  /**
   * Create a new progress session for SSE
   */
  createProgressSession(req, res) {
    const sessionId = generateRandomId();
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store session
    this.progressSessions.set(sessionId, {
      res,
      progress: 0,
      status: 'connected',
      isActive: true,
      startTime: Date.now(),
      clientIP: req.ip || req.connection.remoteAddress
    });

    // Setup progress callbacks
    const progressCallback = (progress, message = '') => {
      this.updateProgress(sessionId, progress, message);
    };

    const statusCallback = (status, data = {}) => {
      this.updateStatus(sessionId, status, data);
    };

    this.progressCallbacks.set(sessionId, {
      progressCallback,
      statusCallback
    });

    // Send initial connection event
    this.sendEvent(sessionId, 'connected', {
      sessionId,
      timestamp: new Date().toISOString(),
      message: 'Progress session established'
    });

    // Handle client disconnect
    req.on('close', () => {
      this.closeSession(sessionId);
    });

    req.on('aborted', () => {
      this.closeSession(sessionId);
    });

    return {
      sessionId,
      progressCallback,
      statusCallback
    };
  }

  /**
   * Update progress for a session
   */
  updateProgress(sessionId, progress, message = '') {
    const session = this.progressSessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    session.progress = Math.max(0, Math.min(100, progress));
    session.lastUpdate = Date.now();

    this.sendEvent(sessionId, 'progress', {
      progress: session.progress,
      message,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  /**
   * Update status for a session
   */
  updateStatus(sessionId, status, data = {}) {
    const session = this.progressSessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    session.status = status;
    session.lastUpdate = Date.now();

    this.sendEvent(sessionId, 'status', {
      status,
      timestamp: new Date().toISOString(),
      ...data
    });

    // Auto-close session if completed or failed
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      setTimeout(() => this.closeSession(sessionId), 1000); // Allow time for final message
    }

    return true;
  }

  /**
   * Send event to specific session
   */
  sendEvent(sessionId, event, data) {
    const session = this.progressSessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      session.res.write(eventData);
      return true;
    } catch (error) {
      console.error(`Error sending SSE event to session ${sessionId}:`, error);
      this.closeSession(sessionId);
      return false;
    }
  }

  /**
   * Send message to specific session
   */
  sendMessage(sessionId, message, type = 'info') {
    return this.sendEvent(sessionId, 'message', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send error to specific session
   */
  sendError(sessionId, error, details = {}) {
    return this.sendEvent(sessionId, 'error', {
      error: error.message || error,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Close a progress session
   */
  closeSession(sessionId) {
    const session = this.progressSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.endTime = Date.now();
      
      try {
        if (!session.res.destroyed) {
          session.res.end();
        }
      } catch (error) {
        console.error(`Error closing SSE session ${sessionId}:`, error);
      }
      
      this.progressSessions.delete(sessionId);
      this.progressCallbacks.delete(sessionId);
    }
  }

  /**
   * Get session information
   */
  getSessionInfo(sessionId) {
    const session = this.progressSessions.get(sessionId);
    if (!session) {
      throw new AppError('Progress session not found', 404);
    }

    return {
      sessionId,
      progress: session.progress,
      status: session.status,
      isActive: session.isActive,
      startTime: session.startTime,
      lastUpdate: session.lastUpdate,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.progressSessions.entries())
      .filter(([_, session]) => session.isActive)
      .map(([sessionId, session]) => ({
        sessionId,
        progress: session.progress,
        status: session.status,
        startTime: session.startTime,
        lastUpdate: session.lastUpdate,
        clientIP: session.clientIP
      }));
  }

  /**
   * Broadcast message to all active sessions
   */
  broadcastMessage(message, type = 'info') {
    let count = 0;
    for (const [sessionId, session] of this.progressSessions.entries()) {
      if (session.isActive) {
        if (this.sendMessage(sessionId, message, type)) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Cleanup old/inactive sessions
   */
  cleanupSessions(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    const cleaned = [];

    for (const [sessionId, session] of this.progressSessions.entries()) {
      const age = now - session.startTime;
      const isStale = !session.isActive || age > maxAge;
      
      // Also check if last update was too long ago
      const lastUpdateAge = session.lastUpdate ? now - session.lastUpdate : age;
      const isStaleUpdate = lastUpdateAge > maxAge;

      if (isStale || isStaleUpdate) {
        this.closeSession(sessionId);
        cleaned.push(sessionId);
      }
    }

    return { cleaned: cleaned.length };
  }

  /**
   * Get progress callbacks for a session
   */
  getProgressCallbacks(sessionId) {
    return this.progressCallbacks.get(sessionId);
  }

  /**
   * Create progress tracker for optimization operations
   */
  createOptimizationTracker(sessionId, totalSteps = 100) {
    let currentStep = 0;
    
    return {
      step: (message = '') => {
        currentStep++;
        const progress = Math.min(100, (currentStep / totalSteps) * 100);
        this.updateProgress(sessionId, progress, message);
      },
      
      setProgress: (progress, message = '') => {
        this.updateProgress(sessionId, progress, message);
      },
      
      complete: (message = 'Operation completed') => {
        this.updateProgress(sessionId, 100, message);
        this.updateStatus(sessionId, 'completed');
      },
      
      fail: (error, message = 'Operation failed') => {
        this.sendError(sessionId, error);
        this.updateStatus(sessionId, 'failed', { error: error.message || error });
      },
      
      cancel: (message = 'Operation cancelled') => {
        this.updateStatus(sessionId, 'cancelled', { message });
      }
    };
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    const sessions = Array.from(this.progressSessions.values());
    const activeSessions = sessions.filter(s => s.isActive);
    
    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      averageSessionDuration: sessions.length > 0 ? 
        sessions.reduce((sum, s) => sum + ((s.endTime || Date.now()) - s.startTime), 0) / sessions.length : 0,
      oldestActiveSession: activeSessions.length > 0 ? 
        Math.min(...activeSessions.map(s => s.startTime)) : null
    };
  }
}

module.exports = ProgressService;