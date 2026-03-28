import { NextRequest, NextResponse } from 'next/server';
import { renameItem } from '@/lib/monday';

// ---------------------------------------------------------------------------
// PATCH /api/monday/rename
// Renames a monday.com item via the GraphQL API.
// Body: { item_id: string; name: string }
// Header: x-monday-token
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Server misconfiguration: missing monday API token' }, { status: 500 });
  }

  let body: { board_id: string; item_id: string; name: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { board_id, item_id, name } = body;
  if (!board_id || !item_id || !name?.trim()) {
    return NextResponse.json({ error: 'board_id, item_id and name are required' }, { status: 400 });
  }

  try {
    await renameItem(board_id, item_id, name.trim(), token);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PATCH /api/monday/rename] Error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
