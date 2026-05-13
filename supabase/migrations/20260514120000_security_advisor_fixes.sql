-- Security Advisor (splinter) follow-ups:
-- - mutable search_path on trigger helper
-- - RLS policies must not use literal true (search_path-safe auth check)
-- - peek_next_package_number: avoid SECURITY DEFINER for authenticated callers

-- ---------------------------------------------------------------------------
-- 1) Trigger helper: fixed search_path (hijack hardening)
-- ---------------------------------------------------------------------------
alter function public.set_orders_updated_at() set search_path = public;

-- ---------------------------------------------------------------------------
-- 2) RLS: replace USING (true) / WITH CHECK (true) with session guard
--    (this admin app has no per-row owner column; any signed-in user may access)
-- ---------------------------------------------------------------------------
drop policy if exists "packages_select_authenticated" on public.packages;
create policy "packages_select_authenticated"
  on public.packages for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "packages_insert_authenticated" on public.packages;
create policy "packages_insert_authenticated"
  on public.packages for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "packages_update_authenticated" on public.packages;
create policy "packages_update_authenticated"
  on public.packages for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "packages_delete_authenticated" on public.packages;
create policy "packages_delete_authenticated"
  on public.packages for delete
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "orders_select_authenticated" on public.orders;
create policy "orders_select_authenticated"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "orders_insert_authenticated" on public.orders;
create policy "orders_insert_authenticated"
  on public.orders for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "orders_update_authenticated" on public.orders;
create policy "orders_update_authenticated"
  on public.orders for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "orders_delete_authenticated" on public.orders;
create policy "orders_delete_authenticated"
  on public.orders for delete
  to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- 3) RPC: invoker reads pg_sequences as the signed-in role (no elevation)
-- ---------------------------------------------------------------------------
create or replace function public.peek_next_package_number()
returns bigint
language plpgsql
security invoker
set search_path = public
stable
as $$
declare
  v_last bigint;
  v_inc bigint;
begin
  select s.last_value, s.increment_by
  into v_last, v_inc
  from pg_catalog.pg_sequences s
  where s.schemaname = 'public'
    and s.sequencename = 'packages_number_seq';

  if not found then
    return 1;
  end if;

  if v_last is null then
    return 1;
  end if;

  return v_last + v_inc;
end;
$$;

comment on function public.peek_next_package_number() is
  'Returns the next value that will be assigned to packages.number (identity), without advancing the sequence.';

revoke all on function public.peek_next_package_number() from public;
grant execute on function public.peek_next_package_number() to authenticated;
