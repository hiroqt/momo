// Process-local preview protection. Use a shared limiter before multi-instance deployment.
export function createPreviewLimiter() {
  const entries = new Map<string, { last: number; minute: number; minuteCount: number; hour: number; hourCount: number }>();
  return (ip: string, now = Date.now()): boolean => {
    for (const [key, value] of entries) if (now - value.hour >= 3_600_000) entries.delete(key);
    let entry = entries.get(ip);
    if (!entry) {
      if (entries.size >= 2000) return false;
      entry = { last: -Infinity, minute: now, minuteCount: 0, hour: now, hourCount: 0 };
      entries.set(ip, entry);
    }
    if (now - entry.minute >= 60_000) { entry.minute = now; entry.minuteCount = 0; }
    if (now - entry.last < 1500 || entry.minuteCount >= 6 || entry.hourCount >= 30) return false;
    entry.last = now;
    entry.minuteCount++;
    entry.hourCount++;
    return true;
  };
}
