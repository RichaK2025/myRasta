'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Play, Pause, Square, ChevronLeft, Share2, Copy, MessageCircle,
  Route as RouteIcon, Compass, Search, Heart, Eye, Clock, Gauge, Plus, Sparkles,
  Bookmark, Camera, Check, QrCode, X, Loader2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { totalDistance, haversine, formatDuration, formatDistance } from '@/lib/geo';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const TAGS = [
  'Fastest', 'Scenic', 'Family Friendly', 'Bike Route',
  'Truck Friendly', 'Monsoon Safe', 'Avoid Traffic', 'Village Route',
];
const ROUTE_TYPES = ['Commute', 'Road Trip', 'Bike Ride', 'Walk', 'Village', 'Delivery'];

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
  const updateName = (n) => {
    localStorage.setItem('raasta_name', n);
    setUser((u) => ({ ...u, name: n }));
  };
  return { user, updateName };
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
  useEffect(() => {
    if (!user) return;
    fetch(`/api/routes?user_id=${user.uid}`).then(r => r.json()).then(setMyRoutes).catch(() => {});
  }, [user]);

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
  const [status, setStatus] = useState('idle'); // idle | recording | paused
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
          // filter jitter: only add if moved > 3m OR first update
          if (d * 1000 < 3 && pos.coords.accuracy > 20) return prev;
          return [...prev, p];
        });
        const spd = (pos.coords.speed ?? 0) * 3.6; // m/s -> km/h
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

  const last = points[points.length - 1];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="absolute top-6 left-6 right-6 z-[500] flex items-center justify-between">
        <button onClick={onBack} className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center backdrop-blur">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50">
            <div className="h-16 w-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-white" />
            </div>
            <p className="text-sm text-neutral-500">Press start to begin tracking</p>
            {error && <p className="text-xs text-red-500 mt-2 px-4 text-center">{error}</p>}
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
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={startRecording}
              className="w-full h-16 rounded-full bg-neutral-900 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              <Play className="h-5 w-5" fill="white" /> Start Recording
            </motion.button>
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
      toast.success('Route saved!');
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

// ============= DETAIL =============
function Detail({ routeId, onBack, onShare }) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/routes/${routeId}`)
      .then((r) => r.json())
      .then((r) => { setRoute(r); setLoading(false); });
  }, [routeId]);

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

// ============= MY ROUTES / EXPLORE =============
function RouteList({ title, onBack, onOpen, user, mine }) {
  const [routes, setRoutes] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const url = mine ? `/api/routes?user_id=${user?.uid}` : '/api/routes';
    if (mine && !user) return;
    fetch(url).then(r => r.json()).then(setRoutes);
  }, [user, mine]);

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
