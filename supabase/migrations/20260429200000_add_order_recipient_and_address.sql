-- Add recipient/address fields on orders.
alter table public.orders
  add column if not exists recipient_name text,
  add column if not exists delivery_address text;

-- Backfill from existing columns when possible.
update public.orders
set
  recipient_name = coalesce(recipient_name, nullif(trim(buyer), '')),
  delivery_address = coalesce(delivery_address, nullif(trim(domestic_delivery_address), ''))
where recipient_name is null
   or delivery_address is null;

comment on column public.orders.recipient_name is
  'Recipient name for shipping.';
comment on column public.orders.delivery_address is
  'Shipping address for recipient.';
