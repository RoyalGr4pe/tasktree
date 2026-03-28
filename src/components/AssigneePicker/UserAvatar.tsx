'use client';

import type { MondayUser } from '@/types';

export function UserAvatar({ user, size }: { user: MondayUser; size: number }) {
  if (user.avatar) {
    return <img src={user.avatar} alt={user.name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#0ea5e9','#3b82f6'];
  let hash = 0;
  for (let i = 0; i < user.id.length; i++) hash = user.id.charCodeAt(i) + ((hash << 5) - hash);
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size, backgroundColor: colors[Math.abs(hash) % colors.length], fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}
