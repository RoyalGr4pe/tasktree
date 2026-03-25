import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbTask, DbWorkspace } from '@/lib/supabase';
import { isTaskLimitReached, isDepthLimitReached } from '@/lib/plan-limits';
import type { Plan } from '@/types';

// ---------------------------------------------------------------------------
// GET /api/tasks?board_id=xxx
// Returns all tasks for a board ordered by position.
// Maps parent_task_id → parent_node_id and title → name for tree-utils compat.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get('board_id');

  if (!boardId) {
    return NextResponse.json({ error: 'Missing board_id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  if (error) {
    console.error('[GET /api/tasks] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (data as DbTask[]).map(toClientTask);

  return NextResponse.json({ tasks });
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// Creates a new task, enforcing plan limits.
// Body: { board_id, workspace_id, parent_task_id?, title? }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: {
    board_id: string;
    workspace_id: string;
    parent_task_id?: string | null;
    title?: string;
    status?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { board_id, workspace_id, parent_task_id, title, status } = body;

  if (!board_id || !workspace_id) {
    return NextResponse.json({ error: 'board_id and workspace_id are required' }, { status: 400 });
  }

  // Get workspace plan
  const { data: workspace, error: wsError } = await supabaseAdmin
    .from('workspaces')
    .select('plan')
    .eq('id', workspace_id)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const plan = (workspace as DbWorkspace).plan as Plan;

  // Enforce task count limit
  const { count, error: countError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', board_id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (isTaskLimitReached(plan, count ?? 0)) {
    return NextResponse.json(
      { error: 'task_limit_reached', plan, limit: count },
      { status: 403 }
    );
  }

  // Calculate depth and position
  let depth = 0;
  let position = 0;

  if (parent_task_id) {
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('tasks')
      .select('depth')
      .eq('id', parent_task_id)
      .single();

    if (parentError || !parent) {
      return NextResponse.json({ error: 'Parent task not found' }, { status: 404 });
    }

    depth = (parent as DbTask).depth + 1;

    // Enforce depth limit
    if (isDepthLimitReached(plan, depth)) {
      return NextResponse.json(
        { error: 'depth_limit_reached', plan, limit: depth - 1 },
        { status: 403 }
      );
    }

    const { count: siblingCount } = await supabaseAdmin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('parent_task_id', parent_task_id);

    position = siblingCount ?? 0;
  } else {
    const { count: rootCount } = await supabaseAdmin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', board_id)
      .is('parent_task_id', null);

    position = rootCount ?? 0;
  }

  const { data: task, error: insertError } = await supabaseAdmin
    .from('tasks')
    .insert({
      board_id,
      workspace_id,
      parent_task_id: parent_task_id ?? null,
      title: title?.trim() ?? '',
      position,
      depth,
      status: status ?? null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[POST /api/tasks] Insert error:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ task: toClientTask(task as DbTask) }, { status: 201 });
}

// ---------------------------------------------------------------------------
// Internal: map DB row → client Task (adds tree-utils compatibility aliases)
// ---------------------------------------------------------------------------

export function toClientTask(row: DbTask) {
  return {
    ...row,
    // Aliases for tree-utils.ts compatibility
    parent_node_id: row.parent_task_id,
    name: row.title,
  };
}
