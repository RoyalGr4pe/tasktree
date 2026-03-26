-- Add estimate_hours to tasks for rollup calculations
alter table tasks add column if not exists estimate_hours numeric(8,2) null;
