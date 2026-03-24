import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/task-labels?board_id=xxx
// Returns all task-label assignments for a board.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get('board_id');
  if (!boardId) {
    return NextResponse.json({ error: 'Missing board_id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('task_labels')
    .select('task_id, label_id')
    .eq('board_id', boardId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ taskLabels: data });
}

// ---------------------------------------------------------------------------
// PUT /api/task-labels
// Replaces all labels for a task.
// Body: { task_id, board_id, label_ids: string[] }
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  let body: { task_id: string; board_id: string; label_ids: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { task_id, board_id, label_ids } = body;
  if (!task_id || !board_id) {
    return NextResponse.json({ error: 'task_id and board_id are required' }, { status: 400 });
  }

  // Delete existing, then insert new
  const { error: deleteError } = await supabaseAdmin
    .from('task_labels')
    .delete()
    .eq('task_id', task_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (label_ids.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('task_labels')
      .insert(label_ids.map((label_id) => ({ task_id, board_id, label_id })));

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
