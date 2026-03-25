-- Programs: named cross-board hierarchies
create table if not exists programs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null,
  name          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists programs_workspace_id_idx on programs (workspace_id);

-- Program boards: which boards belong to which program, in what order
create table if not exists program_boards (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references programs(id) on delete cascade,
  board_id    uuid not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint program_boards_unique unique (program_id, board_id)
);

create index if not exists program_boards_program_id_idx on program_boards (program_id);
