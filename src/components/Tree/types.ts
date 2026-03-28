import type { Task, Board, Workspace } from '@/types';
import { STATUSES, STATUS_ORDER, type Status } from '@/components/StatusPicker';

export interface TreeProps {
  initialTasks: Task[];
  board: Board;
  workspace: Workspace;
  onBack: () => void;
  onBoardRenamed: (board: Board) => void;
  onBoardDeleted: (boardId: string) => void;
  onTaskCountChanged?: (boardId: string, count: number) => void;
}

export const STATUS_GROUPS: Array<{ status: Status | null; label: string; color: string }> =
  STATUS_ORDER.map((s) => {
    const def = STATUSES.find((x) => x.value === s)!;
    return { status: s, label: def.label, color: def.color };
  });
