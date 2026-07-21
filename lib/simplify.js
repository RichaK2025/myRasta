import { haversine } from './geo';

function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Perpendicular distance (metres) from `point` to the line through `a`/`b`,
// via the haversine distances to each endpoint — accurate enough at the
// scale of a recorded route without needing planar projection.
function perpendicularDistanceMeters(point, a, b) {
  const segMeters = haversine(a, b) * 1000;
  if (segMeters < 1) return haversine(point, a) * 1000;
  const da = haversine(point, a) * 1000;
  const db = haversine(point, b) * 1000;
  // Heron's formula for the triangle's area, then height = 2*area/base.
  const s = (segMeters + da + db) / 2;
  const areaSq = Math.max(0, s * (s - segMeters) * (s - da) * (s - db));
  return (2 * Math.sqrt(areaSq)) / segMeters;
}

// Standard Douglas-Peucker line simplification, recursive, over the lat/lng
// of each point. Keeps `points[start]`/`points[end]` always.
function douglasPeucker(points, start, end, epsilonMeters, keep) {
  let maxDist = 0;
  let maxIdx = -1;
  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistanceMeters(points[i], points[start], points[end]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilonMeters && maxIdx !== -1) {
    keep.add(maxIdx);
    douglasPeucker(points, start, maxIdx, epsilonMeters, keep);
    douglasPeucker(points, maxIdx, end, epsilonMeters, keep);
  }
}

// Reduces a recorded route's point count while preserving its shape. A point
// survives if Douglas-Peucker selects it (path deviates > epsilonMeters from
// the straight line it would otherwise sit on), OR the bearing changed more
// than `bearingDegrees` since the last kept point (turns matter even when
// short), OR speed changed more than `speedChangeRatio` (captures
// stops/accelerations a pure shape-based simplification would smooth over).
// Endpoints are always kept. Point object shape is untouched — only array
// length changes, so every downstream consumer (MapView, nearby/
// recommendations scoring, pause-recovery splicing, Follow Mode) keeps
// working unmodified.
export function simplifyRoute(points, {
  epsilonMeters = 8,
  bearingDegrees = 10,
  speedChangeRatio = 0.3,
} = {}) {
  if (!Array.isArray(points) || points.length < 3) return points || [];

  const keep = new Set([0, points.length - 1]);
  douglasPeucker(points, 0, points.length - 1, epsilonMeters, keep);

  let lastKeptIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    if (keep.has(i)) { lastKeptIdx = i; continue; }
    const last = points[lastKeptIdx];
    const curr = points[i];
    const next = points[i + 1];

    const turnedEnough = next && angleDiff(bearing(last, curr), bearing(curr, next)) > bearingDegrees;

    const lastSpeed = last.speed || 0;
    const currSpeed = curr.speed || 0;
    const speedChangedEnough = Math.abs(currSpeed - lastSpeed) > Math.max(lastSpeed, currSpeed, 1) * speedChangeRatio;

    if (turnedEnough || speedChangedEnough) {
      keep.add(i);
      lastKeptIdx = i;
    }
  }

  return points.filter((_, i) => keep.has(i));
}
