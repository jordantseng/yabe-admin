-- YABE admin：orders + packages 完整 schema（單一 baseline）。
-- 全新資料庫：`supabase db reset` 或 SQL Editor 整份執行一次即可。
-- 若遠端曾套用舊的多檔 migration，請勿混用；請對齊團隊 migration 紀錄後再 push。

-- ---------------------------------------------------------------------------
-- 共用：更新時間觸發函式（orders、packages 共用）
-- ---------------------------------------------------------------------------
create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- packages（須先於 orders.package_id）
-- ---------------------------------------------------------------------------
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  number bigint not null
    generated always as identity (start with 1 increment by 1 minvalue 1),
  status text not null default 'open'
    check (
      status in (
        'open',
        'in_japan',
        'in_transit',
        'arrived_taiwan',
        'closed'
      )
    ),
  notes text,
  international_shipping_fee numeric(12, 2) not null default 0,
  is_settled boolean not null default false,
  arrived_at_tw timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_number_key unique (number),
  constraint packages_international_shipping_fee_non_negative
    check (international_shipping_fee >= 0)
);

create index packages_created_at_idx on public.packages (created_at desc);
create index packages_status_idx on public.packages (status);

comment on table public.packages is
  'Consolidation parcel JP→TW; one package groups many orders; number is monotonic display id.';
comment on column public.packages.number is
  'Human-visible parcel id: 1, 2, 3, … (auto-increment, unique).';
comment on column public.packages.status is
  'open=可掛訂單; in_japan=集貨; in_transit=運送中; arrived_taiwan=到台; closed=結案.';
comment on column public.packages.arrived_at_tw is
  'Optional: when the consolidation arrived in Taiwan.';
comment on column public.packages.international_shipping_fee is
  'Per-package international shipping fee for JP->TW consolidation.';
comment on column public.packages.is_settled is
  'Whether this package is financially settled.';

drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at
  before update on public.packages
  for each row
  execute function public.set_orders_updated_at();

alter table public.packages enable row level security;

drop policy if exists "packages_select_authenticated" on public.packages;
create policy "packages_select_authenticated"
  on public.packages for select
  to authenticated
  using (true);

drop policy if exists "packages_insert_authenticated" on public.packages;
create policy "packages_insert_authenticated"
  on public.packages for insert
  to authenticated
  with check (true);

drop policy if exists "packages_update_authenticated" on public.packages;
create policy "packages_update_authenticated"
  on public.packages for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "packages_delete_authenticated" on public.packages;
create policy "packages_delete_authenticated"
  on public.packages for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- orders（無 revenue 儲存欄；利潤由應用層 price - cost）
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  purchase_date date not null,
  buyer text not null,
  payer text not null check (payer in ('虹', '藍')),
  cost numeric(12, 2) not null default 0,
  quantity integer not null default 1,
  price numeric(12, 2) not null default 0,
  payment_status text not null
    check (payment_status in ('未收款', '已收款', '已入帳')),
  product_status text not null
    check (
      product_status in (
        '未購買',
        '已購買',
        '到虹家',
        '集運回台',
        '到台灣',
        '已出貨'
      )
    ),
  package_number text not null default '未指定',
  domestic_shipping_fee numeric(12, 2) not null default 0,
  notes text,
  package_id uuid references public.packages (id) on delete set null,
  domestic_delivery_address text not null default '',
  recipient_name text,
  recipient_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_quantity_check check (quantity >= 1),
  constraint orders_domestic_shipping_fee_non_negative check (domestic_shipping_fee >= 0)
);

create index orders_purchase_date_idx on public.orders (purchase_date desc);
create index orders_package_number_idx on public.orders (package_number);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_product_status_idx on public.orders (product_status);
create index orders_package_id_idx on public.orders (package_id);

comment on table public.orders is
  'Admin order rows; revenue is computed in app (price - cost), not stored.';
comment on column public.orders.package_id is
  'FK to packages; null means not assigned to a consolidation parcel yet.';
comment on column public.orders.package_number is
  'Legacy text label; prefer package_id + packages.number for new code.';
comment on column public.orders.domestic_delivery_address is
  'TW store-to-store or local address after arrival (per order).';
comment on column public.orders.notes is
  'Optional per-order note for internal admin context.';
comment on column public.orders.recipient_name is
  'Recipient name for shipping.';
comment on column public.orders.recipient_phone is
  'Recipient phone number for shipping contact.';
comment on column public.orders.quantity is
  'Item quantity for each order row.';
comment on column public.orders.domestic_shipping_fee is
  'Per-order domestic shipping fee (TW store-to-store / local shipping).';

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_orders_updated_at();

alter table public.orders enable row level security;

drop policy if exists "orders_select_authenticated" on public.orders;
create policy "orders_select_authenticated"
  on public.orders for select
  to authenticated
  using (true);

drop policy if exists "orders_insert_authenticated" on public.orders;
create policy "orders_insert_authenticated"
  on public.orders for insert
  to authenticated
  with check (true);

drop policy if exists "orders_update_authenticated" on public.orders;
create policy "orders_update_authenticated"
  on public.orders for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "orders_delete_authenticated" on public.orders;
create policy "orders_delete_authenticated"
  on public.orders for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- RPC：預覽下一個 packages.number（不消耗 identity）
-- ---------------------------------------------------------------------------
create or replace function public.peek_next_package_number()
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_last bigint;
  v_inc bigint;
begin
  select s.last_value, s.increment_by
  into v_last, v_inc
  from pg_catalog.pg_sequences s
  where s.schemaname = 'public'
    and s.sequencename = 'packages_number_seq';

  if not found then
    return 1;
  end if;

  if v_last is null then
    return 1;
  end if;

  return v_last + v_inc;
end;
$$;

comment on function public.peek_next_package_number() is
  'Returns the next value that will be assigned to packages.number (identity), without advancing the sequence.';

revoke all on function public.peek_next_package_number() from public;
grant execute on function public.peek_next_package_number() to authenticated;
