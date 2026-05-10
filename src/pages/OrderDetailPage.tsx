import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { XIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@/components/ui/button";
import { FormField } from "@/components/FormField";
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
import { ordersKeys, packagesKeys } from "@/lib/queryKeys";

const REQUIRED_MSG = "此欄位為必填";

function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

function emptyOrderDetailForm(): OrderDetailFormValues {
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

function OrderDetailPage() {
  const queryClient = useQueryClient();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPersistedShippedLocked, setIsPersistedShippedLocked] =
    useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty, errors },
  } = useForm<OrderDetailFormValues>({
    defaultValues: emptyOrderDetailForm(),
  });

  const watchedCost = watch("cost");
  const watchedPrice = watch("price");
  const watchedRevenue = watch("revenue");
  const packageNumbersQuery = useQuery({
    queryKey: packagesKeys.numbers(),
    queryFn: async () => {
      const res = await fetchPackageNumbersFromDb();
      return res.data;
    },
  });

  useEffect(() => {
    const price = Number.isFinite(watchedPrice) ? watchedPrice : 0;
    const cost = Number.isFinite(watchedCost) ? watchedCost : 0;
    const nextRevenue = price - cost;
    if (!Number.isFinite(watchedRevenue) || nextRevenue !== watchedRevenue) {
      setValue("revenue", nextRevenue, { shouldDirty: true });
    }
  }, [watchedCost, watchedPrice, watchedRevenue, setValue]);

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
      let data: Awaited<ReturnType<typeof fetchOrderById>>["data"];
      try {
        const res = await fetchOrderById(orderId);
        data = res.data;
      } catch (error) {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
        setLoadError((error as Error).message);
        setIsPersistedShippedLocked(false);
        reset(emptyOrderDetailForm());
        return;
      }
      if (cancelled) {
        return;
      }
      setIsLoading(false);
      if (!data) {
        setLoadError("找不到此訂單");
        setIsPersistedShippedLocked(false);
        reset(emptyOrderDetailForm());
        return;
      }
      const values = orderRecordToDetailForm(data);
      setIsPersistedShippedLocked(values.productStatus === "已出貨");
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
      const nextValues = orderRecordToDetailForm(data);
      setIsPersistedShippedLocked(nextValues.productStatus === "已出貨");
      reset(nextValues);
      queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ordersKeys.totals() });
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
        <div
          className="mb-4 flex items-start justify-between gap-2 text-sm text-destructive"
          role="alert"
        >
          <p>{loadError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={() => setLoadError(null)}
            aria-label="關閉錯誤訊息"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mb-6 space-y-6">
        <fieldset
          disabled={formDisabled || isSaving || isPersistedShippedLocked}
          className="contents"
        >
          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground">
                訂單資訊
              </p>
            </div>
            <FormField label="品項" requiredMark error={errors.item?.message}>
              <input
                {...register("item", {
                  required: REQUIRED_MSG,
                  validate: (v) => v.trim() !== "" || REQUIRED_MSG,
                })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </FormField>

            <FormField label="數量" requiredMark error={errors.quantity?.message}>
              <input
                type="number"
                min={1}
                step={1}
                {...register("quantity", {
                  required: REQUIRED_MSG,
                  valueAsNumber: true,
                  validate: (v) =>
                    (Number.isFinite(v) && v >= 1) ||
                    "請輸入有效的數量（至少為 1）",
                })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </FormField>

            <FormField
              label="購買日期"
              requiredMark
              error={errors.purchaseDate?.message}
            >
              <input
                type="date"
                {...register("purchaseDate", { required: REQUIRED_MSG })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </FormField>

            <FormField label="購買人" requiredMark error={errors.buyer?.message}>
              <input
                {...register("buyer", {
                  required: REQUIRED_MSG,
                  validate: (v) => v.trim() !== "" || REQUIRED_MSG,
                })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </FormField>

            <FormField label="付款人" error={errors.payer?.message}>
              <Controller
                control={control}
                name="payer"
                rules={{ required: REQUIRED_MSG }}
                render={({ field }) => (
                  <Select
                    disabled={formDisabled || isPersistedShippedLocked}
                    value={field.value}
                    onValueChange={(value) => {
                      if (isPersistedShippedLocked) return;
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
            </FormField>

            <FormField label="包裹編號" error={errors.packageNumber?.message}>
              <Controller
                control={control}
                name="packageNumber"
                rules={{ required: REQUIRED_MSG }}
                render={({ field }) => (
                  <Select
                    disabled={formDisabled || isPersistedShippedLocked}
                    value={field.value}
                    onValueChange={(value) => {
                      if (isPersistedShippedLocked) return;
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
            </FormField>

            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium">備註</span>
              <textarea
                {...register("notes")}
                rows={4}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </label>

            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">
                收件資訊
              </p>
            </div>

            <FormField label="收件人">
              <input
                {...register("recipientName")}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </FormField>

            <FormField label="電話">
              <input
                {...register("phone")}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </FormField>

            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium">地址</span>
              <input
                {...register("domesticDeliveryAddress")}
                className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
              />
            </label>

            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">
                金額資訊
              </p>
            </div>

            <div className="md:col-span-2 grid gap-4 md:grid-cols-4">
              <FormField label="售價" error={errors.price?.message}>
                <input
                  type="number"
                  {...register("price", {
                    setValueAs: (v) => {
                      if (v === "" || v === null || v === undefined) {
                        return 0;
                      }
                      const n = Number(v);
                      return Number.isFinite(n) ? n : 0;
                    },
                  })}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                />
              </FormField>
              <FormField label="成本" error={errors.cost?.message}>
                <input
                  type="number"
                  {...register("cost", {
                    setValueAs: (v) => {
                      if (v === "" || v === null || v === undefined) {
                        return 0;
                      }
                      const n = Number(v);
                      return Number.isFinite(n) ? n : 0;
                    },
                  })}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                />
              </FormField>
              <FormField label="收益">
                <input
                  type="number"
                  {...register("revenue", { valueAsNumber: true })}
                  readOnly
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
                />
              </FormField>
              <FormField label="運費" error={errors.domesticShippingFee?.message}>
                <input
                  type="number"
                  {...register("domesticShippingFee", {
                    required: REQUIRED_MSG,
                    valueAsNumber: true,
                    validate: (v) => Number.isFinite(v) || REQUIRED_MSG,
                  })}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
                />
              </FormField>
            </div>

            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">
                訂單狀態
              </p>
            </div>

            <FormField label="收款狀態" error={errors.paymentStatus?.message}>
              <Controller
                control={control}
                name="paymentStatus"
                rules={{ required: REQUIRED_MSG }}
                render={({ field }) => (
                  <Select
                    disabled={formDisabled || isPersistedShippedLocked}
                    value={field.value}
                    onValueChange={(value) => {
                      if (isPersistedShippedLocked) return;
                      if (value) field.onChange(value);
                    }}
                  >
                    <SelectTrigger
                      className={`w-full ${paymentStatusTextClass(
                        field.value
                      )}`}
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
            </FormField>

            <FormField label="商品狀態" error={errors.productStatus?.message}>
              <Controller
                control={control}
                name="productStatus"
                rules={{ required: REQUIRED_MSG }}
                render={({ field }) => (
                  <Select
                    disabled={formDisabled || isPersistedShippedLocked}
                    value={field.value}
                    onValueChange={(value) => {
                      if (isPersistedShippedLocked) {
                        setSaveError("商品狀態已出貨後不可再修改");
                        return;
                      }
                      if (
                        value === "已出貨" &&
                        watch("paymentStatus") !== "已入帳"
                      ) {
                        setSaveError(
                          "收款狀態尚未入帳，不能將商品狀態改為已出貨"
                        );
                        return;
                      }
                      if (value) field.onChange(value);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label="商品狀態">
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
            {saveError && (
              <div
                className="md:col-span-2 mt-2 flex items-start justify-between gap-2 border-t pt-4 text-sm text-destructive"
                role="alert"
              >
                <p>{saveError}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive"
                  onClick={() => setSaveError(null)}
                  aria-label="關閉錯誤訊息"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
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

export default OrderDetailPage;
