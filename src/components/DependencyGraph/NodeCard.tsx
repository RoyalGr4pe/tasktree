'use client';

import type { Task } from '@/types';
import { STATUSES } from '@/components/StatusPicker';
import { NODE_W, NODE_H } from './utils';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  backlog:     { bg: 'rgba(155,160,170,0.15)', text: '#9ba0aa', label: 'Backlog' },
  todo:        { bg: 'rgba(99,102,241,0.12)',  text: '#6366f1', label: 'To Do' },
  in_progress: { bg: 'rgba(240,196,70,0.15)',  text: '#b88a00', label: 'In Progress' },
  in_review:   { bg: 'rgba(249,115,22,0.12)',  text: '#f97316', label: 'In Review' },
  done:        { bg: 'rgba(0,133,77,0.12)',    text: '#00854d', label: 'Done' },
};

export function NodeCard({ task }: { task: Task }) {
  const status = task.status ?? 'backlog';
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.backlog;
  const statusLabel = STATUSES.find((s) => s.value === status)?.label ?? status;
  const isDone = status === 'done';
  const isBlocked = status === 'backlog';

  const title = task.title || 'Untitled';
  const truncated = title.length > 28 ? title.slice(0, 28) + '…' : title;

  return (
    <div
      style={{
        width: NODE_W,
        height: NODE_H,
        background: 'var(--color-surface)',
        border: `1.5px solid ${isDone ? 'var(--color-monday-success)' : 'var(--color-border-subtle)'}`,
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 14px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            background: style.bg,
            color: style.text,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 999,
          }}
        >
          {statusLabel}
        </span>
        {isBlocked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-monday-dark)',
          lineHeight: 1.3,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          marginTop: 6,
        }}
        title={title}
      >
        {truncated}
      </div>

      {task.due_date && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-icon-muted)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}
