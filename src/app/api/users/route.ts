import { NextResponse } from 'next/server';
import { getWorkspaceUsers } from '@/lib/monday-users';

// GET /api/users
// Returns workspace users from monday.com (cached server-side).
// Uses the server-side API token — never exposes it to the client.

export async function GET() {
  const token = process.env.MONDAY_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'MONDAY_API_TOKEN not configured' }, { status: 500 });
  }

  try {
    const users = await getWorkspaceUsers(token);
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/users] Error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
