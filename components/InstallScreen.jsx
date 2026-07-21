'use client';

import { Check } from 'lucide-react';
import { canPromptInstall, promptInstall, isIOS, setPendingRoute, dismissInstallScreen } from '@/lib/pwa';
import { toast } from 'sonner';

const BENEFITS = [
  'Save Routes',
  'Follow Community Recommendations',
  'Access Local Intelligence',
  'Discover Hidden Places',
];

export function InstallScreen({ shareCode, onContinueOnWeb }) {
  const handleInstall = async () => {
    if (canPromptInstall()) {
      setPendingRoute(shareCode);
      const result = await promptInstall();
      if (result.outcome !== 'accepted') {
        // User backed out of the native prompt — nothing installed, so
        // clear the pending route rather than leaving a stale redirect
        // waiting for an install that never happens.
        setPendingRoute('');
      }
    } else if (isIOS()) {
      toast('Tap the Share icon, then "Add to Home Screen".');
    } else {
      toast('Your browser doesn’t support one-tap install here — try "Continue on Web" instead.');
    }
  };

  const handleContinue = () => {
    dismissInstallScreen();
    onContinueOnWeb();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-center px-8 py-12">
      <div className="max-w-sm mx-auto w-full text-center">
        <div className="h-16 w-16 rounded-2xl bg-white mx-auto flex items-center justify-center text-2xl font-bold text-neutral-900">R</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-6">Navigate Like A Local.</h1>
        <p className="text-sm text-neutral-400 mt-3">This route was shared using Raasta.</p>

        <div className="mt-8 space-y-3 text-left">
          {BENEFITS.map((b) => (
            <div key={b} className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-emerald-400" />
              </div>
              <p className="text-sm text-neutral-200">{b}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-3">
          <button onClick={handleInstall} className="w-full h-14 rounded-full bg-white text-neutral-900 text-base font-semibold">
            Install Raasta
          </button>
          <button onClick={handleContinue} className="w-full h-12 rounded-full border border-neutral-700 text-neutral-300 text-sm font-medium">
            Continue on Web
          </button>
        </div>
      </div>
    </div>
  );
}
