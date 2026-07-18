import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// `fetch(url).then(r => r.json())` treats a 503/500 the same as a 200 — the
// body still parses fine, it's just `{ error: '...' }` instead of the array
// the caller expects, which crashes downstream .map/.reduce/.slice calls
// instead of triggering the caller's .catch() fallback. This throws on a
// non-2xx response so existing .catch(...) handlers actually fire.
export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
  return res.json();
}
