alter table public.orders
  add column customer_user_id uuid references auth.users(id) on delete set null;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select (id, full_name, phone, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

create or replace function public.is_cebri_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_cebri_admin() from public, anon;
grant execute on function public.is_cebri_admin() to authenticated;

create policy "Customers read their profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_cebri_admin());

create policy "Customers update their profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_customer_profile() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_customer_profile();

grant select on public.orders to authenticated;
create policy "Customers read their own orders" on public.orders
  for select to authenticated
  using (customer_user_id = auth.uid() or public.is_cebri_admin());
