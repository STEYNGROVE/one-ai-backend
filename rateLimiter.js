const limits = {};

export function checkLimit(userId) {
  const now = Date.now();
  const windowMs = 60000; // 1 min
  const maxRequests = 10;

  if (!limits[userId]) {
    limits[userId] = [];
  }

  limits[userId] = limits[userId].filter(ts => now - ts < windowMs);

  if (limits[userId].length >= maxRequests) {
    return false;
  }

  limits[userId].push(now);
  return true;
}
