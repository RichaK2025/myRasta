// Community Alerts: a generic, extensible layer for temporary crowd-reported
// conditions on the road. Only the policing-related types are reportable
// today; the rest are reserved so future categories (accidents, flooding,
// construction, closures, traffic) slot into the same collection/API/UI
// without a schema change.
export const ALERT_TYPES = [
  { key: 'police_checking', label: 'Police checking ahead', icon: '👮', voice: 'a police checking point' },
  { key: 'speed_monitoring', label: 'Speed monitoring zone', icon: '🚔', voice: 'a speed monitoring zone' },
  { key: 'document_checking', label: 'Document checking point', icon: '📄', voice: 'a document checking point' },
  { key: 'truck_inspection', label: 'Truck inspection point', icon: '🚛', voice: 'a truck inspection point' },
  { key: 'checkpoint', label: 'Temporary checkpoint', icon: '🚨', voice: 'a temporary checkpoint' },
];

// Not yet reportable via the UI — reserved for the generic Community Alert
// system this is designed to grow into.
export const FUTURE_ALERT_TYPES = ['accident', 'flooding', 'construction', 'closure', 'heavy_traffic'];

export const ALERT_EXPIRY_HOURS = 4;

export function resolveAlertType(key) {
  return ALERT_TYPES.find((t) => t.key === key) || null;
}

// 🟢 Recently confirmed / 🟡 Possibly outdated / ⚪ Expired, based on how far
// through its expiry window the alert is.
export function alertConfidence(createdAt, expiresAt) {
  const created = new Date(createdAt).getTime();
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  if (now >= expires) return { key: 'expired', icon: '⚪', label: 'Expired' };
  const elapsedFraction = (now - created) / (expires - created);
  if (elapsedFraction < 0.33) return { key: 'fresh', icon: '🟢', label: 'Recently confirmed' };
  return { key: 'stale', icon: '🟡', label: 'Possibly outdated' };
}

export function formatReportedAgo(createdAt) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}
