// Levels and badges are both computed on read from existing aggregate
// counts — nothing stored, nothing to keep in sync or go stale.
export const LEVELS = [
  { key: 'explorer', label: 'Explorer', minScore: 0 },
  { key: 'navigator', label: 'Navigator', minScore: 10 },
  { key: 'local_guide', label: 'Local Guide', minScore: 30 },
  { key: 'route_master', label: 'Route Master', minScore: 75 },
];

export function getLevel(stats) {
  const score = (stats.routesShared || 0) * 3 + (stats.verificationsGiven || 0) * 2 + (stats.follows || 0) * 1;
  let level = LEVELS[0];
  for (const l of LEVELS) if (score >= l.minScore) level = l;
  return { ...level, score };
}

export const BADGES = [
  { key: 'route_master', label: 'Route Master', icon: '🏆', check: (s) => (s.routesShared || 0) >= 10 },
  { key: 'scenic_expert', label: 'Scenic Expert', icon: '🌄', check: (s) => (s.scenicRoutes || 0) >= 3 },
  { key: 'food_hunter', label: 'Food Hunter', icon: '☕', check: (s) => (s.foodNotes || 0) >= 3 },
  { key: 'pilgrimage_expert', label: 'Pilgrimage Expert', icon: '🛕', check: (s) => (s.pilgrimageRoutes || 0) >= 3 },
  { key: 'monsoon_reporter', label: 'Monsoon Reporter', icon: '🌧', check: (s) => (s.monsoonRoutes || 0) >= 3 },
  { key: 'safety_reporter', label: 'Safety Reporter', icon: '👮', check: (s) => (s.alertsReported || 0) >= 3 },
];

export function getBadges(stats) {
  return BADGES.filter((b) => b.check(stats));
}
