// Weighted popularity score, recomputed and stored whenever an action that
// feeds it already writes to the route doc (verify/follow/like) — one more
// field in an update that's already happening, not a new write. Read
// directly by Explore's "Popular" sort and Leaderboards instead of computing
// a weighted score per request.
export function computePopularityScore({ views = 0, likes = 0, verified_count = 0, follower_count = 0 }) {
  return views * 1 + likes * 3 + verified_count * 5 + follower_count * 4;
}

export async function recomputePopularityScore(db, routeId) {
  const route = await db.collection('routes').findOne(
    { id: routeId },
    { projection: { views: 1, likes: 1, verified_count: 1, follower_count: 1 } }
  );
  if (!route) return;
  const popularity_score = computePopularityScore(route);
  await db.collection('routes').updateOne({ id: routeId }, { $set: { popularity_score } });
  return popularity_score;
}
