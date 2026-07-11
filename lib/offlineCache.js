// Simple offline cache using localStorage. Keeps last 20 routes.
const KEY = 'raasta_offline_routes_v1';

function readAll() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(obj) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {}
}

export function cacheRoute(route) {
  if (!route || !route.share_code) return;
  const all = readAll();
  all[route.share_code] = { ...route, _cached_at: Date.now() };
  // trim to last 20
  const entries = Object.entries(all).sort((a, b) => (b[1]._cached_at || 0) - (a[1]._cached_at || 0));
  const trimmed = Object.fromEntries(entries.slice(0, 20));
  writeAll(trimmed);
}

export function getCachedRoute(share_code) {
  const all = readAll();
  return all[share_code] || null;
}

export function listCached() {
  return Object.values(readAll()).sort((a, b) => (b._cached_at || 0) - (a._cached_at || 0));
}
