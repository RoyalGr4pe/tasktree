import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbWorkspace } from '@/lib/supabase';
import type { Plan } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';

// POST /api/tasks/[taskId]/assign
// Assigns a monday user to a task.
// Body: { userId: string, workspaceId: string }
// Plan limit: free = max 1 assignee per task.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  let body: { userId: string; workspaceId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, workspaceId } = body;
  if (!userId || !workspaceId) {
    return NextResponse.json({ error: 'userId and workspaceId are required' }, { status: 400 });
  }

  // Get workspace plan
  const { data: workspace, error: wsError } = await supabaseAdmin
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const plan = (workspace as DbWorkspace).plan as Plan;

  const maxAssignees = PLAN_LIMITS[plan].maxAssigneesPerTask;
  if (maxAssignees !== Infinity) {
    const { count } = await supabaseAdmin
      .from('task_assignees')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if ((count ?? 0) >= maxAssignees) {
      return NextResponse.json(
        { error: 'assignee_limit_reached', message: 'Upgrade to assign more users to a task.' },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('task_assignees')
    .insert({ task_id: taskId, user_id: userId })
    .select()
    .single();

  if (error) {
    // Unique constraint violation = already assigned
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User already assigned' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignee: data }, { status: 201 });
}
