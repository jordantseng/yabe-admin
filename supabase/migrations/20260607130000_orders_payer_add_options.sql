-- 付款人新增「藍男友」
alter table public.orders drop constraint if exists orders_payer_check;

alter table public.orders
  add constraint orders_payer_check check (payer in ('虹', '藍', '藍男友'));
