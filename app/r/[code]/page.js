'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import {
  MapPin, Clock, Gauge, Eye, Route as RouteIcon, Loader2, Sparkles, ChevronLeft, Share2,
  Star, AlertTriangle, Zap, Construction, CloudRain, Info, Send, Navigation, MessageCircle,
  ShieldCheck, Coffee, Utensils, Fuel, Bath, Shield, Mountain, MapPinned, ThumbsUp, ThumbsDown, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistance, formatDuration } from '@/lib/geo';
import { QRCodeSVG } from 'qrcode.react';
import { cacheRoute, getCachedRoute } from '@/lib/offlineCache';
import { fetchJson } from '@/lib/utils';
import { toast } from 'sonner';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

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

function useAnonUser() {
  const [u, setU] = useState(null);
  useEffect(() => {
    let uid = localStorage.getItem('raasta_uid');
    let name = localStorage.getItem('raasta_name');
    if (!uid) {
      uid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : uuidv4();
      localStorage.setItem('raasta_uid', uid);
    }
    if (!name) {
      name = 'Traveller ' + uid.slice(0, 4).toUpperCase();
      localStorage.setItem('raasta_name', name);
    }
    setU({ uid, name });
  }, []);
  return u;
}

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code;
  const [route, setRoute] = useState(null);
  const [notes, setNotes] = useState([]);
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
          if (cached) setRoute(cached);
          else setNotFound(true);
        } else {
          setRoute(r); cacheRoute(r);
          if (!r.ai_summary) genSummary(r.id);
          fetchJson(`/api/routes/${r.id}/notes`).then(setNotes).catch(() => setNotes([]));
        }
        setLoading(false);
      })
      .catch(() => {
        const cached = getCachedRoute(code);
        if (cached) setRoute(cached); else setNotFound(true);
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

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;

  if (notFound) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        <MapPin className="h-8 w-8 text-neutral-400" />
      </div>
      <p className="text-lg font-semibold">Route not found</p>
      <p className="text-sm text-neutral-500 mt-1">This link may be broken or expired.</p>
      <Button onClick={() => router.push('/')} variant="ghost" className="mt-6">Go to Raasta</Button>
    </div>
  );

  if (following) return <FollowMode route={route} onExit={() => setFollowing(false)} />;

  const noteMarkers = notes.filter(n => n.lat != null && n.lng != null);

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
        <MapView points={route.points} fit interactive noteMarkers={noteMarkers} />
        {route.verified_count > 0 && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[500] px-3 py-1.5 rounded-full bg-neutral-900 text-white text-xs font-medium flex items-center gap-1.5 shadow-xl">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified by {route.verified_count} local{route.verified_count > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        className="px-6 -mt-8 relative bg-white rounded-t-3xl shadow-2xl">
        <div className="h-1 w-12 rounded-full bg-neutral-200 mx-auto mt-3" />
        <div className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">Shared by {route.creator_name}</p>
            </div>
            {route.route_type && <Badge variant="secondary" className="rounded-full">{route.route_type}</Badge>}
          </div>

          {route.description && <p className="text-sm text-neutral-700 mt-4 leading-relaxed">{route.description}</p>}

          <div className="grid grid-cols-4 gap-3 mt-6 py-4 border-y border-neutral-100">
            <Stat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={formatDistance(route.distance_km || 0)} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Est. time" value={formatDuration(route.duration_sec || 0)} />
            <Stat icon={<Gauge className="h-4 w-4" />} label="Avg" value={`${(route.avg_speed_kmh || 0).toFixed(0)} km/h`} />
            <Stat icon={<Eye className="h-4 w-4" />} label="Views" value={String(route.views || 0)} />
          </div>

          <VerifyBox route={route} user={user} onChange={(c) => setRoute(r => ({ ...r, verified_count: c }))} />

          {(route.ai_summary || aiLoading) && (
            <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-blue-50 border border-violet-100 p-5 mt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-neutral-900 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Local's Take</p>
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
                  {route.ai_summary.best_for && (
                    <p className="text-xs text-neutral-600 mt-2 italic">Best for: {route.ai_summary.best_for}</p>
                  )}
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

          <CommunityNotesInline routeId={route.id} user={user} notes={notes} reload={() => fetchJson(`/api/routes/${route.id}/notes`).then(setNotes).catch(() => setNotes([]))} />
          <ConditionsInline routeId={route.id} user={user} />

          <div className="mt-6 rounded-2xl bg-neutral-50 border border-neutral-100 p-4 flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl border border-neutral-100">
              <QRCodeSVG value={shareUrl} size={64} bgColor="transparent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Scan to open</p>
              <p className="text-sm font-medium truncate mt-0.5">{shareUrl}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white p-4">
            <p className="text-[11px] text-white/60 uppercase tracking-widest">Raasta</p>
            <p className="text-sm font-semibold mt-1">Navigate Like A Local.</p>
            <p className="text-xs text-white/70 mt-1">Google Maps gives directions. Raasta gives recommendations.</p>
          </div>
        </div>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-white/80">
        <div className="max-w-md mx-auto flex gap-3">
          <Button onClick={openInMaps} variant="outline" className="h-14 rounded-full border-neutral-200 flex-1">
            <Navigation className="h-4 w-4 mr-2" /> In Maps
          </Button>
          <Button onClick={() => setFollowing(true)}
            className="h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-base font-semibold flex-[2]">
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

function VerifyBox({ route, user, onChange }) {
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
      setCount(data.verified_count); setByMe(!byMe); onChange?.(data.verified_count);
      toast.success(byMe ? 'Verification removed' : 'You verified this route ✓');
    } finally { setBusy(false); }
  };

  return (
    <button onClick={toggle} disabled={busy}
      className={`w-full rounded-2xl border p-4 flex items-center justify-between transition mt-4 ${byMe ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-neutral-50 border-neutral-100'}`}>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${byMe ? 'bg-white/10' : 'bg-neutral-900 text-white'}`}>
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold">{count > 0 ? `Verified by ${count} local${count > 1 ? 's' : ''}` : 'Not verified yet'}</p>
          <p className={`text-[11px] ${byMe ? 'text-white/70' : 'text-neutral-500'}`}>{byMe ? 'Tap to remove your verification' : 'Confirm this route is accurate'}</p>
        </div>
      </div>
      <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${byMe ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'}`}>
        {byMe ? 'Verified ✓' : 'Verify'}
      </div>
    </button>
  );
}

function CommunityNotesInline({ routeId, user, notes, reload }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('tea');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/routes/${routeId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.uid, author: user?.name, category, text: text.trim() }),
      });
      setText(''); setShowForm(false); reload();
      toast.success('Local knowledge added 🙏');
    } finally { setAdding(false); }
  };

  const vote = async (id, dir) => {
    await fetch(`/api/notes/${id}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: dir }),
    });
    reload();
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Local knowledge · {notes.length}</p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-neutral-900 flex items-center gap-1">
          {showForm ? <>Cancel <X className="h-3 w-3" /></> : <>Add note <MapPinned className="h-3 w-3" /></>}
        </button>
      </div>
      {showForm && (
        <div className="rounded-2xl bg-neutral-50 border border-neutral-100 p-3 mb-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {NOTE_CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <button key={c.key} onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium border flex items-center gap-1 ${category === c.key ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <Icon className="h-3 w-3" /> {c.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Best tea stall here, avoid after 8 PM..."
              className="h-10 rounded-xl border-neutral-200 bg-white text-sm" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button onClick={submit} disabled={adding || !text.trim()} className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {notes.map(n => {
          const cfg = NOTE_CATEGORIES.find(c => c.key === n.category) || NOTE_CATEGORIES[9];
          const Icon = cfg.icon;
          return (
            <div key={n.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${cfg.color}`}>
              <div className={`h-8 w-8 rounded-lg ${cfg.dot} flex items-center justify-center shrink-0`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold capitalize">{cfg.label} · {n.author}</p>
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
        {notes.length === 0 && !showForm && <p className="text-xs text-neutral-400 text-center py-4">No local tips yet. Be the first!</p>}
      </div>
    </div>
  );
}

function ConditionsInline({ routeId, user }) {
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
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Road conditions · {items.length}</p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-neutral-900 flex items-center gap-1">
          {showForm ? <>Cancel <X className="h-3 w-3" /></> : <>Report <AlertTriangle className="h-3 w-3" /></>}
        </button>
      </div>
      {showForm && (
        <div className="rounded-2xl border border-neutral-100 p-3 mb-3">
          <div className="flex gap-1.5 mb-2 overflow-x-auto">
            {CONDITION_TYPES.map(c => (
              <button key={c.key} onClick={() => setType(c.key)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border ${type === c.key ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'}`}>{c.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the issue..."
              className="h-10 rounded-xl border-neutral-200 bg-neutral-50 text-sm" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button onClick={submit} disabled={adding || !text.trim()} className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center disabled:opacity-40">
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
                  <p className="text-xs font-semibold capitalize">{cfg.label} · {i.author}</p>
                  <p className="text-[10px] opacity-70">{new Date(i.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-sm mt-0.5">{i.text}</p>
              </div>
            </div>
          );
        })}
        {items.length === 0 && !showForm && <p className="text-xs text-neutral-400 text-center py-4">No road alerts yet.</p>}
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
        <MapView points={route.points}
          center={userPos ? [userPos.lat, userPos.lng] : (route.points[0] ? [route.points[0].lat, route.points[0].lng] : null)}
          zoom={17} follow={!!userPos} interactive />
      </div>
      <div className="bg-white border-t border-neutral-100 p-4">
        <p className="text-xs text-neutral-500 text-center">
          {error ? error : userPos ? 'Following the exact route recorded by ' + route.creator_name : 'Getting your location...'}
        </p>
      </div>
    </div>
  );
}
