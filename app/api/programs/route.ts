import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getWorkspaceId } from '@/lib/api-auth';

// GET /api/programs?workspace_id=xxx
export async function GET(request: NextRequest) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { data: programs, error } = await supabaseAdmin
    .from('programs')
    .select('id, workspace_id, name, created_at, program_boards(board_id, position)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ programs: programs ?? [] });
}

// POST /api/programs  { name }
export async function POST(request: NextRequest) {
  const { workspaceId: workspace_id, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  let body: { name: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('programs')
    .insert({ workspace_id, name: name.trim() })
    .select('id, workspace_id, name, created_at, program_boards(board_id, position)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: data }, { status: 201 });
}
