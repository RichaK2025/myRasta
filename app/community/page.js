'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Route as RouteIcon, Clock, Gauge, Eye } from 'lucide-react';
import { formatDistance, formatDuration } from '@/lib/geo';

export default function CommunityPage() {
  const [routes, setRoutes] = useState([]);
  useEffect(() => {
    fetch('/api/community').then((r) => r.json()).then((data) => setRoutes(data.routes || [])).catch(() => setRoutes([]));
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Community feed</h1>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Public routes shared by the community.</p>

        <div className="mt-6 space-y-3">
          {routes.map((route) => (
            <div key={route.id} className="rounded-3xl border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{route.name}</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">by {route.creator_name}</p>
                </div>
                <Link href={`/r/${route.share_code}`} className="text-sm font-medium text-neutral-900 dark:text-white">Open</Link>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 p-3">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400"><RouteIcon className="h-4 w-4" /> Distance</div>
                  <p className="mt-1 font-semibold">{formatDistance(route.distance_km || 0)}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 p-3">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400"><Clock className="h-4 w-4" /> Duration</div>
                  <p className="mt-1 font-semibold">{formatDuration(route.duration_sec || 0)}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 p-3">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400"><Eye className="h-4 w-4" /> Views</div>
                  <p className="mt-1 font-semibold">{route.views || 0}</p>
                </div>
              </div>
            </div>
          ))}
          {routes.length === 0 && <p className="text-sm text-neutral-500">No public routes yet.</p>}
        </div>
      </div>
    </div>
  );
}
