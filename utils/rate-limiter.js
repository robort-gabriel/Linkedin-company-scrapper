// Rate Limiter for LinkedIn Scraper Extension
// Implements human-like delays to avoid detection

class RateLimiter {
  constructor(minDelay = 5000, maxDelay = 10000) {
    this.minDelay = minDelay; // Minimum delay in milliseconds (5 seconds)
    this.maxDelay = maxDelay; // Maximum delay in milliseconds (10 seconds)
    this.lastRequestTime = 0;
    this.isThrottled = false;
  }

  /**
   * Get a random delay with jitter to appear more human-like
   * @returns {number} Delay in milliseconds
   */
  getRandomDelay() {
    // Add random jitter between min and max delay
    const baseDelay = Math.random() * (this.maxDelay - this.minDelay) + this.minDelay;
    
    // Add additional small random variation (±10%)
    const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
    
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Wait for a random human-like delay
   * @returns {Promise<number>} The actual delay used
   */
  async wait() {
    const delay = this.getRandomDelay();
    
    // Calculate time since last request
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If we're still within the delay period, wait for the remaining time
    let actualDelay = delay;
    if (timeSinceLastRequest < delay) {
      actualDelay = delay - timeSinceLastRequest;
    } else {
      actualDelay = 0;
    }
    
    if (actualDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
    
    this.lastRequestTime = Date.now();
    return actualDelay;
  }

  /**
   * Execute a function with rate limiting
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn) {
    if (this.isThrottled) {
      throw new Error('Rate limiter is throttled. Please wait.');
    }
    
    await this.wait();
    return await fn();
  }

  /**
   * Set throttled state (e.g., when detecting 429 errors)
   * @param {boolean} isThrottled - Whether to throttle
   * @param {number} duration - Duration to throttle in milliseconds
   */
  async setThrottled(isThrottled, duration = 60000) {
    this.isThrottled = isThrottled;
    
    if (isThrottled && duration > 0) {
      // Auto-unthrottle after duration
      setTimeout(() => {
        this.isThrottled = false;
      }, duration);
    }
  }

  /**
   * Update delay settings
   * @param {number} minDelay - Minimum delay in milliseconds
   * @param {number} maxDelay - Maximum delay in milliseconds
   */
  updateDelays(minDelay, maxDelay) {
    this.minDelay = minDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.lastRequestTime = 0;
    this.isThrottled = false;
  }

  /**
   * Get current settings
   */
  getSettings() {
    return {
      minDelay: this.minDelay,
      maxDelay: this.maxDelay,
      isThrottled: this.isThrottled,
      lastRequestTime: this.lastRequestTime
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RateLimiter;
}

