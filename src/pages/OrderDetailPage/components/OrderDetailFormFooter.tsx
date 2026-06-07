import { XIcon } from "lucide-react";
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
  saveError: string | null;
  onDismissSaveError: () => void;
  fieldLock: OrderDetailFieldLock;
  isSaving: boolean;
};

export default function OrderDetailFormFooter({
  saveError,
  onDismissSaveError,
  fieldLock,
  isSaving,
}: OrderDetailFormFooterProps) {
  const {
    formState: { isDirty, dirtyFields },
  } = useFormContext<OrderDetailFormValues>();
  const canSaveWhenShippedLocked =
    isDirty && hasOnlyShippedEditableChanges(dirtyFields);

  return (
    <>
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
            onClick={onDismissSaveError}
            aria-label="關閉錯誤訊息"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
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
    </>
  );
}
