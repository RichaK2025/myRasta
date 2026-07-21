// Plain Levenshtein edit distance, no dependency. Used as a fallback ranking
// pass when a direct substring search comes up short — cheap because it only
// ever runs over a small, already-bounded candidate set, never the whole
// collection.
export function levenshtein(a, b) {
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

// True if `query` is within a typo-tolerant edit-distance of `text` (checked
// against whole words, not the full string, so a typo in one word of a
// longer name/tag still matches). Threshold scales with query length so
// short queries don't match everything.
export function fuzzyIncludes(text, query) {
  if (!text || !query) return false;
  const q = query.toLowerCase();
  const threshold = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
  const words = String(text).toLowerCase().split(/\s+/);
  return words.some((w) => levenshtein(w, q) <= threshold);
}
