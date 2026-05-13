-- Security Advisor: SECURITY DEFINER + EXECUTE on public.rls_auto_enable
-- (function lives on hosted DB / manual SQL, not in baseline migration)
-- Revoke from client-facing roles; keep service_role for admin automation if needed.

do $$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as idargs
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  loop
    execute format(
      'revoke all on function public.rls_auto_enable(%s) from public',
      r.idargs
    );
    execute format(
      'revoke all on function public.rls_auto_enable(%s) from anon, authenticated',
      r.idargs
    );
    execute format(
      'grant execute on function public.rls_auto_enable(%s) to service_role',
      r.idargs
    );
  end loop;
end $$;
