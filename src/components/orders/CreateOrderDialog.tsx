import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

type CreateOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createOrderError: string | null;
  isSubmitting: boolean;
  newOrder: NewOrderDraft;
  setNewOrder: Dispatch<SetStateAction<NewOrderDraft>>;
  packageNumberOptions: string[];
  onCreate: () => void;
};

export function CreateOrderDialog({
  open,
  onOpenChange,
  createOrderError,
  isSubmitting,
  newOrder,
  setNewOrder,
  packageNumberOptions,
  onCreate,
}: CreateOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button">新增訂單</Button>} />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>新增訂單</DialogTitle>
          <DialogDescription>請填寫訂單資訊。</DialogDescription>
        </DialogHeader>
        {createOrderError && (
          <p className="text-sm text-destructive" role="alert">
            {createOrderError}
          </p>
        )}
        <div className="max-h-[70vh] space-y-3 overflow-y-auto py-1 pr-1">
          <section className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground">訂單資訊</p>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1 md:col-span-3">
                <label htmlFor="new-order-item" className="text-sm font-medium">
                  品項
                </label>
                <Input
                  id="new-order-item"
                  value={newOrder.item}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      item: event.target.value,
                    }))
                  }
                  placeholder="品項"
                  aria-label="品項"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-order-quantity" className="text-sm font-medium">
                  數量
                </label>
                <Input
                  id="new-order-quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={newOrder.quantity}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  placeholder="數量"
                  aria-label="數量"
                />
              </div>
              <div className="space-y-1 md:col-span-4">
                <label htmlFor="new-order-purchase-date" className="text-sm font-medium">
                  購買日期
                </label>
                <Input
                  id="new-order-purchase-date"
                  type="date"
                  value={newOrder.purchaseDate}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      purchaseDate: event.target.value,
                    }))
                  }
                  aria-label="購買日期"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-order-buyer" className="text-sm font-medium">
                  購買人
                </label>
                <Input
                  id="new-order-buyer"
                  value={newOrder.buyer}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      buyer: event.target.value,
                    }))
                  }
                  placeholder="購買人"
                  aria-label="購買人"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">付款人</label>
                <Select
                  value={newOrder.payer}
                  onValueChange={(value) => {
                    if (value === "虹" || value === "藍") {
                      setNewOrder((current) => ({
                        ...current,
                        payer: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger aria-label="付款人">
                    <SelectValue placeholder="付款人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="虹">虹</SelectItem>
                    <SelectItem value="藍">藍</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">包裹編號</label>
                <Select
                  value={newOrder.packageNumber}
                  onValueChange={(value) => {
                    if (value) {
                      setNewOrder((current) => ({
                        ...current,
                        packageNumber: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger aria-label="包裹編號">
                    <SelectValue placeholder="包裹編號" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未指定">未指定</SelectItem>
                    {packageNumberOptions.map((packageNumber) => (
                      <SelectItem key={packageNumber} value={packageNumber}>
                        {packageNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-3">
                <label htmlFor="new-order-notes" className="text-sm font-medium">
                  備註
                </label>
                <textarea
                  id="new-order-notes"
                  value={newOrder.notes}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                  placeholder="備註（選填）"
                  aria-label="備註"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground">收件資訊</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="new-order-item" className="text-sm font-medium">
                  收件人
                </label>
                <Input
                  id="new-order-recipient-name"
                  value={newOrder.recipientName}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      recipientName: event.target.value,
                    }))
                  }
                  placeholder="收件人"
                  aria-label="收件人"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-order-phone" className="text-sm font-medium">
                  電話
                </label>
                <Input
                  id="new-order-phone"
                  value={newOrder.phone}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="電話"
                  aria-label="電話"
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <label htmlFor="new-order-address" className="text-sm font-medium">
                  收件地址
                </label>
                <Input
                  id="new-order-address"
                  value={newOrder.domesticDeliveryAddress}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      domesticDeliveryAddress: event.target.value,
                    }))
                  }
                  placeholder="地址"
                  aria-label="地址"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground">金額資訊</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="new-order-cost" className="text-sm font-medium">
                  成本
                </label>
                <Input
                  id="new-order-cost"
                  type="number"
                  value={newOrder.cost}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      cost: event.target.value,
                    }))
                  }
                  placeholder="成本"
                  aria-label="成本"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-order-price" className="text-sm font-medium">
                  售價
                </label>
                <Input
                  id="new-order-price"
                  type="number"
                  value={newOrder.price}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  placeholder="售價"
                  aria-label="售價"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-order-domestic-shipping-fee" className="text-sm font-medium">
                  運費
                </label>
                <Input
                  id="new-order-domestic-shipping-fee"
                  type="number"
                  value={newOrder.domesticShippingFee}
                  onChange={(event) =>
                    setNewOrder((current) => ({
                      ...current,
                      domesticShippingFee: event.target.value,
                    }))
                  }
                  placeholder="運費"
                  aria-label="運費"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground">訂單狀態</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">收款狀態</label>
                <Select
                  value={newOrder.paymentStatus}
                  onValueChange={(value) => {
                    if (value === "未收款" || value === "已收款" || value === "已入帳") {
                      setNewOrder((current) => ({
                        ...current,
                        paymentStatus: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger
                    aria-label="收款狀態"
                    className={paymentStatusTextClass(newOrder.paymentStatus)}
                  >
                    <SelectValue placeholder="收款狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未收款" className="text-red-500">
                      未收款
                    </SelectItem>
                    <SelectItem value="已收款" className="text-amber-500">
                      已收款
                    </SelectItem>
                    <SelectItem value="已入帳" className="text-green-500">
                      已入帳
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">商品狀態</label>
                <Select
                  value={newOrder.productStatus}
                  onValueChange={(value) => {
                    if (
                      value === "未購買" ||
                      value === "已購買" ||
                      value === "到虹家" ||
                      value === "集運回台" ||
                      value === "到台灣" ||
                      value === "已出貨"
                    ) {
                      setNewOrder((current) => ({
                        ...current,
                        productStatus: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger aria-label="商品狀態">
                    <SelectValue placeholder="商品狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未購買">未購買</SelectItem>
                    <SelectItem value="已購買">已購買</SelectItem>
                    <SelectItem value="到虹家">到虹家</SelectItem>
                    <SelectItem value="集運回台">集運回台</SelectItem>
                    <SelectItem value="到台灣">到台灣</SelectItem>
                    <SelectItem value="已出貨">已出貨</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <Button
            type="button"
            onClick={onCreate}
            disabled={
              !newOrder.item.trim() ||
              !newOrder.buyer.trim() ||
              !newOrder.recipientName.trim() ||
              !newOrder.phone.trim() ||
              !newOrder.quantity.trim() ||
              !newOrder.domesticDeliveryAddress.trim() ||
              isSubmitting
            }
          >
            {isSubmitting ? "新增中…" : "新增訂單"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
