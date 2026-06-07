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
import {
  REQUIRED_MSG,
  paymentStatusTextClass,
  type OrderDetailFieldLock,
} from "../constants";

type OrderDetailStatusSectionProps = {
  fieldLock: OrderDetailFieldLock;
  onValidationMessage: (message: string) => void;
};

export default function OrderDetailStatusSection({
  fieldLock,
  onValidationMessage,
}: OrderDetailStatusSectionProps) {
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<OrderDetailFormValues>();

  return (
    <>
      <div className="md:col-span-2 mt-2">
        <p className="text-xs font-semibold text-muted-foreground">訂單狀態</p>
      </div>

      <FormField label="收款狀態" error={errors.paymentStatus?.message}>
        <Controller
          control={control}
          name="paymentStatus"
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
      </FormField>

      <FormField label="商品狀態" error={errors.productStatus?.message}>
        <Controller
          control={control}
          name="productStatus"
          rules={{ required: REQUIRED_MSG }}
          render={({ field }) => (
            <Select
              disabled={fieldLock.fieldsDisabled}
              value={field.value}
              onValueChange={(value) => {
                if (fieldLock.isShippedLocked) {
                  onValidationMessage("商品狀態已出貨後不可再修改");
                  return;
                }
                if (
                  value === "已出貨" &&
                  getValues("paymentStatus") !== "已入帳"
                ) {
                  onValidationMessage(
                    "收款狀態尚未入帳，不能將商品狀態改為已出貨",
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
    </>
  );
}
