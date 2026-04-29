-- Revenue is now computed in frontend/app logic; no persisted/generated DB column.
alter table public.orders
  drop column if exists revenue;

comment on table public.orders is
  'Admin order rows; revenue is computed in app (price - cost), not stored.';
