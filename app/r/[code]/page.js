'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  MapPin, Clock, Gauge, Eye, Route as RouteIcon, Loader2, Sparkles, ChevronLeft, Share2,
  Heart, MessageCircle, Navigation, Star, AlertTriangle, Zap, Construction, CloudRain, Info,
  WifiOff, Send
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistance, formatDuration } from '@/lib/geo';
import { QRCodeSVG } from 'qrcode.react';
import { cacheRoute, getCachedRoute } from '@/lib/offlineCache';
import { toast } from 'sonner';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const CONDITION_TYPES = [
  { key: 'pothole', label: 'Pothole', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'traffic', label: 'Traffic', icon: Zap, color: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'roadblock', label: 'Roadblock', icon: Construction, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { key: 'weather', label: 'Weather', icon: CloudRain, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'info', label: 'Info', icon: Info, color: 'text-neutral-600 bg-neutral-50 border-neutral-200' },
];

function useAnonUser() {
  const [u, setU] = useState(null);
  useEffect(() => {
    let uid = localStorage.getItem('raasta_uid');
    let name = localStorage.getItem('raasta_name');
    if (!uid) { uid = crypto.randomUUID(); localStorage.setItem('raasta_uid', uid); }
    if (!name) { name = 'Traveller ' + uid.slice(0, 4).toUpperCase(); localStorage.setItem('raasta_name', name); }
    setU({ uid, name });
  }, []);
  return u;
}

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code;
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const user = useAnonUser();

  const load = () => {
    fetch(`/api/routes/share/${code}`)
      .then(r => r.json())
      .then((r) => {
        if (r.error) {
          const cached = getCachedRoute(code);
          if (cached) { setRoute(cached); }
          else setNotFound(true);
        } else {
          setRoute(r);
          cacheRoute(r);
          if (!r.ai_summary) genSummary(r.id);
        }
        setLoading(false);
      })
      .catch(() => {
        const cached = getCachedRoute(code);
        if (cached) setRoute(cached);
        else setNotFound(true);
        setLoading(false);
      });
  };

  const genSummary = async (id) => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/routes/${id}/summarize`, { method: 'POST' });
      const ai = await res.json();
      setRoute((r) => ({ ...r, ai_summary: ai }));
    } catch {} finally { setAiLoading(false); }
  };

  useEffect(() => { load(); }, [code]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const openInMaps = () => {
    if (!route?.start || !route?.end) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${route.start.lat},${route.start.lng}&destination=${route.end.lat},${route.end.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
          <MapPin className="h-8 w-8 text-neutral-400" />
        </div>
        <p className="text-lg font-semibold">Route not found</p>
        <p className="text-sm text-neutral-500 mt-1">This link may be broken or expired.</p>
        <Button onClick={() => router.push('/')} variant="ghost" className="mt-6">Go to Raasta</Button>
      </div>
    );
  }

  if (following) {
    return <FollowMode route={route} onExit={() => setFollowing(false)} />;
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-32">
      <div className="absolute top-6 left-6 right-6 z-[500] flex items-center justify-between">
        <button onClick={() => router.push('/')} className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="px-4 py-2 rounded-full bg-white shadow-lg text-xs font-medium flex items-center gap-2">
          <RouteIcon className="h-3.5 w-3.5" /> Raasta
        </div>
        <div className="w-10" />
      </div>

      <div className="h-[50vh] relative bg-neutral-100">
        <MapView points={route.points} fit interactive={true} />
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="px-6 -mt-8 relative bg-white rounded-t-3xl shadow-2xl"
      >
        <div className="h-1 w-12 rounded-full bg-neutral-200 mx-auto mt-3" />
        <div className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">Shared by {route.creator_name}</p>
            </div>
            {route.route_type && (
              <Badge variant="secondary" className="rounded-full">{route.route_type}</Badge>
            )}
          </div>

          {route.description && (
            <p className="text-sm text-neutral-700 mt-4 leading-relaxed">{route.description}</p>
          )}

          <div className="grid grid-cols-4 gap-3 mt-6 py-4 border-y border-neutral-100">
            <Stat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(route.distance_km || 0)} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Est. time" value={formatDuration(route.duration_sec || 0)} />
            <Stat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${(route.avg_speed_kmh || 0).toFixed(0)} km/h`} />
            <Stat icon={<Eye className="h-4 w-4" />} label="Views" value={String(route.views || 0)} />
          </div>

          {(route.ai_summary || aiLoading) && (
            <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-blue-50 border border-violet-100 p-5 mt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-neutral-900 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">AI Summary</p>
                  {route.ai_summary?.vibe && <p className="text-[10px] text-neutral-500 lowercase">{route.ai_summary.vibe}</p>}
                </div>
              </div>
              {aiLoading && !route.ai_summary ? (
                <div className="space-y-2">
                  <div className="h-3 rounded bg-neutral-200 animate-pulse" />
                  <div className="h-3 rounded bg-neutral-200 animate-pulse w-4/5" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-neutral-800 leading-relaxed">{route.ai_summary.summary}</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-2xl bg-white border border-neutral-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Difficulty</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= route.ai_summary.difficulty ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-neutral-700 mt-1.5 font-medium">{['','Very easy','Easy','Moderate','Challenging','Demanding'][route.ai_summary.difficulty]}</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-neutral-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Fuel estimate</p>
                      <p className="text-xs text-neutral-700 mt-1.5 leading-snug">{route.ai_summary.fuel_note}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {route.rating_count > 0 && (
            <div className="flex items-center gap-2 mt-4 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{route.rating_avg?.toFixed(1)}</span>
              <span className="text-neutral-500">from {route.rating_count} traveller{route.rating_count > 1 ? 's' : ''}</span>
            </div>
          )}

          {route.tags?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Best for</p>
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

          <ConditionsInline routeId={route.id} user={user} />
          <CommentsInline routeId={route.id} user={user} />

          <div className="mt-6 rounded-2xl bg-neutral-50 border border-neutral-100 p-4 flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl border border-neutral-100">
              <QRCodeSVG value={shareUrl} size={64} bgColor="transparent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Scan to open</p>
              <p className="text-sm font-medium truncate mt-0.5">{shareUrl}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-white/80">
        <div className="max-w-md mx-auto flex gap-3">
          <Button
            onClick={openInMaps}
            variant="outline"
            className="h-14 rounded-full border-neutral-200 flex-1"
          >
            <Navigation className="h-4 w-4 mr-2" /> In Maps
          </Button>
          <Button
            onClick={() => setFollowing(true)}
            className="h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-base font-semibold flex-[2]"
          >
            <Sparkles className="h-4 w-4 mr-2" /> Open & Follow Route
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="text-center">
      <div className="flex justify-center text-neutral-400">{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function CommentsInline({ routeId, user }) {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, text: text.trim() }),
      });
      setText(''); load();
    } finally { setSending(false); }
  };
  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Comments · {items.length}</p>
      <div className="space-y-3">
        {items.map(c => (
          <div key={c.id} className="rounded-2xl bg-neutral-50 border border-neutral-100 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{c.author}</p>
              <p className="text-[10px] text-neutral-400">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            <p className="text-sm text-neutral-800 mt-1">{c.text}</p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-4">No comments yet. Be the first!</p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..."
          className="h-11 rounded-2xl border-neutral-200 bg-neutral-50" onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={sending || !text.trim()} className="h-11 w-11 rounded-full bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ConditionsInline({ routeId, user }) {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('pothole');
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const load = () => fetch(`/api/routes/${routeId}/conditions`).then(r => r.json()).then(setItems).catch(() => {});
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
      setText(''); load();
      toast.success('Alert posted');
    } finally { setAdding(false); }
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
            <button key={c.key} onClick={() => setType(c.key)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border ${type === c.key ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Post a road alert..."
            className="h-10 rounded-xl border-neutral-200 bg-neutral-50 text-sm" />
          <button onClick={submit} disabled={adding || !text.trim()} className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function FollowMode({ route, onExit }) {
  const [userPos, setUserPos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-50">
      <div className="absolute top-6 left-6 right-6 z-[500] flex items-center justify-between">
        <button onClick={onExit} className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="px-4 py-2 rounded-full bg-neutral-900 text-white shadow-lg text-xs font-medium flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /> Following
        </div>
        <div className="w-10" />
      </div>
      <div className="flex-1">
        <MapView
          points={route.points}
          center={userPos ? [userPos.lat, userPos.lng] : (route.points[0] ? [route.points[0].lat, route.points[0].lng] : null)}
          zoom={17}
          follow={!!userPos}
          interactive
        />
      </div>
      <div className="bg-white border-t border-neutral-100 p-4">
        <p className="text-xs text-neutral-500 text-center">
          {error ? error : userPos ? 'Following the exact route recorded by ' + route.creator_name : 'Getting your location...'}
        </p>
      </div>
    </div>
  );
}
