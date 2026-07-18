'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Renders the official Google Identity Services button and exchanges the
// resulting credential (ID token) for our own session via /api/auth/google.
// Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID and the GSI script loaded in layout.js.
export function GoogleSignInButton({ onSignedIn }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — Google Sign-In is disabled.');
      return;
    }

    let cancelled = false;

    const handleCredential = async (response) => {
      try {
        const user = await onSignedIn(response.credential);
        toast.success(`Signed in as ${user?.name || user?.email}`);
      } catch (err) {
        toast.error(err.message || 'Google sign-in failed');
      }
    };

    // The GSI script loads asynchronously (next/script `afterInteractive`),
    // so poll briefly for window.google instead of assuming it's ready.
    const tryInit = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 150);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: 260,
        });
      }
    };
    tryInit();

    return () => { cancelled = true; };
  }, [onSignedIn]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;
  return <div ref={buttonRef} />;
}
