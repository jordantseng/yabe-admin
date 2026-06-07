import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import Button from "@/components/ui/button";
import FormField from "@/components/FormField";
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
import Input from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrder } from "@/lib/orders";
import { fetchPackageNumbersFromDb } from "@/lib/packages";
import { formatOrderPayerDisplay } from "@/lib/order-payer-display";
import type { OrderPayer } from "@/types/database";
import { ORDER_PAYERS } from "@/types/database";
import { ordersKeys, packagesKeys } from "@/lib/queryKeys";
import { unwrapResultOrThrow } from "@/lib/result-utils";

const REQUIRED_MSG = "此欄位為必填";

type NewOrderDraft = {
  item: string;
  notes: string;
  purchaseDate: string;
  recipientName: string;
  phone: string;
  quantity: string;
  buyer: string;
  domesticDeliveryAddress: string;
  payer: OrderPayer;
  cost: string;
  price: string;
  domesticShippingFee: string;
  revenue: string;
  paymentStatus: "未收款" | "已收款" | "已入帳";
  productStatus: "未購買" | "已購買" | "到虹家" | "集運回台" | "到台灣" | "已出貨";
  packageNumber: string;
};

function createEmptyNewOrderDraft(): NewOrderDraft {
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

export default function CreateOrderDialog({
  open,
  onOpenChange,
}: CreateOrderDialogProps) {
  const queryClient = useQueryClient();
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);
  const packageNumbersQuery = useQuery({
    queryKey: packagesKeys.numbers(),
    queryFn: async () =>
      unwrapResultOrThrow(await fetchPackageNumbersFromDb()),
    placeholderData: (previousData) => previousData,
  });
  const packageNumberOptions = packageNumbersQuery.data ?? [];
  const createOrderMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createOrder>[0]) =>
      unwrapResultOrThrow(await createOrder(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ordersKeys.totals() });
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
                <FormField
                  className="min-w-0 md:col-span-5"
                  label="品項"
                  requiredMark
                  error={errors.item?.message}
                  errorId="new-order-item-error"
                >
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
                </FormField>
                <FormField
                  label="數量"
                  requiredMark
                  error={errors.quantity?.message}
                  errorId="new-order-quantity-error"
                >
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
                </FormField>
                <FormField
                  className="md:col-span-6"
                  label="購買日期"
                  requiredMark
                  error={errors.purchaseDate?.message}
                  errorId="new-order-purchase-date-error"
                >
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
                </FormField>
                <FormField
                  className="min-w-0 md:col-span-3"
                  label="購買人"
                  requiredMark
                  error={errors.buyer?.message}
                  errorId="new-order-buyer-error"
                >
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
                </FormField>
                <FormField
                  className="min-w-0 md:col-span-3"
                  label="付款人"
                  error={errors.payer?.message}
                >
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
                          <SelectValue placeholder="付款人">
                            {formatOrderPayerDisplay(field.value)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_PAYERS.map((payer) => (
                            <SelectItem key={payer} value={payer}>
                              {formatOrderPayerDisplay(payer)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField
                  className="min-w-0 md:col-span-6"
                  label="包裹編號"
                  error={errors.packageNumber?.message}
                >
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
                </FormField>
                <FormField className="md:col-span-6" label="備註">
                  <textarea
                    id="new-order-notes"
                    {...register("notes")}
                    rows={4}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                    placeholder="備註"
                    aria-label="備註"
                  />
                </FormField>
              </div>
            </section>

            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                收件資訊
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <FormField className="min-w-0" label="收件人">
                  <Input
                    id="new-order-recipient-name"
                    {...register("recipientName")}
                    placeholder="收件人"
                    aria-label="收件人"
                  />
                </FormField>
                <FormField className="min-w-0" label="電話">
                  <Input
                    id="new-order-phone"
                    {...register("phone")}
                    placeholder="電話"
                    aria-label="電話"
                  />
                </FormField>
                <FormField className="md:col-span-2" label="收件地址">
                  <Input
                    id="new-order-address"
                    {...register("domesticDeliveryAddress")}
                    placeholder="地址"
                    aria-label="地址"
                  />
                </FormField>
              </div>
            </section>

            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                金額資訊
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <FormField
                  label="成本"
                  error={errors.cost?.message}
                  errorId="new-order-cost-error"
                >
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
                </FormField>
                <FormField
                  label="售價"
                  error={errors.price?.message}
                  errorId="new-order-price-error"
                >
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
                </FormField>
                <FormField label="運費">
                  <Input
                    id="new-order-domestic-shipping-fee"
                    type="number"
                    {...register("domesticShippingFee")}
                    placeholder="運費"
                    aria-label="運費"
                  />
                </FormField>
              </div>
            </section>

            <section className="min-w-0 space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                訂單狀態
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <FormField
                  className="min-w-0"
                  label="收款狀態"
                  error={errors.paymentStatus?.message}
                >
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
                </FormField>
                <FormField
                  className="min-w-0"
                  label="商品狀態"
                  error={errors.productStatus?.message}
                >
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
                </FormField>
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
