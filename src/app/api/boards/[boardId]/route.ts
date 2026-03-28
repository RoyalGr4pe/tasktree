import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbBoard } from '@/lib/supabase';
import { getWorkspaceId } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// PATCH /api/boards/[boardId]
// Renames a board.
// Body: { name: string }
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { boardId } = await params;

  let body: { name: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('boards')
    .update({ name: body.name.trim() })
    .eq('id', boardId)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) {
    console.error('[PATCH /api/boards/[boardId]] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ board: data as DbBoard });
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/[boardId]
// Deletes a board and all its tasks (cascade handled by DB).
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { boardId } = await params;

  // Remove from any portfolios first (program_boards may not have FK cascade)
  await supabaseAdmin.from('program_boards').delete().eq('board_id', boardId);

  const { error } = await supabaseAdmin
    .from('boards')
    .delete()
    .eq('id', boardId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[DELETE /api/boards/[boardId]] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: boardId });
}
