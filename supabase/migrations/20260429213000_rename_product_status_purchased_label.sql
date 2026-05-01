-- Recreate check constraint with corrected status label.
-- Drop first so data update won't be blocked by old allowed values.
alter table public.orders
  drop constraint if exists orders_product_status_check;

-- Rename product status label from 已購賣 to 已購買.
update public.orders
set product_status = '已購買'
where product_status = '已購賣';

alter table public.orders
  add constraint orders_product_status_check
  check (
    product_status in (
      '未購買',
      '已購買',
      '到虹家',
      '集運回台',
      '到台灣',
      '已出貨'
    )
  );
