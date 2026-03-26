import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getWorkspaceId } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/labels?workspace_id=xxx
// Returns all labels for the workspace, cloning defaults on first call.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from('labels')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed defaults into this workspace on first visit
  if (data.length === 0) {
    const defaults = [
      { name: 'Bug',         color: '#e03e3e' },
      { name: 'Feature',     color: '#6366f1' },
      { name: 'Improvement', color: '#f0c446' },
      { name: 'UI',          color: '#22c55e' },
    ];

    const { data: seeded, error: seedError } = await supabaseAdmin
      .from('labels')
      .insert(defaults.map((l) => ({ ...l, workspace_id: workspaceId })))
      .select();

    if (seedError) {
      console.error('[GET /api/labels] Seed error:', seedError);
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }

    return NextResponse.json({ labels: seeded ?? [] });
  }

  // Deduplicate by name (keep earliest created_at) in case of duplicate seeding
  const seen = new Set<string>();
  const deduped = data.filter((l) => {
    if (seen.has(l.name)) return false;
    seen.add(l.name);
    return true;
  });

  return NextResponse.json({ labels: deduped });
}

// ---------------------------------------------------------------------------
// POST /api/labels
// Creates a new label.
// Body: { workspace_id, name, color }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { workspaceId: workspace_id, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  let body: { name: string; color: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, color } = body;
  if (!name?.trim() || !color) {
    return NextResponse.json({ error: 'name and color are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('labels')
    .insert({ workspace_id, name: name.trim(), color })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ label: data }, { status: 201 });
}
