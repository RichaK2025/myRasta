'use client';

import { useEffect, useState } from 'react';

export function SocialProofStrip({ variant = 'default' }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;

  const items = [
    { icon: '🟢', label: 'Active this week', value: stats.active_users },
    { icon: '⭐', label: 'Routes Saved', value: stats.routes_saved },
    { icon: '🔗', label: 'Routes Shared', value: stats.routes_shared },
  ];

  // 'glass' — a 3-column stat grid for the cinematic dark Home background
  // (icon atop bold number atop uppercase label). 'default' keeps the
  // original light/dark-toggle-respecting pill row used on /community.
  if (variant === 'glass') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl px-3 py-3 text-center">
            <p className="text-lg">{item.icon}</p>
            <p className="text-lg font-bold text-white mt-1">{item.value.toLocaleString()}</p>
            <p className="text-[9px] text-white/60 uppercase tracking-wider mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
      {items.map((item) => (
        <div key={item.label} className="shrink-0 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 px-4 py-2.5">
          <p className="text-sm font-semibold">{item.icon} {item.value.toLocaleString()}</p>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
