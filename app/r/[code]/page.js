'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  MapPin, Clock, Gauge, Eye, Route as RouteIcon, Loader2, Sparkles, ChevronLeft, Share2, Heart, MessageCircle, Navigation
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistance, formatDuration } from '@/lib/geo';
import { QRCodeSVG } from 'qrcode.react';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code;
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    fetch(`/api/routes/share/${code}`)
      .then(r => r.json())
      .then((r) => {
        if (r.error) setNotFound(true);
        else setRoute(r);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [code]);

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

  const pointsWithMe = userPos ? [...route.points, { lat: userPos.lat, lng: userPos.lng }] : route.points;

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
