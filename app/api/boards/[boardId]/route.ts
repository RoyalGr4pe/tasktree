import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbBoard } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// PATCH /api/boards/[boardId]
// Renames a board.
// Body: { name: string }
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
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
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const { error } = await supabaseAdmin
    .from('boards')
    .delete()
    .eq('id', boardId);

  if (error) {
    console.error('[DELETE /api/boards/[boardId]] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: boardId });
}
