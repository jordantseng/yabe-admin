import { supabase } from "@/lib/supabase";
import type { OrderRow as OrderRecord } from "@/types/database";

/** Order row from `select('*, packages(number)')`. */
export type OrderWithPackageNumber = OrderRecord & {
  packages: { number: number; international_shipping_fee?: number } | null;
};

export type OrdersTableRow = {
  id: string;
  item: string;
  purchaseDate: string;
  buyer: string;
  payer: OrderRecord["payer"];
  cost: string;
  price: string;
  domesticShippingFee: string;
  revenue: string;
  paymentStatus: OrderRecord["payment_status"];
  productStatus: OrderRecord["product_status"];
  packageNumber: string;
};

export type OrderDetailFormValues = {
  item: string;
  purchaseDate: string;
  buyer: string;
  domesticDeliveryAddress: string;
  payer: string;
  cost: number;
  price: number;
  domesticShippingFee: number;
  revenue: number;
  paymentStatus: string;
  productStatus: string;
  packageNumber: string;
};

function purchaseDateFromRecord(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

/** 收益 = 售價 − 成本 (matches DB generated column). */
export function revenueFromCostPrice(
  cost: string | number,
  price: string | number,
): number {
  const c = typeof cost === "string" ? Number.parseFloat(cost) : Number(cost);
  const p = typeof price === "string" ? Number.parseFloat(price) : Number(price);
  const nc = Number.isNaN(c) ? 0 : c;
  const np = Number.isNaN(p) ? 0 : p;
  return np - nc;
}

export function revenueStringFromCostPrice(
  cost: string | number,
  price: string | number,
): string {
  return String(revenueFromCostPrice(cost, price));
}

export function orderRecordToTableRow(row: OrderRecord): OrdersTableRow {
  return {
    id: row.id,
    item: row.item,
    purchaseDate: purchaseDateFromRecord(row.purchase_date),
    buyer: row.buyer,
    payer: row.payer,
    cost: String(row.cost),
    price: String(row.price),
    domesticShippingFee: String(row.domestic_shipping_fee),
    revenue: revenueStringFromCostPrice(row.cost, row.price),
    paymentStatus: row.payment_status,
    productStatus: row.product_status,
    packageNumber: row.package_number,
  };
}

export function orderRecordToDetailForm(row: OrderRecord): OrderDetailFormValues {
  return {
    item: row.item,
    purchaseDate: purchaseDateFromRecord(row.purchase_date),
    buyer: row.buyer,
    domesticDeliveryAddress: row.domestic_delivery_address ?? "",
    payer: row.payer,
    cost: Number(row.cost),
    price: Number(row.price),
    domesticShippingFee: Number(row.domestic_shipping_fee),
    revenue: revenueFromCostPrice(row.cost, row.price),
    paymentStatus: row.payment_status,
    productStatus: row.product_status,
    packageNumber: row.package_number,
  };
}

export type FetchOrdersOptions = {
  itemSearch?: string;
  paymentStatus?: string;
  productStatus?: string;
  packageNumber?: string;
  sortPurchaseDate?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function escapeIlikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOrderListFilters(query: any, options: FetchOrdersOptions) {
  let q = query;
  const trimmedItem = options.itemSearch?.trim() ?? "";
  if (trimmedItem.length > 0) {
    q = q.ilike("item", `%${escapeIlikePattern(trimmedItem)}%`);
  }
  const pay = options.paymentStatus?.trim();
  if (pay && pay !== "全部") q = q.eq("payment_status", pay);
  const prod = options.productStatus?.trim();
  if (prod && prod !== "全部") q = q.eq("product_status", prod);
  const pkg = options.packageNumber?.trim();
  if (pkg && pkg !== "全部") q = q.eq("package_number", pkg);
  return q;
}

export type FetchOrdersTotalsResult = {
  totalCost: number;
  totalProfit: number;
  error: { message: string } | null;
};

export async function fetchOrdersTotals(
  options: FetchOrdersOptions = {},
): Promise<FetchOrdersTotalsResult> {
  let query = supabase.from("orders").select("cost, price");
  query = applyOrderListFilters(query, options);
  const { data, error } = await query;

  if (error) {
    return { totalCost: 0, totalProfit: 0, error: { message: error.message } };
  }

  let totalCost = 0;
  let totalProfit = 0;
  for (const row of data ?? []) {
    const c = Number(row.cost);
    totalCost += Number.isNaN(c) ? 0 : c;
    totalProfit += revenueFromCostPrice(row.cost, row.price);
  }
  return { totalCost, totalProfit, error: null };
}

export type CreateOrderInput = {
  item: string;
  purchaseDate: string;
  buyer: string;
  domesticDeliveryAddress: string;
  payer: OrderRecord["payer"];
  cost: number;
  price: number;
  domesticShippingFee: number;
  paymentStatus: OrderRecord["payment_status"];
  productStatus: OrderRecord["product_status"];
  packageNumber: string;
};

export async function createOrder(input: CreateOrderInput): Promise<{
  data: OrderRecord | null;
  error: { message: string } | null;
}> {
  const purchaseDate =
    input.purchaseDate.trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      item: input.item.trim(),
      purchase_date: purchaseDate,
      buyer: input.buyer.trim(),
      domestic_delivery_address: input.domesticDeliveryAddress.trim(),
      payer: input.payer,
      cost: input.cost,
      price: input.price,
      domestic_shipping_fee: Number.isFinite(input.domesticShippingFee)
        ? Math.max(0, input.domesticShippingFee)
        : 0,
      payment_status: input.paymentStatus,
      product_status: input.productStatus,
      package_number: input.packageNumber,
    })
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };
  return { data: data as OrderRecord, error: null };
}

export async function fetchOrders(
  options: FetchOrdersOptions = {},
): Promise<{
  data: OrderRecord[] | null;
  count: number;
  error: { message: string } | null;
}> {
  const sortDir = options.sortPurchaseDate ?? "desc";
  const ascending = sortDir === "asc";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 5));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("orders").select("*", { count: "exact" });
  query = applyOrderListFilters(query, options);
  query = query
    .order("purchase_date", { ascending })
    .order("created_at", { ascending })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) return { data: null, count: 0, error: { message: error.message } };
  return {
    data: (data as OrderRecord[] | null) ?? [],
    count: count ?? 0,
    error: null,
  };
}

const PACKAGE_PAGE_LIMIT = 200;

export type FetchOrdersForPackagePageOptions = {
  itemSearch?: string;
  /** `全部` | numeric (`1`, `2`) | legacy `package_number`（僅限已指派 `package_id`） */
  packageFilter?: string;
  page?: number;
  pageSize?: number;
};

/**
 * 包裹頁列表：只回傳已指派集運包裹的訂單（`package_id` 可 join `packages`）。
 * `全部` = 所有已指派；`未指定`（舊網址）視同 `全部`；其它 = 該編號或舊版文字，且仍須已指派。
 */
export async function fetchOrdersForPackagePage(
  options: FetchOrdersForPackagePageOptions = {},
): Promise<{
  data: OrderWithPackageNumber[] | null;
  count: number;
  error: { message: string } | null;
}> {
  const raw = options.packageFilter?.trim() ?? "全部";
  const pkgFilter = raw === "未指定" ? "全部" : raw;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 15));

  const { data: pkgs, error: pkgsError } = await supabase
    .from("packages")
    .select("id, number");
  if (pkgsError) {
    return { data: null, count: 0, error: { message: pkgsError.message } };
  }
  const packageIds = new Set((pkgs ?? []).map((p) => p.id));
  const packageNumbers = new Set((pkgs ?? []).map((p) => String(p.number)));

  let query = supabase
    .from("orders")
    .select("*, packages(number, international_shipping_fee)")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(PACKAGE_PAGE_LIMIT);

  const itemSearch = options.itemSearch?.trim() ?? "";
  if (itemSearch.length > 0) {
    query = query.ilike("item", `%${escapeIlikePattern(itemSearch)}%`);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, count: 0, error: { message: error.message } };
  }

  const assigned = ((data as OrderWithPackageNumber[] | null) ?? []).filter((row) => {
    const byFk = row.package_id != null && packageIds.has(row.package_id);
    const byLegacyLabel =
      !!row.package_number &&
      row.package_number !== "未指定" &&
      packageNumbers.has(row.package_number);
    return byFk || byLegacyLabel;
  });

  const filtered =
    pkgFilter === "全部"
      ? assigned
      : assigned.filter((row) => {
          const asInt = Number.parseInt(pkgFilter, 10);
          if (Number.isFinite(asInt) && String(asInt) === pkgFilter) {
            const joined = row.packages as { number: number } | { number: number }[] | null;
            const joinedNumber = Array.isArray(joined)
              ? joined[0]?.number
              : joined != null
                ? joined.number
                : undefined;
            if (typeof joinedNumber === "number") {
              return String(joinedNumber) === pkgFilter;
            }
            return row.package_number === pkgFilter;
          }
          return row.package_number === pkgFilter;
        });

  const count = filtered.length;
  const from = (page - 1) * pageSize;
  const paginated = filtered.slice(from, from + pageSize);
  return { data: paginated, count, error: null };
}

export type OrderListFieldsPatch = {
  payer?: OrderRecord["payer"];
  paymentStatus?: OrderRecord["payment_status"];
  productStatus?: OrderRecord["product_status"];
  packageNumber?: string;
};

export async function updateOrderFields(
  orderId: string,
  patch: OrderListFieldsPatch,
): Promise<{ error: { message: string } | null }> {
  const row: Record<string, string | null> = {};
  if (patch.payer !== undefined) row.payer = patch.payer;
  if (patch.paymentStatus !== undefined) row.payment_status = patch.paymentStatus;
  if (patch.productStatus !== undefined) row.product_status = patch.productStatus;
  if (patch.packageNumber !== undefined) {
    const packageNumber = patch.packageNumber.trim();
    row.package_number = packageNumber;

    if (packageNumber === "未指定") {
      row.package_id = null;
    } else {
      const asInt = Number.parseInt(packageNumber, 10);
      if (Number.isFinite(asInt) && String(asInt) === packageNumber) {
        const { data: pkgRow, error: pkgErr } = await supabase
          .from("packages")
          .select("id")
          .eq("number", asInt)
          .maybeSingle();
        if (pkgErr) return { error: { message: pkgErr.message } };
        if (!pkgRow) return { error: { message: `找不到包裹編號 ${packageNumber}` } };
        row.package_id = pkgRow.id;
      } else {
        row.package_id = null;
      }
    }
  }

  if (Object.keys(row).length === 0) return { error: null };

  const { error } = await supabase.from("orders").update(row).eq("id", orderId);
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function updateOrderFromDetailForm(
  orderId: string,
  values: OrderDetailFormValues,
): Promise<{ data: OrderRecord | null; error: { message: string } | null }> {
  const purchaseDate =
    values.purchaseDate.trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const packageNumber = values.packageNumber.trim();
  let packageId: string | null = null;
  if (packageNumber !== "未指定") {
    const asInt = Number.parseInt(packageNumber, 10);
    if (Number.isFinite(asInt) && String(asInt) === packageNumber) {
      const { data: pkgRow, error: pkgErr } = await supabase
        .from("packages")
        .select("id")
        .eq("number", asInt)
        .maybeSingle();
      if (pkgErr) return { data: null, error: { message: pkgErr.message } };
      if (!pkgRow) {
        return { data: null, error: { message: `找不到包裹編號 ${packageNumber}` } };
      }
      packageId = pkgRow.id;
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      item: values.item.trim(),
      purchase_date: purchaseDate,
      buyer: values.buyer.trim(),
      domestic_delivery_address: values.domesticDeliveryAddress.trim(),
      payer: values.payer as OrderRecord["payer"],
      cost: values.cost,
      price: values.price,
      domestic_shipping_fee: values.domesticShippingFee,
      payment_status: values.paymentStatus as OrderRecord["payment_status"],
      product_status: values.productStatus as OrderRecord["product_status"],
      package_number: packageNumber,
      package_id: packageId,
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };
  return { data: data as OrderRecord, error: null };
}

export async function deleteOrderById(orderId: string): Promise<{
  error: { message: string } | null;
}> {
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function fetchOrderById(orderId: string): Promise<{
  data: OrderRecord | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return { data: null, error: { message: error.message } };
  return { data: data as OrderRecord | null, error: null };
}
