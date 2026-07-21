'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

export function FollowButton({ routeId, user }) {
  const [count, setCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const qs = user?.uid ? `?user_id=${user.uid}` : '';
    fetch(`/api/routes/${routeId}/follow${qs}`).then((r) => r.json()).then((d) => {
      setCount(d.follower_count || 0);
      setFollowing(!!d.following_by_me);
    }).catch(() => {});
  }, [routeId, user?.uid]);

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/routes/${routeId}/follow`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid }),
      });
      const data = await res.json();
      setCount(data.follower_count || 0);
      setFollowing(!!data.following_by_me);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={toggle} disabled={busy}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium border transition ${
        following
          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
          : 'bg-transparent border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
      }`}>
      <Users className="h-3.5 w-3.5" />
      {following ? 'Following' : 'Follow'} · {count.toLocaleString()}
    </button>
  );
}
