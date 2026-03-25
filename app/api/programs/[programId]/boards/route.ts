import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/programs/[programId]/boards  { board_id }
export async function POST(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  let body: { board_id: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { board_id } = body;
  if (!board_id) return NextResponse.json({ error: 'board_id required' }, { status: 400 });

  // Get current max position
  const { count } = await supabaseAdmin
    .from('program_boards')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId);

  const { data, error } = await supabaseAdmin
    .from('program_boards')
    .insert({ program_id: programId, board_id, position: count ?? 0 })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Board already in program' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ programBoard: data }, { status: 201 });
}

// DELETE /api/programs/[programId]/boards?board_id=xxx
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const boardId = request.nextUrl.searchParams.get('board_id');
  if (!boardId) return NextResponse.json({ error: 'board_id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('program_boards')
    .delete()
    .eq('program_id', programId)
    .eq('board_id', boardId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
