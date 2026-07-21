const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

// Free, no-key reverse geocode of a route's start point, used to populate
// `city` for nearby-route filtering and city-wise leaderboards. Same
// try/catch-null-on-failure contract as lib/routing.js's fetchRoutedPath, so
// a lookup failure never blocks saving a route.
export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Raasta/1.0 (contact: bsnsspace25@gmail.com)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address || {};
    return addr.city || addr.town || addr.village || addr.county || null;
  } catch {
    return null;
  }
}

// Free, no-key forward geocode ("Bhilai" -> {lat, lng, label}) used to turn a
// typed destination into a point for Smart Route Recommendations. Same
// try/catch-null contract as reverseGeocode above.
export async function forwardGeocode(query) {
  try {
    const url = `${NOMINATIM_SEARCH_URL}?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Raasta/1.0 (contact: bsnsspace25@gmail.com)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.[0];
    if (!hit) return null;
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: hit.display_name };
  } catch {
    return null;
  }
}
