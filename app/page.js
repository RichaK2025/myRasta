'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  MapPin, Play, Pause, Square, ChevronLeft, Share2, Copy, MessageCircle,
  Route as RouteIcon, Compass, Search, Heart, Eye, Clock, Gauge, Sparkles,
  Bookmark, Check, X, Loader2, Star, AlertTriangle, TrendingUp, Flame, WifiOff, Send,
  Zap, Info, CloudRain, Construction, ShieldCheck, Coffee, Utensils, Fuel, Bath, Shield,
  Camera, Mountain, Church, Baby, Bike, Truck, User, Home as HomeIcon, Library as LibraryIcon,
  MapPinned, ThumbsUp, ThumbsDown, Users, Sun, Moon, Monitor, Settings, Umbrella, Pencil, ChevronDown,
  Wrench, Sunset, CircleParking, Droplet, Tent, HeartPulse, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { totalDistance, haversine, formatDuration, formatDistance } from '@/lib/geo';
import Link from 'next/link';
import { getSpeedZoneColor } from '@/lib/mapProvider';
import { cacheRoute, listCached } from '@/lib/offlineCache';
import { getSettings, saveSettings, readRouteDraft, saveRouteDraft, clearRouteDraft, getAccuracyProfile, getLocalProfile, saveLocalProfile } from '@/lib/preferences';
import { AVATARS } from '@/lib/avatars';
import { LEGACY_CATEGORY_ALIASES, NOTE_CATEGORIES as PIN_CATEGORIES, resolveCategoryConfig } from '@/lib/noteCategories';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/useAuth';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { fetchJson } from '@/lib/utils';
import { SILENT_AUDIO_SRC } from '@/lib/silentAudio';
import { fetchRoutedPath } from '@/lib/routing';
import { RouteCard } from '@/components/RouteCard';
import { SocialProofStrip } from '@/components/SocialProofStrip';
import { FollowButton } from '@/components/FollowButton';
import { ALERT_TYPES } from '@/lib/alertTypes';
import { VERIFY_AXIS_LABELS } from '@/lib/verification';
import { fuzzyIncludes } from '@/lib/fuzzy';
import { AlertsSection } from '@/components/AlertsSection';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

// If a paused recording drifts more than this far from where it was paused
// (found either by low-frequency polling while paused, or at the first GPS
// fix after tapping Resume), it's treated as "significant" — the user is
// asked whether to reconstruct the gap via the routing engine rather than
// silently leaving a straight line across it.
const SIGNIFICANT_MOVEMENT_METERS = 100;
// How often to check location while paused. A single low-accuracy fix, not a
// continuous watch, to keep this battery-cheap.
const PAUSE_POLL_INTERVAL_MS = 30000;
// Displacement between two consecutive low-frequency pause polls that reads
// as sustained travel (vs. GPS drift while stationary) — triggers the
// "resume recording?" nudge.
const AUTO_RESUME_NUDGE_METERS = 40;
// Auto-Pause: how long without a fix passing the live movement filter before
// recording pauses itself, and how often that's checked.
const AUTO_PAUSE_STATIONARY_MS = 60000;
const STATIONARY_CHECK_INTERVAL_MS = 5000;

const TAGS = [
  'Fastest', 'Scenic', 'Family Friendly', 'Women Safe', 'Bike Route',
  'Truck Friendly', 'Pilgrimage', 'Rain Safe', 'Monsoon Safe', 'Avoid Traffic',
  'Village Route', 'Adventure', 'Hidden Gems',
];
const ROUTE_TYPES = ['Commute', 'Road Trip', 'Bike Ride', 'Walk', 'Village', 'Delivery', 'Pilgrimage'];

const INTEREST_TAGS = [
  '🏍 Rider', '🌄 Adventurous Explorer', '🏙 City Explorer', '🛕 Pilgrimage Traveller',
  '☕ Food Explorer', '🚚 Truck Driver', '👨‍👩‍👧 Family Traveller', '📸 Photographer',
  '🌧 Monsoon Explorer', '🚶 Walker', '🚴 Cyclist', '🧭 Route Tracker',
];

const CONDITION_TYPES = [
  { key: 'pothole', label: 'Pothole', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'flooding', label: 'Flooding', icon: CloudRain, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'traffic', label: 'Traffic', icon: Zap, color: 'text-red-700 bg-red-50 border-red-200' },
  { key: 'roadblock', label: 'Roadblock', icon: Construction, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'closure', label: 'Closure', icon: X, color: 'text-neutral-800 bg-neutral-100 border-neutral-200' },
  { key: 'info', label: 'Info', icon: Info, color: 'text-neutral-700 bg-neutral-50 border-neutral-200' },
];

const NOTE_CATEGORIES = [
  { key: 'tea_stall', label: 'Tea Stall', icon: Coffee, color: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-600' },
  { key: 'food', label: 'Food', icon: Utensils, color: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-500' },
  { key: 'petrol', label: 'Petrol', icon: Fuel, color: 'bg-cyan-50 border-cyan-200 text-cyan-800', dot: 'bg-cyan-600' },
  { key: 'mechanic', label: 'Mechanic', icon: Wrench, color: 'bg-neutral-100 border-neutral-300 text-neutral-800', dot: 'bg-neutral-600' },
  { key: 'washroom', label: 'Washroom', icon: Bath, color: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-600' },
  { key: 'pothole', label: 'Pothole', icon: AlertTriangle, color: 'bg-amber-50 border-amber-200 text-amber-900', dot: 'bg-amber-700' },
  { key: 'construction', label: 'Construction', icon: Construction, color: 'bg-orange-50 border-orange-200 text-orange-900', dot: 'bg-orange-600' },
  { key: 'scenic_view', label: 'Scenic View', icon: Mountain, color: 'bg-violet-50 border-violet-200 text-violet-800', dot: 'bg-violet-600' },
  { key: 'sunset_point', label: 'Sunset Point', icon: Sunset, color: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-500' },
  { key: 'network_dead_zone', label: 'Network Dead Zone', icon: WifiOff, color: 'bg-neutral-100 border-neutral-300 text-neutral-700', dot: 'bg-neutral-500' },
  { key: 'police_checkpoint', label: 'Police Checkpoint', icon: Shield, color: 'bg-indigo-50 border-indigo-200 text-indigo-800', dot: 'bg-indigo-600' },
  { key: 'parking', label: 'Parking', icon: CircleParking, color: 'bg-sky-50 border-sky-200 text-sky-800', dot: 'bg-sky-600' },
  { key: 'water_source', label: 'Water Source', icon: Droplet, color: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
  { key: 'campsite', label: 'Campsite', icon: Tent, color: 'bg-lime-50 border-lime-200 text-lime-800', dot: 'bg-lime-600' },
  { key: 'hospital', label: 'Hospital', icon: HeartPulse, color: 'bg-red-50 border-red-200 text-red-800', dot: 'bg-red-600' },
  { key: 'women_safe_stop', label: 'Women Safe Stop', icon: ShieldCheck, color: 'bg-pink-50 border-pink-200 text-pink-800', dot: 'bg-pink-600' },
  { key: 'ev_charging', label: 'EV Charging', icon: Zap, color: 'bg-green-50 border-green-200 text-green-800', dot: 'bg-green-600' },
  { key: 'other', label: 'Other', icon: HelpCircle, color: 'bg-neutral-100 border-neutral-300 text-neutral-700', dot: 'bg-neutral-500' },
];

const EXPLORE_CATEGORIES = [
  { key: 'trending', label: 'Trending', icon: TrendingUp },
  { key: 'popular', label: 'Popular', icon: Flame },
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'nearby', label: 'Nearby', icon: MapPin },
  { key: 'Scenic', label: 'Scenic', icon: Mountain },
  { key: 'Women Safe', label: 'Women Safe', icon: ShieldCheck },
  { key: 'Family Friendly', label: 'Family', icon: Baby },
  { key: 'Pilgrimage', label: 'Pilgrimage', icon: Church },
  { key: 'Rain Safe', label: 'Rain Safe', icon: Umbrella },
  { key: 'Bike Route', label: 'Bike', icon: Bike },
];

function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// ============= SPLASH =============
function Splash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-neutral-950 z-50"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }} className="flex flex-col items-center"
      >
        <div className="h-20 w-20 rounded-3xl bg-neutral-900 flex items-center justify-center shadow-2xl">
          <RouteIcon className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        <motion.h1 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-6 text-3xl font-semibold tracking-tight">Raasta</motion.h1>
        <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Navigate Like A Local.</motion.p>
      </motion.div>
    </motion.div>
  );
}

// ============= BOTTOM NAV =============
function BottomNav({ active, onNav }) {
  const items = [
    { key: 'home', label: 'Home', icon: HomeIcon },
    { key: 'explore', label: 'Explore', icon: Compass },
    { key: 'record', label: 'Record', icon: Play, primary: true },
    { key: 'my', label: 'Library', icon: LibraryIcon },
    { key: 'profile', label: 'Profile', icon: User },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-md mx-auto px-4 pb-4 pointer-events-auto">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-2xl shadow-neutral-900/10 px-2 py-2">
          <div className="grid grid-cols-5">
            {items.map((it) => {
              const Icon = it.icon;
              const isActive = active === it.key;
              if (it.primary) {
                return (
                  <button key={it.key} onClick={() => onNav(it.key)} className="flex flex-col items-center justify-center py-1">
                    <div className="h-11 w-11 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shadow-lg">
                      <Icon className="h-5 w-5" fill="currentColor" />
                    </div>
                    <span className="text-[10px] mt-1 font-medium">{it.label}</span>
                  </button>
                );
              }
              return (
                <button key={it.key} onClick={() => onNav(it.key)}
                  className={`flex flex-col items-center justify-center py-2 ${isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  <Icon className="h-5 w-5" />
                  <span className={`text-[10px] mt-1 ${isActive ? 'font-semibold' : 'font-normal'}`}>{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= HOME =============
// Live Trip Sharing viewer — "Rahul is currently travelling," from the
// live_trips status pointer (current position only, never a track).
function LiveTripsSection({ user }) {
  const [trips, setTrips] = useState([]);
  useEffect(() => {
    if (!user?.uid) return;
    // Membership is resolved server-side — no need to fetch groups first.
    fetchJson(`/api/live-trips?viewer_id=${user.uid}`).then(setTrips).catch(() => setTrips([]));
  }, [user]);
  if (trips.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {trips.map((t) => (
        <div key={t.user_id} className="flex items-center gap-2 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <p className="text-sm">{t.name} is currently travelling.</p>
        </div>
      ))}
    </div>
  );
}

function Home({ onNav, user }) {
  const [myRoutes, setMyRoutes] = useState([]);
  const [trending, setTrending] = useState([]);
  const online = useOnlineStatus();

  useEffect(() => {
    if (!user) return;
    if (!online) { setMyRoutes(listCached()); return; }
    fetchJson(`/api/routes?user_id=${user.uid}`).then(setMyRoutes).catch(() => setMyRoutes(listCached()));
    fetchJson(`/api/routes?sort=trending`).then(setTrending).catch(() => {});
  }, [user, online]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28">
      <div className="px-6 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Hi {user?.name?.split(' ')[0] || 'there'} 👋</p>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">Navigate<br /><span className="text-neutral-400 dark:text-neutral-500">Like A Local.</span></h1>
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3 leading-relaxed max-w-[85%]">
          Google Maps gives directions. Raasta gives recommendations — from real people who know the road.
        </p>
        {!online && (
          <div className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 px-4 py-2.5 flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-700 dark:text-amber-500" />
            <p className="text-xs text-amber-800 dark:text-amber-400">You’re offline. Showing cached routes.</p>
          </div>
        )}
      </div>

      <div className="px-6">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => onNav('record')}
          className="w-full rounded-3xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 p-6 flex items-center justify-between shadow-xl shadow-neutral-900/10">
          <div className="text-left">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Start new</p>
            <h2 className="text-2xl font-semibold mt-1">Record Route</h2>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">Trace your journey with GPS</p>
          </div>
          <div className="h-14 w-14 rounded-full bg-white/10 dark:bg-neutral-900/10 flex items-center justify-center">
            <Play className="h-6 w-6" fill="currentColor" />
          </div>
        </motion.button>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onNav('my')}
            className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-5 text-left">
            <Bookmark className="h-5 w-5 mb-3" />
            <p className="text-sm font-medium">My Library</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{myRoutes.length} saved</p>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onNav('explore')}
            className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-5 text-left">
            <Compass className="h-5 w-5 mb-3" />
            <p className="text-sm font-medium">Explore</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Community routes</p>
          </motion.button>
        </div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={() => onNav('plan')}
          className="w-full mt-3 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-4 flex items-center justify-between text-left">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Plan a Trip</p>
            <p className="text-sm font-semibold mt-1">Get route recommendations for a destination</p>
          </div>
          <Search className="h-5 w-5 text-neutral-400" />
        </motion.button>

        <div className="mt-3 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Community</p>
              <p className="text-sm font-semibold mt-1">View public routes from everyone</p>
            </div>
            <Link href="/community" className="text-sm font-medium text-neutral-900 dark:text-white">Open feed</Link>
          </div>
        </div>

        <div className="mt-4">
          <SocialProofStrip />
        </div>
        <LiveTripsSection user={user} />

        {trending.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Trending routes</h3>
              </div>
              <button onClick={() => onNav('explore')} className="text-xs text-neutral-500 dark:text-neutral-400">See all</button>
            </div>
            <div className="space-y-3">
              {trending.slice(0, 3).map((r) => (
                <RouteCard key={r.id} route={r} onOpen={() => onNav('detail', r.id)} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Your recent routes</h3>
            {myRoutes.length > 0 && (
              <button onClick={() => onNav('my')} className="text-xs text-neutral-500 dark:text-neutral-400">See all</button>
            )}
          </div>
          {myRoutes.length === 0 ? (
            <div className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-700 p-8 text-center">
              <MapPin className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-600" />
              <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">No routes yet</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Record your first journey to share the local way.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRoutes.slice(0, 3).map((r) => (
                <RouteCard key={r.id} route={r} onOpen={() => onNav('detail', r.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= ROUTE CARD =============
// ============= RECORD =============
function Record({ user, onBack, onDone }) {
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(getSettings());
  const [waypoints, setWaypoints] = useState([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlertPicker, setShowAlertPicker] = useState(false);
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [liveSharing, setLiveSharing] = useState(false);
  const liveShareIntervalRef = useRef(null);
  const [stopPrompt, setStopPrompt] = useState(null); // {lat,lng} when Auto-Pause suggests "Were you stopping here?"
  const [reportingAlert, setReportingAlert] = useState(false);
  const watchIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const keepAliveAudioRef = useRef(null);
  // Set right before a resume's watchPosition restarts, to the last point
  // recorded before the pause. The first GPS fix that comes back is checked
  // against it once, then cleared, so we only ever try to bridge the gap
  // immediately after a resume — not on every subsequent point.
  const resumeAnchorRef = useRef(null);
  // The point recording was paused at, and the low-freq poll interval that
  // watches for movement while paused (smart pause recovery).
  const pausedAtRef = useRef(null);
  const lastPausePollRef = useRef(null);
  const pauseWatchIntervalRef = useRef(null);
  const nudgeShownRef = useRef(false);
  // Auto-Pause: timestamp of the last fix that passed the live movement
  // filter, checked on an interval while recording; true when the current
  // pause was triggered by stationarity rather than a manual tap, so the
  // resume side knows whether to ask first or just resume automatically.
  const lastMovementAtRef = useRef(null);
  const lastMovementPointRef = useRef(null); // where the stationary period actually started — used for the "Were you stopping here?" prompt
  const stationaryCheckIntervalRef = useRef(null);
  const autoPausedRef = useRef(false);
  // { from, to, distanceMeters, alreadyAppended } when significant movement
  // is detected — `alreadyAppended` distinguishes a gap caught live (the new
  // point is already in `points`) from one caught by the pause-time poll
  // (the probe point was never recorded).
  const [recoveryPrompt, setRecoveryPrompt] = useState(null);
  // The pause-poll interval is only (re-)armed once per pause, so the
  // "Resume" action inside its auto-nudge toast would otherwise call a
  // `startRecording` closure frozen at pause-start time. Route through a
  // ref that's refreshed every render instead, so it always resumes off the
  // current `points` (e.g. if a recovery was applied mid-pause).
  const latestStartRecordingRef = useRef(null);
  // Same staleness concern for the stationary-check interval below, which is
  // also armed once (at recording-start time) and calls pauseRecording much
  // later, off whatever `points` looked like at arm-time otherwise.
  const latestPauseRecordingRef = useRef(null);
  const distanceKm = useMemo(() => totalDistance(points), [points]);
  const routeStats = useMemo(() => ({
    distance_km: distanceKm,
    duration_sec: elapsed,
    avg_speed_kmh: elapsed > 0 ? (distanceKm / (elapsed / 3600)) : 0,
    max_speed_kmh: maxSpeed,
    waypoint_count: waypoints.length,
  }), [distanceKm, elapsed, maxSpeed, waypoints.length]);

  useEffect(() => {
    const draft = readRouteDraft();
    if (draft?.points?.length) {
      setPoints(draft.points);
      setElapsed(draft.elapsed || 0);
      setCurrentSpeed(draft.currentSpeed || 0);
      setMaxSpeed(draft.maxSpeed || 0);
      setWaypoints(draft.waypoints || []);
      setStatus('paused');
      startPauseMonitoring(draft.points[draft.points.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    stopPauseMonitoring();
    releaseWakeLock();
    stopKeepAliveAudio();
    // Ref check (not the `liveSharing` state, which would be stale here —
    // this cleanup's closure is fixed at mount time) so an unmount mid-live-share
    // still stops it instead of leaving a stale "is travelling" status.
    if (liveShareIntervalRef.current) {
      clearInterval(liveShareIntervalRef.current);
      if (user?.uid) fetch(`/api/live-trips?user_id=${user.uid}`, { method: 'DELETE' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveRouteDraft({ points, elapsed, currentSpeed, maxSpeed, waypoints, status });
  }, [points, elapsed, currentSpeed, maxSpeed, waypoints, status]);

  // The Wake Lock API spec releases the lock automatically the moment the
  // page is hidden, so it only prevents the *screen from auto-locking due
  // to inactivity* while the tab is visible — it does not survive the user
  // actually switching apps. Re-request it every time the tab regains
  // visibility while still recording.
  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Refused (low battery, permissions, etc.) — recording still works,
      // the phone just might sleep and pause GPS updates sooner.
    }
  };
  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

  // Smart pause recovery: while paused, take a single low-accuracy fix every
  // PAUSE_POLL_INTERVAL_MS (not a continuous watch) to check whether the
  // user forgot to resume and kept moving. Cheap enough to not meaningfully
  // affect battery, but only reliable while the tab stays foregrounded —
  // like the wake lock above, background tabs can throttle/suspend timers.
  const pollWhilePaused = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp,
          speed: pos.coords.speed ?? 0, altitude: pos.coords.altitude ?? null, accuracy: pos.coords.accuracy };
        const anchor = pausedAtRef.current;
        if (!anchor) return;

        if (lastPausePollRef.current) {
          const stepMeters = haversine(lastPausePollRef.current, p) * 1000;
          if (stepMeters > AUTO_RESUME_NUDGE_METERS && !nudgeShownRef.current) {
            nudgeShownRef.current = true;
            if (autoPausedRef.current) {
              // This pause wasn't the user's choice — resuming shouldn't be either.
              toast('You appear to be moving again — resuming recording.');
              latestStartRecordingRef.current?.();
            } else {
              toast('You appear to be travelling again. Resume recording?', {
                action: { label: 'Resume', onClick: () => latestStartRecordingRef.current?.() },
                duration: 20000,
              });
            }
          }
        }
        lastPausePollRef.current = p;

        const distanceMeters = haversine(anchor, p) * 1000;
        setRecoveryPrompt((prev) => prev || (distanceMeters > SIGNIFICANT_MOVEMENT_METERS
          ? { from: anchor, to: p, distanceMeters, alreadyAppended: false }
          : prev));
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: PAUSE_POLL_INTERVAL_MS, timeout: 15000 }
    );
  };
  const startPauseMonitoring = (anchorPoint) => {
    pausedAtRef.current = anchorPoint || null;
    lastPausePollRef.current = null;
    nudgeShownRef.current = false;
    if (pauseWatchIntervalRef.current) clearInterval(pauseWatchIntervalRef.current);
    pauseWatchIntervalRef.current = setInterval(pollWhilePaused, PAUSE_POLL_INTERVAL_MS);
  };
  const stopPauseMonitoring = () => {
    if (pauseWatchIntervalRef.current) clearInterval(pauseWatchIntervalRef.current);
    pauseWatchIntervalRef.current = null;
    pausedAtRef.current = null;
  };

  const startKeepAliveAudio = () => {
    if (!keepAliveAudioRef.current) {
      const audio = new Audio(SILENT_AUDIO_SRC);
      audio.loop = true;
      audio.volume = 0.01; // near-silent, not fully 0 — some browsers only
      // exempt tabs from suspension when audio is actually audible.
      audio.setAttribute('playsinline', '');
      keepAliveAudioRef.current = audio;
    }
    keepAliveAudioRef.current.play().catch(() => {
      // Autoplay can be refused outside a user gesture — startRecording is
      // always triggered by a tap, so this should succeed in practice.
    });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Raasta — recording your route' });
      navigator.mediaSession.playbackState = 'playing';
    }
  };
  const stopKeepAliveAudio = () => {
    keepAliveAudioRef.current?.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  };

  // Detects backgrounding (tab hidden), and on return: re-acquires the wake
  // lock (auto-released while hidden) and tells the user if tracking was
  // likely interrupted for long enough to matter, instead of silently
  // producing a route with an unexplained gap.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        wakeLockRef.current = null; // already released by the browser
        if (status === 'recording') hiddenAtRef.current = Date.now();
      } else {
        if (hiddenAtRef.current != null) {
          const hiddenForSec = Math.round((Date.now() - hiddenAtRef.current) / 1000);
          hiddenAtRef.current = null;
          if (status === 'recording' && hiddenForSec >= 5) {
            toast.warning(`Tracking may have paused for ~${hiddenForSec}s while backgrounded.`);
          }
        }
        if (status === 'recording') requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [status]);

  const startRecording = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    setError(null); setStatus('recording');
    stopPauseMonitoring();
    requestWakeLock();
    startKeepAliveAudio();
    startTimeRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    // Only a resume (not the initial start) has prior points — arm the
    // anchor so the first fix we get back can be checked for a gap.
    resumeAnchorRef.current = points.length > 0 ? points[points.length - 1] : null;

    // Auto-Pause: (re)start the stationary clock fresh on every
    // start/resume, so a resume doesn't immediately look 60s-stationary
    // against a timestamp from before the pause.
    lastMovementAtRef.current = Date.now();
    setStopPrompt(null);
    if (stationaryCheckIntervalRef.current) clearInterval(stationaryCheckIntervalRef.current);
    stationaryCheckIntervalRef.current = setInterval(() => {
      if (getSettings().autoPause && Date.now() - lastMovementAtRef.current > AUTO_PAUSE_STATIONARY_MS) {
        toast('Recording paused because you appear to be stationary.');
        latestPauseRecordingRef.current?.(true);
        setStopPrompt((prev) => prev || lastMovementPointRef.current);
      }
    }, STATIONARY_CHECK_INTERVAL_MS);

    const profile = getAccuracyProfile(settings.accuracy);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp,
          speed: pos.coords.speed ?? 0, altitude: pos.coords.altitude ?? null, accuracy: pos.coords.accuracy };

        if (resumeAnchorRef.current) {
          const anchor = resumeAnchorRef.current;
          resumeAnchorRef.current = null; // only ever try this once per resume
          const gapMeters = haversine(anchor, p) * 1000;
          // Don't silently fix the gap — surface it so the user decides
          // (Recover route / Ignore movement). The point below is still
          // appended normally so live tracking never stalls on that choice.
          if (gapMeters > SIGNIFICANT_MOVEMENT_METERS) {
            setRecoveryPrompt((prev) => prev || { from: anchor, to: p, distanceMeters: gapMeters, alreadyAppended: true });
          }
        }

        setPoints((prev) => {
          if (prev.length === 0) return [p];
          const last = prev[prev.length - 1];
          const d = haversine(last, p);
          const movementMeters = d * 1000;
          const accuracyMeters = pos.coords.accuracy ?? 999;
          const speedKmh = (pos.coords.speed ?? 0) * 3.6;
          const dtSec = (p.timestamp - last.timestamp) / 1000;

          if (p.timestamp <= last.timestamp) return prev;
          if (movementMeters < 1) return prev;
          if (accuracyMeters > 40 && movementMeters < 8) return prev;

          const minDistanceMeters = Math.max(8, Math.min(25, accuracyMeters * 0.75));
          if (movementMeters < minDistanceMeters && speedKmh < 1.5) return prev;
          if (dtSec > 0 && (movementMeters / dtSec) * 3.6 > 220) return prev;
          lastMovementAtRef.current = Date.now(); // fed to the Auto-Pause stationary check below
          lastMovementPointRef.current = p;
          return [...prev, p];
        });
        const spd = (pos.coords.speed ?? 0) * 3.6;
        setCurrentSpeed(spd); setMaxSpeed((m) => Math.max(m, spd));
      },
      (err) => { setError(err.message); toast.error('Location error: ' + err.message); },
      { enableHighAccuracy: profile.enableHighAccuracy, maximumAge: profile.maximumAge, timeout: profile.timeout }
    );
  };
  latestStartRecordingRef.current = startRecording;

  const pauseRecording = (auto = false) => {
    autoPausedRef.current = auto;
    setStatus('paused');
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    if (stationaryCheckIntervalRef.current) clearInterval(stationaryCheckIntervalRef.current);
    stationaryCheckIntervalRef.current = null;
    releaseWakeLock();
    stopKeepAliveAudio();
    startPauseMonitoring(points[points.length - 1]);
  };
  latestPauseRecordingRef.current = pauseRecording;

  const recoverRoute = async () => {
    if (!recoveryPrompt) return;
    const { from, to, alreadyAppended } = recoveryPrompt;
    setRecoveryPrompt(null);
    const routedPoints = await fetchRoutedPath(from, to);
    if (!routedPoints || routedPoints.length === 0) {
      toast.error('Could not reconstruct that section of the route.');
      if (!alreadyAppended) setPoints((prev) => [...prev, to]);
      return;
    }
    // Spread real elapsed time evenly across the inserted points so
    // duration/speed math downstream never sees a null/zero gap.
    const withTimestamps = routedPoints.map((rp, i) => ({
      ...rp,
      timestamp: from.timestamp + ((to.timestamp - from.timestamp) * (i + 1)) / (routedPoints.length + 1),
    }));
    setPoints((prev) => {
      if (alreadyAppended) {
        // `to` is already the last recorded point — splice the estimated
        // points in just before it rather than after.
        return [...prev.slice(0, -1), ...withTimestamps, prev[prev.length - 1]];
      }
      return [...prev, ...withTimestamps, to];
    });
    toast.success('Estimated route section added');
  };
  const ignoreMovement = () => setRecoveryPrompt(null);

  // Smart Waypoints: one tap saves the current GPS location under a category
  // — no manual map placement. Categorized waypoints ride the existing
  // `waypoints` array (already part of the route doc) and become permanent
  // Route Pins (route_notes) once the route is saved (see Save's onSaved flow).
  const addPin = (categoryKey, atPoint) => {
    setShowPinPicker(false);
    const marker = atPoint || points[points.length - 1];
    if (!marker) { toast.error('Start recording first so we know your location.'); return; }
    const cfg = resolveCategoryConfig(categoryKey);
    const item = { id: `${Date.now()}`, lat: marker.lat, lng: marker.lng, category: categoryKey, label: cfg.label, created_at: new Date().toISOString() };
    setWaypoints((prev) => [...prev, item]);
    toast.success(`${cfg.icon} ${cfg.label} pin added`);
  };

  // Live Trip Sharing: a lightweight status pointer (current position only,
  // never a track) upserted on the same low-freq cadence already used for
  // pause monitoring. Shares with every group the user belongs to — kept
  // simple rather than a per-group picker, per "keep implementation
  // lightweight."
  const toggleLiveSharing = async () => {
    if (liveSharing) {
      setLiveSharing(false);
      if (liveShareIntervalRef.current) clearInterval(liveShareIntervalRef.current);
      liveShareIntervalRef.current = null;
      if (user?.uid) fetch(`/api/live-trips?user_id=${user.uid}`, { method: 'DELETE' }).catch(() => {});
      toast('Stopped sharing your live location.');
      return;
    }
    if (!user?.uid) { toast.error('Sign in to share your live location.'); return; }
    let groupIds = [];
    try {
      groupIds = (await fetchJson(`/api/groups?user_id=${user.uid}`)).map((g) => g.id);
    } catch {}
    const upsert = () => {
      const at = points[points.length - 1];
      if (!at) return;
      fetch('/api/live-trips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, name: user.name, lat: at.lat, lng: at.lng, group_ids: groupIds }),
      }).catch(() => {});
    };
    upsert();
    liveShareIntervalRef.current = setInterval(upsert, PAUSE_POLL_INTERVAL_MS);
    setLiveSharing(true);
    toast.success('Sharing your live location with your groups.');
  };

  const reportAlert = async (typeKey) => {
    setShowAlertPicker(false);
    const at = points[points.length - 1];
    if (!at) { toast.error('Start recording first so we know your location.'); return; }
    setReportingAlert(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: typeKey, lat: at.lat, lng: at.lng, user_id: user?.uid }),
      });
      const created = await res.json();
      if (!res.ok || created?.error) throw new Error(created?.error);
      setAlerts((prev) => [...prev, created]);
      toast.success('Reported to the community — thanks!');
    } catch {
      toast.error('Could not report right now. Try again.');
    } finally {
      setReportingAlert(false);
    }
  };

  const stopRecording = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (stationaryCheckIntervalRef.current) clearInterval(stationaryCheckIntervalRef.current);
    stationaryCheckIntervalRef.current = null;
    stopPauseMonitoring();
    releaseWakeLock();
    stopKeepAliveAudio();
    if (liveSharing) {
      if (liveShareIntervalRef.current) clearInterval(liveShareIntervalRef.current);
      liveShareIntervalRef.current = null;
      setLiveSharing(false);
      if (user?.uid) fetch(`/api/live-trips?user_id=${user.uid}`, { method: 'DELETE' }).catch(() => {});
    }
    if (points.length < 2 || distanceKm < 0.01) { toast.error('Not enough movement recorded.'); return; }
    clearRouteDraft();
    setRecoveryPrompt(null);
    onDone({
      points, distance_km: distanceKm, duration_sec: elapsed, max_speed_kmh: maxSpeed,
      avg_speed_kmh: elapsed > 0 ? (distanceKm / (elapsed / 3600)) : 0,
      start: points[0], end: points[points.length - 1],
      waypoints,
      route_stats: routeStats,
      tracking_settings: settings,
    });
  };

  const simulateRoute = () => {
    setStatus('recording');
    const base = { lat: 19.076, lng: 72.877 };
    const now = Date.now(); const pts = [];
    for (let i = 0; i < 40; i++) {
      pts.push({
        lat: base.lat + i * 0.0008 + Math.sin(i * 0.4) * 0.0004,
        lng: base.lng + i * 0.0011 + Math.cos(i * 0.4) * 0.0004,
        timestamp: now + i * 10000, speed: 8 + Math.random() * 4, altitude: null, accuracy: 5,
      });
    }
    setPoints(pts); setElapsed(400); setCurrentSpeed(35); setMaxSpeed(52);
    setTimeout(() => setStatus('paused'), 400);
  };

  const last = points[points.length - 1];
  const routeSegments = useMemo(() => {
    const segments = [];
    let i = 1;
    while (i < points.length) {
      if (points[i].routed) {
        // Merge the whole consecutive run of routed (estimated) points into
        // one dashed segment, anchored to the real GPS point on either side,
        // instead of many tiny 2-point segments.
        const start = i - 1;
        let j = i;
        while (j < points.length && points[j].routed) j += 1;
        const end = Math.min(j, points.length - 1);
        segments.push({ points: points.slice(start, end + 1), estimated: true, dashArray: '8 8', color: '#6b7280', weight: 4 });
        i = end + 1;
      } else {
        const prev = points[i - 1];
        const next = points[i];
        const speedKmh = ((next.speed || 0) * 3.6);
        segments.push({ points: [prev, next], speedKmh, color: getSpeedZoneColor(speedKmh) });
        i += 1;
      }
    }
    return segments;
  }, [points]);
  const hasEstimatedSection = points.some((p) => p.routed);

  // Refresh nearby community alerts (e.g. police checking reports) every
  // couple of minutes while there's a location to check against — cheap
  // enough not to matter, frequent enough to catch new reports en route.
  useEffect(() => {
    if (status === 'idle' || !last) return;
    const fetchNearby = () => {
      fetch(`/api/alerts?lat=${last.lat}&lng=${last.lng}&radiusKm=5`)
        .then((r) => r.json())
        .then((data) => setAlerts(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    fetchNearby();
    const id = setInterval(fetchNearby, 120000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, last?.lat != null && Math.round(last.lat * 200), last?.lng != null && Math.round(last.lng * 200)]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
      <div className="absolute top-6 left-6 right-6 z-[500] flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-white dark:bg-neutral-900 shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="px-4 py-2 rounded-full bg-white dark:bg-neutral-900 shadow-lg text-xs font-medium flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-neutral-300'}`} />
          {status === 'recording' ? 'Recording' : status === 'paused' ? 'Paused' : 'Ready'}
        </div>
        <div className="w-10" />
      </div>
      {hasEstimatedSection && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[500] px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 shadow-lg text-xs font-medium flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
          <span className="inline-block w-4 border-t-2 border-dashed border-neutral-400" /> Estimated route section
        </div>
      )}

      <div className="flex-1 relative min-h-[55vh]">
        {points.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-6">
            <div className="h-16 w-16 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-white dark:text-neutral-900" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">Press start to begin tracking your route</p>
            {error && (
              <>
                <p className="text-xs text-red-500 mt-3 px-4 text-center">{error}</p>
                <button onClick={simulateRoute} className="mt-3 text-xs px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  Try demo route instead
                </button>
              </>
            )}
          </div>
        ) : (
          <MapView points={points} follow={status === 'recording'} center={last ? [last.lat, last.lng] : null} zoom={17} mapStyle={settings.mapStyle} routeSegments={routeSegments} waypoints={waypoints} alerts={alerts} />
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 rounded-t-3xl -mt-6 relative z-10 shadow-2xl">
        <div className="px-6 pt-6 pb-8">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat label="Distance" value={formatDistance(distanceKm)} />
            <Stat label="Time" value={formatDuration(elapsed)} />
            <Stat label="Speed" value={`${currentSpeed.toFixed(1)} km/h`} />
          </div>
          <div className="mb-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-3 text-xs text-neutral-600 dark:text-neutral-300">
            <div className="flex items-center justify-between">
              <span>Accuracy profile</span>
              <span className="font-medium capitalize">{settings.accuracy}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span>Waypoints</span>
              <span className="font-medium">{waypoints.length}</span>
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setShowPinPicker(true)} className="flex-1 rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm">📍 Add Pin</button>
            <button onClick={() => { const next = saveSettings({ mapStyle: settings.mapStyle === 'satellite' ? 'standard' : 'satellite' }); setSettings(next); }} className="flex-1 rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm">Map: {settings.mapStyle}</button>
          </div>
          {showPinPicker && (
            <div className="fixed inset-0 z-[600] flex items-end bg-black/40" onClick={() => setShowPinPicker(false)}>
              <div className="w-full bg-white dark:bg-neutral-900 rounded-t-3xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm font-semibold mb-3">What's here?</p>
                <div className="grid grid-cols-3 gap-2">
                  {PIN_CATEGORIES.filter((c) => !settings.disabledPinCategories?.includes(c.key)).map((c) => (
                    <button key={c.key} onClick={() => addPin(c.key)}
                      className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 dark:border-neutral-700 py-3 text-[11px] font-medium text-center">
                      <span className="text-xl">{c.icon}</span> {c.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowPinPicker(false)} className="w-full text-center text-xs text-neutral-500 dark:text-neutral-400 mt-3 py-2">Cancel</button>
              </div>
            </div>
          )}
          {stopPrompt && (
            <div className="mb-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-4">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Were you stopping here?</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {['tea_stall', 'food', 'petrol'].map((key) => {
                  const cfg = resolveCategoryConfig(key);
                  return (
                    <button key={key} onClick={() => { addPin(key, stopPrompt); setStopPrompt(null); }}
                      className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-700 py-2.5 text-[11px] font-medium">
                      <span className="text-lg">{cfg.icon}</span> {cfg.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => { addPin('other', stopPrompt); setStopPrompt(null); }}
                  className="h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium">Rest Stop</button>
                <button onClick={() => setStopPrompt(null)} className="h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium">Ignore</button>
              </div>
            </div>
          )}
          {status !== 'idle' && (
            <div className="flex gap-2 mb-4">
              <button onClick={() => setShowAlertPicker(true)} className="flex-1 rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm flex items-center justify-center gap-1.5">
                🚨 Report Police Checking
              </button>
              <button onClick={toggleLiveSharing}
                className={`flex-1 rounded-full border px-3 py-2 text-sm flex items-center justify-center gap-1.5 ${liveSharing ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-700'}`}>
                📡 {liveSharing ? 'Sharing Live' : 'Share Live Location'}
              </button>
            </div>
          )}
          {showAlertPicker && (
            <div className="fixed inset-0 z-[600] flex items-end bg-black/40" onClick={() => setShowAlertPicker(false)}>
              <div className="w-full bg-white dark:bg-neutral-900 rounded-t-3xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm font-semibold mb-3">What did you see?</p>
                <div className="space-y-2">
                  {ALERT_TYPES.map((t) => (
                    <button key={t.key} disabled={reportingAlert} onClick={() => reportAlert(t.key)}
                      className="w-full flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-3 text-sm text-left disabled:opacity-50">
                      <span className="text-lg">{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAlertPicker(false)} className="w-full text-center text-xs text-neutral-500 dark:text-neutral-400 mt-3 py-2">Cancel</button>
              </div>
            </div>
          )}
          {recoveryPrompt && (
            <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">It looks like you travelled while paused.</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                About {formatDistance(recoveryPrompt.distanceMeters / 1000)} of movement was detected. Reconstruct that section using roads, or ignore it?
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={ignoreMovement} className="h-11 rounded-full border border-neutral-200 dark:border-neutral-700 text-sm font-medium">Ignore movement</button>
                <button onClick={recoverRoute} className="h-11 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium">Recover route</button>
              </div>
            </div>
          )}
          {status === 'idle' && (
            <div className="space-y-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={startRecording}
                className="w-full h-16 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-base font-semibold flex items-center justify-center gap-2 shadow-lg">
                <Play className="h-5 w-5" fill="currentColor" /> Start Recording
              </motion.button>
              <button onClick={simulateRoute} className="w-full text-xs text-neutral-500 dark:text-neutral-400 py-2">Demo mode (simulate a route)</button>
            </div>
          )}
          {status === 'recording' && (
            <div className="grid grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => pauseRecording()}
                className="h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold flex items-center justify-center gap-2">
                <Pause className="h-5 w-5" /> Pause
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={stopRecording}
                className="h-16 rounded-full bg-red-500 text-white font-semibold flex items-center justify-center gap-2">
                <Square className="h-4 w-4" fill="white" /> Stop & Save
              </motion.button>
            </div>
          )}
          {status === 'paused' && (
            <div className="grid grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={startRecording}
                className="h-16 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold flex items-center justify-center gap-2">
                <Play className="h-5 w-5" fill="currentColor" /> Resume
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={stopRecording}
                className="h-16 rounded-full bg-red-500 text-white font-semibold flex items-center justify-center gap-2">
                <Square className="h-4 w-4" fill="white" /> Finish
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="text-center">
      <div className="flex justify-center text-neutral-400 dark:text-neutral-500">{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mt-1">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

// ============= SAVE =============
function Save({ data, user, onBack, onSaved }) {
  const [settings, setSettings] = useState(getSettings());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [routeType, setRouteType] = useState('Commute');
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleTag = (t) => setTags((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const save = async () => {
    if (!name.trim()) { toast.error('Please give your route a name'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, name: name.trim(), description: description.trim(), route_type: routeType,
          tags, notes: notes.trim(), creator_name: user?.name || 'Anonymous', user_id: user?.uid, folder_id: data.folder_id || null, waypoints: data.waypoints || [], route_stats: data.route_stats, tracking_settings: data.tracking_settings }),
      });

      // A non-2xx response (e.g. 503 when MongoDB is unreachable) still returns
      // valid JSON — `{ error: '...' }` — so it must be checked explicitly.
      // Treating it as success is what produced the "/r/undefined" share links.
      let payload;
      try {
        payload = await res.json();
      } catch {
        throw new Error(`Server returned an unexpected response (status ${res.status})`);
      }
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error || `Failed to save route (status ${res.status})`);
      }
      if (!payload?.id || !payload?.share_code) {
        throw new Error('Route was saved but the server response was missing an id/share code.');
      }

      const created = payload;
      cacheRoute(created);
      toast.success('Route saved!');
      fetch(`/api/routes/${created.id}/summarize`, { method: 'POST' }).catch(() => {});
      // Smart Waypoints: categorized pins added one-tap during recording
      // become permanent Route Pins (route_notes) now that the route has an
      // id — plain (uncategorized) waypoints stay exactly as before.
      for (const wp of data.waypoints || []) {
        if (!wp.category) continue;
        fetch(`/api/routes/${created.id}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user?.uid, author: user?.name || 'Anonymous', category: wp.category, text: wp.label, lat: wp.lat, lng: wp.lng }),
        }).catch(() => {});
      }
      onSaved(created);
    } catch (err) {
      toast.error(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-32">
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Save Route</h1>
        <div className="w-10" />
      </div>
      <div className="px-6">
        <div className="rounded-3xl overflow-hidden border border-neutral-100 dark:border-neutral-800 h-48">
          <MapView points={data.points} fit interactive={false} waypoints={data.waypoints || []} mapStyle={settings.mapStyle} routeSegments={data.points.length > 1 ? data.points.slice(1).map((point, index) => ({ points: [data.points[index], point], speedKmh: point.speed * 3.6, color: getSpeedZoneColor(point.speed * 3.6) })) : []} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 py-3 px-2">
          <MiniStat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(data.distance_km)} />
          <MiniStat icon={<Clock className="h-4 w-4" />} label="Time" value={formatDuration(data.duration_sec)} />
          <MiniStat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${data.avg_speed_kmh?.toFixed(1) || 0} km/h`} />
        </div>
        <div className="mt-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Analytics snapshot</span>
            <span className="font-medium text-neutral-900 dark:text-white">{data.route_stats?.waypoint_count || 0} waypoints</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>Peak speed</span>
            <span className="font-semibold">{data.route_stats?.max_speed_kmh?.toFixed(1) || 0} km/h</span>
          </div>
        </div>
        <div className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Route name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backroads to Lonavala"
              className="mt-2 h-12 rounded-xl border-neutral-200 dark:border-neutral-800 text-base" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes this route special?"
              className="mt-2 rounded-xl border-neutral-200 dark:border-neutral-800 min-h-[80px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Route type</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ROUTE_TYPES.map((t) => (
                <button key={t} onClick={() => setRouteType(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${routeType === t ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Tags</label>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Help fellow travellers find this route</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <button key={t} onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'}`}>
                    {active && <Check className="inline h-3 w-3 mr-1" />} {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Notes for travellers</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What locals should know: watch for potholes at km 3, best time is early morning..."
              className="mt-2 rounded-xl border-neutral-200 dark:border-neutral-800 min-h-[80px]" />
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-white/80 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-950/80">
        <div className="max-w-md mx-auto">
          <Button onClick={save} disabled={saving} className="w-full h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-base font-semibold">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Save & Share <Sparkles className="h-4 w-4 ml-2" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============= ROUTE STORY =============
// route.story (owner-written) takes priority; falls back to the AI-generated
// route.ai_summary.story; editing always writes to route.story (an empty
// save clears the override and re-enables the AI fallback).
function RouteStory({ route, user, onSaved }) {
  const isOwner = user?.uid && route.user_id === user.uid;
  const storyText = route.story || route.ai_summary?.story || '';
  const isCustom = !!route.story;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(storyText);
  const [saving, setSaving] = useState(false);

  if (!storyText && !isOwner) return null;

  const save = async (value) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/routes/${route.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, story: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      onSaved?.(data.story ?? null);
      setEditing(false);
      toast.success(value ? 'Story updated' : 'Reset to AI-generated story');
    } catch {
      toast.error('Could not save the story. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Route Story</p>
        {isOwner && !editing && (
          <button onClick={() => { setDraft(storyText); setEditing(true); }} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="My favourite Sunday drive..."
            className="rounded-xl border-neutral-200 dark:border-neutral-800 min-h-[100px] text-sm" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => setEditing(false)} className="flex-1 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 text-xs font-medium">Cancel</button>
            {isCustom && (
              <button onClick={() => save('')} disabled={saving} className="flex-1 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 text-xs font-medium">Reset to AI story</button>
            )}
            <button onClick={() => save(draft)} disabled={saving} className="flex-1 h-9 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{storyText}</p>
      )}
    </div>
  );
}

// ============= AI SUMMARY =============
function AISummaryCard({ route, onRefresh, loading }) {
  const ai = route.ai_summary;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-violet-950/30 dark:via-neutral-900 dark:to-blue-950/30 border border-violet-100 dark:border-violet-900/50 p-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white dark:text-neutral-900" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-900 dark:text-white">Local's Take</p>
            {ai?.vibe && <p className="text-[10px] text-neutral-500 dark:text-neutral-400 lowercase">{ai.vibe}</p>}
          </div>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} disabled={loading} className="text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Regenerate'}
          </button>
        )}
      </div>
      {ai ? (
        <>
          <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">{ai.summary}</p>
          {ai.best_for && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 italic">Best for: {ai.best_for}</p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Difficulty</p>
              <div className="flex items-center gap-1 mt-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= ai.difficulty ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
                ))}
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1.5 font-medium">{['','Very easy','Easy','Moderate','Challenging','Demanding'][ai.difficulty]}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Fuel estimate</p>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1.5 leading-snug">{ai.fuel_note}</p>
            </div>
          </div>
          {ai.why_locals_prefer?.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Why locals prefer this route</p>
              <div className="space-y-1.5">
                {ai.why_locals_prefer.map((point, i) => (
                  <p key={i} className="text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" /> {point}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      ) : loading ? (
        <div className="space-y-2">
          <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse w-4/5" />
        </div>
      ) : (
        <button onClick={onRefresh} className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Generate local take
        </button>
      )}
    </div>
  );
}

// ============= VERIFIED PILL =============
const VERIFY_QUESTIONS = [
  { key: 'road_condition_accurate', label: 'Road condition info is accurate' },
  { key: 'safety_accurate', label: 'Feels safe to travel' },
  { key: 'scenic_accurate', label: 'Scenic / worth the view' },
  { key: 'family_friendly_accurate', label: 'Good for family travel' },
  { key: 'tags_accurate', label: 'Tags are accurate' },
];

function VerifiedPill({ route, user, onChange }) {
  const [count, setCount] = useState(route.verified_count || 0);
  const [confidence, setConfidence] = useState(route.confidence_score ?? null);
  const [axisScores, setAxisScores] = useState(route.axis_scores ?? null);
  const [byMe, setByMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState(() => Object.fromEntries(VERIFY_QUESTIONS.map((q) => [q.key, true])));

  useEffect(() => {
    fetch(`/api/routes/${route.id}/verifications`).then(r => r.json()).then((d) => {
      setCount(d.count || 0);
      setConfidence(d.confidence_score ?? null);
      setAxisScores(d.axis_scores ?? null);
      setByMe(!!d.users?.find(u => u.user_id === user?.uid));
    });
  }, [route.id, user?.uid]);

  const submit = async (unverify) => {
    if (!user) return; setBusy(true);
    try {
      const res = await fetch(`/api/routes/${route.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, author: user.name, unverify, ...answers }),
      });
      const data = await res.json();
      setCount(data.verified_count);
      setConfidence(data.confidence_score ?? null);
      setAxisScores(data.axis_scores ?? null);
      setByMe(!unverify);
      setShowForm(false);
      onChange?.(data.verified_count);
      toast.success(unverify ? 'Verification removed' : 'You verified this route ✓');
    } finally { setBusy(false); }
  };

  const headline = count > 0
    ? `Verified by ${count} local${count > 1 ? 's' : ''}${confidence != null ? ` · ${confidence}% Local Approval` : ''}`
    : 'Not verified yet';

  return (
    <div>
      <button onClick={() => (byMe ? submit(true) : setShowForm((s) => !s))} disabled={busy}
        className={`w-full rounded-2xl border p-4 flex items-center justify-between transition ${
          byMe ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800'
        }`}>
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${byMe ? 'bg-white/10 dark:bg-neutral-900/10' : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'}`}>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{headline}</p>
            <p className={`text-[11px] ${byMe ? 'text-white/70 dark:text-neutral-900/70' : 'text-neutral-500 dark:text-neutral-400'}`}>{byMe ? 'Tap to remove your verification' : 'Confirm this route is accurate'}</p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${byMe ? 'bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white' : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'}`}>
          {byMe ? 'Verified ✓' : 'Verify'}
        </div>
      </button>
      {axisScores && (
        <div className="mt-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-2">
          {Object.entries(VERIFY_AXIS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-28 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div className="h-full bg-neutral-900 dark:bg-white rounded-full" style={{ width: `${axisScores[key] ?? 0}%` }} />
              </div>
              <span className="text-xs font-medium w-9 text-right">{axisScores[key] ?? 0}%</span>
            </div>
          ))}
        </div>
      )}
      {showForm && !byMe && (
        <div className="mt-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-1.5">
          {VERIFY_QUESTIONS.map((q) => (
            <button key={q.key} onClick={() => setAnswers((a) => ({ ...a, [q.key]: !a[q.key] }))}
              className="w-full flex items-center justify-between px-2 py-2 rounded-xl text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">{q.label}</span>
              <span className={`h-5 w-5 rounded-md border flex items-center justify-center ${answers[q.key] ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-700'}`}>
                {answers[q.key] && <Check className="h-3.5 w-3.5 text-white dark:text-neutral-900" />}
              </span>
            </button>
          ))}
          <button onClick={() => submit(false)} disabled={busy}
            className="w-full mt-1 h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Submit verification'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============= COMMUNITY NOTES (map-point) =============
function CommunityNotes({ routeId, user, points }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('tea_stall');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // Post Journey Annotation: scrub the recorded track to pin the note to a
  // specific spot instead of the route's midpoint (the previous default).
  const [pointIndex, setPointIndex] = useState(() => Math.floor((points?.length || 1) / 2));

  const load = () => fetchJson(`/api/routes/${routeId}/notes`).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, [routeId]);

  const submit = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const at = points?.[pointIndex];
      await fetch(`/api/routes/${routeId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, category, text: text.trim(), lat: at?.lat, lng: at?.lng }),
      });
      setText(''); setShowForm(false); load();
      toast.success('Local knowledge added 🙏');
    } finally { setAdding(false); }
  };

  const vote = async (id, dir) => {
    await fetch(`/api/notes/${id}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: dir }),
    });
    load();
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Local knowledge · {items.length}</p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-neutral-900 dark:text-white flex items-center gap-1">
          {showForm ? <>Cancel <X className="h-3 w-3" /></> : <>Add note <MapPinned className="h-3 w-3" /></>}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3 mb-3">
          {points?.length > 1 && (
            <div className="mb-3">
              <div className="h-32 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
                <MapView points={points} fit interactive={false} showEnds={false} height="100%"
                  droppedPin={points[pointIndex] ? { lat: points[pointIndex].lat, lng: points[pointIndex].lng } : null} />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 mb-1">Where on the route?</p>
              <input type="range" min={0} max={points.length - 1} value={pointIndex}
                onChange={(e) => setPointIndex(parseInt(e.target.value, 10))}
                className="w-full accent-neutral-900 dark:accent-white" />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {NOTE_CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <button key={c.key} onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium border flex items-center gap-1 ${category === c.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'}`}>
                  <Icon className="h-3 w-3" /> {c.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Best tea stall here, avoid after 8 PM..."
              className="h-10 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button onClick={submit} disabled={adding || !text.trim()} className="h-10 w-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-40">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(n => {
          const cfg = NOTE_CATEGORIES.find(c => c.key === n.category)
            || NOTE_CATEGORIES.find(c => c.key === LEGACY_CATEGORY_ALIASES[n.category])
            || NOTE_CATEGORIES[NOTE_CATEGORIES.length - 1];
          const Icon = cfg.icon;
          return (
            <div key={n.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${cfg.color}`}>
              <div className={`h-8 w-8 rounded-lg ${cfg.dot} flex items-center justify-center shrink-0`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold capitalize">{cfg.label} • {n.author}</p>
                  <p className="text-[10px] opacity-70">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-sm mt-0.5">{n.text}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => vote(n.id, 'up')} className="flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100">
                    <ThumbsUp className="h-3 w-3" /> {n.upvotes || 0}
                  </button>
                  <button onClick={() => vote(n.id, 'down')} className="flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100">
                    <ThumbsDown className="h-3 w-3" /> {n.downvotes || 0}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && !showForm && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No local tips yet. Be the first to share.</p>
        )}
      </div>
    </div>
  );
}

// ============= CONDITIONS =============
function Conditions({ routeId, user }) {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('pothole');
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const load = () => fetchJson(`/api/routes/${routeId}/conditions`).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, [routeId]);

  const submit = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/routes/${routeId}/conditions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, type, text: text.trim() }),
      });
      setText(''); setShowForm(false); load(); toast.success('Alert posted');
    } finally { setAdding(false); }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Road conditions · {items.length}</p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-neutral-900 dark:text-white flex items-center gap-1">
          {showForm ? <>Cancel <X className="h-3 w-3" /></> : <>Report <AlertTriangle className="h-3 w-3" /></>}
        </button>
      </div>
      {showForm && (
        <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3 mb-3">
          <div className="flex gap-1.5 mb-2 overflow-x-auto">
            {CONDITION_TYPES.map(c => (
              <button key={c.key} onClick={() => setType(c.key)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border ${type === c.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>{c.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the issue..."
              className="h-10 rounded-xl border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button onClick={submit} disabled={adding || !text.trim()} className="h-10 w-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-40">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(i => {
          const cfg = CONDITION_TYPES.find(c => c.key === i.type) || CONDITION_TYPES[5];
          const Icon = cfg.icon;
          return (
            <div key={i.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${cfg.color}`}>
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold capitalize">{cfg.label} • {i.author}</p>
                  <p className="text-[10px] opacity-70">{new Date(i.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-sm mt-0.5">{i.text}</p>
              </div>
            </div>
          );
        })}
        {items.length === 0 && !showForm && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No road alerts yet.</p>
        )}
      </div>
    </div>
  );
}

// ============= COMMENTS =============
function Comments({ routeId, user }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const load = () => fetchJson(`/api/routes/${routeId}/comments`).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, [routeId]);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/routes/${routeId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, text: text.trim() }),
      });
      setText(''); load();
    } finally { setSending(false); }
  };
  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Comments · {items.length}</p>
      <div className="space-y-3">
        {items.map(c => (
          <div key={c.id} className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{c.author}</p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-1">{c.text}</p>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No comments yet.</p>}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..."
          className="h-11 rounded-2xl border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={sending || !text.trim()} className="h-11 w-11 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-40">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ============= NEARBY ROUTES =============
function NearbyRoutes({ routeId, onOpen }) {
  const [routes, setRoutes] = useState([]);
  useEffect(() => {
    fetchJson(`/api/routes/${routeId}/nearby`).then((d) => setRoutes(d.routes || [])).catch(() => setRoutes([]));
  }, [routeId]);
  if (routes.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">People also explored</p>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-6 px-6">
        {routes.map((r) => (
          <div key={r.id} className="w-56 shrink-0">
            <RouteCard route={r} onOpen={() => onOpen(r.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============= RATING =============
function RatingRow({ routeId, user, current }) {
  const [avg, setAvg] = useState(current?.rating_avg || 0);
  const [count, setCount] = useState(current?.rating_count || 0);
  const [my, setMy] = useState(0);
  const [hover, setHover] = useState(0);
  const rate = async (stars) => {
    setMy(stars);
    const res = await fetch(`/api/routes/${routeId}/rate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.uid, stars }),
    });
    const data = await res.json();
    setAvg(data.rating_avg); setCount(data.rating_count);
    toast.success(`You rated ${stars} ★`);
  };
  return (
    <div className="flex items-center justify-between rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 mt-3">
      <div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Your rating</p>
        <div className="flex items-center gap-0.5 mt-1">
          {[1,2,3,4,5].map(i => (
            <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => rate(i)} className="p-0.5">
              <Star className={`h-5 w-5 ${(hover || my) >= i ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 dark:text-neutral-700'}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Community</p>
        <p className="text-lg font-semibold flex items-center gap-1 justify-end">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          {avg > 0 ? avg.toFixed(1) : '–'}
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">({count})</span>
        </p>
      </div>
    </div>
  );
}

// ============= DETAIL =============
function Detail({ routeId, onBack, onShare, onOpenRoute, user }) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [notes, setNotes] = useState([]);

  const load = () => {
    fetchJson(`/api/routes/${routeId}`).then((r) => {
      setRoute(r); cacheRoute(r); setLoading(false);
      if (!r.ai_summary) genSummary(r.id);
    }).catch(() => setLoading(false));
    fetchJson(`/api/routes/${routeId}/notes`).then(setNotes).catch(() => setNotes([]));
  };
  const genSummary = async (id) => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/routes/${id}/summarize`, { method: 'POST' });
      const ai = await res.json();
      setRoute((r) => ({ ...r, ai_summary: ai }));
    } catch {} finally { setAiLoading(false); }
  };
  useEffect(() => { load(); }, [routeId]);
  const toggleLike = async () => {
    setLiked(!liked);
    const res = await fetch(`/api/routes/${routeId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlike: liked }),
    });
    const updated = await res.json();
    setRoute((r) => ({ ...r, likes: updated.likes }));
  };
  if (loading) return <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400 dark:text-neutral-500" /></div>;
  if (!route || route.error) return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-8">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Route not found</p>
      <Button variant="ghost" onClick={onBack} className="mt-4">Go back</Button>
    </div>
  );
  const noteMarkers = notes.filter(n => n.lat != null && n.lng != null);
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-32">
      <div className="absolute top-6 left-6 z-[500]">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-white dark:bg-neutral-900 shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute top-6 right-6 z-[500]">
        <button onClick={toggleLike} className="h-10 w-10 rounded-full bg-white dark:bg-neutral-900 shadow-lg flex items-center justify-center">
          <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>
      <div className="h-[42vh] relative bg-neutral-100 dark:bg-neutral-900">
        <MapView points={route.points} fit interactive noteMarkers={noteMarkers} />
      </div>
      <div className="px-6 -mt-6 relative bg-white dark:bg-neutral-950 rounded-t-3xl shadow-xl">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">by {route.creator_name}</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{route.route_type}</Badge>
          </div>
          {route.description && <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-4 leading-relaxed">{route.description}</p>}
          <div className="grid grid-cols-4 gap-3 mt-6 py-4 border-y border-neutral-100 dark:border-neutral-800">
            <MiniStat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(route.distance_km || 0)} />
            <MiniStat icon={<Clock className="h-4 w-4" />} label="Duration" value={formatDuration(route.duration_sec || 0)} />
            <MiniStat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${(route.avg_speed_kmh || 0).toFixed(0)} km/h`} />
            <MiniStat icon={<Eye className="h-4 w-4" />} label="Views" value={String(route.views || 0)} />
          </div>
          <div className="mt-4 flex justify-end">
            <FollowButton routeId={route.id} user={user} />
          </div>
          <RouteStory route={route} user={user} onSaved={(story) => setRoute(r => ({ ...r, story }))} />
          <div className="mt-4">
            <VerifiedPill route={route} user={user} onChange={(c) => setRoute(r => ({ ...r, verified_count: c }))} />
          </div>
          <AISummaryCard route={route} onRefresh={() => genSummary(route.id)} loading={aiLoading} />
          <RatingRow routeId={route.id} user={user} current={route} />
          {route.tags?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {route.tags.map((t) => (
                  <span key={t} className="px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}
          {route.notes && (
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Notes from creator</p>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-sm text-neutral-800 leading-relaxed">{route.notes}</p>
              </div>
            </div>
          )}
          <CommunityNotes routeId={route.id} user={user} points={route.points} />
          <Conditions routeId={route.id} user={user} />
          <AlertsSection lat={route.start?.lat} lng={route.start?.lng} />
          <Comments routeId={route.id} user={user} />
          <NearbyRoutes routeId={route.id} onOpen={(id) => onOpenRoute?.(id)} />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-white/80 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-950/80">
        <div className="max-w-md mx-auto">
          <Button onClick={() => onShare(route)} className="w-full h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-base font-semibold">
            <Share2 className="h-5 w-5 mr-2" /> Share this route
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============= EXPLORE =============
// ============= PLAN A TRIP (Smart Route Recommendations) =============
// Surfaces existing community-recorded routes near a searched destination,
// grouped into mode cards — not a live turn-by-turn routing engine. Matches
// "Google Maps gives directions, Raasta gives recommendations."
function PlanTrip({ onBack, onOpen }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);

  const search = async () => {
    if (!query.trim()) return;
    setState('loading');
    try {
      const res = await fetch(`/api/recommendations?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.error);
      setResult(data);
      setState('done');
    } catch (err) {
      setResult(null);
      setState('error');
      toast.error(err.message || 'Could not find recommendations for that destination.');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-10">
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Plan a Trip</h1>
        <div className="w-10" />
      </div>

      <div className="px-6">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Where are you headed? We'll show routes locals actually recommend.</p>
        <div className="flex items-center gap-2 mt-4">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="e.g. Raipur, or a landmark" className="h-12 rounded-xl border-neutral-200 dark:border-neutral-800" />
          <button onClick={search} disabled={state === 'loading'} className="h-12 w-12 shrink-0 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-50">
            {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>

        {state === 'done' && result && (
          <div className="mt-6">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Showing routes near {result.destination.label?.split(',')[0] || query}</p>
            {result.cards.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-10">No community routes near there yet — be the first to record one.</p>
            )}
            <div className="space-y-6">
              {result.cards.map((card) => (
                <div key={card.mode}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{card.icon} {card.label}</p>
                    {card.route.verified_count > 0 && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Recommended by {card.route.verified_count} local{card.route.verified_count > 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <RouteCard route={card.route} onOpen={() => onOpen(card.route.id)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Explore({ onBack, onOpen }) {
  const [routes, setRoutes] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ city: '', route_type: '', distance: '' });
  const [cities, setCities] = useState([]);

  useEffect(() => {
    fetchJson('/api/routes/cities').then(setCities).catch(() => setCities([]));
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (filters.city) params.set('city', filters.city);
    if (filters.route_type) params.set('route_type', filters.route_type);
    if (filters.distance === 'short') params.set('maxDistance', '10');
    if (filters.distance === 'medium') { params.set('minDistance', '10'); params.set('maxDistance', '50'); }
    if (filters.distance === 'long') params.set('minDistance', '50');
    return params;
  };

  // Debounced search — searches every publicly saved route, not just what's
  // already loaded for the current category tab (the bug this replaces).
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      fetchJson(`/api/search?q=${encodeURIComponent(q.trim())}`).then(setRoutes).catch(() => setRoutes([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (q.trim()) return; // search box takes over while active
    const params = buildParams();

    if (cat === 'nearby') {
      if (!navigator.geolocation) { setRoutes([]); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          params.set('near', `${pos.coords.latitude},${pos.coords.longitude}`);
          params.set('radiusKm', '50');
          fetchJson(`/api/routes?${params.toString()}`).then(setRoutes).catch(() => setRoutes([]));
        },
        () => setRoutes([]),
      );
      return;
    }

    if (cat === 'trending' || cat === 'popular' || cat === 'recent') {
      params.set('sort', cat);
    } else {
      params.set('sort', 'trending'); // tag categories still filter client-side below
    }
    fetchJson(`/api/routes?${params.toString()}`).then((data) => {
      if (cat !== 'trending' && cat !== 'popular' && cat !== 'recent' && cat !== 'nearby') {
        setRoutes(data.filter(r => r.tags?.includes(cat)));
      } else setRoutes(data);
    }).catch(() => setRoutes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q, filters]);

  const routesList = routes || [];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28">
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Discover routes curated by locals</p>
      </div>
      <div className="px-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search routes, cities, tags..."
              className="pl-11 h-12 rounded-2xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900" />
          </div>
          <button onClick={() => setShowFilters((s) => !s)}
            className={`h-12 w-12 shrink-0 rounded-2xl border flex items-center justify-center ${showFilters ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'}`}>
            <Settings className="h-4 w-4" />
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select value={filters.city} onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}
              className="h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs px-2">
              <option value="">Any city</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.route_type} onChange={(e) => setFilters(f => ({ ...f, route_type: e.target.value }))}
              className="h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs px-2">
              <option value="">Any type</option>
              {ROUTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.distance} onChange={(e) => setFilters(f => ({ ...f, distance: e.target.value }))}
              className="h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs px-2">
              <option value="">Any distance</option>
              <option value="short">Under 10 km</option>
              <option value="medium">10-50 km</option>
              <option value="long">50+ km</option>
            </select>
          </div>
        )}
        {!q.trim() && (
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
            {EXPLORE_CATEGORIES.map(t => (
              <button key={t.key} onClick={() => setCat(t.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${cat === t.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'}`}>
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-6 mt-5 space-y-3">
        {routes === null && [1,2,3].map(i => <div key={i} className="rounded-3xl h-56 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />)}
        {routes !== null && routesList.length === 0 && (
          <div className="text-center py-16 text-sm text-neutral-500 dark:text-neutral-400">
            {q.trim() ? 'No routes found.' : 'No routes in this category yet.'}
          </div>
        )}
        {routesList.map(r => <RouteCard key={r.id} route={r} onOpen={() => onOpen(r.id)} />)}
      </div>
    </div>
  );
}

// ============= LIBRARY =============
function Library({ user, onOpen }) {
  const [routes, setRoutes] = useState(null);
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({});
  useEffect(() => {
    if (!user) return;
    fetchJson(`/api/routes?user_id=${user.uid}`).then(setRoutes).catch(() => setRoutes([]));
  }, [user]);

  const matches = (r) => {
    if (!q) return true;
    const query = q.toLowerCase();
    const textFields = [r.name, r.city, r.route_type, r.creator_name, r.story, r.notes, r.ai_summary?.summary, r.ai_summary?.story];
    if (textFields.some((f) => f && f.toLowerCase().includes(query))) return true;
    if (r.tags?.some((t) => t.toLowerCase().includes(query))) return true;
    // Typo-tolerant fallback over a small, already-fetched set (this user's own routes).
    return fuzzyIncludes(r.name, query) || fuzzyIncludes(r.city, query) || (r.tags || []).some((t) => fuzzyIncludes(t, query));
  };
  const filtered = (routes || []).filter(matches);

  const groups = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      const key = r.city || 'Other';
      (map[key] ||= []).push(r);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28">
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Routes you’ve recorded</p>
      </div>
      <div className="px-6">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library..."
            className="pl-11 h-12 rounded-2xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900" />
        </div>
      </div>
      <div className="px-6 mt-5 space-y-5">
        {routes === null && [1,2,3].map(i => <div key={i} className="rounded-3xl h-56 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />)}
        {routes !== null && filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-neutral-500 dark:text-neutral-400">No saved routes yet.</div>
        )}
        {groups.map(([city, list]) => (
          <div key={city}>
            <button onClick={() => setCollapsed((c) => ({ ...c, [city]: !c[city] }))}
              className="w-full flex items-center justify-between py-1 mb-2">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{city} <span className="text-neutral-400 dark:text-neutral-500 font-normal">({list.length})</span></p>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${collapsed[city] ? '-rotate-90' : ''}`} />
            </button>
            {!collapsed[city] && (
              <div className="space-y-3">
                {list.map((r) => <RouteCard key={r.id} route={r} onOpen={() => onOpen(r.id)} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============= SETTINGS =============
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const options = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = mounted && theme === opt.key;
        return (
          <button key={opt.key} onClick={() => setTheme(opt.key)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 text-xs font-medium transition ${
              active ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                     : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
            }`}>
            <Icon className="h-4 w-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsSection() {
  const [settings, setSettings] = useState(getSettings());
  const update = (next) => {
    const merged = saveSettings(next);
    setSettings(merged);
  };
  return (
    <div className="mt-4 rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        <p className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">Tracking settings</p>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Map style</p>
          <div className="grid grid-cols-3 gap-2">
            {['standard','satellite','terrain'].map((value) => (
              <button key={value} onClick={() => update({ mapStyle: value })} className={`rounded-2xl border px-3 py-2 text-sm capitalize ${settings.mapStyle === value ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                {value}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Accuracy profile</p>
          <div className="grid grid-cols-3 gap-2">
            {['high','balanced','battery'].map((value) => (
              <button key={value} onClick={() => update({ accuracy: value })} className={`rounded-2xl border px-3 py-2 text-sm capitalize ${settings.accuracy === value ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                {value}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Units</p>
          <div className="grid grid-cols-2 gap-2">
            {['metric','imperial'].map((value) => (
              <button key={value} onClick={() => update({ units: value })} className={`rounded-2xl border px-3 py-2 text-sm capitalize ${settings.units === value ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Auto-pause</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Pause when movement stops</p>
          </div>
          <button onClick={() => update({ autoPause: !settings.autoPause })} className={`px-3 py-1.5 rounded-full text-xs font-medium ${settings.autoPause ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200'}`}>
            {settings.autoPause ? 'On' : 'Off'}
          </button>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Pin categories &amp; alerts</p>
          <div className="grid grid-cols-3 gap-2">
            {PIN_CATEGORIES.map((c) => {
              const enabled = !settings.disabledPinCategories?.includes(c.key);
              return (
                <button key={c.key} onClick={() => {
                  const next = enabled
                    ? [...(settings.disabledPinCategories || []), c.key]
                    : (settings.disabledPinCategories || []).filter((k) => k !== c.key);
                  update({ disabledPinCategories: next });
                }} className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-medium ${enabled ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500'}`}>
                  <span className="text-2xl leading-none">{c.icon}</span> {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 mt-4">Appearance</p>
      <ThemeToggle />
    </div>
  );
}

// ============= LEADERBOARDS =============
const LEADERBOARD_METRICS = [
  { key: 'explorers', label: 'Top Explorers', unit: 'km' },
  { key: 'contributors', label: 'Top Contributors', unit: 'contributions' },
  { key: 'reviewers', label: 'Top Reviewers', unit: 'reviews' },
];

function Leaderboards({ onBack }) {
  const [metric, setMetric] = useState('explorers');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState([]);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    fetchJson('/api/routes/cities').then(setCities).catch(() => setCities([]));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams({ metric });
    if (city) params.set('city', city);
    setRows(null);
    fetchJson(`/api/leaderboards?${params.toString()}`).then(setRows).catch(() => setRows([]));
  }, [metric, city]);

  const activeMetric = LEADERBOARD_METRICS.find((m) => m.key === metric);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-10">
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Leaderboards</h1>
        <div className="w-10" />
      </div>
      <div className="px-6">
        <div className="flex gap-2">
          {LEADERBOARD_METRICS.map((m) => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`flex-1 py-2 rounded-full text-xs font-medium border ${metric === m.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)}
          className="mt-3 w-full h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs px-3">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="mt-4 space-y-2">
          {rows === null && [1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />)}
          {rows !== null && rows.length === 0 && (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-10">No data yet{city ? ` for ${city}` : ''}.</p>
          )}
          {rows?.map((r, i) => (
            <div key={r.user_id} className="flex items-center gap-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3">
              <span className="text-sm font-semibold w-6 text-center text-neutral-400">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{r.followers} followers</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{r.value} <span className="text-xs font-normal text-neutral-400">{activeMetric?.unit}</span></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= GROUPS =============
const GROUP_CATEGORIES = ['Family', 'Bike Riders', 'Trek Group', 'Cycling Group', 'Other'];

function Groups({ user, onBack, onOpenGroup }) {
  const [groups, setGroups] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Family');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchJson(`/api/groups?user_id=${user.uid}`).then(setGroups).catch(() => setGroups([]));
  useEffect(() => { if (user) load(); }, [user]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, name: name.trim(), category }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.error);
      setName(''); setShowCreate(false); load();
      toast.success('Group created');
    } catch (err) {
      toast.error(err.message || 'Could not create group');
    } finally { setBusy(false); }
  };

  const join = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, invite_code: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.error);
      setJoinCode(''); load();
      toast.success(`Joined ${data.name}`);
    } catch (err) {
      toast.error(err.message || 'Invalid invite code');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-10">
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Groups</h1>
        <div className="w-10" />
      </div>
      <div className="px-6">
        <div className="flex gap-2">
          <button onClick={() => setShowCreate((s) => !s)} className="flex-1 h-11 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium">
            Create group
          </button>
        </div>
        {showCreate && (
          <div className="mt-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family"
              className="h-11 rounded-xl border-neutral-200 dark:border-neutral-700" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {GROUP_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium border ${category === c ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                  {c}
                </button>
              ))}
            </div>
            <button onClick={create} disabled={busy || !name.trim()} className="w-full h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium mt-3 disabled:opacity-50">
              Create
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Have an invite code?"
            className="h-11 rounded-xl border-neutral-200 dark:border-neutral-700 text-sm" onKeyDown={(e) => e.key === 'Enter' && join()} />
          <button onClick={join} disabled={busy || !joinCode.trim()} className="h-11 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium disabled:opacity-50">
            Join
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {groups === null && [1,2].map(i => <div key={i} className="h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />)}
          {groups !== null && groups.length === 0 && (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-10">No groups yet — create one or join with a code.</p>
          )}
          {groups?.map((g) => (
            <button key={g.id} onClick={() => onOpenGroup(g.id)} className="w-full flex items-center justify-between rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 text-left">
              <div>
                <p className="text-sm font-semibold">{g.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{g.category} · {g.member_count} member{g.member_count === 1 ? '' : 's'}</p>
              </div>
              <ChevronDown className="h-4 w-4 -rotate-90 text-neutral-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupDetail({ groupId, user, onBack, onOpenRoute }) {
  const [group, setGroup] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');

  const load = () => {
    fetchJson(`/api/groups/${groupId}?user_id=${user.uid}`).then(setGroup).catch(() => setGroup(null));
    fetchJson(`/api/groups/${groupId}/routes?user_id=${user.uid}`).then(setRoutes).catch(() => setRoutes([]));
    fetchJson(`/api/groups/${groupId}/collections?user_id=${user.uid}`).then(setCollections).catch(() => setCollections([]));
  };
  useEffect(() => { if (user) load(); }, [groupId, user]);

  const copyInvite = () => {
    navigator.clipboard?.writeText(group.invite_code);
    toast.success('Invite code copied');
  };

  const leaveGroup = async () => {
    await fetch(`/api/groups/${groupId}/leave`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.uid }),
    });
    toast.success('Left group');
    onBack();
  };

  const deleteGroup = async () => {
    await fetch(`/api/groups/${groupId}?user_id=${user.uid}`, { method: 'DELETE' });
    toast.success('Group deleted');
    onBack();
  };

  const createCollection = async () => {
    if (!collectionName.trim()) return;
    await fetch(`/api/groups/${groupId}/collections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.uid, name: collectionName.trim() }),
    });
    setCollectionName(''); setShowCreateCollection(false); load();
  };

  if (!group) return <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;

  const isOwner = group.owner_id === user.uid;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-10">
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{group.name}</h1>
        <div className="w-10" />
      </div>
      <div className="px-6">
        <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{group.category} · {group.member_ids?.length} member{group.member_ids?.length === 1 ? '' : 's'}</p>
              <p className="text-sm font-medium mt-1">Invite code: <span className="font-mono">{group.invite_code}</span></p>
            </div>
            <button onClick={copyInvite} className="text-xs font-medium px-3 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 shrink-0">Copy</button>
          </div>
          <button onClick={isOwner ? deleteGroup : leaveGroup} className="text-xs text-red-600 dark:text-red-400 mt-3">
            {isOwner ? 'Delete group' : 'Leave group'}
          </button>
        </div>

        <div className="flex items-center justify-between mt-6 mb-2">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Collections</p>
          <button onClick={() => setShowCreateCollection((s) => !s)} className="text-xs font-medium">+ New</button>
        </div>
        {showCreateCollection && (
          <div className="flex items-center gap-2 mb-3">
            <Input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} placeholder="e.g. Weekend Trips"
              className="h-10 rounded-xl border-neutral-200 dark:border-neutral-700 text-sm" onKeyDown={(e) => e.key === 'Enter' && createCollection()} />
            <button onClick={createCollection} className="h-10 px-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm">Add</button>
          </div>
        )}
        <div className="space-y-2 mb-6">
          {collections.length === 0 && <p className="text-xs text-neutral-400 dark:text-neutral-500">No collections yet.</p>}
          {collections.map((c) => (
            <div key={c.id} className="rounded-xl border border-neutral-100 dark:border-neutral-800 p-3 text-sm">
              {c.name} <span className="text-neutral-400 text-xs">({c.route_ids?.length || 0} routes)</span>
            </div>
          ))}
        </div>

        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Shared with this group</p>
        <div className="space-y-3">
          {routes.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400 py-6 text-center">No routes shared here yet.</p>}
          {routes.map((r) => <RouteCard key={r.id} route={r} onOpen={() => onOpenRoute(r.id)} />)}
        </div>
      </div>
    </div>
  );
}

// ============= PROFILE =============
function Profile({ user, googleUser, updateName, signInWithGoogle, signOut, onNavLeaderboards, onNavGroups }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({ routes: 0, verifications: 0 });
  const [profile, setProfile] = useState(() => getLocalProfile());
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [communityStats, setCommunityStats] = useState(null);
  const [challenges, setChallenges] = useState([]);
  useEffect(() => {
    if (!user) return;
    fetchJson(`/api/users/${user.uid}/stats`).then(setCommunityStats).catch(() => setCommunityStats(null));
    fetchJson(`/api/challenges?user_id=${user.uid}`).then(setChallenges).catch(() => setChallenges([]));
  }, [user]);
  useEffect(() => { setName(user?.name || ''); }, [user]);
  useEffect(() => {
    if (googleUser) {
      setProfile({
        dob: googleUser.dob || null, gender: googleUser.gender || null,
        home_city: googleUser.home_city || null, interest_tags: googleUser.interest_tags || [],
        avatar_id: googleUser.avatar_id || 'avatar_01',
      });
    } else {
      setProfile(getLocalProfile());
    }
  }, [googleUser]);
  useEffect(() => {
    if (!user) return;
    fetchJson(`/api/routes?user_id=${user.uid}`).then((rts) => {
      setStats({ routes: rts.length, verifications: rts.reduce((a, r) => a + (r.verified_count || 0), 0) });
    }).catch(() => setStats({ routes: 0, verifications: 0 }));
  }, [user]);
  const save = () => {
    if (name.trim()) { updateName(name.trim()); setEditing(false); toast.success('Profile updated'); }
  };
  const saveProfile = async (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    if (googleUser) {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => null);
      if (!res?.ok) toast.error('Could not save — try again.');
    } else {
      saveLocalProfile(patch);
    }
  };
  const toggleInterestTag = (tag) => {
    const has = profile.interest_tags?.includes(tag);
    const next = has ? profile.interest_tags.filter((t) => t !== tag) : [...(profile.interest_tags || []), tag];
    saveProfile({ interest_tags: next });
  };
  const age = profile.dob ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28">
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      </div>
      <div className="px-6">
        <div className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-6 flex items-center gap-4">
          {googleUser?.picture ? (
            <img src={googleUser.picture} alt="" className="h-16 w-16 rounded-2xl object-cover" referrerPolicy="no-referrer" />
          ) : (
            <button onClick={() => setShowAvatarPicker(true)} className="relative">
              <Avatar avatarId={profile.avatar_id} size={64} />
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                <Pencil className="h-2.5 w-2.5" />
              </span>
            </button>
          )}
          <div className="flex-1 min-w-0">
            {editing && !googleUser ? (
              <div className="flex items-center gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl border-neutral-200 dark:border-neutral-700" />
                <button onClick={save} className="h-10 px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm">Save</button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold truncate">{user?.name}</h2>
                {googleUser ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{googleUser.email}</p>
                ) : (
                  <button onClick={() => setEditing(true)} className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Edit name</button>
                )}
              </>
            )}
          </div>
        </div>

        {showAvatarPicker && (
          <div className="fixed inset-0 z-[600] flex items-end bg-black/40" onClick={() => setShowAvatarPicker(false)}>
            <div className="w-full bg-white dark:bg-neutral-900 rounded-t-3xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold mb-3">Choose an avatar</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATARS.map((a) => (
                  <button key={a.id} onClick={() => { saveProfile({ avatar_id: a.id }); setShowAvatarPicker(false); }}
                    className={`rounded-2xl p-1 ${profile.avatar_id === a.id ? 'ring-2 ring-neutral-900 dark:ring-white' : ''}`}>
                    <Avatar avatarId={a.id} size={56} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">About you</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Date of birth</label>
              <Input type="date" value={profile.dob || ''} onChange={(e) => saveProfile({ dob: e.target.value || null })}
                className="mt-1 h-10 rounded-xl border-neutral-200 dark:border-neutral-700 text-sm" />
              {age != null && <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{age} years old</p>}
            </div>
            <div>
              <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Home city</label>
              <Input value={profile.home_city || ''} onChange={(e) => setProfile((p) => ({ ...p, home_city: e.target.value }))}
                onBlur={(e) => saveProfile({ home_city: e.target.value })}
                placeholder="e.g. Raipur" className="mt-1 h-10 rounded-xl border-neutral-200 dark:border-neutral-700 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Gender (optional)</label>
            <div className="flex gap-2 mt-1">
              {['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => (
                <button key={g} onClick={() => saveProfile({ gender: profile.gender === g ? null : g })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${profile.gender === g ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-neutral-500 dark:text-neutral-400">What kind of traveller are you?</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {INTEREST_TAGS.map((tag) => (
                <button key={tag} onClick={() => toggleInterestTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${profile.interest_tags?.includes(tag) ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 flex items-center justify-between gap-3">
          {googleUser ? (
            <>
              <div>
                <p className="text-sm font-medium">Signed in with Google</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Your routes are synced to this account.</p>
              </div>
              <button onClick={() => signOut()} className="text-xs font-medium px-3 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 shrink-0">
                Sign out
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">Not signed in</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Sign in with Google to sync routes across devices.</p>
              </div>
              <GoogleSignInButton onSignedIn={signInWithGoogle} />
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-5">
            <p className="text-2xl font-semibold tabular-nums">{stats.routes}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Routes recorded</p>
          </div>
          <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-5">
            <p className="text-2xl font-semibold tabular-nums">{stats.verifications}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Local verifications</p>
          </div>
        </div>
        <button onClick={() => onNavGroups?.()} className="mt-4 w-full rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 flex items-center justify-between text-left">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Groups</p>
            <p className="text-sm font-semibold mt-1">Family, riders, trek groups — private route sharing</p>
          </div>
          <Users className="h-5 w-5 text-neutral-400" />
        </button>
        {communityStats && (
          <div className="mt-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Community level</p>
                <p className="text-sm font-semibold mt-0.5">{communityStats.level?.label}</p>
              </div>
              <button onClick={() => onNavLeaderboards?.()} className="text-xs font-medium px-3 py-2 rounded-full border border-neutral-200 dark:border-neutral-700">
                Leaderboards
              </button>
            </div>
            {communityStats.badges?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {communityStats.badges.map((b) => (
                  <span key={b.key} className="px-2.5 py-1 rounded-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-xs">
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {challenges.length > 0 && (
          <div className="mt-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">This week's challenges</p>
            <div className="space-y-2.5">
              {challenges.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700 dark:text-neutral-300">{c.label}</span>
                    <span className="text-neutral-400">{c.progress}/{c.target}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 mt-1 overflow-hidden">
                    <div className="h-full bg-neutral-900 dark:bg-white rounded-full" style={{ width: `${Math.min(100, (c.progress / c.target) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <SettingsSection />
        <div className="mt-6 rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white p-6">
          <RouteIcon className="h-6 w-6 mb-2" />
          <h3 className="text-lg font-semibold">Navigate Like A Local</h3>
          <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
            Google Maps knows roads. Locals know better. Every route you share adds to the collective
            wisdom of your community.
          </p>
        </div>
        <div className="mt-6 space-y-1 text-xs text-neutral-400 dark:text-neutral-500">
          <p>User ID • {user?.uid?.slice(0, 8)}…</p>
          <p>Raasta v2.0 • MVP</p>
        </div>
      </div>
    </div>
  );
}

// ============= SHARE SHEET (three states: open | mini | null) =============
const VISIBILITY_PILLS = [
  { key: 'public', label: 'Public' },
  { key: 'group', label: 'Group Only' },
  { key: 'private', label: 'Private' },
  { key: 'selected', label: 'Selected People' },
];
const DURATION_PILLS = [
  { key: 'today', label: 'Today only' },
  { key: '24h', label: '24 hours' },
  { key: 'permanent', label: 'Permanent' },
];

function ShareSheet({ route, user, mode, setMode }) {
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState(route?.visibility || (route?.is_public ? 'public' : 'private'));
  const [groupIds, setGroupIds] = useState(route?.visible_group_ids || []);
  const [peopleText, setPeopleText] = useState((route?.visible_user_ids || []).join(', '));
  const [duration, setDuration] = useState('permanent');
  const [myGroups, setMyGroups] = useState([]);
  const [publishing, setPublishing] = useState(false);
  useEffect(() => {
    setVisibility(route?.visibility || (route?.is_public ? 'public' : 'private'));
    setGroupIds(route?.visible_group_ids || []);
    setPeopleText((route?.visible_user_ids || []).join(', '));
  }, [route?.id]);
  useEffect(() => {
    if (user) fetchJson(`/api/groups?user_id=${user.uid}`).then(setMyGroups).catch(() => setMyGroups([]));
  }, [user]);
  const isPublic = visibility === 'public';
  // Never build a link from a route that hasn't actually been persisted —
  // this is what previously produced ".../r/undefined" links.
  if (!route?.share_code) return null;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${route.share_code}` : '';

  const saveVisibility = async (next) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/routes/${route.id}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.uid, visibility: next.visibility ?? visibility,
          group_ids: next.groupIds ?? groupIds,
          user_ids: next.userIds ?? peopleText.split(',').map((s) => s.trim()).filter(Boolean),
          expires_in: next.duration ?? duration,
        }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Sharing settings updated');
    } catch {
      toast.error('Could not update. Try again.');
    } finally {
      setPublishing(false);
    }
  };
  const selectVisibility = (key) => { setVisibility(key); saveVisibility({ visibility: key }); };
  const toggleGroup = (id) => {
    const next = groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id];
    setGroupIds(next); saveVisibility({ visibility: 'group', groupIds: next });
  };
  const selectDuration = (key) => { setDuration(key); saveVisibility({ duration: key }); };
  const waText = `${route.name} — shared on Raasta.\n\n🗺️ Navigate Like A Local. Use my Raasta link instead of explaining directions on call:\n${shareUrl}`;

  const close = () => setMode(null);
  const minimize = () => setMode('mini');
  const expand = () => setMode('open');

  // Auto-minimize after 5s when opened
  useEffect(() => {
    if (mode === 'open') {
      const t = setTimeout(() => setMode('mini'), 5000);
      return () => clearTimeout(t);
    }
  }, [mode, setMode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true); toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: route.name, text: `Route on Raasta: ${route.name}\nNavigate Like A Local.`, url: shareUrl }); } catch {}
    } else { copy(); }
  };

  if (mode === 'mini') {
    return (
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="fixed bottom-24 left-0 right-0 z-40 pointer-events-none flex justify-center px-4"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={expand}
          className="pointer-events-auto h-12 pl-4 pr-2 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-2xl shadow-neutral-900/30 flex items-center gap-3 max-w-[92%]"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate">Share Route</span>
          <span className="text-[10px] text-white/60 dark:text-neutral-900/60 truncate hidden xs:inline">{route.name}</span>
          <span
            role="button"
            aria-label="Dismiss share"
            onClick={(e) => { e.stopPropagation(); close(); }}
            className="ml-1 h-8 w-8 rounded-full bg-white/10 dark:bg-neutral-900/10 flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </span>
        </motion.button>
      </motion.div>
    );
  }

  if (mode !== 'open') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Soft backdrop that doesn't fully block detail; tap to minimize */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={minimize}
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
      />
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 400) minimize();
        }}
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white dark:bg-neutral-950 rounded-t-3xl sm:rounded-3xl p-6 pb-10 shadow-2xl"
      >
        <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700 mx-auto mb-5 cursor-grab active:cursor-grabbing" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Share route</h3>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Swipe down to minimize · auto-hides in 5s</p>
          </div>
          <button onClick={close} className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white p-5 mb-4">
          <div className="flex items-center gap-2 text-white/70 text-[10px] uppercase tracking-widest">
            <RouteIcon className="h-3 w-3" /> Raasta
          </div>
          <h2 className="text-xl font-semibold mt-3">{route.name}</h2>
          {route.ai_summary?.vibe && <p className="text-xs text-white/70 mt-1 lowercase">“{route.ai_summary.vibe}”</p>}
          <div className="flex items-center gap-3 mt-4 text-xs text-white/80">
            <span>{formatDistance(route.distance_km || 0)}</span>
            <span>•</span>
            <span>{formatDuration(route.duration_sec || 0)}</span>
            {route.verified_count > 0 && <><span>•</span><span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {route.verified_count} locals</span></>}
          </div>
          <p className="text-[11px] text-white/60 mt-4">Navigate Like A Local.</p>
        </div>
        <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 p-4 border border-neutral-100 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Public link</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm font-medium truncate flex-1">{shareUrl}</p>
            <button onClick={copy} className="h-9 w-9 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 p-4 border border-neutral-100 dark:border-neutral-800">
          <p className="text-sm font-medium">Who can see this route?</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {VISIBILITY_PILLS.map((v) => (
              <button key={v.key} disabled={publishing} onClick={() => selectVisibility(v.key)}
                className={`h-10 rounded-xl text-xs font-medium border ${visibility === v.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {visibility === 'group' && (
            <div className="mt-3 space-y-1.5">
              {myGroups.length === 0 && <p className="text-[11px] text-neutral-500 dark:text-neutral-400">You're not in any groups yet.</p>}
              {myGroups.map((g) => (
                <label key={g.id} className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm">
                  <span>☑️ Automatically share with {g.name}</span>
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="h-4 w-4 accent-neutral-900" />
                </label>
              ))}
            </div>
          )}

          {visibility === 'selected' && (
            <div className="mt-3">
              <Input value={peopleText} onChange={(e) => setPeopleText(e.target.value)}
                onBlur={() => saveVisibility({ userIds: peopleText.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="Paste their user id, comma-separated" className="h-10 rounded-xl border-neutral-200 dark:border-neutral-700 text-sm" />
            </div>
          )}

          {visibility !== 'private' && (
            <div className="mt-3">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1.5">Sharing duration</p>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_PILLS.map((d) => (
                  <button key={d.key} disabled={publishing} onClick={() => selectDuration(d.key)}
                    className={`h-9 rounded-lg text-[11px] font-medium border ${duration === d.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"
            className="h-14 rounded-2xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2">
            <MessageCircle className="h-5 w-5" /> WhatsApp
          </a>
          <button onClick={nativeShare} className="h-14 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold flex items-center justify-center gap-2">
            <Share2 className="h-5 w-5" /> More
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center mt-4">“Use my Raasta link instead of explaining directions on call.”</p>
      </motion.div>
    </motion.div>
  );
}

// ============= APP =============
function App() {
  const [screen, setScreen] = useState('splash');
  const [detailId, setDetailId] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [recordedData, setRecordedData] = useState(null);
  const [shareRoute, setShareRoute] = useState(null);
  const [shareMode, setShareMode] = useState(null); // 'open' | 'mini' | null
  const { user, googleUser, signInWithGoogle, signOut, updateName } = useAuth();
  useServiceWorker();

  const openShare = (r) => { setShareRoute(r); setShareMode('open'); };
  const setMode = (m) => { setShareMode(m); if (m === null) setShareRoute(null); };

  const goto = (s, id = null) => {
    if (s === 'detail' && id) setDetailId(id);
    if (s === 'group-detail' && id) setGroupId(id);
    setScreen(s);
  };

  const showBottomNav = ['home', 'explore', 'my', 'profile'].includes(screen);

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-neutral-950 min-h-screen relative overflow-x-hidden">
      <AnimatePresence mode="wait">
        {screen === 'splash' && <Splash key="splash" onDone={() => setScreen('home')} />}
      </AnimatePresence>

      {screen === 'home' && <Home onNav={goto} user={user} />}
      {screen === 'record' && (
        <Record user={user} onBack={() => setScreen('home')}
          onDone={(data) => { setRecordedData(data); setScreen('save'); }} />
      )}
      {screen === 'save' && recordedData && (
        <Save data={recordedData} user={user} onBack={() => setScreen('record')}
          onSaved={(r) => { setRecordedData(null); setDetailId(r.id); openShare(r); setScreen('detail'); }} />
      )}
      {screen === 'my' && <Library user={user} onOpen={(id) => goto('detail', id)} />}
      {screen === 'explore' && <Explore onOpen={(id) => goto('detail', id)} />}
      {screen === 'plan' && <PlanTrip onBack={() => setScreen('home')} onOpen={(id) => goto('detail', id)} />}
      {screen === 'profile' && (
        <Profile user={user} googleUser={googleUser} updateName={updateName}
          signInWithGoogle={signInWithGoogle} signOut={signOut} onNavLeaderboards={() => setScreen('leaderboards')}
          onNavGroups={() => setScreen('groups')} />
      )}
      {screen === 'leaderboards' && <Leaderboards onBack={() => setScreen('profile')} />}
      {screen === 'groups' && (
        <Groups user={user} onBack={() => setScreen('profile')} onOpenGroup={(id) => goto('group-detail', id)} />
      )}
      {screen === 'group-detail' && groupId && (
        <GroupDetail groupId={groupId} user={user} onBack={() => setScreen('groups')} onOpenRoute={(id) => goto('detail', id)} />
      )}
      {screen === 'detail' && detailId && (
        <Detail routeId={detailId} user={user} onBack={() => setScreen('home')} onShare={openShare}
          onOpenRoute={(id) => setDetailId(id)} />
      )}

      {showBottomNav && <BottomNav active={screen} onNav={goto} />}

      <AnimatePresence>
        {shareRoute && shareMode && (
          <ShareSheet route={shareRoute} user={user} mode={shareMode} setMode={setMode} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
