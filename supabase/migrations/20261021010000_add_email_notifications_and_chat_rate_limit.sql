alter table public.orders
  add column customer_email text,
  add column business_email_sent boolean not null default false,
  add column customer_email_sent boolean not null default false;

drop function public.allow_order_request(text);

create function public.allow_order_request(p_ip_hash text, p_cooldown_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  permitted boolean;
begin
  if p_cooldown_seconds < 1 or p_cooldown_seconds > 120 then
    return false;
  end if;

  with attempt as (
    insert into public.order_request_limits(ip_hash, last_request_at)
    values (p_ip_hash, now())
    on conflict (ip_hash) do update
      set last_request_at = excluded.last_request_at
      where public.order_request_limits.last_request_at < now() - make_interval(secs => p_cooldown_seconds)
    returning 1
  )
  select exists(select 1 from attempt) into permitted;

  return permitted;
end;
$$;

revoke all on function public.allow_order_request(text, integer) from public, anon, authenticated;
grant execute on function public.allow_order_request(text, integer) to service_role;
