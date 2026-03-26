import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getWorkspaceId } from '@/lib/api-auth';

// PATCH /api/programs/[programId]  { name }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { programId } = await params;
  let body: { name?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('programs')
    .update(updates)
    .eq('id', programId)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: data });
}

// DELETE /api/programs/[programId]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { programId } = await params;
  const { error } = await supabaseAdmin.from('programs').delete().eq('id', programId).eq('workspace_id', workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
