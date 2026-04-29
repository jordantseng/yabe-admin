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

export function orderRecordToTableRow(row: OrderRecord): OrdersTableRow {
  return {
    id: row.id,
    item: row.item,
    purchaseDate: purchaseDateFromRecord(row.purchase_date),
    buyer: row.buyer,
    payer: row.payer,
    cost: String(row.cost),
    price: String(row.price),
    revenue: String(row.revenue),
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
    revenue: Number(row.revenue),
    paymentStatus: row.payment_status,
    productStatus: row.product_status,
    packageNumber: row.package_number,
  };
}

export type FetchOrdersOptions = {
  /** Case-insensitive substring match on `item` (Postgres `ilike`). */
  itemSearch?: string;
};

function escapeIlikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function fetchOrders(
  options: FetchOrdersOptions = {},
): Promise<{
  data: OrderRecord[] | null;
  error: { message: string } | null;
}> {
  const trimmedItem = options.itemSearch?.trim() ?? "";

  let query = supabase
    .from("orders")
    .select("*")
    .order("purchase_date", { ascending: false });

  if (trimmedItem.length > 0) {
    const pattern = `%${escapeIlikePattern(trimmedItem)}%`;
    query = query.ilike("item", pattern);
  }

  const { data, error } = await query.returns<OrderRecord[]>();

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: data ?? [], error: null };
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

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: data as OrderRecord | null, error: null };
}
