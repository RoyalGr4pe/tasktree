-- TaskTree MVP schema
-- Run this in the Supabase SQL editor after 001_initial.sql
-- The old `nodes` table is left intact for rollback safety.

-- ============================================================
-- 1. workspaces  (one row per monday.com account/workspace)
-- ============================================================
create table if not exists workspaces (
  id          text        primary key,   -- monday.com account_id
  plan        text        not null default 'free'
                          check (plan in ('free', 'pro', 'business')),
  created_at  timestamptz not null default now()
);

alter table workspaces enable row level security;

create policy "service role full access"
  on workspaces for all
  using (true) with check (true);

-- ============================================================
-- 2. boards  (TaskTree boards owned by a workspace)
-- ============================================================
create table if not exists boards (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id text        not null references workspaces(id) on delete cascade,
  name         text        not null default 'My Board',
  created_at   timestamptz not null default now()
);

create index if not exists idx_boards_workspace_id on boards(workspace_id);

alter table boards enable row level security;

create policy "service role full access"
  on boards for all
  using (true) with check (true);

-- ============================================================
-- 3. tasks  (pure TaskTree records — not monday items)
-- ============================================================
create table if not exists tasks (
  id                    uuid        primary key default gen_random_uuid(),
  board_id              uuid        not null references boards(id) on delete cascade,
  workspace_id          text        not null references workspaces(id) on delete cascade,
  parent_task_id        uuid        references tasks(id) on delete set null,
  title                 text        not null default '',
  position              integer     not null default 0,
  depth                 integer     not null default 0,
  created_at            timestamptz not null default now(),
  -- reserved for optional future monday.com item linking
  linked_monday_item_id text        null
);

create index if not exists idx_tasks_board_id        on tasks(board_id);
create index if not exists idx_tasks_workspace_id    on tasks(workspace_id);
create index if not exists idx_tasks_parent_task_id  on tasks(parent_task_id);
create index if not exists idx_tasks_board_position  on tasks(board_id, position);

alter table tasks enable row level security;

create policy "service role full access"
  on tasks for all
  using (true) with check (true);
