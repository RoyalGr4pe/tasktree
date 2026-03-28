'use client';

import { useEffect, useRef, useState } from 'react';
import { assignUser, unassignUser } from '@/services/tasks';
import type { MondayUser, Plan } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';
import AssigneeIcon from '@/components/icons/assignee-icon';
import { UserAvatar } from './UserAvatar';

interface ContentProps {
  taskId: string;
  workspaceId: string;
  assignedUserIds: string[];
  users: MondayUser[];
  plan: Plan;
  onAssigneesChange: (taskId: string, userIds: string[]) => void;
  onClose: () => void;
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-monday-blue shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

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

  // onClose is kept for the portal wrapper
  void onClose;

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  async function unassignAll() {
    if (pending) return;
    for (const userId of [...assignedUserIds]) {
      setPending(userId);
      try {
        await unassignUser(taskId, userId);
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
        await unassignUser(taskId, user.id);
        onAssigneesChange(taskId, assignedUserIds.filter((id) => id !== user.id));
      } else {
        try {
          await assignUser(taskId, user.id, workspaceId);
        } catch (e: unknown) {
          const status = (e as { status?: number }).status;
          const body = (e as { body?: { message?: string; error?: string } }).body;
          if (status === 403) {
            setError(body?.message ?? 'Upgrade required to assign multiple users.');
            return;
          }
          throw e;
        }
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

      {assignedUserIds.length >= PLAN_LIMITS[plan].maxAssigneesPerTask && (
        <div className="mt-1 mx-1 mb-2 px-2 py-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-md border border-amber-100">
          {PLAN_LIMITS[plan].maxAssigneesPerTask === 1
            ? 'Your plan allows 1 assignee per task'
            : `Your plan allows ${PLAN_LIMITS[plan].maxAssigneesPerTask} assignees per task`}
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
