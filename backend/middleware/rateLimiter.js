/**
 * Enterprise Rate Limiting Middleware (AgriSpectra Security Defense)
 * Prevents DDoS, brute-force attacks, email flooding, and solenoid coil burnout.
 */

export class MemoryRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // default 1 minute
    this.max = options.max || 60; // default 60 requests per window
    this.message = options.message || "Too many requests. Please try again later.";
    this.records = new Map();

    // Auto-cleanup stale buckets every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.records.entries()) {
        if (now > record.resetTime) {
          this.records.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      // In test mode, allow tests to pass unless specifically testing rate limiting
      if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
        return next();
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
      const key = `${clientIp}:${req.baseUrl || req.path}`;
      const now = Date.now();

      let record = this.records.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + this.windowMs };
        this.records.set(key, record);
      } else {
        record.count++;
      }

      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      if (record.count > this.max) {
        return res.status(429).json({
          success: false,
          error: this.message,
          retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
        });
      }

      next();
    };
  }
}

// 1. Password reset & login anti-brute-force defense (Max 10 attempts per 15 minutes)
export const loginLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many authentication login attempts from this IP. Anti-brute-force lockout engaged. Please wait 15 minutes before retrying."
}).middleware();

// General auth endpoint rate limiter (Max 120 requests per minute for sync, user profiles, session checks)
export const authLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: "Authentication rate limit reached. Please reduce request frequency."
}).middleware();

// 2. Admin sensitive endpoints limiter (Max 60 requests/min)
export const adminLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Administrative rate limit exceeded. Please back off."
}).middleware();

// 3. Solenoid hardware actuation limiter (Max 15 pulse actuations/min to protect coil)
export const valveActuationLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: "Hydraulic solenoid actuation frequency exceeded. Hardware thermal protection engaged."
}).middleware();
