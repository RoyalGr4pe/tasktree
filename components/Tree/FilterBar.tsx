'use client';

import { forwardRef, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MondayUser } from '@/types';
import type { Label } from '@/components/LabelPicker';
import type { Priority } from '@/components/PriorityPicker';
import { PRIORITIES, PriorityDot } from '@/components/PriorityPicker';

export interface ActiveFilters {
  assigneeIds: string[];
  priorities: Priority[];
  labelIds: string[];
  dueDateRange: 'overdue' | 'today' | 'this_week' | null;
}

export const EMPTY_FILTERS: ActiveFilters = {
  assigneeIds: [],
  priorities: [],
  labelIds: [],
  dueDateRange: null,
};

export function isFilterActive(filters: ActiveFilters) {
  return (
    filters.assigneeIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.dueDateRange !== null
  );
}

// ---------------------------------------------------------------------------
// Avatar (mirrors AssigneePicker's UserAvatar)
// ---------------------------------------------------------------------------

function UserAvatar({ user, size = 20 }: { user: MondayUser; size?: number }) {
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#0ea5e9','#3b82f6'];
  let hash = 0;
  for (let i = 0; i < user.id.length; i++) hash = user.id.charCodeAt(i) + ((hash << 5) - hash);
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: colors[Math.abs(hash) % colors.length], fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown portal — clamps so it never overflows the right edge
// ---------------------------------------------------------------------------

const DROPDOWN_WIDTH = 220;

interface DropdownProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}

function Dropdown({ anchorEl, onClose, children }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    // Align to right edge of anchor, then clamp so dropdown doesn't overflow
    const fromRight = rect.right + window.scrollX - DROPDOWN_WIDTH;
    const clamped = Math.min(fromRight, viewportWidth + window.scrollX - DROPDOWN_WIDTH - 8);
    const left = Math.max(8, clamped);
    setPos({ top: rect.bottom + window.scrollY + 4, left });
  }, [anchorEl]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [anchorEl, onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: DROPDOWN_WIDTH }}
      className="bg-surface-overlay border border-border-input rounded-xl shadow-xl overflow-hidden p-1"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Chip button
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const FilterChip = forwardRef<HTMLButtonElement, ChipProps>(function FilterChip({ label, active, onClick }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-monday-blue/10 border-monday-blue/30 text-monday-blue'
          : 'bg-badge-bg border-transparent text-table-foreground hover:border-border-subtle hover:text-monday-dark'
      }`}
    >
      {label}
      <svg
        className="w-2.5 h-2.5 opacity-50 shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
});

// ---------------------------------------------------------------------------
// Checkbox row
// ---------------------------------------------------------------------------

interface CheckRowProps {
  checked: boolean;
  label: string;
  color?: string;
  avatar?: React.ReactNode;
  onClick: () => void;
}

function CheckRow({ checked, label, color, avatar, onClick }: CheckRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-node-hover transition-colors text-sm text-monday-dark"
    >
      <span
        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
          checked ? 'bg-monday-blue border-monday-blue' : 'border-border-input'
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {avatar}
      {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

const DUE_OPTIONS: { value: ActiveFilters['dueDateRange']; label: string }[] = [
  { value: 'overdue',   label: 'Overdue' },
  { value: 'today',     label: 'Due today' },
  { value: 'this_week', label: 'Due this week' },
];

interface FilterBarProps {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  mondayUsers: MondayUser[];
  labels: Label[];
}

export default function FilterBar({ filters, onChange, mondayUsers, labels }: FilterBarProps) {
  const [openPanel, setOpenPanel] = useState<'assignee' | 'priority' | 'label' | 'due' | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const assigneeRef = useRef<HTMLButtonElement>(null);
  const priorityRef = useRef<HTMLButtonElement>(null);
  const labelRef    = useRef<HTMLButtonElement>(null);
  const dueRef      = useRef<HTMLButtonElement>(null);

  const toggle = (panel: typeof openPanel) =>
    setOpenPanel((prev) => (prev === panel ? null : panel));

  const toggleAssignee = (id: string) =>
    onChange({
      ...filters,
      assigneeIds: filters.assigneeIds.includes(id)
        ? filters.assigneeIds.filter((x) => x !== id)
        : [...filters.assigneeIds, id],
    });

  const togglePriority = (p: Priority) =>
    onChange({
      ...filters,
      priorities: filters.priorities.includes(p)
        ? filters.priorities.filter((x) => x !== p)
        : [...filters.priorities, p],
    });

  const toggleLabel = (id: string) =>
    onChange({
      ...filters,
      labelIds: filters.labelIds.includes(id)
        ? filters.labelIds.filter((x) => x !== id)
        : [...filters.labelIds, id],
    });

  const setDue = (val: ActiveFilters['dueDateRange']) =>
    onChange({ ...filters, dueDateRange: filters.dueDateRange === val ? null : val });

  const active = isFilterActive(filters);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">

      {/* ── Assignee ── */}
      <FilterChip
        ref={assigneeRef}
        label={filters.assigneeIds.length > 0 ? `Assignee (${filters.assigneeIds.length})` : 'Assignee'}
        active={filters.assigneeIds.length > 0}
        onClick={() => toggle('assignee')}
      />
      {openPanel === 'assignee' && (
        <Dropdown anchorEl={assigneeRef.current} onClose={() => { setOpenPanel(null); setAssigneeSearch(''); }}>
          <div className="px-3 py-1 border-b border-border-subtle">
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              className="w-full text-sm text-monday-dark placeholder:text-icon-muted bg-transparent outline-none"
            />
          </div>
          <div className="pt-1">
            {(() => {
              const filtered = mondayUsers.filter((u) =>
                u.name.toLowerCase().includes(assigneeSearch.toLowerCase())
              );
              if (filtered.length === 0) return <p className="px-3 py-2 text-xs text-icon-muted">No users found</p>;
              return filtered.map((u) => (
                <CheckRow
                  key={u.id}
                  checked={filters.assigneeIds.includes(u.id)}
                  label={u.name}
                  avatar={<UserAvatar user={u} size={20} />}
                  onClick={() => toggleAssignee(u.id)}
                />
              ));
            })()}
          </div>
        </Dropdown>
      )}

      {/* ── Priority ── */}
      <FilterChip
        ref={priorityRef}
        label={filters.priorities.length > 0 ? `Priority (${filters.priorities.length})` : 'Priority'}
        active={filters.priorities.length > 0}
        onClick={() => toggle('priority')}
      />
      {openPanel === 'priority' && (
        <Dropdown anchorEl={priorityRef.current} onClose={() => setOpenPanel(null)}>
          {PRIORITIES.filter((p) => p.value !== 'no_priority').map(({ value, label, color }) => (
            <CheckRow
              key={value}
              checked={filters.priorities.includes(value)}
              label={label}
              avatar={<PriorityDot color={color} />}
              onClick={() => togglePriority(value)}
            />
          ))}
        </Dropdown>
      )}

      {/* ── Label ── */}
      <FilterChip
        ref={labelRef}
        label={filters.labelIds.length > 0 ? `Label (${filters.labelIds.length})` : 'Label'}
        active={filters.labelIds.length > 0}
        onClick={() => toggle('label')}
      />
      {openPanel === 'label' && (
        <Dropdown anchorEl={labelRef.current} onClose={() => setOpenPanel(null)}>
          {labels.length === 0 ? (
            <p className="px-3 py-2 text-xs text-icon-muted">No labels</p>
          ) : (
            labels.map((l) => (
              <CheckRow
                key={l.id}
                checked={filters.labelIds.includes(l.id)}
                label={l.name}
                color={l.color}
                onClick={() => toggleLabel(l.id)}
              />
            ))
          )}
        </Dropdown>
      )}

      {/* ── Due date ── */}
      <FilterChip
        ref={dueRef}
        label={
          filters.dueDateRange
            ? DUE_OPTIONS.find((o) => o.value === filters.dueDateRange)!.label
            : 'Due date'
        }
        active={filters.dueDateRange !== null}
        onClick={() => toggle('due')}
      />
      {openPanel === 'due' && (
        <Dropdown anchorEl={dueRef.current} onClose={() => setOpenPanel(null)}>
          {DUE_OPTIONS.map(({ value, label }) => (
            <CheckRow
              key={value ?? ''}
              checked={filters.dueDateRange === value}
              label={label}
              onClick={() => setDue(value)}
            />
          ))}
        </Dropdown>
      )}

      {/* ── Clear ── */}
      {active && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="px-2.5 py-1 rounded-full text-xs font-medium text-monday-error hover:bg-monday-error/10 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
