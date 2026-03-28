'use client';

import { useState } from 'react';
import type { Board } from '@/types';
import { getBoardColorClass } from './utils';

interface AddBoardPickerProps {
  available: Board[];
  onAdd: (board: Board) => void;
  onClose: () => void;
}

export function AddBoardPicker({ available, onAdd, onClose }: AddBoardPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = available.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-surface border border-border-subtle rounded-xl shadow-xl overflow-hidden w-64">
      <div className="px-3 pt-2 pb-2 border-b border-border-subtle">
        <input
          autoFocus
          type="text"
          placeholder="Search boards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-monday-dark placeholder:text-monday-dark bg-transparent outline-none border-none"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-icon-muted text-center">No boards available</li>
        )}
        {filtered.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => { onAdd(b); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-node-hover transition-colors rounded-lg text-left"
            >
              <div className={`w-5 h-5 rounded ${getBoardColorClass(b.id)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                {b.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-monday-dark truncate">{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
