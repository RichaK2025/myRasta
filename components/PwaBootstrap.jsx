'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { captureInstallPrompt, isStandalone, consumePendingRoute } from '@/lib/pwa';

// Mounted once at the app root. Captures the `beforeinstallprompt` event as
// early as possible (it only fires once, and is gone by the time a user
// later taps an "Install" button if we didn't stash it), and — when running
// as the installed PWA — resumes whatever shared route the user was
// installing for.
export function PwaBootstrap() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e) => captureInstallPrompt(e);
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!isStandalone()) return;
    const code = consumePendingRoute();
    if (code) router.replace(`/r/${code}`);
  }, [router]);

  return null;
}
