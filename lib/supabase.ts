import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Publishable key (sb_publishable_...) — safe for client-side use.
// Falls back to the legacy anon JWT for projects that haven't migrated yet.
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Secret key (sb_secret_...) — server-side only. Never exposed to the browser.
// Falls back to the legacy service_role JWT for projects that haven't migrated yet.
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
  );
}

// Client for use in browser / client components.
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Client for use in API routes and server components.
// Uses the secret key when available for elevated privileges; falls back to
// the publishable key if no secret key is configured (acceptable for MVP RLS setups).
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey ?? supabasePublishableKey
);

// ---------------------------------------------------------------------------
// Type-safe helpers
// ---------------------------------------------------------------------------

// Legacy — kept for rollback safety
export type DbNode = {
  id: string;
  board_id: string;
  item_id: string;
  parent_node_id: string | null;
  position: number;
  depth: number;
  created_at: string;
};

export type DbWorkspace = {
  id: string;
  plan: string;
  created_at: string;
};

export type DbBoard = {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
};

export type DbTask = {
  id: string;
  board_id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  position: number;
  depth: number;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string;
  linked_monday_item_id: string | null;
};
