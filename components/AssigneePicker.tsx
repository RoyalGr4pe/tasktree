'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MondayUser } from '@/types';
import AssigneeIcon from './icons/assignee-icon';

interface ContentProps {
  taskId: string;
  workspaceId: string;
  assignedUserIds: string[];
  users: MondayUser[];
  plan: 'free' | 'pro' | 'business';
  onAssigneesChange: (taskId: string, userIds: string[]) => void;
  onClose: () => void;
}

// Exported so it can be embedded inline (e.g. inside a context menu submenu)
export function AssigneePickerContent({
  taskId,
  workspaceId,
  assignedUserIds,
  users,
  plan,
  onAssigneesChange,
  onClose,
}: ContentProps) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  async function unassignAll() {
    if (pending) return;
    for (const userId of [...assignedUserIds]) {
      setPending(userId);
      try {
        const res = await fetch(`/api/tasks/${taskId}/assign/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to unassign');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setPending(null);
        return;
      }
    }
    onAssigneesChange(taskId, []);
    setPending(null);
  }

  async function toggle(user: MondayUser) {
    if (pending) return;
    setError(null);
    const isAssigned = assignedUserIds.includes(user.id);
    setPending(user.id);
    try {
      if (isAssigned) {
        const res = await fetch(`/api/tasks/${taskId}/assign/${user.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to unassign');
        onAssigneesChange(taskId, assignedUserIds.filter((id) => id !== user.id));
      } else {
        const res = await fetch(`/api/tasks/${taskId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, workspaceId }),
        });
        const body = await res.json();
        if (res.status === 403) {
          setError(body.message ?? 'Upgrade required to assign multiple users.');
          return;
        }
        if (!res.ok) throw new Error(body.error ?? 'Failed to assign');
        onAssigneesChange(taskId, [...assignedUserIds, user.id]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="px-3 pt-2 pb-2 border-b">
        <input
          ref={inputRef}
          type="text"
          placeholder="Assign to..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-monday-dark placeholder:text-monday-dark bg-transparent outline-none border-none"
        />
      </div>

      {error && (
        <div className="mx-3 mb-2 px-2 py-1.5 text-[11px] text-monday-error bg-red-50 rounded-md border border-red-100">
          {error}
        </div>
      )}

      {plan === 'free' && assignedUserIds.length >= 1 && (
        <div className="mt-1 mx-1 mb-2 px-2 py-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-md border border-amber-100">
          Free plan - 1 assignee per task
        </div>
      )}

      <div className="p-1">
        {!search && (
          <button
            onClick={unassignAll}
            disabled={!!pending || assignedUserIds.length === 0}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f8f9] transition-colors disabled:opacity-40 rounded-lg"
          >
            <AssigneeIcon />
            <span className="flex-1 text-sm text-monday-dark text-left">No assignee</span>
            <span className="text-xs text-monday-dark-secondary tabular-nums font-medium">0</span>
          </button>
        )}
        {!search && (
          <div className="px-3 pt-2 pb-1">
            <span className="text-xs font-medium text-monday-dark">Team members</span>
          </div>
        )}
        <ul className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-[#9ba0aa] text-center">No users found</li>
          )}
          {filtered.map((user) => {
            const isAssigned = assignedUserIds.includes(user.id);
            const isLoading = pending === user.id;
            return (
              <li key={user.id}>
                <button
                  onClick={() => toggle(user)}
                  disabled={!!pending}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f8f9] transition-colors disabled:opacity-60 rounded-lg"
                >
                  <UserAvatar user={user} size={20} />
                  <span className="flex-1 text-sm text-monday-dark text-left truncate font-medium">{user.name}</span>
                  {isLoading ? <Spinner /> : isAssigned ? (
                    <svg className="w-4 h-4 text-monday-dark shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                  <span className="ml-2 text-xs text-monday-dark-secondary tabular-nums font-medium">{assignedUserIds.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

interface AssigneePickerProps extends ContentProps {
  anchorEl: HTMLElement | null;
}

export default function AssigneePicker({ anchorEl, onClose, ...rest }: AssigneePickerProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pickerWidth = 260;
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.max(8, rect.right + window.scrollX - pickerWidth),
    });
  }, [anchorEl]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) { onClose(); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorEl]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 260 }}
      className="bg-white border border-[#e0e0e0] rounded-xl shadow-xl overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AssigneePickerContent {...rest} onClose={onClose} />
    </div>,
    document.body
  );
}

function UserAvatar({ user, size }: { user: MondayUser; size: number }) {
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

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-monday-blue shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}
