-- Task dependency relationships
-- Each row: task_id depends on depends_on_task_id (Finish→Start by default)

create table if not exists task_dependencies (
  id                  uuid        primary key default gen_random_uuid(),
  task_id             uuid        not null references tasks(id) on delete cascade,
  depends_on_task_id  uuid        not null references tasks(id) on delete cascade,
  created_at          timestamptz not null default now(),
  constraint task_dependencies_no_self check (task_id != depends_on_task_id),
  constraint task_dependencies_unique  unique (task_id, depends_on_task_id)
);

create index if not exists idx_task_dep_task_id        on task_dependencies(task_id);
create index if not exists idx_task_dep_depends_on     on task_dependencies(depends_on_task_id);

alter table task_dependencies enable row level security;

create policy "service role full access"
  on task_dependencies for all
  using (true) with check (true);
