import type { OrderDetailFormValues } from "@/lib/orders";

export const REQUIRED_MSG = "此欄位為必填";

export type OrderDetailFieldLock = {
  /** 載入中／錯誤時，整表不可操作（含成本） */
  formDisabled: boolean;
  /** 一般欄位停用（formDisabled 或已出貨鎖定） */
  fieldsDisabled: boolean;
  /** 商品狀態已出貨，僅成本可改 */
  isShippedLocked: boolean;
};

export function buildOrderDetailFieldLock(
  formDisabled: boolean,
  isPersistedShippedLocked: boolean,
): OrderDetailFieldLock {
  return {
    formDisabled,
    fieldsDisabled: formDisabled || isPersistedShippedLocked,
    isShippedLocked: isPersistedShippedLocked,
  };
}

export function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

export function emptyOrderDetailForm(): OrderDetailFormValues {
  return {
    item: "",
    notes: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    recipientName: "",
    phone: "",
    quantity: 1,
    buyer: "",
    domesticDeliveryAddress: "",
    payer: "虹",
    cost: 0,
    price: 0,
    domesticShippingFee: 0,
    revenue: 0,
    paymentStatus: "未收款",
    productStatus: "未購買",
    packageNumber: "未指定",
  };
}
