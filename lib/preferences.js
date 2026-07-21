const STORAGE_KEYS = {
  units: 'raasta_units',
  mapStyle: 'raasta_map_style',
  accuracy: 'raasta_accuracy_profile',
  autoPause: 'raasta_auto_pause',
  voiceCues: 'raasta_voice_cues',
  syncEnabled: 'raasta_sync_enabled',
  routeDraft: 'raasta_route_draft_v1',
  profile: 'raasta_profile_v1',
};

export const DEFAULT_SETTINGS = {
  units: 'metric',
  mapStyle: 'standard',
  accuracy: 'balanced',
  autoPause: true,
  voiceCues: false,
  syncEnabled: true,
  // Pin categories the user doesn't want to see in the "Add Pin" picker or
  // hear about in Smart Route Alerts. Empty = every category enabled.
  disabledPinCategories: [],
};

export function getSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem('raasta_settings_v1');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next) {
  if (typeof window === 'undefined') return;
  const current = getSettings();
  const merged = { ...current, ...next };
  localStorage.setItem('raasta_settings_v1', JSON.stringify(merged));
  return merged;
}

export function readRouteDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.routeDraft);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveRouteDraft(state) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.routeDraft, JSON.stringify(state));
}

export function clearRouteDraft() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.routeDraft);
}

// Anonymous-user equivalent of the signed-in profile fields (PATCH
// /api/auth/profile) — same fields, same localStorage-mirroring pattern as
// every other anon preference here.
const DEFAULT_PROFILE = { dob: null, gender: null, home_city: null, interest_tags: [], avatar_id: 'avatar_01' };

export function getLocalProfile() {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveLocalProfile(next) {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  const merged = { ...getLocalProfile(), ...next };
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(merged));
  return merged;
}

export function getAccuracyProfile(profile) {
  switch (profile) {
    case 'high':
      return { enableHighAccuracy: true, maximumAge: 500, timeout: 10000, intervalMs: 1000 };
    case 'battery':
      return { enableHighAccuracy: false, maximumAge: 10000, timeout: 20000, intervalMs: 10000 };
    case 'balanced':
    default:
      return { enableHighAccuracy: false, maximumAge: 2000, timeout: 15000, intervalMs: 3000 };
  }
}
