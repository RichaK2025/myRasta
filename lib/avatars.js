// Built-in avatars: no image uploads, no image bytes anywhere — just an
// `avatarId` string stored on the user, resolved to an emoji + color here.
export const AVATARS = [
  { id: 'avatar_01', emoji: '🚗', color: '#0ea5e9' },
  { id: 'avatar_02', emoji: '🏍', color: '#f97316' },
  { id: 'avatar_03', emoji: '🚴', color: '#22c55e' },
  { id: 'avatar_04', emoji: '🚶', color: '#a855f7' },
  { id: 'avatar_05', emoji: '🚚', color: '#eab308' },
  { id: 'avatar_06', emoji: '🧭', color: '#ef4444' },
  { id: 'avatar_07', emoji: '🌄', color: '#14b8a6' },
  { id: 'avatar_08', emoji: '🛕', color: '#f59e0b' },
  { id: 'avatar_09', emoji: '☕', color: '#78716c' },
  { id: 'avatar_10', emoji: '📸', color: '#ec4899' },
  { id: 'avatar_11', emoji: '🌧', color: '#3b82f6' },
  { id: 'avatar_12', emoji: '🗺', color: '#8b5cf6' },
  { id: 'avatar_13', emoji: '⛺', color: '#84cc16' },
  { id: 'avatar_14', emoji: '👨‍👩‍👧', color: '#f472b6' },
  { id: 'avatar_15', emoji: '🏔', color: '#06b6d4' },
  { id: 'avatar_16', emoji: '🐾', color: '#d97706' },
];

export function resolveAvatar(avatarId) {
  return AVATARS.find((a) => a.id === avatarId) || AVATARS[0];
}
