// Lightweight, best-effort profanity/abuse filter — a short curated list per
// language, not a comprehensive moderation system. Sourcing an authoritative
// profanity dictionary per language responsibly is a specialized
// localization task; this catches unambiguous, severe terms only, checked as
// one combined pass since the language of any given piece of text isn't
// known in advance.
export const MODERATION_MESSAGE = 'Please use respectful language.';

const BANNED_WORDS = {
  en: ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'nigger', 'faggot', 'whore', 'slut'],
  hi: ['chutiya', 'madarchod', 'behenchod', 'randi', 'gandu', 'harami', 'kutta', 'saala'],
  bn: ['magi', 'khanki', 'shala', 'chodon'],
  ta: ['punda', 'thevidiya', 'ommala'],
  te: ['lanja', 'pooku', 'dengey'],
  pa: ['kutteh', 'harami', 'saala'],
  ar: ['kafir', 'kalb', 'sharmuta'],
  es: ['puta', 'mierda', 'cabron', 'joder', 'pendejo'],
  fr: ['merde', 'pute', 'connard', 'salope'],
  zh: ['gou', 'biao', 'wangba'],
  ru: ['blyad', 'suka', 'pizdec'],
  pt: ['puta', 'merda', 'caralho', 'foda'],
  de: ['scheisse', 'arschloch', 'hure', 'fotze'],
};

const ALL_BANNED = new Set(Object.values(BANNED_WORDS).flat());

// Common evasions: leetspeak substitutions and stripped punctuation/diacritics.
// Diacritics are stripped via the ̀-ͯ combining-marks range left
// over after NFD decomposition (e.g. "é" -> "e" + a combining acute accent).
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[.,!?;:'"()[\]{}]/g, ' '); // drop punctuation only — keep all scripts intact
}

export function containsProfanity(text) {
  if (!text) return false;
  const normalized = normalize(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (ALL_BANNED.has(word)) return true;
  }
  // Also check as a substring pass for non-space-delimited scripts (e.g. no
  // spaces around the term, or compound words) — bounded to short banned
  // terms already, so this stays cheap.
  for (const banned of ALL_BANNED) {
    if (normalized.includes(banned)) return true;
  }
  return false;
}
