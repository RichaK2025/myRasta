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
  MapPinned, ThumbsUp, ThumbsDown, Users, Sun, Moon, Monitor, Settings, Umbrella
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { totalDistance, haversine, formatDuration, formatDistance } from '@/lib/geo';
import { cacheRoute, listCached } from '@/lib/offlineCache';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const TAGS = [
  'Fastest', 'Scenic', 'Family Friendly', 'Women Safe', 'Bike Route',
  'Truck Friendly', 'Pilgrimage', 'Rain Safe', 'Monsoon Safe', 'Avoid Traffic',
  'Village Route', 'Adventure',
];
const ROUTE_TYPES = ['Commute', 'Road Trip', 'Bike Ride', 'Walk', 'Village', 'Delivery', 'Pilgrimage'];

const CONDITION_TYPES = [
  { key: 'pothole', label: 'Pothole', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'flooding', label: 'Flooding', icon: CloudRain, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'traffic', label: 'Traffic', icon: Zap, color: 'text-red-700 bg-red-50 border-red-200' },
  { key: 'roadblock', label: 'Roadblock', icon: Construction, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'closure', label: 'Closure', icon: X, color: 'text-neutral-800 bg-neutral-100 border-neutral-200' },
  { key: 'info', label: 'Info', icon: Info, color: 'text-neutral-700 bg-neutral-50 border-neutral-200' },
];

const NOTE_CATEGORIES = [
  { key: 'tea', label: 'Tea/Chai', icon: Coffee, color: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-600' },
  { key: 'food', label: 'Food', icon: Utensils, color: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-500' },
  { key: 'fuel', label: 'Fuel', icon: Fuel, color: 'bg-cyan-50 border-cyan-200 text-cyan-800', dot: 'bg-cyan-600' },
  { key: 'washroom', label: 'Washroom', icon: Bath, color: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-600' },
  { key: 'police', label: 'Police', icon: Shield, color: 'bg-indigo-50 border-indigo-200 text-indigo-800', dot: 'bg-indigo-600' },
  { key: 'danger', label: 'Danger', icon: AlertTriangle, color: 'bg-red-50 border-red-200 text-red-800', dot: 'bg-red-600' },
  { key: 'safe', label: 'Safe', icon: ShieldCheck, color: 'bg-green-50 border-green-200 text-green-800', dot: 'bg-green-600' },
  { key: 'scenic', label: 'Scenic', icon: Mountain, color: 'bg-violet-50 border-violet-200 text-violet-800', dot: 'bg-violet-600' },
  { key: 'shortcut', label: 'Shortcut', icon: Zap, color: 'bg-pink-50 border-pink-200 text-pink-800', dot: 'bg-pink-600' },
  { key: 'warning', label: 'Warning', icon: Info, color: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-700' },
];

const EXPLORE_CATEGORIES = [
  { key: 'trending', label: 'Trending', icon: TrendingUp },
  { key: 'popular', label: 'Popular', icon: Flame },
  { key: 'Scenic', label: 'Scenic', icon: Mountain },
  { key: 'Women Safe', label: 'Women Safe', icon: ShieldCheck },
  { key: 'Family Friendly', label: 'Family', icon: Baby },
  { key: 'Pilgrimage', label: 'Pilgrimage', icon: Church },
  { key: 'Rain Safe', label: 'Rain Safe', icon: Umbrella },
  { key: 'Bike Route', label: 'Bike', icon: Bike },
];

function useLocalUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let uid = localStorage.getItem('raasta_uid');
    let name = localStorage.getItem('raasta_name');
    if (!uid) { uid = crypto.randomUUID(); localStorage.setItem('raasta_uid', uid); }
    if (!name) { name = 'Traveller ' + uid.slice(0, 4).toUpperCase(); localStorage.setItem('raasta_name', name); }
    setUser({ uid, name });
  }, []);
  const updateName = (n) => {
    localStorage.setItem('raasta_name', n);
    setUser((u) => ({ ...u, name: n }));
  };
  return { user, updateName };
}

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
function Home({ onNav, user }) {
  const [myRoutes, setMyRoutes] = useState([]);
  const [trending, setTrending] = useState([]);
  const online = useOnlineStatus();

  useEffect(() => {
    if (!user) return;
    if (!online) { setMyRoutes(listCached()); return; }
    fetch(`/api/routes?user_id=${user.uid}`).then(r => r.json()).then(setMyRoutes).catch(() => setMyRoutes(listCached()));
    fetch(`/api/routes?sort=trending`).then(r => r.json()).then(setTrending).catch(() => {});
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
function RouteCard({ route, onOpen }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} onClick={onOpen}
      className="rounded-3xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm cursor-pointer">
      <div className="h-36 bg-neutral-100 dark:bg-neutral-800 relative">
        {route.points?.length > 1 ? (
          <MapView points={route.points} fit interactive={false} showEnds height="100%" />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-300 dark:text-neutral-600">
            <MapPin className="h-8 w-8" />
          </div>
        )}
        {route.ai_summary?.vibe && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[10px] font-medium flex items-center gap-1 shadow-sm">
            <Sparkles className="h-3 w-3" /> {route.ai_summary.vibe}
          </div>
        )}
        {route.verified_count > 0 && (
          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-neutral-900/90 text-white text-[10px] font-medium flex items-center gap-1 shadow-sm">
            <ShieldCheck className="h-3 w-3" /> Verified by {route.verified_count}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold truncate">{route.name}</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">by {route.creator_name}</p>
          </div>
          {route.route_type && (
            <Badge variant="secondary" className="rounded-full text-[10px] font-normal shrink-0">{route.route_type}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-neutral-600 dark:text-neutral-400 flex-wrap">
          <span className="flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" /> {formatDistance(route.distance_km || 0)}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(route.duration_sec || 0)}</span>
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {route.views || 0}</span>
          {route.likes > 0 && <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {route.likes}</span>}
          {route.rating_count > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {route.rating_avg?.toFixed(1)}</span>}
        </div>
        {route.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {route.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">{t}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============= RECORD =============
function Record({ onBack, onDone }) {
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const distanceKm = useMemo(() => totalDistance(points), [points]);

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startRecording = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    setError(null); setStatus('recording');
    startTimeRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp,
          speed: pos.coords.speed ?? 0, altitude: pos.coords.altitude ?? null, accuracy: pos.coords.accuracy };
        setPoints((prev) => {
          if (prev.length === 0) return [p];
          const last = prev[prev.length - 1];
          const d = haversine(last, p);
          // Drop near-duplicate noise from a poor fix.
          if (d * 1000 < 3 && pos.coords.accuracy > 20) return prev;
          // Drop fixes too imprecise to trust (GPS drift / multipath jumps).
          if (pos.coords.accuracy > 30) return prev;
          // Drop implied-speed outliers — a fix that would require teleporting.
          const dtSec = (p.timestamp - last.timestamp) / 1000;
          if (dtSec > 0 && (d / dtSec) * 3600 > 220) return prev;
          return [...prev, p];
        });
        const spd = (pos.coords.speed ?? 0) * 3.6;
        setCurrentSpeed(spd); setMaxSpeed((m) => Math.max(m, spd));
      },
      (err) => { setError(err.message); toast.error('Location error: ' + err.message); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  };

  const pauseRecording = () => {
    setStatus('paused');
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
  };

  const stopRecording = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (points.length < 2) { toast.error('Not enough movement recorded.'); return; }
    onDone({
      points, distance_km: distanceKm, duration_sec: elapsed, max_speed_kmh: maxSpeed,
      avg_speed_kmh: elapsed > 0 ? (distanceKm / (elapsed / 3600)) : 0,
      start: points[0], end: points[points.length - 1],
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
          <MapView points={points} follow={status === 'recording'} center={last ? [last.lat, last.lng] : null} zoom={17} />
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 rounded-t-3xl -mt-6 relative z-10 shadow-2xl">
        <div className="px-6 pt-6 pb-8">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Distance" value={formatDistance(distanceKm)} />
            <Stat label="Time" value={formatDuration(elapsed)} />
            <Stat label="Speed" value={`${currentSpeed.toFixed(1)} km/h`} />
          </div>
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
              <motion.button whileTap={{ scale: 0.97 }} onClick={pauseRecording}
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
          tags, notes: notes.trim(), creator_name: user?.name || 'Anonymous', user_id: user?.uid }),
      });
      const created = await res.json();
      cacheRoute(created);
      toast.success('Route saved!');
      fetch(`/api/routes/${created.id}/summarize`, { method: 'POST' }).catch(() => {});
      onSaved(created);
    } catch { toast.error('Failed to save. Try again.'); }
    finally { setSaving(false); }
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
          <MapView points={data.points} fit interactive={false} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 py-3 px-2">
          <MiniStat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(data.distance_km)} />
          <MiniStat icon={<Clock className="h-4 w-4" />} label="Time" value={formatDuration(data.duration_sec)} />
          <MiniStat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${data.avg_speed_kmh?.toFixed(1) || 0} km/h`} />
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
function VerifiedPill({ route, user, onChange }) {
  const [count, setCount] = useState(route.verified_count || 0);
  const [byMe, setByMe] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/routes/${route.id}/verifications`).then(r => r.json()).then((d) => {
      setCount(d.count || 0);
      setByMe(!!d.users?.find(u => u.user_id === user?.uid));
    });
  }, [route.id, user?.uid]);

  const toggle = async () => {
    if (!user) return; setBusy(true);
    try {
      const res = await fetch(`/api/routes/${route.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, author: user.name, unverify: byMe }),
      });
      const data = await res.json();
      setCount(data.verified_count);
      setByMe(!byMe);
      onChange?.(data.verified_count);
      toast.success(byMe ? 'Verification removed' : 'You verified this route ✓');
    } finally { setBusy(false); }
  };

  return (
    <button onClick={toggle} disabled={busy}
      className={`w-full rounded-2xl border p-4 flex items-center justify-between transition ${
        byMe ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${byMe ? 'bg-white/10 dark:bg-neutral-900/10' : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'}`}>
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold">{count > 0 ? `Verified by ${count} local${count > 1 ? 's' : ''}` : 'Not verified yet'}</p>
          <p className={`text-[11px] ${byMe ? 'text-white/70 dark:text-neutral-900/70' : 'text-neutral-500 dark:text-neutral-400'}`}>{byMe ? 'Tap to remove your verification' : 'Confirm this route is accurate'}</p>
        </div>
      </div>
      <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${byMe ? 'bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white' : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'}`}>
        {byMe ? 'Verified ✓' : 'Verify'}
      </div>
    </button>
  );
}

// ============= COMMUNITY NOTES (map-point) =============
function CommunityNotes({ routeId, user, points }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('tea');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => fetch(`/api/routes/${routeId}/notes`).then(r => r.json()).then(setItems).catch(() => {});
  useEffect(() => { load(); }, [routeId]);

  const submit = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/routes/${routeId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, category, text: text.trim() }),
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
          const cfg = NOTE_CATEGORIES.find(c => c.key === n.category) || NOTE_CATEGORIES[9];
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
  const load = () => fetch(`/api/routes/${routeId}/conditions`).then(r => r.json()).then(setItems).catch(() => {});
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
  const load = () => fetch(`/api/routes/${routeId}/comments`).then(r => r.json()).then(setItems).catch(() => {});
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
function Detail({ routeId, onBack, onShare, user }) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [notes, setNotes] = useState([]);

  const load = () => {
    fetch(`/api/routes/${routeId}`).then((r) => r.json()).then((r) => {
      setRoute(r); cacheRoute(r); setLoading(false);
      if (!r.ai_summary) genSummary(r.id);
    });
    fetch(`/api/routes/${routeId}/notes`).then(r => r.json()).then(setNotes).catch(() => {});
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
          <Comments routeId={route.id} user={user} />
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
function Explore({ onBack, onOpen }) {
  const [routes, setRoutes] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('trending');

  useEffect(() => {
    let url;
    if (cat === 'trending' || cat === 'popular') {
      url = `/api/routes?sort=${cat}`;
    } else {
      url = `/api/routes?sort=trending`; // filter client-side by tag
    }
    fetch(url).then(r => r.json()).then((data) => {
      if (cat !== 'trending' && cat !== 'popular') {
        setRoutes(data.filter(r => r.tags?.includes(cat)));
      } else setRoutes(data);
    }).catch(() => setRoutes([]));
  }, [cat]);

  const filtered = (routes || []).filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.tags?.some(t => t.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28">
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Discover routes curated by locals</p>
      </div>
      <div className="px-6">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search routes..."
            className="pl-11 h-12 rounded-2xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900" />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {EXPLORE_CATEGORIES.map(t => (
            <button key={t.key} onClick={() => setCat(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${cat === t.key ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'}`}>
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 mt-5 space-y-3">
        {routes === null && [1,2,3].map(i => <div key={i} className="rounded-3xl h-56 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />)}
        {routes !== null && filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-neutral-500 dark:text-neutral-400">No routes in this category yet.</div>
        )}
        {filtered.map(r => <RouteCard key={r.id} route={r} onOpen={() => onOpen(r.id)} />)}
      </div>
    </div>
  );
}

// ============= LIBRARY =============
function Library({ user, onOpen }) {
  const [routes, setRoutes] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!user) return;
    fetch(`/api/routes?user_id=${user.uid}`).then(r => r.json()).then(setRoutes).catch(() => setRoutes([]));
  }, [user]);
  const filtered = (routes || []).filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.tags?.some(t => t.toLowerCase().includes(q.toLowerCase()))
  );
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
      <div className="px-6 mt-5 space-y-3">
        {routes === null && [1,2,3].map(i => <div key={i} className="rounded-3xl h-56 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />)}
        {routes !== null && filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-neutral-500 dark:text-neutral-400">No saved routes yet.</div>
        )}
        {filtered.map(r => <RouteCard key={r.id} route={r} onOpen={() => onOpen(r.id)} />)}
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
  return (
    <div className="mt-4 rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        <p className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">Settings</p>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Appearance</p>
      <ThemeToggle />
    </div>
  );
}

// ============= PROFILE =============
function Profile({ user, updateName }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({ routes: 0, verifications: 0 });
  useEffect(() => { setName(user?.name || ''); }, [user]);
  useEffect(() => {
    if (!user) return;
    fetch(`/api/routes?user_id=${user.uid}`).then(r => r.json()).then((rts) => {
      setStats({ routes: rts.length, verifications: rts.reduce((a, r) => a + (r.verified_count || 0), 0) });
    });
  }, [user]);
  const save = () => {
    if (name.trim()) { updateName(name.trim()); setEditing(false); toast.success('Profile updated'); }
  };
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28">
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      </div>
      <div className="px-6">
        <div className="rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-neutral-900 text-2xl font-semibold">
            {user?.name?.[0]?.toUpperCase() || 'R'}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl border-neutral-200 dark:border-neutral-700" />
                <button onClick={save} className="h-10 px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm">Save</button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold truncate">{user?.name}</h2>
                <button onClick={() => setEditing(true)} className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Edit name</button>
              </>
            )}
          </div>
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
function ShareSheet({ route, mode, setMode }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${route.share_code}` : '';
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
  const [recordedData, setRecordedData] = useState(null);
  const [shareRoute, setShareRoute] = useState(null);
  const [shareMode, setShareMode] = useState(null); // 'open' | 'mini' | null
  const { user, updateName } = useLocalUser();
  useServiceWorker();

  const openShare = (r) => { setShareRoute(r); setShareMode('open'); };
  const setMode = (m) => { setShareMode(m); if (m === null) setShareRoute(null); };

  const goto = (s, id = null) => {
    if (s === 'detail' && id) setDetailId(id);
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
        <Record onBack={() => setScreen('home')}
          onDone={(data) => { setRecordedData(data); setScreen('save'); }} />
      )}
      {screen === 'save' && recordedData && (
        <Save data={recordedData} user={user} onBack={() => setScreen('record')}
          onSaved={(r) => { setRecordedData(null); setDetailId(r.id); openShare(r); setScreen('detail'); }} />
      )}
      {screen === 'my' && <Library user={user} onOpen={(id) => goto('detail', id)} />}
      {screen === 'explore' && <Explore onOpen={(id) => goto('detail', id)} />}
      {screen === 'profile' && <Profile user={user} updateName={updateName} />}
      {screen === 'detail' && detailId && (
        <Detail routeId={detailId} user={user} onBack={() => setScreen('home')} onShare={openShare} />
      )}

      {showBottomNav && <BottomNav active={screen} onNav={goto} />}

      <AnimatePresence>
        {shareRoute && shareMode && (
          <ShareSheet route={shareRoute} mode={shareMode} setMode={setMode} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
