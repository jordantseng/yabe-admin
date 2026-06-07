-- 訂單出貨時間（商品狀態首次改為「已出貨」時寫入）
alter table public.orders
  add column if not exists shipped_at timestamptz;

comment on column public.orders.shipped_at is
  'When product_status first became 已出貨; set once, not overwritten on later edits.';

update public.orders
set shipped_at = updated_at
where product_status = '已出貨'
  and shipped_at is null;
