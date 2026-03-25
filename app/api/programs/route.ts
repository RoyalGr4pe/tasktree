import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/programs?workspace_id=xxx
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });

  const { data: programs, error } = await supabaseAdmin
    .from('programs')
    .select('id, workspace_id, name, created_at, program_boards(board_id, position)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ programs: programs ?? [] });
}

// POST /api/programs  { workspace_id, name }
export async function POST(request: NextRequest) {
  let body: { workspace_id: string; name: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { workspace_id, name } = body;
  if (!workspace_id || !name?.trim()) return NextResponse.json({ error: 'workspace_id and name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('programs')
    .insert({ workspace_id, name: name.trim() })
    .select('id, workspace_id, name, created_at, program_boards(board_id, position)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: data }, { status: 201 });
}
