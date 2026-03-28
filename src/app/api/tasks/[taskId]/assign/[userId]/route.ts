import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// DELETE /api/tasks/[taskId]/assign/[userId]
// Removes a user assignment from a task.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string; userId: string }> }
) {
  const { taskId, userId } = await params;

  const { error } = await supabaseAdmin
    .from('task_assignees')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ unassigned: { taskId, userId } });
}
