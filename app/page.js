'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Play, Pause, Square, ChevronLeft, Share2, Copy, MessageCircle,
  Route as RouteIcon, Compass, Search, Heart, Eye, Clock, Gauge, Plus, Sparkles,
  Bookmark, Camera, Check, QrCode, X, Loader2, Trash2, Star, AlertTriangle,
  TrendingUp, Flame, WifiOff, Send, Zap, Info, CloudRain, Construction
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { totalDistance, haversine, formatDuration, formatDistance } from '@/lib/geo';
import { cacheRoute, listCached, getCachedRoute } from '@/lib/offlineCache';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const TAGS = [
  'Fastest', 'Scenic', 'Family Friendly', 'Bike Route',
  'Truck Friendly', 'Monsoon Safe', 'Avoid Traffic', 'Village Route',
];
const ROUTE_TYPES = ['Commute', 'Road Trip', 'Bike Ride', 'Walk', 'Village', 'Delivery'];

const CONDITION_TYPES = [
  { key: 'pothole', label: 'Pothole', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'traffic', label: 'Traffic', icon: Zap, color: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'roadblock', label: 'Roadblock', icon: Construction, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { key: 'weather', label: 'Weather', icon: CloudRain, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'info', label: 'Info', icon: Info, color: 'text-neutral-600 bg-neutral-50 border-neutral-200' },
];

function useLocalUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let uid = localStorage.getItem('raasta_uid');
    let name = localStorage.getItem('raasta_name');
    if (!uid) {
      uid = crypto.randomUUID();
      localStorage.setItem('raasta_uid', uid);
    }
    if (!name) {
      name = 'Traveller ' + uid.slice(0, 4).toUpperCase();
      localStorage.setItem('raasta_name', name);
    }
    setUser({ uid, name });
  }, []);
  return { user };
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
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// ============= SPLASH =============
function Splash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="h-20 w-20 rounded-3xl bg-neutral-900 flex items-center justify-center shadow-2xl">
          <RouteIcon className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        <motion.h1
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-3xl font-semibold tracking-tight"
        >
          Raasta
        </motion.h1>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-2 text-sm text-neutral-500"
        >
          Real routes, by real people.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

// ============= HOME =============
function Home({ onNav, user }) {
  const [myRoutes, setMyRoutes] = useState([]);
  const online = useOnlineStatus();

  useEffect(() => {
    if (!user) return;
    if (!online) {
      setMyRoutes(listCached());
      return;
    }
    fetch(`/api/routes?user_id=${user.uid}`).then(r => r.json()).then(setMyRoutes).catch(() => {
      setMyRoutes(listCached());
    });
  }, [user, online]);

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="px-6 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">Hello,</p>
            <h1 className="text-2xl font-semibold tracking-tight">{user?.name?.split(' ')[0] || 'there'} 👋</h1>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <RouteIcon className="h-5 w-5" />
          </div>
        </div>
        {!online && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-2.5 flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-700" />
            <p className="text-xs text-amber-800">You’re offline. Showing cached routes.</p>
          </div>
        )}
      </div>

      <div className="px-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onNav('record')}
          className="w-full rounded-3xl bg-neutral-900 text-white p-6 flex items-center justify-between shadow-xl shadow-neutral-900/10"
        >
          <div className="text-left">
            <p className="text-xs text-neutral-400 uppercase tracking-wider">Start new</p>
            <h2 className="text-2xl font-semibold mt-1">Record Route</h2>
            <p className="text-sm text-neutral-400 mt-1">Trace your journey with GPS</p>
          </div>
          <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
            <Play className="h-6 w-6" fill="white" />
          </div>
        </motion.button>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNav('my')}
            className="rounded-3xl bg-neutral-50 border border-neutral-100 p-5 text-left"
          >
            <Bookmark className="h-5 w-5 mb-3" />
            <p className="text-sm font-medium">My Routes</p>
            <p className="text-xs text-neutral-500 mt-0.5">{myRoutes.length} saved</p>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNav('explore')}
            className="rounded-3xl bg-neutral-50 border border-neutral-100 p-5 text-left"
          >
            <Compass className="h-5 w-5 mb-3" />
            <p className="text-sm font-medium">Explore</p>
            <p className="text-xs text-neutral-500 mt-0.5">Community routes</p>
          </motion.button>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-900">Recent routes</h3>
            {myRoutes.length > 0 && (
              <button onClick={() => onNav('my')} className="text-xs text-neutral-500">See all</button>
            )}
          </div>
          {myRoutes.length === 0 ? (
            <div className="rounded-3xl bg-neutral-50 border border-dashed border-neutral-200 p-8 text-center">
              <MapPin className="h-8 w-8 mx-auto text-neutral-300" />
              <p className="mt-3 text-sm font-medium text-neutral-700">No routes yet</p>
              <p className="text-xs text-neutral-500 mt-1">Record your first journey to share it with others.</p>
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
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className="rounded-3xl border border-neutral-100 bg-white overflow-hidden shadow-sm cursor-pointer"
    >
      <div className="h-36 bg-neutral-100 relative">
        {route.points?.length > 1 ? (
          <MapView points={route.points} fit interactive={false} showEnds height="100%" />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-300">
            <MapPin className="h-8 w-8" />
          </div>
        )}
        {route.ai_summary?.vibe && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[10px] font-medium flex items-center gap-1 shadow-sm">
            <Sparkles className="h-3 w-3" /> {route.ai_summary.vibe}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold truncate">{route.name}</h4>
            <p className="text-xs text-neutral-500 mt-0.5">by {route.creator_name}</p>
          </div>
          {route.route_type && (
            <Badge variant="secondary" className="rounded-full text-[10px] font-normal shrink-0">
              {route.route_type}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-neutral-600">
          <span className="flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" /> {formatDistance(route.distance_km || 0)}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(route.duration_sec || 0)}</span>
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {route.views || 0}</span>
          {route.likes > 0 && <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {route.likes}</span>}
          {route.rating_count > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {route.rating_avg?.toFixed(1)}</span>}
        </div>
        {route.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {route.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">{t}</span>
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

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device.');
      return;
    }
    setError(null);
    setStatus('recording');
    startTimeRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
          speed: pos.coords.speed ?? 0,
          altitude: pos.coords.altitude ?? null,
          accuracy: pos.coords.accuracy,
        };
        setPoints((prev) => {
          if (prev.length === 0) return [p];
          const last = prev[prev.length - 1];
          const d = haversine(last, p);
          if (d * 1000 < 3 && pos.coords.accuracy > 20) return prev;
          return [...prev, p];
        });
        const spd = (pos.coords.speed ?? 0) * 3.6;
        setCurrentSpeed(spd);
        setMaxSpeed((m) => Math.max(m, spd));
      },
      (err) => {
        setError(err.message);
        toast.error('Location error: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  };

  const pauseRecording = () => {
    setStatus('paused');
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stopRecording = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (points.length < 2) {
      toast.error('Not enough movement recorded. Try walking a bit further.');
      return;
    }
    onDone({
      points,
      distance_km: distanceKm,
      duration_sec: elapsed,
      max_speed_kmh: maxSpeed,
      avg_speed_kmh: elapsed > 0 ? (distanceKm / (elapsed / 3600)) : 0,
      start: points[0],
      end: points[points.length - 1],
    });
  };

  // Demo mode: simulate route recording (useful in iframe where geolocation blocked)
  const simulateRoute = () => {
    setStatus('recording');
    const base = { lat: 19.076, lng: 72.877 };
    const now = Date.now();
    const pts = [];
    for (let i = 0; i < 40; i++) {
      pts.push({
        lat: base.lat + i * 0.0008 + Math.sin(i * 0.4) * 0.0004,
        lng: base.lng + i * 0.0011 + Math.cos(i * 0.4) * 0.0004,
        timestamp: now + i * 10000,
        speed: 8 + Math.random() * 4,
        altitude: null,
        accuracy: 5,
      });
    }
    setPoints(pts);
    setElapsed(400);
    setCurrentSpeed(35);
    setMaxSpeed(52);
    setTimeout(() => setStatus('paused'), 400);
  };

  const last = points[points.length - 1];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="absolute top-6 left-6 right-6 z-[500] flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="px-4 py-2 rounded-full bg-white shadow-lg text-xs font-medium flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-neutral-300'}`} />
          {status === 'recording' ? 'Recording' : status === 'paused' ? 'Paused' : 'Ready'}
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative min-h-[55vh]">
        {points.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50 px-6">
            <div className="h-16 w-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-white" />
            </div>
            <p className="text-sm text-neutral-500 text-center">Press start to begin tracking your route</p>
            {error && (
              <>
                <p className="text-xs text-red-500 mt-3 px-4 text-center">{error}</p>
                <button onClick={simulateRoute} className="mt-3 text-xs px-4 py-2 rounded-full bg-neutral-100 border border-neutral-200">
                  Try demo route instead
                </button>
              </>
            )}
          </div>
        ) : (
          <MapView points={points} follow={status === 'recording'} center={last ? [last.lat, last.lng] : null} zoom={17} />
        )}
      </div>

      <div className="bg-white border-t border-neutral-100 rounded-t-3xl -mt-6 relative z-10 shadow-2xl">
        <div className="px-6 pt-6 pb-8">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Distance" value={formatDistance(distanceKm)} />
            <Stat label="Time" value={formatDuration(elapsed)} />
            <Stat label="Speed" value={`${currentSpeed.toFixed(1)} km/h`} />
          </div>

          {status === 'idle' && (
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={startRecording}
                className="w-full h-16 rounded-full bg-neutral-900 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="h-5 w-5" fill="white" /> Start Recording
              </motion.button>
              <button onClick={simulateRoute} className="w-full text-xs text-neutral-500 py-2">
                Demo mode (simulate a route)
              </button>
            </div>
          )}

          {status === 'recording' && (
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={pauseRecording}
                className="h-16 rounded-full bg-neutral-100 text-neutral-900 font-semibold flex items-center justify-center gap-2"
              >
                <Pause className="h-5 w-5" /> Pause
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={stopRecording}
                className="h-16 rounded-full bg-red-500 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Square className="h-4 w-4" fill="white" /> Stop & Save
              </motion.button>
            </div>
          )}

          {status === 'paused' && (
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={startRecording}
                className="h-16 rounded-full bg-neutral-900 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Play className="h-5 w-5" fill="white" /> Resume
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={stopRecording}
                className="h-16 rounded-full bg-red-500 text-white font-semibold flex items-center justify-center gap-2"
              >
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
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
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

  const toggleTag = (t) => {
    setTags((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error('Please give your route a name');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          name: name.trim(),
          description: description.trim(),
          route_type: routeType,
          tags,
          notes: notes.trim(),
          creator_name: user?.name || 'Anonymous',
          user_id: user?.uid,
        }),
      });
      const created = await res.json();
      cacheRoute(created);
      toast.success('Route saved!');
      // fire-and-forget AI summary
      fetch(`/api/routes/${created.id}/summarize`, { method: 'POST' }).catch(() => {});
      onSaved(created);
    } catch (e) {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Save Route</h1>
        <div className="w-10" />
      </div>

      <div className="px-6">
        <div className="rounded-3xl overflow-hidden border border-neutral-100 h-48">
          <MapView points={data.points} fit interactive={false} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 py-3 px-2">
          <MiniStat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(data.distance_km)} />
          <MiniStat icon={<Clock className="h-4 w-4" />} label="Time" value={formatDuration(data.duration_sec)} />
          <MiniStat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${data.avg_speed_kmh?.toFixed(1) || 0} km/h`} />
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Route name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Backroads to Lonavala"
              className="mt-2 h-12 rounded-xl border-neutral-200 text-base"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this route special?"
              className="mt-2 rounded-xl border-neutral-200 min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Route type</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ROUTE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setRouteType(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    routeType === t ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Tags</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'
                    }`}
                  >
                    {active && <Check className="inline h-3 w-3 mr-1" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Notes for travellers</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Watch out for potholes near km 3, best time is early morning..."
              className="mt-2 rounded-xl border-neutral-200 min-h-[80px]"
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-white/80">
        <div className="max-w-md mx-auto">
          <Button
            onClick={save}
            disabled={saving}
            className="w-full h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-base font-semibold"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Save & Share <Sparkles className="h-4 w-4 ml-2" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="text-center">
      <div className="flex justify-center text-neutral-400">{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

// ============= AI SUMMARY CARD =============
function AISummaryCard({ route, onRefresh, loading }) {
  const ai = route.ai_summary;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-blue-50 border border-violet-100 p-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-neutral-900 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-900">AI Summary</p>
            {ai?.vibe && <p className="text-[10px] text-neutral-500 lowercase">{ai.vibe}</p>}
          </div>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} disabled={loading} className="text-[10px] text-neutral-500 hover:text-neutral-900">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Regenerate'}
          </button>
        )}
      </div>
      {ai ? (
        <>
          <p className="text-sm text-neutral-800 leading-relaxed">{ai.summary}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-white border border-neutral-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Difficulty</p>
              <div className="flex items-center gap-1 mt-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= ai.difficulty ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
                ))}
              </div>
              <p className="text-xs text-neutral-700 mt-1.5 font-medium">{['','Very easy','Easy','Moderate','Challenging','Demanding'][ai.difficulty]}</p>
            </div>
            <div className="rounded-2xl bg-white border border-neutral-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Fuel estimate</p>
              <p className="text-xs text-neutral-700 mt-1.5 leading-snug">{ai.fuel_note}</p>
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="space-y-2">
          <div className="h-3 rounded bg-neutral-200 animate-pulse" />
          <div className="h-3 rounded bg-neutral-200 animate-pulse w-4/5" />
          <div className="h-3 rounded bg-neutral-200 animate-pulse w-3/5" />
        </div>
      ) : (
        <button onClick={onRefresh} className="text-xs text-neutral-600 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Generate AI summary
        </button>
      )}
    </div>
  );
}

// ============= COMMENTS =============
function CommentsSection({ routeId, user }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    fetch(`/api/routes/${routeId}/comments`).then(r => r.json()).then(setComments).catch(() => {});
  };

  useEffect(() => { load(); }, [routeId]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/routes/${routeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, text: text.trim() }),
      });
      setText('');
      load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Comments · {comments.length}</p>
      <div className="space-y-3">
        {comments.map(c => (
          <div key={c.id} className="rounded-2xl bg-neutral-50 border border-neutral-100 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{c.author}</p>
              <p className="text-[10px] text-neutral-400">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            <p className="text-sm text-neutral-800 mt-1">{c.text}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-4">No comments yet. Be the first to share!</p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Add a comment..."
          className="h-11 rounded-2xl border-neutral-200 bg-neutral-50"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="h-11 w-11 rounded-full bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ============= CONDITIONS =============
function ConditionsSection({ routeId, user }) {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('pothole');
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetch(`/api/routes/${routeId}/conditions`).then(r => r.json()).then(setItems).catch(() => {});
  };
  useEffect(() => { load(); }, [routeId]);

  const submit = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/routes/${routeId}/conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, type, text: text.trim() }),
      });
      setText('');
      load();
      toast.success('Alert posted');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Road conditions · {items.length}</p>
      <div className="space-y-2">
        {items.map(i => {
          const cfg = CONDITION_TYPES.find(c => c.key === i.type) || CONDITION_TYPES[4];
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
        {items.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-4">No road alerts yet.</p>
        )}
      </div>
      <div className="mt-3 rounded-2xl border border-neutral-100 p-3">
        <div className="flex gap-1.5 mb-2 overflow-x-auto">
          {CONDITION_TYPES.map(c => (
            <button
              key={c.key}
              onClick={() => setType(c.key)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border ${type === c.key ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Post a road alert..."
            className="h-10 rounded-xl border-neutral-200 bg-neutral-50 text-sm"
          />
          <button onClick={submit} disabled={adding || !text.trim()} className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.uid, stars }),
    });
    const data = await res.json();
    setAvg(data.rating_avg);
    setCount(data.rating_count);
    toast.success(`You rated ${stars} ★`);
  };

  return (
    <div className="flex items-center justify-between rounded-2xl bg-neutral-50 border border-neutral-100 p-4 mt-4">
      <div>
        <p className="text-xs text-neutral-500">Your rating</p>
        <div className="flex items-center gap-0.5 mt-1">
          {[1,2,3,4,5].map(i => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => rate(i)}
              className="p-0.5"
            >
              <Star className={`h-5 w-5 ${(hover || my) >= i ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-neutral-500">Community</p>
        <p className="text-lg font-semibold flex items-center gap-1 justify-end">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          {avg > 0 ? avg.toFixed(1) : '–'}
          <span className="text-xs text-neutral-500 font-normal">({count})</span>
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

  const load = () => {
    fetch(`/api/routes/${routeId}`)
      .then((r) => r.json())
      .then((r) => {
        setRoute(r);
        cacheRoute(r);
        setLoading(false);
        if (!r.ai_summary) genSummary(r.id);
      });
  };

  const genSummary = async (id) => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/routes/${id}/summarize`, { method: 'POST' });
      const ai = await res.json();
      setRoute((r) => ({ ...r, ai_summary: ai }));
    } catch {} finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { load(); }, [routeId]);

  const toggleLike = async () => {
    setLiked(!liked);
    const res = await fetch(`/api/routes/${routeId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlike: liked }),
    });
    const updated = await res.json();
    setRoute((r) => ({ ...r, likes: updated.likes }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!route || route.error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <p className="text-sm text-neutral-500">Route not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">Go back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="absolute top-6 left-6 z-[500]">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute top-6 right-6 z-[500]">
        <button onClick={toggleLike} className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>

      <div className="h-[42vh] relative bg-neutral-100">
        <MapView points={route.points} fit interactive={true} />
      </div>

      <div className="px-6 -mt-6 relative bg-white rounded-t-3xl shadow-xl">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">by {route.creator_name}</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{route.route_type}</Badge>
          </div>

          {route.description && (
            <p className="text-sm text-neutral-700 mt-4 leading-relaxed">{route.description}</p>
          )}

          <div className="grid grid-cols-4 gap-3 mt-6 py-4 border-y border-neutral-100">
            <MiniStat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(route.distance_km || 0)} />
            <MiniStat icon={<Clock className="h-4 w-4" />} label="Duration" value={formatDuration(route.duration_sec || 0)} />
            <MiniStat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${(route.avg_speed_kmh || 0).toFixed(0)} km/h`} />
            <MiniStat icon={<Eye className="h-4 w-4" />} label="Views" value={String(route.views || 0)} />
          </div>

          <AISummaryCard route={route} onRefresh={() => genSummary(route.id)} loading={aiLoading} />

          <RatingRow routeId={route.id} user={user} current={route} />

          {route.tags?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {route.tags.map((t) => (
                  <span key={t} className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}

          {route.notes && (
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Notes from creator</p>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-sm text-neutral-800 leading-relaxed">{route.notes}</p>
              </div>
            </div>
          )}

          <ConditionsSection routeId={route.id} user={user} />
          <CommentsSection routeId={route.id} user={user} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-white/80">
        <div className="max-w-md mx-auto">
          <Button
            onClick={() => onShare(route)}
            className="w-full h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-base font-semibold"
          >
            <Share2 className="h-5 w-5 mr-2" /> Share this route
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============= LIST =============
function RouteList({ title, onBack, onOpen, user, mine }) {
  const [routes, setRoutes] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    const url = mine ? `/api/routes?user_id=${user?.uid}` : `/api/routes?sort=${sort}`;
    if (mine && !user) return;
    fetch(url).then(r => r.json()).then(setRoutes).catch(() => setRoutes([]));
  }, [user, mine, sort]);

  const filtered = (routes || []).filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.tags?.some(t => t.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="px-6 pt-14 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="px-6">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search routes..."
            className="pl-11 h-12 rounded-2xl border-neutral-200 bg-neutral-50"
          />
        </div>
        {!mine && (
          <div className="flex gap-2 mt-3">
            {[
              { k: 'recent', l: 'Recent', I: Clock },
              { k: 'trending', l: 'Trending', I: TrendingUp },
              { k: 'popular', l: 'Popular', I: Flame },
            ].map(t => (
              <button
                key={t.k}
                onClick={() => setSort(t.k)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${
                  sort === t.k ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200'
                }`}
              >
                <t.I className="h-3 w-3" /> {t.l}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-6 mt-5 space-y-3">
        {routes === null && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-3xl h-56 bg-neutral-100 animate-pulse" />
            ))}
          </div>
        )}
        {routes !== null && filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-neutral-500">
            {mine ? 'No saved routes yet.' : 'No routes found.'}
          </div>
        )}
        {filtered.map(r => (
          <RouteCard key={r.id} route={r} onOpen={() => onOpen(r.id)} />
        ))}
      </div>
    </div>
  );
}

// ============= SHARE SHEET =============
function ShareSheet({ route, onClose }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${route.share_code}` : '';
  const waText = `Check out this route on Raasta: ${route.name}\n${shareUrl}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: route.name, text: `Route on Raasta: ${route.name}`, url: shareUrl });
      } catch {}
    } else {
      copy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-10"
      >
        <div className="h-1 w-12 rounded-full bg-neutral-200 mx-auto mb-6 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Share route</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-100">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Public link</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm font-medium truncate flex-1">{shareUrl}</p>
            <button onClick={copy} className="h-9 w-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noreferrer"
            className="h-14 rounded-2xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-5 w-5" /> WhatsApp
          </a>
          <button
            onClick={nativeShare}
            className="h-14 rounded-2xl bg-neutral-900 text-white font-semibold flex items-center justify-center gap-2"
          >
            <Share2 className="h-5 w-5" /> More
          </button>
        </div>
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
  const { user } = useLocalUser();
  useServiceWorker();

  const goto = (s, id = null) => {
    setScreen(s);
    if (id) setDetailId(id);
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative overflow-x-hidden">
      <AnimatePresence mode="wait">
        {screen === 'splash' && <Splash key="splash" onDone={() => setScreen('home')} />}
      </AnimatePresence>

      {screen === 'home' && <Home onNav={goto} user={user} />}
      {screen === 'record' && (
        <Record
          onBack={() => setScreen('home')}
          onDone={(data) => { setRecordedData(data); setScreen('save'); }}
        />
      )}
      {screen === 'save' && recordedData && (
        <Save
          data={recordedData}
          user={user}
          onBack={() => setScreen('record')}
          onSaved={(r) => { setRecordedData(null); setDetailId(r.id); setShareRoute(r); setScreen('detail'); }}
        />
      )}
      {screen === 'my' && (
        <RouteList title="My Routes" mine user={user} onBack={() => setScreen('home')} onOpen={(id) => goto('detail', id)} />
      )}
      {screen === 'explore' && (
        <RouteList title="Explore" user={user} onBack={() => setScreen('home')} onOpen={(id) => goto('detail', id)} />
      )}
      {screen === 'detail' && detailId && (
        <Detail
          routeId={detailId}
          user={user}
          onBack={() => setScreen('home')}
          onShare={(r) => setShareRoute(r)}
        />
      )}

      <AnimatePresence>
        {shareRoute && <ShareSheet route={shareRoute} onClose={() => setShareRoute(null)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
