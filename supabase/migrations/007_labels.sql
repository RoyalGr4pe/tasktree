-- Labels — workspace-scoped tags that can be applied to tasks.

create table if not exists labels (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  text        not null,
  name          text        not null,
  color         text        not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_labels_workspace_id on labels(workspace_id);

alter table labels enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'labels' and policyname = 'service role full access'
  ) then
    execute 'create policy "service role full access" on labels for all using (true) with check (true)';
  end if;
end $$;


-- Task labels — join table linking tasks to labels.

create table if not exists task_labels (
  task_id   uuid  not null references tasks(id)  on delete cascade,
  label_id  uuid  not null references labels(id) on delete cascade,
  board_id  uuid  not null references boards(id) on delete cascade,

  primary key (task_id, label_id)
);

create index if not exists idx_task_labels_task_id  on task_labels(task_id);
create index if not exists idx_task_labels_board_id on task_labels(board_id);

alter table task_labels enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'task_labels' and policyname = 'service role full access'
  ) then
    execute 'create policy "service role full access" on task_labels for all using (true) with check (true)';
  end if;
end $$;


-- Default label templates (workspace_id = '__defaults__').
-- The API clones these into a workspace on first use.

insert into labels (workspace_id, name, color) values
  ('__defaults__', 'Bug',         '#e03e3e'),
  ('__defaults__', 'Feature',     '#6366f1'),
  ('__defaults__', 'Improvement', '#f0c446'),
  ('__defaults__', 'UI',          '#22c55e')
on conflict do nothing;
