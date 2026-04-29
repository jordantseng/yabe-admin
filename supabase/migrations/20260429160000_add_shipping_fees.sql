-- Add shipping fee fields:
-- - per order domestic shipping
-- - per package international shipping

alter table public.orders
  add column if not exists domestic_shipping_fee numeric(12, 2) not null default 0;

alter table public.packages
  add column if not exists international_shipping_fee numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_domestic_shipping_fee_non_negative'
  ) then
    alter table public.orders
      add constraint orders_domestic_shipping_fee_non_negative
      check (domestic_shipping_fee >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'packages_international_shipping_fee_non_negative'
  ) then
    alter table public.packages
      add constraint packages_international_shipping_fee_non_negative
      check (international_shipping_fee >= 0);
  end if;
end $$;

comment on column public.orders.domestic_shipping_fee is
  'Per-order domestic shipping fee (TW store-to-store / local shipping).';
comment on column public.packages.international_shipping_fee is
  'Per-package international shipping fee for JP->TW consolidation.';
