import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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

  const signingSecret = process.env.MONDAY_SIGNING_SECRET;

  // In development without a signing secret, allow through (dev fallback in route handlers)
  if (!signingSecret) {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Server misconfiguration: missing signing secret' }, { status: 500 });
  }

  // Extract token from Authorization header or x-monday-session-token
  const authHeader = request.headers.get('authorization');
  const sessionHeader = request.headers.get('x-monday-session-token');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : sessionHeader;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: missing session token' }, { status: 401 });
  }

  try {
    const key = new TextEncoder().encode(signingSecret);
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

    const dat = payload.dat as { account_id?: number } | undefined;
    if (typeof dat?.account_id !== 'number') {
      return NextResponse.json({ error: 'Unauthorized: invalid token payload' }, { status: 401 });
    }

    // Inject the verified accountId as a header so route handlers can trust it
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-verified-workspace-id', String(dat.account_id));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
  }
}

export const config = {
  matcher: '/api/:path*',
};
