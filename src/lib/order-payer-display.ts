import { isOrderPayer, type OrderPayer } from "@/types/database";

const ORDER_PAYER_DISPLAY: Record<OrderPayer, string> = {
  虹: "🌈",
  藍: "🔵",
  藍男友: "🔵👦🏻",
};

/** 付款人 UI 顯示用；篩選與儲存仍使用原始值（虹／藍／藍男友）。 */
export function formatOrderPayerDisplay(payer: string): string {
  if (isOrderPayer(payer)) {
    return ORDER_PAYER_DISPLAY[payer];
  }
  return payer;
}
