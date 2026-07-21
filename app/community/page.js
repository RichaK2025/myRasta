'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { RouteCard } from '@/components/RouteCard';
import { SocialProofStrip } from '@/components/SocialProofStrip';

export default function CommunityPage() {
  const router = useRouter();
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

        <div className="mt-5">
          <SocialProofStrip />
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} onOpen={() => router.push(`/r/${route.share_code}`)} />
          ))}
          {routes.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">No public routes yet.</p>}
        </div>
      </div>
    </div>
  );
}
