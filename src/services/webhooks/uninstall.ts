import { supabaseAdmin } from '@/lib/supabase';
import { log } from '@/lib/logger';

const DELETION_GRACE_DAYS = 5;

export async function handleUninstall(accountId: number, ip: string): Promise<void> {
  const workspaceId = String(accountId);
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + DELETION_GRACE_DAYS);

  const { error } = await supabaseAdmin
    .from('workspaces')
    .update({ scheduled_for_deletion_at: scheduledAt.toISOString() })
    .eq('id', workspaceId);

  if (error) {
    log({ type: 'error', method: 'POST', path: '/api/monday/webhook', ip, message: error.message });
    throw error;
  }

  log({ type: 'access', method: 'POST', path: '/api/monday/webhook', status: 200, account_id: workspaceId, ip, duration_ms: 0 });
}
