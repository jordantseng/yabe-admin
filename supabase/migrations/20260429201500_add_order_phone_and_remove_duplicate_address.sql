-- Keep a single address column and add recipient phone.
alter table public.orders
  add column if not exists recipient_phone text;

-- Merge any data from duplicate address column back to domestic_delivery_address.
update public.orders
set domestic_delivery_address = nullif(trim(delivery_address), '')
where (
    domestic_delivery_address is null
    or trim(domestic_delivery_address) = ''
  )
  and nullif(trim(delivery_address), '') is not null;

-- Ensure not-null address column has no remaining null/blank values.
update public.orders
set domestic_delivery_address = ''
where domestic_delivery_address is null
   or trim(domestic_delivery_address) = '';

-- Remove duplicate address column after data merge.
alter table public.orders
  drop column if exists delivery_address;

comment on column public.orders.recipient_phone is
  'Recipient phone number for shipping contact.';
