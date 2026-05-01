-- Add order quantity with safe default.
alter table public.orders
  add column if not exists quantity integer not null default 1;

-- Ensure quantity is always >= 1.
alter table public.orders
  drop constraint if exists orders_quantity_check;

alter table public.orders
  add constraint orders_quantity_check
  check (quantity >= 1);

comment on column public.orders.quantity is
  'Item quantity for each order row.';
