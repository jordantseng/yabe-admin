import { supabase } from "@/lib/supabase";
import type { OrderRow as OrderRecord } from "@/types/database";

export type OrdersTableRow = {
  id: string;
  item: string;
  purchaseDate: string;
  buyer: string;
  payer: OrderRecord["payer"];
  cost: string;
  price: string;
  revenue: string;
  paymentStatus: OrderRecord["payment_status"];
  productStatus: OrderRecord["product_status"];
  packageNumber: string;
};

export type OrderDetailFormValues = {
  item: string;
  purchaseDate: string;
  buyer: string;
  payer: string;
  cost: number;
  price: number;
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
    payer: row.payer,
    cost: Number(row.cost),
    price: Number(row.price),
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
  payer: OrderRecord["payer"];
  cost: number;
  price: number;
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
      payer: input.payer,
      cost: input.cost,
      price: input.price,
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
  const row: Record<string, string> = {};
  if (patch.payer !== undefined) row.payer = patch.payer;
  if (patch.paymentStatus !== undefined) row.payment_status = patch.paymentStatus;
  if (patch.productStatus !== undefined) row.product_status = patch.productStatus;
  if (patch.packageNumber !== undefined) row.package_number = patch.packageNumber;

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

  const { data, error } = await supabase
    .from("orders")
    .update({
      item: values.item.trim(),
      purchase_date: purchaseDate,
      buyer: values.buyer.trim(),
      payer: values.payer as OrderRecord["payer"],
      cost: values.cost,
      price: values.price,
      payment_status: values.paymentStatus as OrderRecord["payment_status"],
      product_status: values.productStatus as OrderRecord["product_status"],
      package_number: values.packageNumber,
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
