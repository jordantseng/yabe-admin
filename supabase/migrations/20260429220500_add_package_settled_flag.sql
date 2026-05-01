-- 包裹是否已結清（財務）
alter table public.packages
  add column if not exists is_settled boolean not null default false;

comment on column public.packages.is_settled is
  'Whether this package is financially settled.';
