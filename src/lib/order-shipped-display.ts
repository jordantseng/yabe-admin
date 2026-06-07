import type { OrderProductStatus } from "@/types/database";

export function formatShippedAtDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/** 商品狀態欄 UI：已出貨時顯示「已出貨: {日期}」，否則顯示狀態文字。 */
export function productStatusFieldDisplay(
  productStatus: OrderProductStatus | string,
  shippedAt?: string | null,
): string {
  if (productStatus === "已出貨") {
    return shippedAt
      ? `已出貨: ${formatShippedAtDisplay(shippedAt)}`
      : "已出貨";
  }
  return productStatus;
}
