-- 集運包裹主檔（日本→台灣）：一個包裹可掛多筆訂單；包裹編號為全表唯一、遞增正整數。
-- 過渡期仍保留 orders.package_number（文字）；新流程請使用 orders.package_id 對應 packages.id，
-- 顯示給使用者看 packages.number。
--
-- 前置條件：必須先執行 20260429120000_create_orders.sql（建立 public.orders 與 set_orders_updated_at）。
-- 若單獨貼上本檔會出現 relation "public.orders" does not exist。

create table if not exists public.packages (
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
  arrived_at_tw timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_number_key unique (number)
);

create index if not exists packages_created_at_idx
  on public.packages (created_at desc);

create index if not exists packages_status_idx
  on public.packages (status);

comment on table public.packages is
  'Consolidation parcel JP→TW; one package groups many orders; number is monotonic display id.';
comment on column public.packages.number is
  'Human-visible parcel id: 1, 2, 3, … (auto-increment, unique).';
comment on column public.packages.status is
  'open=可掛訂單; in_japan=集貨; in_transit=運送中; arrived_taiwan=到台; closed=結案.';
comment on column public.packages.arrived_at_tw is
  'Optional: when the consolidation arrived in Taiwan.';

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

-- 訂單：指向包裹主檔（可為 null = 尚未指派集運批次）
alter table public.orders
  add column if not exists package_id uuid
    references public.packages (id) on delete set null;

-- 到台灣後各訂單的店到店／國內寄送地址（與集運批次無關，每筆訂單各自一個）
alter table public.orders
  add column if not exists domestic_delivery_address text not null default '';

create index if not exists orders_package_id_idx
  on public.orders (package_id);

comment on column public.orders.package_id is
  'FK to packages; null means not assigned to a consolidation parcel yet.';
comment on column public.orders.domestic_delivery_address is
  'TW store-to-store or local address after arrival (per order).';
comment on column public.orders.package_number is
  'Legacy text label; prefer package_id + packages.number for new code.';
