import rateLimit from "express-rate-limit";

const WINDOW_MS = 60000; // 1 minute
const MAX_PER_USER = 20;
const MAX_FAILED_ATTEMPTS = 10;

const userWindows = {};
const failedAttempts = {};
const blockedUsers = new Set();

// IP-based rate limiter using express-rate-limit (60 req/min per IP)
export const ipRateLimitMiddleware = rateLimit({
  windowMs: WINDOW_MS,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Slow down." },
});

function slide(store, key, max) {
  const now = Date.now();
  if (!store[key]) store[key] = [];
  store[key] = store[key].filter(ts => now - ts < WINDOW_MS);
  if (store[key].length >= max) return false;
  store[key].push(now);
  return true;
}

export function checkLimit(userId) {
  if (blockedUsers.has(userId)) return false;
  return slide(userWindows, userId, MAX_PER_USER);
}

export function recordFailedAttempt(userId) {
  failedAttempts[userId] = (failedAttempts[userId] || 0) + 1;
  if (failedAttempts[userId] >= MAX_FAILED_ATTEMPTS) {
    blockedUsers.add(userId);
  }
}

export function clearFailedAttempts(userId) {
  delete failedAttempts[userId];
}
