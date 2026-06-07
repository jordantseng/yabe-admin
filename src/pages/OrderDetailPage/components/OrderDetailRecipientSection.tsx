import { useFormContext } from "react-hook-form";
import FormField from "@/components/FormField";
import type { OrderDetailFormValues } from "@/lib/orders";

type OrderDetailRecipientSectionProps = {
  formDisabled: boolean;
  isPersistedShippedLocked: boolean;
};

export default function OrderDetailRecipientSection({
  formDisabled,
  isPersistedShippedLocked,
}: OrderDetailRecipientSectionProps) {
  const { register } = useFormContext<OrderDetailFormValues>();
  const fieldDisabled = formDisabled || isPersistedShippedLocked;

  return (
    <>
      <div className="md:col-span-2 mt-2">
        <p className="text-xs font-semibold text-muted-foreground">收件資訊</p>
      </div>

      <FormField label="收件人">
        <input
          disabled={fieldDisabled}
          {...register("recipientName")}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </FormField>

      <FormField label="電話">
        <input
          disabled={fieldDisabled}
          {...register("phone")}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </FormField>

      <label className="space-y-1 md:col-span-2">
        <span className="block text-sm font-medium">地址</span>
        <input
          disabled={fieldDisabled}
          {...register("domesticDeliveryAddress")}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </label>
    </>
  );
}
