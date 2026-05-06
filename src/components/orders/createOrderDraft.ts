export type NewOrderDraft = {
  item: string;
  notes: string;
  purchaseDate: string;
  recipientName: string;
  phone: string;
  quantity: string;
  buyer: string;
  domesticDeliveryAddress: string;
  payer: "虹" | "藍";
  cost: string;
  price: string;
  domesticShippingFee: string;
  revenue: string;
  paymentStatus: "未收款" | "已收款" | "已入帳";
  productStatus: "未購買" | "已購買" | "到虹家" | "集運回台" | "到台灣" | "已出貨";
  packageNumber: string;
};

export function createEmptyNewOrderDraft(): NewOrderDraft {
  return {
    item: "",
    notes: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    recipientName: "",
    phone: "",
    quantity: "1",
    buyer: "",
    domesticDeliveryAddress: "",
    payer: "虹",
    cost: "",
    price: "",
    domesticShippingFee: "0",
    revenue: "0",
    paymentStatus: "未收款",
    productStatus: "未購買",
    packageNumber: "未指定",
  };
}

