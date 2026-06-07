import { Controller, useFormContext } from "react-hook-form";
import FormField from "@/components/FormField";
import type { OrderDetailFormValues } from "@/lib/orders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatOrderPayerDisplay } from "@/lib/order-payer-display";
import { ORDER_PAYERS } from "@/types/database";
import { REQUIRED_MSG, type OrderDetailFieldLock } from "../constants";

type OrderDetailOrderInfoSectionProps = {
  fieldLock: OrderDetailFieldLock;
  packageNumberOptions: string[];
};

export default function OrderDetailOrderInfoSection({
  fieldLock,
  packageNumberOptions,
}: OrderDetailOrderInfoSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<OrderDetailFormValues>();

  return (
    <>
      <div className="md:col-span-2">
        <p className="text-xs font-semibold text-muted-foreground">訂單資訊</p>
      </div>
      <FormField label="品項" requiredMark error={errors.item?.message}>
        <input
          disabled={fieldLock.fieldsDisabled}
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
          disabled={fieldLock.fieldsDisabled}
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
          disabled={fieldLock.fieldsDisabled}
          {...register("purchaseDate", { required: REQUIRED_MSG })}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </FormField>

      <FormField label="購買人" requiredMark error={errors.buyer?.message}>
        <input
          disabled={fieldLock.fieldsDisabled}
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
              disabled={fieldLock.fieldsDisabled}
              value={field.value}
              onValueChange={(value) => {
                if (fieldLock.isShippedLocked) return;
                if (value) field.onChange(value);
              }}
            >
              <SelectTrigger className="w-full" aria-label="付款人">
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

      <FormField label="包裹編號" error={errors.packageNumber?.message}>
        <Controller
          control={control}
          name="packageNumber"
          rules={{ required: REQUIRED_MSG }}
          render={({ field }) => (
            <Select
              disabled={fieldLock.fieldsDisabled}
              value={field.value}
              onValueChange={(value) => {
                if (fieldLock.isShippedLocked) return;
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
          disabled={fieldLock.fieldsDisabled}
          {...register("notes")}
          rows={4}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:bg-muted"
        />
      </label>
    </>
  );
}
