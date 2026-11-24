-- Performance Test (paid, £4.99): orders, settings, and the two automatic hand-offs to the hc-order function.
-- Safe to run more than once.

create table if not exists public.hc_config (
  id int primary key default 1 check (id = 1),
  paid_on boolean not null default false,          -- stays false until the privacy notice's Health Check section is live
  price_pence int not null default 499,
  currency text not null default 'gbp',
  reviewer_email text,                             -- who gets the "new order" alert
  from_email text not null default '34 Automation <healthcheck@34automation.co.uk>',
  report_page_url text not null default 'https://34automation.co.uk/health-check/',   -- where the report page is hosted
  reviewer_page_url text,                          -- the reviewer screen, linked from the alert email
  privacy_url text not null default 'https://34automation.co.uk/privacy/#health-check',
  updated_at timestamptz not null default now()
);
insert into public.hc_config (id) values (1) on conflict (id) do nothing;
comment on table public.hc_config is 'Performance Test settings (one row). paid_on must stay false until the privacy notice has its Health Check section.';
alter table public.hc_config enable row level security;

create table if not exists public.hc_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','checkout','paid','review','delivered','cancelled','expired','error')),
  source text not null default 'web' check (char_length(source) <= 40),
  url text not null check (char_length(url) between 4 and 300),
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  customer_email text not null check (char_length(customer_email) between 5 and 120 and customer_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  competitor_name text check (competitor_name is null or char_length(competitor_name) between 1 and 80),
  competitor_url text check (competitor_url is null or char_length(competitor_url) between 4 and 300),
  consent_at timestamptz not null,
  amount_pence int,
  checkout_url text,
  stripe_session_id text unique,
  paid_at timestamptz,
  due_at timestamptz,                               -- 3 working hours after payment (Mon-Fri 9-5, London time)
  report_id uuid references public.hc_reports(id),
  competitor_report_id uuid references public.hc_reports(id),
  review jsonb not null default '{}'::jsonb,        -- the designer's scores and notes
  reviewed_by text,
  delivered_at timestamptz,
  delivery_emailed_at timestamptz,
  access_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),   -- the customer's private report link
  ip_hash text,
  error text
);
comment on table public.hc_orders is 'Performance Test orders. Contains customer names and emails: covered by the privacy notice Health Check section. Written by the hc-order Edge Function.';
create index if not exists hc_orders_status_idx on public.hc_orders (status, due_at);
alter table public.hc_orders enable row level security;
-- No policies on purpose: only the service role (Edge Functions) and the dashboard can read or write.

-- 1. A row inserted as 'new' straight into the table (the Claude artifact route) asks hc-order to make its Stripe checkout.
-- 2. A row moved to 'delivered' by the reviewer asks hc-order to email the customer their report link.
create or replace function public.hc_orders_kick()
returns trigger language plpgsql security definer set search_path = '' as $$
declare act text;
begin
  if tg_op = 'INSERT' and new.status = 'new' and new.checkout_url is null and new.source <> 'web' then act := 'checkout';   -- the web route makes its own
  elsif tg_op = 'UPDATE' and new.status = 'delivered' and old.status is distinct from 'delivered' then act := 'deliver';
  end if;
  if act is not null then
    perform net.http_post(
      url := 'https://faaraefaigsngvuuvsyv.supabase.co/functions/v1/hc-order',
      body := jsonb_build_object('action', act, 'id', new.id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 8000);
  end if;
  return new;
end; $$;
revoke all on function public.hc_orders_kick() from public, anon, authenticated;
drop trigger if exists hc_orders_kick on public.hc_orders;
create trigger hc_orders_kick after insert or update of status on public.hc_orders
for each row execute function public.hc_orders_kick();
