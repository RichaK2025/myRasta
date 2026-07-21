'use client';

import { useEffect, useState } from 'react';
import { alertConfidence, formatReportedAgo, resolveAlertType } from '@/lib/alertTypes';

export function AlertsSection({ lat, lng, radiusKm = 5 }) {
  const [alerts, setAlerts] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    fetch(`/api/alerts?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`)
      .then((r) => r.json())
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [lat, lng, radiusKm]);

  const vote = async (id, action) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/alerts/${id}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data?.removed) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      } else if (data && !data.error) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? data : a)));
      }
    } catch {
      // Leave the list as-is — a failed vote isn't worth a toast here.
    } finally {
      setBusyId(null);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Community Alerts Nearby</p>
      <div className="space-y-2">
        {alerts.map((a) => {
          const type = resolveAlertType(a.type);
          if (!type) return null;
          const confidence = alertConfidence(a.created_at, a.expires_at);
          return (
            <div key={a.id} className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{type.icon} {type.label}</p>
                <span className="text-xs" title={confidence.label}>{confidence.icon}</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Reported {formatReportedAgo(a.created_at)} · Confirmed by {a.confirm_count || 0}
              </p>
              <div className="flex gap-2 mt-2">
                <button disabled={busyId === a.id} onClick={() => vote(a.id, 'active')}
                  className="flex-1 rounded-full border border-neutral-200 dark:border-neutral-700 py-1.5 text-xs disabled:opacity-50">
                  👍 Still Active
                </button>
                <button disabled={busyId === a.id} onClick={() => vote(a.id, 'gone')}
                  className="flex-1 rounded-full border border-neutral-200 dark:border-neutral-700 py-1.5 text-xs disabled:opacity-50">
                  👎 No Longer There
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
