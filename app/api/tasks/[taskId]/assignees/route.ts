import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/tasks/[taskId]/assignees
// Returns all user IDs assigned to a task.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const { data, error } = await supabaseAdmin
    .from('task_assignees')
    .select('user_id, assigned_at')
    .eq('task_id', taskId)
    .order('assigned_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignees: data });
}
