import { NextRequest, NextResponse } from 'next/server';

/**
 * Gets the verified workspace ID from the request.
 *
 * In production: reads from the x-verified-workspace-id header, which is
 * injected by middleware after verifying the monday.com session token.
 *
 * In development (no signing secret): falls back to the query param with
 * the dev workspace ID from env vars.
 *
 * Returns { workspaceId } on success, or { error: NextResponse } to return immediately.
 */
export function getWorkspaceId(request: NextRequest):
  | { workspaceId: string; error?: never }
  | { workspaceId?: never; error: NextResponse } {

  // Trust the middleware-injected header (verified against monday JWT)
  const verified = request.headers.get('x-verified-workspace-id');
  if (verified) {
    return { workspaceId: verified };
  }

  // Dev fallback: no signing secret configured
  if (process.env.NODE_ENV === 'development' && !process.env.MONDAY_SIGNING_SECRET) {
    const devId = process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID;
    if (devId) return { workspaceId: devId };
    // Also accept the query param in dev
    const param = request.nextUrl.searchParams.get('workspace_id');
    if (param) return { workspaceId: param };
  }

  return {
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}
