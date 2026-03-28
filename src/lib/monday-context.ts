import type { MondayContext } from '@/types';
import { setSessionToken } from '@/lib/api-fetch';

/**
 * Resolves the monday.com context (workspaceId + userId) using three paths:
 *
 * 1. URL query params — monday injects `accountId` + `userId` into the iframe URL (fastest)
 * 2. monday SDK `get('context')` — reliable fallback with a timeout
 * 3. Env vars — local development only
 *
 * Always call this client-side only (it accesses `window`).
 */
export async function getMondayContext(timeoutMs = 3000): Promise<MondayContext> {
  // Path 1: URL params (available immediately, no SDK needed)
  // monday injects accountId, userId, and sessionToken into the iframe URL
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlAccountId = params.get('accountId');
    const urlUserId = params.get('userId');
    const urlSessionToken = params.get('sessionToken');

    if (urlAccountId && urlSessionToken) {
      setSessionToken(urlSessionToken);
      return {
        workspaceId: urlAccountId,
        userId: urlUserId ?? 'unknown',
      };
    }
  }

  // Path 2: monday SDK context (with timeout to avoid hanging outside iframe)
  try {
    const ctx = await Promise.race([
      getSdkContext(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('monday SDK context timeout')), timeoutMs)
      ),
    ]);
    if (ctx.sessionToken) setSessionToken(ctx.sessionToken);
    return ctx;
  } catch {
    // SDK timed out or errored — fall through to env vars
  }

  // Path 3: env vars for local dev (no session token — middleware allows through in dev)
  const devWorkspaceId = process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID;
  const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID;

  if (devWorkspaceId) {
    return {
      workspaceId: devWorkspaceId,
      userId: devUserId ?? 'dev-user',
    };
  }

  throw new Error(
    'Could not resolve monday.com workspace context. ' +
    'For local development, set NEXT_PUBLIC_DEV_WORKSPACE_ID in .env.local.'
  );
}

async function getSdkContext(): Promise<MondayContext> {
  // Dynamic import so this module is safe to import server-side
  const mondaySdk = (await import('monday-sdk-js')).default;
  const monday = mondaySdk();

  // Get the session token directly — it contains account_id and user_id in its payload
  const tokenRes = await monday.get('sessionToken') as { data: string };
  const sessionToken = tokenRes?.data;

  if (!sessionToken) {
    throw new Error('monday SDK did not return a session token');
  }

  // Decode the JWT payload (dat.account_id, dat.user_id) without verifying — verification
  // happens server-side in the middleware with the signing secret.
  const payloadB64 = sessionToken.split('.')[1];
  const dat = JSON.parse(atob(payloadB64)).dat as { account_id: number; user_id: number };

  if (!dat?.account_id) {
    throw new Error('monday session token missing account_id');
  }

  // Also get theme from context if available
  let theme: MondayContext['theme'];
  try {
    const ctxRes = await Promise.race([
      new Promise<{ data: Record<string, unknown> }>((resolve) => {
        monday.listen('context', (res: { data: Record<string, unknown> }) => resolve(res));
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(), 1000)),
    ]);
    theme = ctxRes.data?.theme as MondayContext['theme'];
  } catch {
    // theme is non-critical
  }

  return {
    workspaceId: String(dat.account_id),
    userId: String(dat.user_id),
    theme,
    sessionToken,
  };
}
