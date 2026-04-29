import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  fetchOrderById,
  orderRecordToDetailForm,
  updateOrderFromDetailForm,
  type OrderDetailFormValues,
} from "@/lib/orders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchPackageNumbersFromDb } from "@/lib/packages";

const PACKAGE_NUMBERS_QUERY_KEY = ["packages", "numbers"] as const;

function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

function emptyOrderDetailForm(): OrderDetailFormValues {
  return {
    item: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
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

function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<OrderDetailFormValues>({
    defaultValues: emptyOrderDetailForm(),
  });

  const watchedCost = watch("cost");
  const watchedPrice = watch("price");
  const watchedDomesticShippingFee = watch("domesticShippingFee");
  const watchedRevenue = watch("revenue");
  const packageNumbersQuery = useQuery({
    queryKey: PACKAGE_NUMBERS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetchPackageNumbersFromDb();
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.data ?? [];
    },
  });

  useEffect(() => {
    const nextRevenue =
      (watchedPrice ?? 0) -
      (watchedCost ?? 0) -
      (watchedDomesticShippingFee ?? 0);
    if (nextRevenue !== watchedRevenue) {
      setValue("revenue", nextRevenue, { shouldDirty: true });
    }
  }, [
    watchedCost,
    watchedPrice,
    watchedDomesticShippingFee,
    watchedRevenue,
    setValue,
  ]);

  const packageNumberOptions = packageNumbersQuery.data ?? [];

  useEffect(() => {
    if (!orderId) {
      setLoadError("缺少訂單編號");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setLoadError(null);
    setIsLoading(true);

    (async () => {
      const { data, error } = await fetchOrderById(orderId);
      if (cancelled) {
        return;
      }
      setIsLoading(false);
      if (error) {
        setLoadError(error.message);
        reset(emptyOrderDetailForm());
        return;
      }
      if (!data) {
        setLoadError("找不到此訂單");
        reset(emptyOrderDetailForm());
        return;
      }
      const values = orderRecordToDetailForm(data);
      reset(values);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, reset]);

  const onSubmit = async (values: OrderDetailFormValues) => {
    if (!orderId) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const { data, error } = await updateOrderFromDetailForm(orderId, values);
    setIsSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    if (data) {
      reset(orderRecordToDetailForm(data));
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/orders");
      }
    }
  };

  const formDisabled = isLoading || !!loadError;

  return (
    <main
      className="mx-auto max-w-4xl space-y-4"
      style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">訂單詳細</h1>
          <p className="text-sm text-muted-foreground">
            訂單編號：{orderId ?? "N/A"}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
      {isLoading && (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          載入中…
        </p>
      )}
      {loadError && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      )}
      {saveError && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mb-6 space-y-6">
        <fieldset disabled={formDisabled || isSaving} className="contents">
          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground">
                基本資料
              </p>
            </div>
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

            <Field label="地址">
              <input
                {...register("domesticDeliveryAddress")}
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

            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">
                金額資訊
              </p>
            </div>

            <div className="md:col-span-2 grid gap-4 md:grid-cols-4">
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
                  {...register("price", {
                    valueAsNumber: true,
                    required: true,
                  })}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                />
              </Field>

              <Field label="店到店運費">
                <input
                  type="number"
                  {...register("domesticShippingFee", {
                    valueAsNumber: true,
                    required: true,
                  })}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                />
              </Field>

              <Field label="收益">
                <input
                  type="number"
                  {...register("revenue", {
                    valueAsNumber: true,
                    required: true,
                  })}
                  readOnly
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">
                訂單狀態
              </p>
            </div>

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
                  <SelectTrigger
                    className={`w-full ${paymentStatusTextClass(field.value)}`}
                    aria-label="收款狀態"
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
                      <SelectItem value="未指定">未指定</SelectItem>
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
            <div className="md:col-span-2 mt-2 flex justify-end border-t pt-4">
              <Button
                type="submit"
                disabled={!isDirty || formDisabled || isSaving}
              >
                {isSaving ? "更新中…" : "更新"}
              </Button>
            </div>
          </div>
        </fieldset>
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
