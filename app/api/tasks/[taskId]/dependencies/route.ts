import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbTaskDependency } from '@/lib/supabase';

type Params = { params: Promise<{ taskId: string }> };

// ---------------------------------------------------------------------------
// GET /api/tasks/[taskId]/dependencies
// Returns all dependency rows where task_id = taskId (what this task depends on)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const { taskId } = await params;

  const { data, error } = await supabaseAdmin
    .from('task_dependencies')
    .select('*')
    .eq('task_id', taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dependencies: data as DbTaskDependency[] });
}

// ---------------------------------------------------------------------------
// POST /api/tasks/[taskId]/dependencies
// Body: { depends_on_task_id: string }
// Adds a dependency after validating no cycle would be created.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  const { taskId } = await params;

  let body: { depends_on_task_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { depends_on_task_id } = body;

  if (!depends_on_task_id) {
    return NextResponse.json({ error: 'depends_on_task_id is required' }, { status: 400 });
  }

  if (taskId === depends_on_task_id) {
    return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 422 });
  }

  // Cycle detection: would adding taskId→depends_on_task_id create a cycle?
  // A cycle exists if depends_on_task_id can already reach taskId through existing deps.
  const wouldCycle = await detectCycle(taskId, depends_on_task_id);
  if (wouldCycle) {
    return NextResponse.json({ error: 'circular_dependency' }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from('task_dependencies')
    .insert({ task_id: taskId, depends_on_task_id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dependency: data as DbTaskDependency }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/[taskId]/dependencies?depends_on_task_id=xxx
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const depends_on_task_id = req.nextUrl.searchParams.get('depends_on_task_id');

  if (!depends_on_task_id) {
    return NextResponse.json({ error: 'depends_on_task_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('task_dependencies')
    .delete()
    .eq('task_id', taskId)
    .eq('depends_on_task_id', depends_on_task_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Cycle detection — BFS from depends_on_task_id through existing dependencies.
// Returns true if taskId is reachable, meaning adding the edge would cycle.
// ---------------------------------------------------------------------------

async function detectCycle(taskId: string, dependsOnId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [dependsOnId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data } = await supabaseAdmin
      .from('task_dependencies')
      .select('depends_on_task_id')
      .eq('task_id', current);

    for (const row of data ?? []) {
      queue.push(row.depends_on_task_id);
    }
  }

  return false;
}
