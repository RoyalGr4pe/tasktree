-- Enable RLS on programs and program_boards tables

alter table programs enable row level security;

create policy "service role full access"
  on programs for all
  using (true) with check (true);

alter table program_boards enable row level security;

create policy "service role full access"
  on program_boards for all
  using (true) with check (true);
