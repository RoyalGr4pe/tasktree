-- TaskTree initial schema
-- Run this migration against your Supabase project via the Supabase dashboard
-- or `supabase db push`.

create table if not exists nodes (
  id               uuid        primary key default gen_random_uuid(),
  board_id         text        not null,
  item_id          text        not null,
  parent_node_id   uuid        references nodes(id) on delete set null,
  position         integer     not null default 0,
  depth            integer     not null default 0,
  created_at       timestamptz not null default now(),

  constraint unique_board_item unique (board_id, item_id)
);

-- Query performance indexes
create index if not exists idx_nodes_board_id
  on nodes(board_id);

create index if not exists idx_nodes_parent_node_id
  on nodes(parent_node_id);

create index if not exists idx_nodes_board_position
  on nodes(board_id, position);

-- Enable Row Level Security
-- You may want to add actual policies once you have auth in place.
alter table nodes enable row level security;

-- Permissive policy for MVP (tighten before production)
create policy "Allow all operations for now"
  on nodes
  for all
  using (true)
  with check (true);
