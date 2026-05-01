-- 預覽下一個 packages.number（identity），不消耗序號；刪除列後仍與實際 insert 一致。

create or replace function public.peek_next_package_number()
returns bigint
language plpgsql
security definer
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
