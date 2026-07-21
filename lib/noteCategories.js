// Single source of truth for local-pin categories, shared by the Record
// screen's one-tap "Add Pin" flow, the route_notes map markers, and Follow
// Mode's Smart Route Alerts narration.
// alertStyle drives Smart Route Alerts phrasing: 'hazard' -> "X reported
// ahead", 'scenic' -> "X approaching", 'amenity' (default) -> "X ahead in
// {distance}".
export const NOTE_CATEGORIES = [
  { key: 'tea_stall', label: 'Tea Stall', icon: '☕', color: '#78716c', alertStyle: 'amenity' },
  { key: 'food', label: 'Food', icon: '🍲', color: '#f97316', alertStyle: 'amenity' },
  { key: 'petrol', label: 'Petrol', icon: '⛽', color: '#0891b2', alertStyle: 'amenity' },
  { key: 'mechanic', label: 'Mechanic', icon: '🔧', color: '#6b7280', alertStyle: 'amenity' },
  { key: 'washroom', label: 'Washroom', icon: '🚻', color: '#3b82f6', alertStyle: 'amenity' },
  { key: 'pothole', label: 'Pothole', icon: '⚠️', color: '#d97706', alertStyle: 'hazard' },
  { key: 'construction', label: 'Construction', icon: '🚧', color: '#f59e0b', alertStyle: 'hazard' },
  { key: 'scenic_view', label: 'Scenic View', icon: '🌄', color: '#14b8a6', alertStyle: 'scenic' },
  { key: 'sunset_point', label: 'Sunset Point', icon: '🌅', color: '#fb923c', alertStyle: 'scenic' },
  { key: 'network_dead_zone', label: 'Network Dead Zone', icon: '📶', color: '#64748b', alertStyle: 'hazard' },
  { key: 'police_checkpoint', label: 'Police Checkpoint', icon: '🚓', color: '#1d4ed8', alertStyle: 'hazard' },
  { key: 'parking', label: 'Parking', icon: '🅿️', color: '#0ea5e9', alertStyle: 'amenity' },
  { key: 'water_source', label: 'Water Source', icon: '💧', color: '#0284c7', alertStyle: 'amenity' },
  { key: 'campsite', label: 'Campsite', icon: '🏕️', color: '#65a30d', alertStyle: 'amenity' },
  { key: 'hospital', label: 'Hospital', icon: '🏥', color: '#dc2626', alertStyle: 'amenity' },
  { key: 'women_safe_stop', label: 'Women Safe Stop', icon: '👩', color: '#ec4899', alertStyle: 'amenity' },
  { key: 'ev_charging', label: 'EV Charging', icon: '🔌', color: '#22c55e', alertStyle: 'amenity' },
  { key: 'other', label: 'Other', icon: '❓', color: '#a3a3a3', alertStyle: 'amenity' },
];

// Old route_notes categories (tea/food/fuel/washroom/police/danger/safe/
// scenic/shortcut/warning) -> their closest match above. No DB migration —
// old docs keep their original `category` string forever; this alias map is
// only consulted at render/lookup time.
export const LEGACY_CATEGORY_ALIASES = {
  tea: 'tea_stall',
  fuel: 'petrol',
  police: 'police_checkpoint',
  danger: 'pothole',
  safe: 'women_safe_stop',
  scenic: 'scenic_view',
  warning: 'construction',
  shortcut: 'other',
};

export function resolveCategoryConfig(rawKey) {
  return (
    NOTE_CATEGORIES.find((c) => c.key === rawKey) ||
    NOTE_CATEGORIES.find((c) => c.key === LEGACY_CATEGORY_ALIASES[rawKey]) ||
    NOTE_CATEGORIES[NOTE_CATEGORIES.length - 1] // 'Other' fallback
  );
}

// Smart Route Alerts phrasing — "Tea stall ahead in 500m" / "Scenic
// viewpoint approaching" / "Road damage reported ahead", per the category's
// alertStyle.
export function buildAlertPhrase(rawKey, distanceKm) {
  const cfg = resolveCategoryConfig(rawKey);
  const distanceText = distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`;
  if (cfg.alertStyle === 'hazard') return `${cfg.label} reported ahead.`;
  if (cfg.alertStyle === 'scenic') return `${cfg.label} approaching.`;
  return `${cfg.label} ahead in ${distanceText}.`;
}
