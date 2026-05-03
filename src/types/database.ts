/**
 * Matches public schema from supabase/migrations/20260429120000_initial_schema.sql
 */

export type PackageStatus =
  | "open"
  | "in_japan"
  | "in_transit"
  | "arrived_taiwan"
  | "closed";

export type PackageRow = {
  id: string;
  number: number;
  status: PackageStatus;
  is_settled: boolean;
  notes: string | null;
  international_shipping_fee: number;
  arrived_at_tw: string | null;
  created_at: string;
  updated_at: string;
};

export type PackageInsert = Omit<
  PackageRow,
  "id" | "number" | "created_at" | "updated_at"
> &
  Partial<Pick<PackageRow, "id">>;

export type PackageUpdate = Partial<
  Omit<PackageRow, "id" | "number" | "created_at" | "updated_at">
>;

export type OrderPayer = "虹" | "藍";

export type OrderPaymentStatus = "未收款" | "已收款" | "已入帳";

export type OrderProductStatus =
  | "未購買"
  | "已購買"
  | "到虹家"
  | "集運回台"
  | "到台灣"
  | "已出貨";

export type OrderRow = {
  id: string;
  item: string;
  purchase_date: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  buyer: string;
  payer: OrderPayer;
  cost: number;
  quantity: number;
  price: number;
  domestic_shipping_fee: number;
  notes: string | null;
  payment_status: OrderPaymentStatus;
  product_status: OrderProductStatus;
  /** Legacy; prefer package_id + join packages.number. */
  package_number: string;
  /** Assigned consolidation parcel; null = not assigned. */
  package_id: string | null;
  /** TW store-to-store / local address after arrival (per order). */
  domestic_delivery_address: string;
  created_at: string;
  updated_at: string;
};

export type OrderInsert = Omit<OrderRow, "id" | "created_at" | "updated_at"> &
  Partial<Pick<OrderRow, "id">>;

export type OrderUpdate = Partial<
  Omit<OrderRow, "id" | "created_at" | "updated_at">
>;
