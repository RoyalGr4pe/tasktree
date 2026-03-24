import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbWorkspace } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/workspaces?workspace_id=xxx
// Returns the workspace record, creating it with plan=free if it doesn't exist.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');

  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
  }

  // Upsert workspace (creates with free plan on first visit)
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .upsert({ id: workspaceId }, { onConflict: 'id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    console.error('[GET /api/workspaces] Upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspace: data as DbWorkspace });
}
