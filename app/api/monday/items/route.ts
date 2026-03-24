import { NextRequest, NextResponse } from 'next/server';
import { getBoardItems, createItem } from '@/lib/monday';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbNode } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/monday/items?board_id=xxx
// Server-side proxy to the monday.com GraphQL API.
// The monday SDK token is forwarded via the `x-monday-token` header.
// This route exists to keep the token server-side and avoid CORS issues.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get('board_id');

  if (!boardId) {
    return NextResponse.json({ error: 'Missing board_id query parameter' }, { status: 400 });
  }

  // Use the server-side API token — more reliable than the SDK session token
  // which is a short-lived JWT not accepted by the REST API directly.
  const token = process.env.MONDAY_API_TOKEN ?? request.headers.get('x-monday-token');
  if (!token) {
    return NextResponse.json({ error: 'Missing monday API token' }, { status: 401 });
  }

  try {
    const items = await getBoardItems(boardId, token);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/monday/items] Error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/monday/items
// Creates a new monday item then inserts it as a child node in Supabase.
// Body: { board_id, parent_node_id, name }
// Header: x-monday-token
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const token = process.env.MONDAY_API_TOKEN ?? request.headers.get('x-monday-token');
  if (!token) {
    return NextResponse.json({ error: 'Missing monday API token' }, { status: 401 });
  }

  let body: { board_id: string; parent_node_id?: string | null; name: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { board_id, parent_node_id, name } = body;
  if (!board_id || !name?.trim()) {
    return NextResponse.json({ error: 'board_id and name are required' }, { status: 400 });
  }

  // 1. Calculate depth and position
  let depth = 0;
  let position = 0;

  if (parent_node_id) {
    const { data: parentNode, error: parentErr } = await supabaseAdmin
      .from('nodes')
      .select('depth')
      .eq('id', parent_node_id)
      .single();

    if (parentErr || !parentNode) {
      return NextResponse.json({ error: 'Parent node not found' }, { status: 404 });
    }

    depth = (parentNode as { depth: number }).depth + 1;

    const { count } = await supabaseAdmin
      .from('nodes')
      .select('id', { count: 'exact', head: true })
      .eq('parent_node_id', parent_node_id);
    position = count ?? 0;
  } else {
    // Root node — position after last root
    const { count } = await supabaseAdmin
      .from('nodes')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', board_id)
      .is('parent_node_id', null);
    position = count ?? 0;
  }

  // 2. Create the monday item
  let mondayItem: Awaited<ReturnType<typeof createItem>>;
  try {
    mondayItem = await createItem(board_id, name.trim(), token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/monday/items] monday createItem error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 3. Insert the new node into Supabase
  const { data: newNode, error: insertErr } = await supabaseAdmin
    .from('nodes')
    .insert({
      board_id,
      item_id: mondayItem.id,
      parent_node_id: parent_node_id ?? null,
      position,
      depth,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[POST /api/monday/items] Supabase insert error:', insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    node: newNode as DbNode,
    monday_item: mondayItem,
  });
}
