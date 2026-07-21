'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';

// A small floating voice-companion orb — the presentation layer over
// whatever speechSynthesis narration is already playing (community alerts,
// local recommendations). It never drives narration itself; a parent passes
// `state`/`caption` in as that narration starts and ends.
//
// states: idle (gentle breathing glow) / listening (sound-wave bars, visual
// only in this pass — no speech-recognition pipeline yet) / speaking (pulsing
// glow + caption) / recommendation (same pulse, distinctly tinted + labeled).
export function VoiceCloud({ state = 'idle', caption = '' }) {
  const isActive = state === 'speaking' || state === 'recommendation';
  const tint = state === 'recommendation' ? '#a78bfa' : '#ffffff';

  return (
    <div className="fixed bottom-24 right-5 z-[600] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {isActive && caption && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="max-w-[220px] rounded-2xl bg-neutral-900/90 backdrop-blur text-white text-xs px-3.5 py-2.5 shadow-xl"
          >
            {state === 'recommendation' && (
              <p className="text-[9px] uppercase tracking-wider text-violet-300 mb-1">Local tip</p>
            )}
            {caption}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={
          state === 'idle'
            ? { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }
            : state === 'listening'
            ? { scale: [1, 1.1, 1] }
            : { scale: [1, 1.12, 1] }
        }
        transition={{ duration: state === 'idle' ? 3.2 : 0.9, repeat: Infinity, ease: 'easeInOut' }}
        className="h-14 w-14 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${tint}, #d4d4d8)`,
          boxShadow: isActive
            ? `0 0 0 6px ${tint}22, 0 8px 24px rgba(0,0,0,0.25)`
            : '0 0 0 4px rgba(255,255,255,0.15), 0 6px 18px rgba(0,0,0,0.18)',
        }}
      >
        {state === 'listening' ? (
          <div className="flex items-end gap-0.5 h-5">
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="w-0.5 rounded-full bg-neutral-900"
                animate={{ height: ['30%', '100%', '30%'] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
              />
            ))}
          </div>
        ) : (
          <Mic className="h-5 w-5 text-neutral-900/70" />
        )}
      </motion.div>
    </div>
  );
}
