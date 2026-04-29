-- Add optional note field for each order.
alter table public.orders
  add column if not exists notes text;

comment on column public.orders.notes is
  'Optional per-order note for internal admin context.';
