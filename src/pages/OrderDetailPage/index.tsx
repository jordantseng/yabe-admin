import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchOrderById,
  orderRecordToDetailForm,
  updateOrderFromDetailForm,
  type OrderDetailFormValues,
} from "@/lib/orders";
import { fetchPackageNumbersFromDb } from "@/lib/packages";
import { unwrapResultOrThrow } from "@/lib/result-utils";
import { ordersKeys, packagesKeys } from "@/lib/queryKeys";
import { emptyOrderDetailForm } from "./constants";
import OrderDetailAmountSection from "./components/OrderDetailAmountSection";
import OrderDetailFormFooter from "./components/OrderDetailFormFooter";
import OrderDetailHeader from "./components/OrderDetailHeader";
import OrderDetailLoadAlerts from "./components/OrderDetailLoadAlerts";
import OrderDetailOrderInfoSection from "./components/OrderDetailOrderInfoSection";
import OrderDetailRecipientSection from "./components/OrderDetailRecipientSection";
import OrderDetailStatusSection from "./components/OrderDetailStatusSection";

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

  const methods = useForm<OrderDetailFormValues>({
    defaultValues: emptyOrderDetailForm(),
  });

  const { control, handleSubmit, reset, setValue } = methods;

  const watchedCost = useWatch({ control, name: "cost", defaultValue: 0 });
  const watchedPrice = useWatch({ control, name: "price", defaultValue: 0 });
  const watchedRevenue = useWatch({
    control,
    name: "revenue",
    defaultValue: 0,
  });
  const packageNumbersQuery = useQuery({
    queryKey: packagesKeys.numbers(),
    queryFn: async () => unwrapResultOrThrow(await fetchPackageNumbersFromDb()),
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

  const orderIdMissing = !orderId;
  const displayLoadError = orderIdMissing ? "缺少訂單編號" : loadError;
  const showFetchLoading = Boolean(orderId && isLoading);
  const formDisabled = orderIdMissing || showFetchLoading || !!loadError;

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (cancelled) {
        return;
      }
      setLoadError(null);
      setIsLoading(true);
      const orderRes = await fetchOrderById(orderId);
      if (cancelled) {
        return;
      }
      if (orderRes.isErr()) {
        setIsLoading(false);
        setLoadError(orderRes.error.message);
        setIsPersistedShippedLocked(false);
        reset(emptyOrderDetailForm());
        return;
      }
      const data = orderRes.value;
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
    const updateRes = await updateOrderFromDetailForm(orderId, values);
    setIsSaving(false);
    if (updateRes.isErr()) {
      setSaveError(updateRes.error.message);
      return;
    }
    const data = updateRes.value;
    const nextValues = orderRecordToDetailForm(data);
    setIsPersistedShippedLocked(nextValues.productStatus === "已出貨");
    reset(nextValues);
    queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
    queryClient.invalidateQueries({ queryKey: ordersKeys.totals() });
    queryClient.invalidateQueries({ queryKey: packagesKeys.pageRows() });
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/orders");
    }
  };

  return (
    <main
      className="mx-auto max-w-4xl space-y-4"
      style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}
    >
      <OrderDetailHeader onBack={() => navigate(-1)} />
      <OrderDetailLoadAlerts
        showFetchLoading={showFetchLoading}
        displayLoadError={displayLoadError}
        loadError={loadError}
        onDismissLoadError={() => setLoadError(null)}
      />

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="mb-6 space-y-6">
          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <fieldset disabled={formDisabled || isSaving} className="contents">
              <OrderDetailOrderInfoSection
                formDisabled={formDisabled}
                isPersistedShippedLocked={isPersistedShippedLocked}
                packageNumberOptions={packageNumberOptions}
              />
              <OrderDetailRecipientSection
                formDisabled={formDisabled}
                isPersistedShippedLocked={isPersistedShippedLocked}
              />
              <OrderDetailAmountSection
                formDisabled={formDisabled}
                isPersistedShippedLocked={isPersistedShippedLocked}
              />
              <OrderDetailStatusSection
                formDisabled={formDisabled}
                isPersistedShippedLocked={isPersistedShippedLocked}
                onValidationMessage={setSaveError}
              />
            </fieldset>
            <OrderDetailFormFooter
              saveError={saveError}
              onDismissSaveError={() => setSaveError(null)}
              formDisabled={formDisabled}
              isSaving={isSaving}
              isPersistedShippedLocked={isPersistedShippedLocked}
            />
          </div>
        </form>
      </FormProvider>
    </main>
  );
}

export default OrderDetailPage;
