import "server-only";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const buckets = new Map<string, { count: number; resetAt: number }>();

// In-memory guard for local/single-instance protection only.
// Replace or supplement with durable shared storage before relying on this
// across multiple serverless instances or app replicas.
export function checkSupportChatRateLimit(key: string) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }

  if (current.count >= MAX_REQUESTS) {
    return { allowed: false, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, resetAt: current.resetAt };
}
