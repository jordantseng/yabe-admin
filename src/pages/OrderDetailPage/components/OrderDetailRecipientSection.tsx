import { useFormContext } from "react-hook-form";
import FormField from "@/components/FormField";
import type { OrderDetailFormValues } from "@/lib/orders";
import type { OrderDetailFieldLock } from "../constants";

type OrderDetailRecipientSectionProps = {
  fieldLock: OrderDetailFieldLock;
};

export default function OrderDetailRecipientSection({
  fieldLock,
}: OrderDetailRecipientSectionProps) {
  const { register } = useFormContext<OrderDetailFormValues>();

  return (
    <>
      <div className="md:col-span-2 mt-2">
        <p className="text-xs font-semibold text-muted-foreground">收件資訊</p>
      </div>

      <FormField label="收件人">
        <input
          disabled={fieldLock.fieldsDisabled}
          {...register("recipientName")}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </FormField>

      <FormField label="電話">
        <input
          disabled={fieldLock.fieldsDisabled}
          {...register("phone")}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </FormField>

      <label className="space-y-1 md:col-span-2">
        <span className="block text-sm font-medium">地址</span>
        <input
          disabled={fieldLock.fieldsDisabled}
          {...register("domesticDeliveryAddress")}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </label>
    </>
  );
}
