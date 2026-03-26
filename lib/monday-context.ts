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

  const ctx = await new Promise<MondayContext>((resolve, reject) => {
    monday.listen('context', (res: { data: Record<string, unknown> }) => {
      const accountId = (res.data?.account as { id?: unknown } | undefined)?.id;
      const userId = res.data?.user as string | undefined;

      if (!accountId) {
        reject(new Error('monday SDK context missing account id'));
        return;
      }

      resolve({
        workspaceId: String(accountId),
        userId: userId ? String(userId) : 'unknown',
        theme: res.data?.theme as MondayContext['theme'],
        sessionToken: res.data?.sessionToken as string | undefined,
      });
    });
  });

  // sessionToken is not reliably present in the context event — fetch it explicitly
  if (!ctx.sessionToken) {
    try {
      const tokenRes = await monday.execute('getSessionToken') as { data: string };
      if (tokenRes?.data) ctx.sessionToken = tokenRes.data;
    } catch {
      // not available in this context — proceed without it
    }
  }

  return ctx;
}
