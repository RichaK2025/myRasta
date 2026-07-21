// Single source of truth for the group/private/selected-people visibility
// cases layered on top of the existing public/private is_public flag. Every
// existing public-feed query in this app (Explore, /api/community,
// /api/search, /api/routes/[id]/nearby, /api/recommendations,
// /api/leaderboards, /api/stats) only ever checks `is_public: true`, which
// stays in sync with `visibility` — none of them need to know about this
// file at all.
export const VISIBILITY_OPTIONS = ['public', 'group', 'private', 'selected'];

// Temporary sharing is checked lazily at read time, never TTL-deleted — the
// route itself must survive a share expiring, only the viewer's access to
// it should revert.
export function isShareExpired(route) {
  if (!route?.share_expires_at) return false;
  return new Date(route.share_expires_at).getTime() < Date.now();
}

// Can `viewerId` (a member of `viewerGroupIds`) see this route, beyond the
// already-handled public case?
export function canView(route, viewerId, viewerGroupIds = []) {
  if (!route) return false;
  if (route.user_id === viewerId) return true; // owner always sees their own
  if (isShareExpired(route)) return false;
  if (route.visibility === 'public') return true;
  if (route.visibility === 'group') {
    return (route.visible_group_ids || []).some((g) => viewerGroupIds.includes(g));
  }
  if (route.visibility === 'selected') {
    return (route.visible_user_ids || []).includes(viewerId);
  }
  return false; // 'private' or unset
}

// Resolves the request body's `expires_in` ('today' | '24h' | 'trip' | null)
// to a concrete `share_expires_at` ISO timestamp, or null for permanent.
// 'trip' resolves to null here — "this trip only" is handled by Live Trip
// Sharing ending, not by an expiry on the saved route itself.
export function resolveShareExpiry(expiresIn) {
  if (expiresIn === '24h') return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  if (expiresIn === 'today') {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.toISOString();
  }
  return null; // 'permanent' | 'trip' | null
}
