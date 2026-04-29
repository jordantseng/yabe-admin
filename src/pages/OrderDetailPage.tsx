import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrderDetailFormValues = {
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

const initialOrderDetail: OrderDetailFormValues = {
  item: "Nike Air Max",
  purchaseDate: "2026-04-28",
  buyer: "王小明",
  payer: "虹",
  cost: 2500,
  price: 3200,
  revenue: 700,
  paymentStatus: "未收款",
  productStatus: "未購買",
  packageNumber: "PKG-001",
};

const PACKAGE_OPTIONS_STORAGE_KEY = "package-number-options";

function OrderDetailPage() {
  const { orderId } = useParams();
  const [orderDetail, setOrderDetail] =
    useState<OrderDetailFormValues>(initialOrderDetail);
  const [packageNumberOptions] = useState(() => {
    if (typeof window === "undefined") {
      return ["PKG-001"];
    }

    const savedOptions = window.localStorage.getItem(PACKAGE_OPTIONS_STORAGE_KEY);
    if (!savedOptions) {
      return ["PKG-001"];
    }

    try {
      const parsed = JSON.parse(savedOptions);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((item) => typeof item === "string")
      ) {
        return parsed;
      }
    } catch {
      // Ignore malformed localStorage value and fallback to default.
    }

    return ["PKG-001"];
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<OrderDetailFormValues>({
    defaultValues: orderDetail,
  });

  const watchedCost = watch("cost");
  const watchedPrice = watch("price");
  const watchedRevenue = watch("revenue");

  useEffect(() => {
    const nextRevenue = (watchedPrice ?? 0) - (watchedCost ?? 0);
    if (nextRevenue !== watchedRevenue) {
      setValue("revenue", nextRevenue, { shouldDirty: true });
    }
  }, [watchedCost, watchedPrice, watchedRevenue, setValue]);

  const onSubmit = (values: OrderDetailFormValues) => {
    setOrderDetail(values);
    reset(values);
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 className="mb-2 text-xl font-semibold">訂單詳細</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        訂單編號：{orderId ?? "N/A"}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mb-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="品項">
            <input
              {...register("item", { required: true })}
              className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
            />
          </Field>

          <Field label="購買日期">
            <input
              type="date"
              {...register("purchaseDate", { required: true })}
              className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
            />
          </Field>

          <Field label="購買人">
            <input
              {...register("buyer", { required: true })}
              className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
            />
          </Field>

          <Field label="付款人">
            <Controller
              control={control}
              name="payer"
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="付款人">
                    <SelectValue placeholder="付款人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="虹">虹</SelectItem>
                    <SelectItem value="藍">藍</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="成本">
            <input
              type="number"
              {...register("cost", { valueAsNumber: true, required: true })}
              className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
            />
          </Field>

          <Field label="售價">
            <input
              type="number"
              {...register("price", { valueAsNumber: true, required: true })}
              className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
            />
          </Field>

          <Field label="收益">
            <input
              type="number"
              {...register("revenue", { valueAsNumber: true, required: true })}
              readOnly
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
            />
          </Field>

          <Field label="收款狀態">
            <Controller
              control={control}
              name="paymentStatus"
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="收款狀態">
                    <SelectValue placeholder="收款狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未收款">未收款</SelectItem>
                    <SelectItem value="已收款">已收款</SelectItem>
                    <SelectItem value="已入帳">已入帳</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="商品狀態">
            <Controller
              control={control}
              name="productStatus"
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="商品狀態">
                    <SelectValue placeholder="商品狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未購買">未購買</SelectItem>
                    <SelectItem value="已購賣">已購賣</SelectItem>
                    <SelectItem value="到虹家">到虹家</SelectItem>
                    <SelectItem value="集運回台">集運回台</SelectItem>
                    <SelectItem value="到台灣">到台灣</SelectItem>
                    <SelectItem value="已出貨">已出貨</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="包裹編號">
            <Controller
              control={control}
              name="packageNumber"
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="包裹編號">
                    <SelectValue placeholder="包裹編號" />
                  </SelectTrigger>
                  <SelectContent>
                    {packageNumberOptions.map((packageNumber) => (
                      <SelectItem key={packageNumber} value={packageNumber}>
                        {packageNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty}>
            更新
          </Button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export default OrderDetailPage;
