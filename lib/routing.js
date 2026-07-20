const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';

// Fetches a road-following path between two points from the free public OSRM
// router. Used to bridge the gap left when recording is paused and resumed
// somewhere else, so the drawn route follows roads instead of cutting a
// straight line across the pause. Returns null on any failure so callers can
// fall back to the straight line.
export async function fetchRoutedPath(from, to, profile = 'driving') {
  try {
    const url = `${OSRM_BASE_URL}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    // Drop the first/last vertices — they're OSRM's snapped versions of
    // `from`/`to`, which the caller already has as real recorded points.
    return coords.slice(1, -1).map(([lng, lat]) => ({
      lat, lng, timestamp: null, speed: 0, altitude: null, accuracy: null, routed: true,
    }));
  } catch {
    return null;
  }
}
