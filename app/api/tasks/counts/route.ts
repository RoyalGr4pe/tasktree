import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getWorkspaceId } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/tasks/counts?workspace_id=xxx
// Returns { counts: { [boardId]: number } } for all boards in the workspace.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('board_id')
    .eq('workspace_id', workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.board_id] = (counts[row.board_id] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}
