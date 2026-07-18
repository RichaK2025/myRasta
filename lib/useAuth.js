'use client';

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Anonymous, device-local identity used before/without signing in. Every
// saved route is tied to whichever id this hook currently reports as
// `user.uid`, so upgrading to Google just swaps that id in place.
function getOrCreateAnonId() {
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
  return { uid, name };
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data?.user) {
        setGoogleUser(data.user);
        setUser({ uid: `g_${data.user.id}`, name: data.user.name, email: data.user.email, picture: data.user.picture, authProvider: 'google' });
        return;
      }
    } catch {
      // Network/API failure — fall through to the anonymous identity so the
      // app stays usable offline or if auth is temporarily unavailable.
    }
    setGoogleUser(null);
    setUser({ ...getOrCreateAnonId(), authProvider: 'anon' });
  }, []);

  useEffect(() => {
    setAuthLoading(true);
    refreshAuth().finally(() => setAuthLoading(false));
  }, [refreshAuth]);

  const signInWithGoogle = useCallback(async (idToken) => {
    // Send the device's current anonymous id so the server can re-home any
    // routes/folders recorded before sign-in onto the Google account instead
    // of leaving them stranded under the old local id.
    const anonUserId = localStorage.getItem('raasta_uid') || null;
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, anonUserId }),
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || 'Google sign-in failed');
    }
    await refreshAuth();
    return data.user;
  }, [refreshAuth]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await refreshAuth();
  }, [refreshAuth]);

  const updateName = useCallback((n) => {
    if (googleUser) return; // Google identity's name is authoritative; edit in Google instead.
    localStorage.setItem('raasta_name', n);
    setUser((u) => ({ ...u, name: n }));
  }, [googleUser]);

  return { user, googleUser, authLoading, signInWithGoogle, signOut, updateName };
}
