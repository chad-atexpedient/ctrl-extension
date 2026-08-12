/**
 * Rate Limiter for Tool Execution
 * Prevents DoS conditions and rate limit abuse
 */

/**
 * Rate Limiter Class
 * Implements token bucket algorithm for rate limiting
 */
export class RateLimiter {
  constructor(options = {}) {
    // Configuration
    this.maxRequests = options.maxRequests || 10;
    this.windowMs = options.windowMs || 60000; // Default: 10 requests per minute
    this.perTool = options.perTool || true; // Separate limits per tool

    // State
    this.requests = new Map(); // Key: tool name, Value: Array of timestamps
  }

  /**
   * Check if request is allowed
   * @param {string} tool - Tool name
   * @returns {Object} { allowed: boolean, retryAfter: number, remaining: number }
   */
  check(tool = 'default') {
    const key = this.perTool ? tool : 'global';
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request array for this tool
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const toolRequests = this.requests.get(key);

    // Remove old requests outside the time window
    const validRequests = toolRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(key, validRequests);

    // Check if under limit
    const remaining = this.maxRequests - validRequests.length;
    const allowed = remaining > 0;

    // Calculate when next request can be made (if rate limited)
    let retryAfter = 0;
    if (!allowed && validRequests.length > 0) {
      const oldestRequest = Math.min(...validRequests);
      retryAfter = oldestRequest + this.windowMs - now;
    }

    return {
      allowed,
      retryAfter: Math.max(0, retryAfter),
      remaining: Math.max(0, remaining)
    };
  }

  /**
   * Record a request (call after checking)
   * @param {string} tool - Tool name
   */
  record(tool = 'default') {
    const key = this.perTool ? tool : 'global';
    const now = Date.now();

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const toolRequests = this.requests.get(key);
    toolRequests.push(now);

    // Cleanup old requests
    const windowStart = now - this.windowMs;
    const validRequests = toolRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(key, validRequests);
  }

  /**
   * Reset rate limit for a specific tool or all tools
   * @param {string} tool - Tool name or 'all'
   */
  reset(tool = 'all') {
    if (tool === 'all') {
      this.requests.clear();
    } else {
      this.requests.delete(tool);
    }
  }

  /**
   * Get current rate limit state for a tool
   * @param {string} tool - Tool name
   * @returns {Object} Current state
   */
  getState(tool = 'default') {
    const key = this.perTool ? tool : 'global';
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const toolRequests = this.requests.get(key) || [];
    const validRequests = toolRequests.filter(timestamp => timestamp > windowStart);

    return {
      used: validRequests.length,
      remaining: Math.max(0, this.maxRequests - validRequests.length),
      limit: this.maxRequests,
      window: this.windowMs,
      resetAt: toolRequests.length > 0 ? Math.min(...validRequests) + this.windowMs : now
    };
  }

  /**
   * Get state for all tools
   * @returns {Object} Map of tool states
   */
  getAllStates() {
    const states = {};

    if (this.perTool) {
      // Get state for each tool
      this.requests.forEach((requests, tool) => {
        states[tool] = this.getState(tool);
      });
    } else {
      states.global = this.getState('default');
    }

    return states;
  }
}

/**
 * Tool-specific rate limits
 */
export const TOOL_LIMITS = {
  web_search: {
    maxRequests: 10,
    windowMs: 60000 // 10 requests per minute
  },
  image_search: {
    maxRequests: 5,
    windowMs: 60000 // 5 requests per minute
  },
  generate_image: {
    maxRequests: 3,
    windowMs: 60000 // 3 requests per minute
  },
  default: {
    maxRequests: 20,
    windowMs: 60000 // 20 requests per minute default
  }
};

/**
 * Create rate limiter for a specific tool
 * @param {string} tool - Tool name
 * @returns {RateLimiter} Rate limiter instance
 */
export function createToolRateLimiter(tool) {
  const limits = TOOL_LIMITS[tool] || TOOL_LIMITS.default;

  return new RateLimiter({
    maxRequests: limits.maxRequests,
    windowMs: limits.windowMs,
    perTool: true
  });
}

/**
 * Create global rate limiter for all operations
 * @param {Object} options - Override default options
 * @returns {RateLimiter} Rate limiter instance
 */
export function createGlobalRateLimiter(options = {}) {
  return new RateLimiter({
    maxRequests: options.maxRequests || 50,
    windowMs: options.windowMs || 60000, // 50 requests per minute
    perTool: false
  });
}

/**
 * Rate limit middleware wrapper
 * @param {RateLimiter} rateLimiter - Rate limiter instance
 * @param {string} tool - Tool name
 * @param {Function} fn - Function to execute
 * @returns {Function} Wrapped function with rate limiting
 */
export function withRateLimit(rateLimiter, tool, fn) {
  return async function(...args) {
    // Check rate limit
    const { allowed, retryAfter } = rateLimiter.check(tool);

    if (!allowed) {
      throw new Error(`Rate limit exceeded for ${tool}. Retry after ${retryAfter}ms`);
    }

    try {
      // Execute the function
      const result = await fn(...args);

      // Record successful request
      rateLimiter.record(tool);

      return result;
    } catch (error) {
      // Record failed request (optional, depending on use case)
      // rateLimiter.record(tool);

      throw error;
    }
  };
}

/**
 * Format rate limit error for user display
 * @param {Error} error - Rate limit error
 * @returns {string} Formatted error message
 */
export function formatRateLimitError(error) {
  const retryMatch = error.message.match(/Retry after (\d+)ms/);

  if (retryMatch) {
    const retryAfterMs = parseInt(retryMatch[1]);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    if (retryAfterSec < 60) {
      return `Rate limit reached. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? 's' : ''} before trying again.`;
    } else {
      const minutes = Math.ceil(retryAfterSec / 60);
      return `Rate limit reached. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before trying again.`;
    }
  }

  return error.message;
}
