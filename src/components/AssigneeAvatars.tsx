'use client';

import { type RefObject } from 'react';
import type { MondayUser } from '@/types';
import AssigneeIcon from './icons/assignee-icon';

interface AssigneeAvatarsProps {
  assignedUserIds: string[];
  users: MondayUser[];
  max?: number;
  onClick?: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}

export default function AssigneeAvatars({
  assignedUserIds,
  users,
  max = 3,
  onClick,
  buttonRef,
}: AssigneeAvatarsProps) {
  const assignedUsers = assignedUserIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is MondayUser => u !== undefined);

  const visible = assignedUsers.slice(0, max);
  const overflow = assignedUsers.length - visible.length;

  if (assignedUsers.length === 0) {
    // Empty state — grey person silhouette
    return (
      <button
        ref={buttonRef}
        onClick={onClick}
        className="flex items-center justify-center shrink-0"
        title="Assign user"
      >
        <AssigneeIcon />
      </button>
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className="flex items-center hover:opacity-80 transition-opacity"
      title={assignedUsers.map((u) => u.name).join(', ')}
    >
      <div className="flex -space-x-1.5">
        {visible.map((user) => (
          <Avatar key={user.id} user={user} />
        ))}
        {overflow > 0 && (
          <div className="w-6 h-6 rounded-full bg-avatar-overflow-bg border-2 border-avatar-border flex items-center justify-center text-[9px] font-semibold text-monday-dark-secondary z-10">
            +{overflow}
          </div>
        )}
      </div>
    </button>
  );
}

function Avatar({ user }: { user: MondayUser }) {
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        title={user.name}
        className="w-6 h-6 rounded-full border-2 border-avatar-border object-cover"
      />
    );
  }

  // Fallback initials avatar
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      title={user.name}
      className="w-6 h-6 rounded-full border-2 border-avatar-border flex items-center justify-center text-[9px] font-bold text-white"
      style={{ backgroundColor: stringToColor(user.id) }}
    >
      {initials}
    </div>
  );
}

// Deterministic color from user ID
function stringToColor(str: string): string {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#0ea5e9', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
