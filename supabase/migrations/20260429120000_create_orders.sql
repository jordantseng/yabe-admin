-- Orders table aligned with src/pages/OrdersPage.tsx (OrderRow).
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- Or: supabase db push (if using Supabase CLI linked to this project).

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  purchase_date date not null,
  buyer text not null,
  payer text not null check (payer in ('虹', '藍')),
  cost numeric(12, 2) not null default 0,
  quantity integer not null default 1 check (quantity >= 1),
  price numeric(12, 2) not null default 0,
  revenue numeric(12, 2) generated always as (price - cost) stored,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_purchase_date_idx on public.orders (purchase_date desc);
create index if not exists orders_package_number_idx on public.orders (package_number);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_product_status_idx on public.orders (product_status);

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_orders_updated_at();

alter table public.orders enable row level security;

-- Adjust policies to your auth model. Example: signed-in users only.
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

comment on table public.orders is 'Admin order rows; maps to OrderRow in the app (id is uuid, not the old numeric mock id).';
