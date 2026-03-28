import { jwtVerify } from 'jose';

/**
 * The payload monday.com embeds inside the sessionToken JWT.
 * Ref: https://developer.monday.com/apps/docs/monday-session-token
 */
export interface MondayTokenPayload {
  accountId: number;
  userId: number;
  backToUrl?: string;
  shortLivedToken?: string;
}

/**
 * Verifies the monday.com sessionToken JWT and returns the decoded payload.
 * Throws if the token is missing, expired, or has an invalid signature.
 */
export async function verifyMondayToken(token: string): Promise<MondayTokenPayload> {
  const secret = process.env.MONDAY_SIGNING_SECRET;
  if (!secret) {
    throw new Error('MONDAY_SIGNING_SECRET environment variable is not set');
  }

  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

  if (typeof payload.accountId !== 'number') {
    throw new Error('Invalid monday token: missing accountId');
  }

  return payload as unknown as MondayTokenPayload;
}

/**
 * Extracts and verifies the monday session token from a request.
 * Checks the Authorization header (Bearer <token>) first, then x-monday-session-token.
 * Returns the verified workspace ID (accountId as string) or throws.
 */
export async function getVerifiedWorkspaceId(request: Request): Promise<string> {
  // Skip auth in local dev when MONDAY_SIGNING_SECRET is not set
  if (!process.env.MONDAY_SIGNING_SECRET) {
    if (process.env.NODE_ENV === 'development') {
      const devId = process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID;
      if (devId) return devId;
    }
    throw new Error('MONDAY_SIGNING_SECRET is not configured');
  }

  const authHeader = request.headers.get('authorization');
  const sessionHeader = request.headers.get('x-monday-session-token');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : sessionHeader;

  if (!token) {
    throw new Error('Missing monday session token');
  }

  const payload = await verifyMondayToken(token);
  return String(payload.accountId);
}
