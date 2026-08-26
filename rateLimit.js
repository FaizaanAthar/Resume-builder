// Best-effort rate limiting only. Serverless functions (Vercel etc.) run as multiple
// isolated instances, so this in-memory map does NOT give you a hard global limit —
// it just stops a single instance from being hammered in a tight loop. For real
// production abuse protection, put this behind a durable store (Upstash Redis, etc.)
// or a provider-level rate limit / WAF rule. See README "Going further" section.

const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

export function checkRateLimit(key) {
  const now = Date.now();
  const entry = hits.get(key) || { count: 0, windowStart: now };

  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  hits.set(key, entry);

  return entry.count <= MAX_PER_WINDOW;
}

export function clientKeyFromRequest(request) {
  return (
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
