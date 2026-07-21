// Best-effort PWA install helpers. Raasta is a web app (manifest.json +
// service worker), not a native/store-distributed app — there's no reliable
// way to detect "is this installed somewhere on this device" from a plain
// browser tab, and no OS-level custom-scheme/App-Links/Universal-Links deep
// linking without a native or TWA-packaged app. What *is* achievable: detect
// whether the current tab is already running as the installed PWA, offer a
// real one-tap install where the browser supports it, and best-effort resume
// the shared route right after install.

const PENDING_ROUTE_KEY = 'raasta_pending_route';
const INSTALL_DISMISSED_KEY = 'raasta_install_dismissed';

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true;
}

export function wasInstallDismissed() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
}

export function dismissInstallScreen() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
}

export function setPendingRoute(code) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_ROUTE_KEY, code);
}

export function consumePendingRoute() {
  if (typeof window === 'undefined') return null;
  const code = localStorage.getItem(PENDING_ROUTE_KEY);
  if (code) localStorage.removeItem(PENDING_ROUTE_KEY);
  return code;
}

// The `beforeinstallprompt` event fires once, early, and must be captured
// and stashed — by the time a user taps "Install," the event is long gone if
// we didn't hold onto it. `lib/installPromptStore.js` holds the single
// captured event; this just wraps calling it.
let capturedEvent = null;

export function captureInstallPrompt(event) {
  event.preventDefault();
  capturedEvent = event;
}

export function canPromptInstall() {
  return !!capturedEvent;
}

export async function promptInstall() {
  if (!capturedEvent) return { outcome: 'unavailable' };
  capturedEvent.prompt();
  const result = await capturedEvent.userChoice;
  capturedEvent = null;
  return result;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
