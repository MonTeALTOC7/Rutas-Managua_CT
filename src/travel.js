import { distance } from './planner.js';

// Closest projection on the selected segment. On loops or parallel roads the
// closest point can be ambiguous; never report this as confirmed progress.
export function remainingOnLine(point, line) {
  if (line.length < 2) return null;
  const cos = Math.cos(point.lat * Math.PI / 180);
  const x = p => (p[1] - point.lon) * cos * 111320;
  const y = p => (p[0] - point.lat) * 111320;
  let best = null, total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const ax = x(a), ay = y(a), dx = x(b) - ax, dy = y(b) - ay;
    const denom = dx * dx + dy * dy;
    const t = denom ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denom)) : 0;
    const offset = Math.hypot(ax + t * dx, ay + t * dy);
    const length = distance({lat:a[0],lon:a[1]}, {lat:b[0],lon:b[1]});
    if (!best || offset < best.offset) best = { offset, along: total + t * length, point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] };
    total += length;
  }
  return { ...best, remaining: Math.max(0, total - best.along) };
}
