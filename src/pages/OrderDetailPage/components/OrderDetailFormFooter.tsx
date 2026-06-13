import { useFormContext } from "react-hook-form";
import Button from "@/components/ui/button";
import type { OrderDetailFormValues } from "@/lib/orders";

import type { OrderDetailFieldLock } from "../constants";

function hasOnlyShippedEditableChanges(
  dirtyFields: Partial<
    Record<keyof OrderDetailFormValues, boolean | Record<string, unknown>>
  >,
): boolean {
  const keys = Object.keys(dirtyFields) as (keyof OrderDetailFormValues)[];
  if (keys.length === 0) {
    return false;
  }
  return keys.every((key) => key === "cost" || key === "revenue");
}

type OrderDetailFormFooterProps = {
  fieldLock: OrderDetailFieldLock;
  isSaving: boolean;
};

export default function OrderDetailFormFooter({
  fieldLock,
  isSaving,
}: OrderDetailFormFooterProps) {
  const {
    formState: { isDirty, dirtyFields },
  } = useFormContext<OrderDetailFormValues>();
  const canSaveWhenShippedLocked =
    isDirty && hasOnlyShippedEditableChanges(dirtyFields);

  return (
    <div className="md:col-span-2 mt-2 flex justify-end border-t pt-4">
      <Button
        type="submit"
        disabled={
          !isDirty ||
          fieldLock.formDisabled ||
          isSaving ||
          (fieldLock.isShippedLocked && !canSaveWhenShippedLocked)
        }
      >
        {isSaving ? "更新中…" : "更新"}
      </Button>
    </div>
  );
}
