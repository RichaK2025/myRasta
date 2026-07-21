// Tag-overlap similarity (0-1), used to rank nearby/related routes and to
// personalize the feed against a user's preferred tags.
export function jaccard(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
