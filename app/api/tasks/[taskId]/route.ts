import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbTask } from '@/lib/supabase';
import { toClientTask } from '../route';
import { getWorkspaceId } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// PATCH /api/tasks/[taskId]
// Updates title and/or position/parent/depth (rename + DnD reorder share this).
// Body: { title?, parent_task_id?, position?, depth? }
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { taskId } = await params;

  let body: Partial<{
    title: string;
    parent_task_id: string | null;
    position: number;
    depth: number;
    priority: string | null;
    status: string | null;
    due_date: string | null;
    estimate_hours: number | null;
  }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined)         updates.title          = body.title.trim();
  if (body.parent_task_id !== undefined) updates.parent_task_id = body.parent_task_id;
  if (body.position !== undefined)      updates.position       = body.position;
  if (body.depth !== undefined)         updates.depth          = body.depth;
  if (body.priority !== undefined)      updates.priority       = body.priority;
  if (body.status !== undefined)        updates.status         = body.status;
  if (body.due_date !== undefined)      updates.due_date       = body.due_date;
  if (body.estimate_hours !== undefined) updates.estimate_hours = body.estimate_hours;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) {
    console.error('[PATCH /api/tasks/[taskId]] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: toClientTask(data as DbTask) });
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/[taskId]
// Deletes a task and all its descendants (recursive BFS collect, bulk delete).
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { taskId } = await params;

  // Verify the root task belongs to the caller's workspace before doing anything
  const { data: rootTask } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!rootTask) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Collect all descendant IDs via BFS
  const idsToDelete: string[] = [];
  const queue: string[] = [taskId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    idsToDelete.push(currentId);

    const { data: children } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('parent_task_id', currentId);

    if (children) {
      queue.push(...children.map((c: { id: string }) => c.id));
    }
  }

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .in('id', idsToDelete);

  if (error) {
    console.error('[DELETE /api/tasks/[taskId]] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: idsToDelete });
}
