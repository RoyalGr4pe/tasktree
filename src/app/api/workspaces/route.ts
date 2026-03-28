import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DbWorkspace } from '@/lib/supabase';
import { getWorkspaceId } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/workspaces?workspace_id=xxx
// Returns the workspace record, creating it with plan=free if it doesn't exist.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { workspaceId, error: authError } = getWorkspaceId(request);
  if (authError) return authError;

  // Upsert workspace (creates with free plan on first visit).
  // Clears scheduled_for_deletion_at so a reinstall cancels a pending deletion.
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .upsert(
      { id: workspaceId, scheduled_for_deletion_at: null },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    console.error('[GET /api/workspaces] Upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspace: data as DbWorkspace });
}
