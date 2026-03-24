-- Task assignees — stores which monday users are assigned to each task.
-- Users are fetched from monday API at runtime; only user IDs are stored here.

create table if not exists task_assignees (
  id           uuid        primary key default gen_random_uuid(),
  task_id      uuid        not null references tasks(id) on delete cascade,
  user_id      text        not null,
  assigned_at  timestamptz not null default now(),

  constraint unique_task_user unique (task_id, user_id)
);

create index if not exists idx_task_assignees_task_id on task_assignees(task_id);

alter table task_assignees enable row level security;

create policy "service role full access"
  on task_assignees for all
  using (true) with check (true);
