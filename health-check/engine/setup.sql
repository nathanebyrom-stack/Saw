-- Website Health Check: one row per run. Written and read only by the health-check Edge Function (service role).
-- Safe to run more than once.
create extension if not exists pg_net with schema extensions;

create table if not exists public.hc_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  url text not null check (char_length(url) between 4 and 500),
  source text not null default 'web' check (char_length(source) <= 40),
  ip_hash text,
  report jsonb,
  error text
);
comment on table public.hc_reports is 'Website Health Check runs for 34automation.co.uk. Written by the health-check Edge Function. A row inserted with status=queued is picked up automatically.';
create index if not exists hc_reports_created_idx on public.hc_reports (created_at desc);
alter table public.hc_reports enable row level security;
-- No policies on purpose: only the service role (the Edge Function) and the dashboard can read or write.

-- A row inserted as 'queued' (for example from SQL) asks the Edge Function to run it.
create or replace function public.hc_reports_kick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'queued' then
    perform net.http_post(
      url := 'https://faaraefaigsngvuuvsyv.supabase.co/functions/v1/health-check',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 8000
    );
  end if;
  return new;
end;
$$;
revoke all on function public.hc_reports_kick() from public, anon, authenticated;

drop trigger if exists hc_reports_kick on public.hc_reports;
create trigger hc_reports_kick after insert on public.hc_reports
for each row execute function public.hc_reports_kick();
