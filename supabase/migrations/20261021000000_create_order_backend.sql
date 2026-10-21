create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'quoted', 'completed', 'cancelled')),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  delivery_address text not null default '',
  customer_notes text not null default '',
  payment_preference text not null default 'Bank transfer after quote approval',
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 25),
  privacy_consent boolean not null check (privacy_consent)
);

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant all on table public.orders to service_role;

create table if not exists public.order_request_limits (
  ip_hash text primary key,
  last_request_at timestamptz not null
);

alter table public.order_request_limits enable row level security;
revoke all on table public.order_request_limits from anon, authenticated;
grant all on table public.order_request_limits to service_role;

create or replace function public.allow_order_request(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  permitted boolean;
begin
  with attempt as (
    insert into public.order_request_limits(ip_hash, last_request_at)
    values (p_ip_hash, now())
    on conflict (ip_hash) do update
      set last_request_at = excluded.last_request_at
      where public.order_request_limits.last_request_at < now() - interval '30 seconds'
    returning 1
  )
  select exists(select 1 from attempt) into permitted;

  return permitted;
end;
$$;

revoke all on function public.allow_order_request(text) from public, anon, authenticated;
grant execute on function public.allow_order_request(text) to service_role;
