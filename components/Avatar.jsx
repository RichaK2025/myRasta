'use client';

import { resolveAvatar } from '@/lib/avatars';

export function Avatar({ avatarId, size = 64 }) {
  const avatar = resolveAvatar(avatarId);
  return (
    <div
      className="rounded-2xl flex items-center justify-center shrink-0"
      style={{ height: size, width: size, background: avatar.color, fontSize: size * 0.5 }}
    >
      {avatar.emoji}
    </div>
  );
}
