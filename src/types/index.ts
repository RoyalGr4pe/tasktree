// ---------------------------------------------------------------------------
// Workspace / plan
// ---------------------------------------------------------------------------

export type Plan = 'free' | 'pro' | 'business';

export interface Workspace {
  id: string;          // monday.com account_id
  plan: Plan;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface ProgramBoard {
  board_id: string;
  position: number;
}

export interface Program {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  program_boards: ProgramBoard[];
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Task  (pure Supabase record — not a monday item)
// ---------------------------------------------------------------------------

export type Priority = 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export interface Task {
  id: string;
  board_id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  position: number;
  depth: number;
  priority: Priority | null;
  status: Status | null;
  due_date: string | null;
  estimate_hours?: number | null;
  created_at: string;
  linked_monday_item_id: string | null;

  // Aliases kept for tree-utils.ts compatibility (mapped at API boundary)
  parent_node_id: string | null;  // === parent_task_id
  name: string;                   // === title
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface TaskDependency {
  id: string;
  task_id: string;           // the dependent task (this task is blocked until depends_on is done)
  depends_on_task_id: string; // the blocking task
  created_at: string;
}

// Map of taskId → IDs it depends on (blocking tasks)
export type DependencyMap = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Rollups — computed client-side from direct children
// ---------------------------------------------------------------------------

export interface TaskRollup {
  progress_percent: number;       // 0–100
  total_estimated_hours: number;  // sum of child estimate_hours
  rolled_up_due_date: string | null;   // max(child.due_date)
  aggregated_status: Status | 'mixed' | null;
  child_count: number;
  done_count: number;
}

export interface TreeTask extends Task {
  children: TreeTask[];
  isExpanded?: boolean;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// monday.com types (kept for reference / future sync)
// ---------------------------------------------------------------------------

export interface MondayItem {
  id: string;
  name: string;
  board: { id: string };
}

export interface MondayContext {
  workspaceId: string;   // monday account_id
  userId: string;
  theme?: 'light' | 'dark' | 'black' | 'hacker';
  sessionToken?: string; // signed JWT from monday — used to authenticate API requests
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export interface PatchTaskPayload {
  id: string;
  parent_task_id: string | null;
  position: number;
  depth: number;
}

// Alias so tree-utils callers still compile
export type PatchNodePayload = PatchTaskPayload;

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

export interface MondayUser {
  id: string;
  name: string;
  avatar: string; // photo_thumb URL
}

export interface TaskAssignee {
  user_id: string;
  assigned_at: string;
}

// ---------------------------------------------------------------------------
// Plan limit error codes returned by the API
// ---------------------------------------------------------------------------

export type PlanLimitError =
  | 'board_limit_reached'
  | 'task_limit_reached'
  | 'depth_limit_reached'
  | 'assignee_limit_reached';

// ---------------------------------------------------------------------------
// DnD types
// ---------------------------------------------------------------------------

export interface DragData {
  type: 'TreeNode';
  node: TreeTask;
}

export interface DropData {
  type: 'TreeNode';
  node: TreeTask;
  isChild: boolean;
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
