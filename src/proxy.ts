import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';

// Routes that don't require auth
const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/api/monday/webhook',  // called by monday.com, verified by HMAC signature instead
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { method } = request;
  const start = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip public/legacy routes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const clientSecret = process.env.MONDAY_CLIENT_SECRET;
  const signingSecret = process.env.MONDAY_SIGNING_SECRET;

  // In development without secrets, allow through (dev fallback in route handlers)
  if (!clientSecret && !signingSecret) {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Server misconfiguration: missing client secret' }, { status: 500 });
  }

  // Extract token from Authorization header or x-monday-session-token
  const authHeader = request.headers.get('authorization');
  const sessionHeader = request.headers.get('x-monday-session-token');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : sessionHeader;

  if (!token) {
    log({ type: 'access', method, path: pathname, status: 401, ip, duration_ms: Date.now() - start });
    return NextResponse.json({ error: 'Unauthorized: missing session token' }, { status: 401 });
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      log({ type: 'access', method, path: pathname, status: 401, ip, duration_ms: Date.now() - start });
      return NextResponse.json({ error: 'Unauthorized: malformed token' }, { status: 401 });
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    const { createHmac } = await import('crypto');
    const message = `${headerB64}.${payloadB64}`;

    // Monday.com signs session tokens with the client secret as a plain UTF-8 string
    const secret = clientSecret ?? signingSecret!;
    const expected = createHmac('sha256', secret).update(message).digest('base64url');

    if (expected !== signatureB64) {
      log({ type: 'access', method, path: pathname, status: 401, ip, duration_ms: Date.now() - start });
      return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check token expiry
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      log({ type: 'access', method, path: pathname, status: 401, ip, duration_ms: Date.now() - start });
      return NextResponse.json({ error: 'Unauthorized: token expired' }, { status: 401 });
    }

    const dat = payload.dat as { account_id?: number; user_id?: number } | undefined;
    if (typeof dat?.account_id !== 'number') {
      log({ type: 'access', method, path: pathname, status: 401, ip, duration_ms: Date.now() - start });
      return NextResponse.json({ error: 'Unauthorized: invalid token payload' }, { status: 401 });
    }

    const account_id = String(dat.account_id);
    const user_id = typeof dat.user_id === 'number' ? String(dat.user_id) : undefined;

    log({ type: 'access', method, path: pathname, status: 200, account_id, user_id, ip, duration_ms: Date.now() - start });

    // Inject verified identity headers so route handlers can trust them
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-verified-workspace-id', account_id);
    if (user_id) requestHeaders.set('x-verified-user-id', user_id);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[proxy] JWT verify failed:', message);
    log({ type: 'error', method, path: pathname, ip, message });
    return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
  }
}

export const config = {
  matcher: '/api/:path*',
};
