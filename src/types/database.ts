/** Matches public.orders after running supabase/migrations/20260429120000_create_orders.sql */

export type OrderPayer = "虹" | "藍";

export type OrderPaymentStatus = "未收款" | "已收款" | "已入帳";

export type OrderProductStatus =
  | "未購買"
  | "已購賣"
  | "到虹家"
  | "集運回台"
  | "到台灣"
  | "已出貨";

export type OrderRow = {
  id: string;
  item: string;
  purchase_date: string;
  buyer: string;
  payer: OrderPayer;
  cost: number;
  price: number;
  revenue: number;
  payment_status: OrderPaymentStatus;
  product_status: OrderProductStatus;
  package_number: string;
  created_at: string;
  updated_at: string;
};

export type OrderInsert = Omit<OrderRow, "id" | "revenue" | "created_at" | "updated_at"> &
  Partial<Pick<OrderRow, "id">>;

export type OrderUpdate = Partial<
  Omit<OrderRow, "id" | "revenue" | "created_at" | "updated_at">
>;
