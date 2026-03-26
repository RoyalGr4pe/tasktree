import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbBoard, DbWorkspace } from '@/lib/supabase';
import { isBoardLimitReached } from '@/lib/plan-limits';
import type { Plan } from '@/types';
import { getWorkspaceId } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/boards?workspace_id=xxx
// Lists all boards for a workspace ordered by creation date.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from('boards')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GET /api/boards] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ boards: data as DbBoard[] });
}

// ---------------------------------------------------------------------------
// POST /api/boards
// Creates a new board, enforcing plan limits.
// Body: { workspace_id: string, name: string }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { workspaceId: workspace_id, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  let body: { name: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
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

  // Count existing boards
  const { count, error: countError } = await supabaseAdmin
    .from('boards')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (isBoardLimitReached(plan, count ?? 0)) {
    return NextResponse.json(
      { error: 'board_limit_reached', plan, limit: count },
      { status: 403 }
    );
  }

  // Insert board
  const { data: board, error: insertError } = await supabaseAdmin
    .from('boards')
    .insert({ workspace_id, name: name.trim() })
    .select()
    .single();

  if (insertError) {
    console.error('[POST /api/boards] Insert error:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ board: board as DbBoard }, { status: 201 });
}
