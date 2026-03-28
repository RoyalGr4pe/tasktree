import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { log } from '@/lib/logger';
import { handleUninstall } from '@/services/webhooks/uninstall';

// ---------------------------------------------------------------------------
// POST /api/monday/webhook
// Receives all monday.com app lifecycle events and routes them accordingly.
// Verified via HMAC-SHA256 signature using MONDAY_SIGNING_SECRET.
// ---------------------------------------------------------------------------

type MondayWebhookPayload = {
  type: string;
  data: {
    account_id: number;
    app_id?: number;
    user_id?: number;
    [key: string]: unknown;
  };
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rawBody = await request.text();

  // Verify HMAC signature
  const signature = request.headers.get('authorization');
  const signingSecret = process.env.MONDAY_SIGNING_SECRET;

  if (signingSecret) {
    const expected = createHmac('sha256', signingSecret).update(rawBody).digest('hex');
    if (signature !== expected) {
      log({ type: 'error', method: 'POST', path: '/api/monday/webhook', ip, message: 'Invalid signature' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: MondayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, data } = payload;

  try {
    switch (type) {
      case 'uninstall':
        await handleUninstall(data.account_id, ip);
        break;

      // Add future event handlers here:
      // case 'app_subscription_cancelled':
      // case 'app_subscription_cancelled_by_user':
      //   await handleSubscriptionCancelled(data.account_id, ip);
      //   break;

      default:
        // Acknowledge unhandled events so monday.com doesn't retry
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ type: 'error', method: 'POST', path: '/api/monday/webhook', ip, message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ received: true, type });
}
