import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbTaskDependency } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/tasks/dependencies?board_id=xxx
// Returns all dependency rows for tasks on a board in one request.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('board_id');
  if (!boardId) return NextResponse.json({ error: 'Missing board_id' }, { status: 400 });

  // Get all task IDs for this board, then fetch all their dependencies
  const { data: tasks, error: taskError } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('board_id', boardId);

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });

  const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
  if (taskIds.length === 0) return NextResponse.json({ dependencies: [] });

  const { data, error } = await supabaseAdmin
    .from('task_dependencies')
    .select('*')
    .in('task_id', taskIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dependencies: data as DbTaskDependency[] });
}
