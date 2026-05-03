import "server-only";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PRUNE_INTERVAL_MS = WINDOW_MS;

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastPruneAt = 0;

function pruneExpiredBuckets(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;

  lastPruneAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

// First-layer local protection only. Use durable/shared throttling before
// relying on this across multiple serverless instances.
export function checkSupportEmailRateLimit(key: string) {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }

  if (current.count >= MAX_ATTEMPTS) {
    return { allowed: false, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, resetAt: current.resetAt };
}
