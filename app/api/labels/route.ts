import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/labels?workspace_id=xxx
// Returns all labels for the workspace, cloning defaults on first call.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
  }

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
  let body: { workspace_id: string; name: string; color: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspace_id, name, color } = body;
  if (!workspace_id || !name?.trim() || !color) {
    return NextResponse.json({ error: 'workspace_id, name, and color are required' }, { status: 400 });
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
