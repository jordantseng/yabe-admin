import { useFormContext } from "react-hook-form";
import FormField from "@/components/FormField";
import type { OrderDetailFormValues } from "@/lib/orders";
import { REQUIRED_MSG } from "../constants";

type OrderDetailAmountSectionProps = {
  formDisabled: boolean;
  isPersistedShippedLocked: boolean;
};

export default function OrderDetailAmountSection({
  formDisabled,
  isPersistedShippedLocked,
}: OrderDetailAmountSectionProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<OrderDetailFormValues>();
  const lockedFieldDisabled = formDisabled || isPersistedShippedLocked;

  return (
    <>
      <div className="md:col-span-2 mt-2">
        <p className="text-xs font-semibold text-muted-foreground">金額資訊</p>
      </div>
      <div className="md:col-span-2 grid gap-4 md:grid-cols-4">
        <FormField label="售價" error={errors.price?.message}>
          <input
            type="number"
            disabled={lockedFieldDisabled}
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
            disabled={formDisabled}
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
        <FormField
          label="運費"
          error={errors.domesticShippingFee?.message}
        >
          <input
            type="number"
            disabled={lockedFieldDisabled}
            {...register("domesticShippingFee", {
              required: REQUIRED_MSG,
              valueAsNumber: true,
              validate: (v) => Number.isFinite(v) || REQUIRED_MSG,
            })}
            className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
          />
        </FormField>
      </div>
    </>
  );
}
