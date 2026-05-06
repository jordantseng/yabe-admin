import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import {
  createEmptyNewOrderDraft,
  type NewOrderDraft,
} from "@/components/orders/createOrderDraft";
import { createOrder } from "@/lib/orders";
import { fetchPackageNumbersFromDb } from "@/lib/packages";

const REQUIRED_MSG = "此欄位為必填";

function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

type CreateOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateOrderDialog({
  open,
  onOpenChange,
}: CreateOrderDialogProps) {
  const queryClient = useQueryClient();
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);
  const packageNumbersQuery = useQuery({
    queryKey: ["packages", "numbers"],
    queryFn: async () => {
      const res = await fetchPackageNumbersFromDb();
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.data ?? [];
    },
    placeholderData: (previousData) => previousData,
  });
  const packageNumberOptions = packageNumbersQuery.data ?? [];
  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "totals"] });
      onOpenChange(false);
    },
    onError: (error) => {
      setCreateOrderError(error.message);
    },
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewOrderDraft>({
    defaultValues: createEmptyNewOrderDraft(),
  });

  useEffect(() => {
    if (open) {
      reset(createEmptyNewOrderDraft());
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button">新增訂單</Button>} />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>新增訂單</DialogTitle>
        </DialogHeader>
        {createOrderError && (
          <p className="text-sm text-destructive" role="alert">
            {createOrderError}
          </p>
        )}
        <form
          onSubmit={handleSubmit(async (newOrder) => {
            const item = newOrder.item.trim();
            const buyer = newOrder.buyer.trim();
            const recipientName = newOrder.recipientName.trim();
            const phone = newOrder.phone.trim();
            const quantityNumber = Number.parseInt(newOrder.quantity, 10);
            const domesticDeliveryAddress =
              newOrder.domesticDeliveryAddress.trim();
            const purchaseDate = newOrder.purchaseDate.trim();
            if (
              !item ||
              !buyer ||
              !purchaseDate ||
              !Number.isFinite(quantityNumber) ||
              quantityNumber < 1
            ) {
              return;
            }

            const costTrim = newOrder.cost.trim();
            const priceTrim = newOrder.price.trim();
            const costNumber =
              costTrim === "" ? 0 : Number.parseFloat(newOrder.cost);
            const priceNumber =
              priceTrim === "" ? 0 : Number.parseFloat(newOrder.price);
            if (!Number.isFinite(costNumber) || !Number.isFinite(priceNumber)) {
              return;
            }
            const domesticShippingFeeNumber = Number.parseFloat(
              newOrder.domesticShippingFee
            );

            setCreateOrderError(null);
            await createOrderMutation.mutateAsync({
              item,
              notes: newOrder.notes,
              purchaseDate,
              recipientName: recipientName || undefined,
              phone: phone || undefined,
              quantity: quantityNumber,
              buyer,
              domesticDeliveryAddress: domesticDeliveryAddress || undefined,
              payer: newOrder.payer,
              cost: costNumber,
              price: priceNumber,
              domesticShippingFee: Number.isNaN(domesticShippingFeeNumber)
                ? 0
                : domesticShippingFeeNumber,
              paymentStatus: newOrder.paymentStatus,
              productStatus: newOrder.productStatus,
              packageNumber: newOrder.packageNumber,
            });
          })}
          className="contents"
        >
          <div className="max-h-[70vh] min-w-0 space-y-3 overflow-x-hidden overflow-y-auto py-1">
            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                訂單資訊
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-6">
                <div className="space-y-1 md:col-span-5">
                  <label
                    htmlFor="new-order-item"
                    className="text-sm font-medium"
                  >
                    品項
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="new-order-item"
                    aria-invalid={errors.item ? true : undefined}
                    aria-describedby={
                      errors.item ? "new-order-item-error" : undefined
                    }
                    {...register("item", {
                      required: REQUIRED_MSG,
                      validate: (v) => v.trim() !== "" || REQUIRED_MSG,
                    })}
                    placeholder="品項"
                    aria-label="品項"
                  />
                  {errors.item && (
                    <p
                      id="new-order-item-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {errors.item.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-quantity"
                    className="text-sm font-medium"
                  >
                    數量
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="new-order-quantity"
                    type="number"
                    min={1}
                    step={1}
                    aria-invalid={errors.quantity ? true : undefined}
                    aria-describedby={
                      errors.quantity ? "new-order-quantity-error" : undefined
                    }
                    {...register("quantity", {
                      required: REQUIRED_MSG,
                      validate: (v) => {
                        const s = String(v ?? "").trim();
                        if (!s) return REQUIRED_MSG;
                        const n = Number.parseInt(s, 10);
                        if (!Number.isFinite(n) || n < 1) {
                          return "請輸入有效的數量（至少為 1）";
                        }
                        return true;
                      },
                    })}
                    placeholder="數量"
                    aria-label="數量"
                  />
                  {errors.quantity && (
                    <p
                      id="new-order-quantity-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {errors.quantity.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1 md:col-span-6">
                  <label
                    htmlFor="new-order-purchase-date"
                    className="text-sm font-medium"
                  >
                    購買日期
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="new-order-purchase-date"
                    type="date"
                    aria-invalid={errors.purchaseDate ? true : undefined}
                    aria-describedby={
                      errors.purchaseDate
                        ? "new-order-purchase-date-error"
                        : undefined
                    }
                    {...register("purchaseDate", { required: REQUIRED_MSG })}
                    aria-label="購買日期"
                  />
                  {errors.purchaseDate && (
                    <p
                      id="new-order-purchase-date-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {errors.purchaseDate.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1 md:col-span-3">
                  <label
                    htmlFor="new-order-buyer"
                    className="text-sm font-medium"
                  >
                    購買人
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <Input
                    id="new-order-buyer"
                    aria-invalid={errors.buyer ? true : undefined}
                    aria-describedby={
                      errors.buyer ? "new-order-buyer-error" : undefined
                    }
                    {...register("buyer", {
                      required: REQUIRED_MSG,
                      validate: (v) => v.trim() !== "" || REQUIRED_MSG,
                    })}
                    placeholder="購買人"
                    aria-label="購買人"
                  />
                  {errors.buyer && (
                    <p
                      id="new-order-buyer-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {errors.buyer.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1 md:col-span-3">
                  <label className="text-sm font-medium">付款人</label>
                  <Controller
                    control={control}
                    name="payer"
                    rules={{ required: REQUIRED_MSG }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          className="w-full min-w-0"
                          aria-label="付款人"
                        >
                          <SelectValue placeholder="付款人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="虹">虹</SelectItem>
                          <SelectItem value="藍">藍</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.payer && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.payer.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1 md:col-span-6">
                  <label className="text-sm font-medium">包裹編號</label>
                  <Controller
                    control={control}
                    name="packageNumber"
                    rules={{ required: REQUIRED_MSG }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          className="w-full min-w-0"
                          aria-label="包裹編號"
                        >
                          <SelectValue placeholder="包裹編號" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="未指定">未指定</SelectItem>
                          {packageNumberOptions.map((packageNumber) => (
                            <SelectItem
                              key={packageNumber}
                              value={packageNumber}
                            >
                              {packageNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.packageNumber && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.packageNumber.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1 md:col-span-6">
                  <label
                    htmlFor="new-order-notes"
                    className="text-sm font-medium"
                  >
                    備註
                  </label>
                  <textarea
                    id="new-order-notes"
                    {...register("notes")}
                    rows={4}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                    placeholder="備註"
                    aria-label="備註"
                  />
                </div>
              </div>
            </section>

            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                收件資訊
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <label
                    htmlFor="new-order-recipient-name"
                    className="text-sm font-medium"
                  >
                    收件人
                  </label>
                  <Input
                    id="new-order-recipient-name"
                    {...register("recipientName")}
                    placeholder="收件人"
                    aria-label="收件人"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <label
                    htmlFor="new-order-phone"
                    className="text-sm font-medium"
                  >
                    電話
                  </label>
                  <Input
                    id="new-order-phone"
                    {...register("phone")}
                    placeholder="電話"
                    aria-label="電話"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label
                    htmlFor="new-order-address"
                    className="text-sm font-medium"
                  >
                    收件地址
                  </label>
                  <Input
                    id="new-order-address"
                    {...register("domesticDeliveryAddress")}
                    placeholder="地址"
                    aria-label="地址"
                  />
                </div>
              </div>
            </section>

            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                金額資訊
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-cost"
                    className="text-sm font-medium"
                  >
                    成本
                  </label>
                  <Input
                    id="new-order-cost"
                    type="number"
                    aria-invalid={errors.cost ? true : undefined}
                    aria-describedby={
                      errors.cost ? "new-order-cost-error" : undefined
                    }
                    {...register("cost", {
                      validate: (v) => {
                        const s = String(v ?? "").trim();
                        if (s === "") return true;
                        return (
                          Number.isFinite(Number.parseFloat(s)) ||
                          "請輸入有效的數字"
                        );
                      },
                    })}
                    placeholder="成本"
                    aria-label="成本"
                  />
                  {errors.cost && (
                    <p
                      id="new-order-cost-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {errors.cost.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-price"
                    className="text-sm font-medium"
                  >
                    售價
                  </label>
                  <Input
                    id="new-order-price"
                    type="number"
                    aria-invalid={errors.price ? true : undefined}
                    aria-describedby={
                      errors.price ? "new-order-price-error" : undefined
                    }
                    {...register("price", {
                      validate: (v) => {
                        const s = String(v ?? "").trim();
                        if (s === "") return true;
                        return (
                          Number.isFinite(Number.parseFloat(s)) ||
                          "請輸入有效的數字"
                        );
                      },
                    })}
                    placeholder="售價"
                    aria-label="售價"
                  />
                  {errors.price && (
                    <p
                      id="new-order-price-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {errors.price.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-domestic-shipping-fee"
                    className="text-sm font-medium"
                  >
                    運費
                  </label>
                  <Input
                    id="new-order-domestic-shipping-fee"
                    type="number"
                    {...register("domesticShippingFee")}
                    placeholder="運費"
                    aria-label="運費"
                  />
                </div>
              </div>
            </section>

            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                訂單狀態
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <label className="text-sm font-medium">收款狀態</label>
                  <Controller
                    control={control}
                    name="paymentStatus"
                    rules={{ required: REQUIRED_MSG }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          aria-label="收款狀態"
                          className={cn(
                            "w-full min-w-0",
                            paymentStatusTextClass(field.value)
                          )}
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
                    )}
                  />
                  {errors.paymentStatus && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.paymentStatus.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <label className="text-sm font-medium">商品狀態</label>
                  <Controller
                    control={control}
                    name="productStatus"
                    rules={{ required: REQUIRED_MSG }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          className="w-full min-w-0"
                          aria-label="商品狀態"
                        >
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
                    )}
                  />
                  {errors.productStatus && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.productStatus.message}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
          <input type="hidden" {...register("revenue")} />
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  取消
                </Button>
              }
            />
            <Button type="submit" disabled={createOrderMutation.isPending}>
              {createOrderMutation.isPending ? "新增中…" : "新增訂單"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
