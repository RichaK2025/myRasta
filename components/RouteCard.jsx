'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { MapPin, Sparkles, ShieldCheck, Route as RouteIcon, Clock, Eye, Heart, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistance, formatDuration } from '@/lib/geo';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export function RouteCard({ route, onOpen }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} onClick={onOpen}
      className="rounded-3xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm cursor-pointer">
      <div className="h-36 bg-neutral-100 dark:bg-neutral-800 relative">
        {(route.points?.length > 1 || route.encoded_polyline) ? (
          <MapView points={route.points} encodedPolyline={route.encoded_polyline} fit interactive={false} showEnds height="100%" />
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
