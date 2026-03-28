import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { DbNode } from '@/lib/supabase';
import { deleteItem } from '@/lib/monday';
type SyncNodesPayload = { board_id: string; items: { id: string }[] };
type PatchNodePayload = { id: string; parent_node_id: string | null; position: number; depth: number };

// ---------------------------------------------------------------------------
// GET /api/monday/tree?board_id=xxx
// Returns all nodes for a board, ordered by position.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get('board_id');

  if (!boardId) {
    return NextResponse.json({ error: 'Missing board_id query parameter' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  if (error) {
    console.error('[GET /api/monday/tree] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ nodes: data as DbNode[] });
}

// ---------------------------------------------------------------------------
// POST /api/monday/tree
// Syncs monday board items into the nodes table.
// New items get inserted at root level; existing items are left unchanged
// (we preserve user-defined hierarchy). Returns all nodes for the board.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: SyncNodesPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { board_id, items } = body;

  if (!board_id || !Array.isArray(items)) {
    return NextResponse.json(
      { error: 'body must contain board_id (string) and items (array)' },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json({ nodes: [] });
  }

  // Fetch existing item_ids for this board so we only insert truly new items
  const { data: existing, error: fetchError } = await supabase
    .from('nodes')
    .select('item_id')
    .eq('board_id', board_id);

  if (fetchError) {
    console.error('[POST /api/monday/tree] Supabase fetch error:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingItemIds = new Set((existing ?? []).map((r: { item_id: string }) => r.item_id));
  const newItems = items.filter((item) => !existingItemIds.has(item.id));

  if (newItems.length > 0) {
    // Determine starting position: max existing position + 1
    const { data: maxRow } = await supabase
      .from('nodes')
      .select('position')
      .eq('board_id', board_id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    let nextPosition = maxRow ? (maxRow as { position: number }).position + 1 : 0;

    const rows = newItems.map((item) => ({
      board_id,
      item_id: item.id,
      parent_node_id: null,
      position: nextPosition++,
      depth: 0,
    }));

    const { error: insertError } = await supabase.from('nodes').insert(rows);

    if (insertError) {
      console.error('[POST /api/monday/tree] Supabase insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Return full updated list
  const { data: allNodes, error: allError } = await supabase
    .from('nodes')
    .select('*')
    .eq('board_id', board_id)
    .order('position', { ascending: true });

  if (allError) {
    return NextResponse.json({ error: allError.message }, { status: 500 });
  }

  return NextResponse.json({ nodes: allNodes as DbNode[], inserted: newItems.length });
}

// ---------------------------------------------------------------------------
// PATCH /api/monday/tree
// Updates a single node's parent_node_id, position, and depth after DnD.
// Body: PatchNodePayload
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  let body: PatchNodePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, parent_node_id, position, depth } = body;

  if (!id || position === undefined || depth === undefined) {
    return NextResponse.json(
      { error: 'body must contain id, parent_node_id, position, and depth' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('nodes')
    .update({ parent_node_id, position, depth })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[PATCH /api/monday/tree] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ node: data as DbNode });
}

// ---------------------------------------------------------------------------
// DELETE /api/monday/tree?node_id=xxx
// Deletes the node and all its descendants from Supabase, then deletes the
// corresponding monday items.
// Header: x-monday-token
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const nodeId = request.nextUrl.searchParams.get('node_id');
  if (!nodeId) {
    return NextResponse.json({ error: 'Missing node_id query parameter' }, { status: 400 });
  }

  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Server misconfiguration: missing monday API token' }, { status: 500 });
  }

  // Collect the node and all descendants by walking the tree in Supabase.
  // We do a breadth-first expansion since Postgres doesn't have recursive
  // delete cascade on the self-referential FK (it's SET NULL, not CASCADE).
  const idsToDelete: string[] = [];
  const itemIdsToDelete: string[] = [];
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const { data: node, error } = await supabaseAdmin
      .from('nodes')
      .select('id, item_id')
      .eq('id', currentId)
      .single();

    if (error || !node) continue;

    idsToDelete.push((node as { id: string; item_id: string }).id);
    itemIdsToDelete.push((node as { id: string; item_id: string }).item_id);

    // Find children
    const { data: children } = await supabaseAdmin
      .from('nodes')
      .select('id')
      .eq('parent_node_id', currentId);

    if (children) {
      queue.push(...(children as { id: string }[]).map((c) => c.id));
    }
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // Delete all collected nodes from Supabase (deepest first to avoid FK issues)
  const { error: deleteError } = await supabaseAdmin
    .from('nodes')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('[DELETE /api/monday/tree] Supabase delete error:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete monday items (best-effort — don't fail the request if this errors)
  await Promise.all(
    itemIdsToDelete.map((itemId) =>
      deleteItem(itemId, token).catch((err) =>
        console.warn('[DELETE /api/monday/tree] monday delete warning:', itemId, err)
      )
    )
  );

  return NextResponse.json({ deleted: idsToDelete });
}
