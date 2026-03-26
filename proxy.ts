import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require auth (none currently — all API routes need it)
const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/api/monday', // legacy monday sync routes use their own token mechanism
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip public/legacy routes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const clientSecret = process.env.MONDAY_CLIENT_SECRET;

  // In development without a client secret, allow through (dev fallback in route handlers)
  if (!clientSecret) {
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
    return NextResponse.json({ error: 'Unauthorized: missing session token' }, { status: 401 });
  }

  try {
    // Manual HS256 verification — jose's jwtVerify can choke on monday's non-standard exp format
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const { createHmac } = await import('crypto');
    // Try both UTF-8 and hex-decoded interpretations of the secret
    const sigUtf8 = createHmac('sha256', clientSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    const sigHex = createHmac('sha256', Buffer.from(clientSecret, 'hex'))
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    const expectedSig = sigUtf8;
    console.error('[proxy] sigUtf8:', sigUtf8.slice(0, 10), 'sigHex:', sigHex.slice(0, 10), 'actual:', signatureB64.slice(0, 10));

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    console.error('[proxy] token payload:', JSON.stringify(payload));
    console.error('[proxy] clientSecret length:', clientSecret.length, 'first6:', clientSecret.slice(0, 6));

    if (expectedSig !== signatureB64) {
      console.error('[proxy] signature mismatch — expected:', expectedSig.slice(0, 10), 'got:', signatureB64.slice(0, 10));
      return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
    }

    const dat = payload.dat as { account_id?: number } | undefined;
    if (typeof dat?.account_id !== 'number') {
      console.error('[proxy] invalid payload:', payload);
      return NextResponse.json({ error: 'Unauthorized: invalid token payload' }, { status: 401 });
    }

    // Inject the verified accountId as a header so route handlers can trust it
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-verified-workspace-id', String(dat.account_id));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    console.error('[proxy] JWT verify failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
  }
}

export const config = {
  matcher: '/api/:path*',
};
