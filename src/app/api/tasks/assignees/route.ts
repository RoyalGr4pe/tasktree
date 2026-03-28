import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/tasks/assignees?board_id=xxx
// Returns all assignees for every task on a board in one query.
// Response: { assignees: { task_id, user_id, assigned_at }[] }

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get('board_id');

  if (!boardId) {
    return NextResponse.json({ error: 'Missing board_id' }, { status: 400 });
  }

  // Join through tasks to filter by board
  const { data, error } = await supabaseAdmin
    .from('task_assignees')
    .select('task_id, user_id, assigned_at, tasks!inner(board_id)')
    .eq('tasks.board_id', boardId)
    .order('assigned_at', { ascending: true });

  if (error) {
    console.error('[GET /api/tasks/assignees] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Strip the joined tasks field before returning
  const assignees = (data ?? []).map(({ task_id, user_id, assigned_at }) => ({
    task_id,
    user_id,
    assigned_at,
  }));

  return NextResponse.json({ assignees });
}
