import { useState } from "react";
import { FolderInputIcon } from "lucide-react";
import Button from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OrdersBulkActionType = "包裹編號" | "收款狀態" | "商品狀態";
export type OrdersBulkPaymentStatus = "未收款" | "已收款" | "已入帳";
export type OrdersBulkProductStatus =
  | "未購買"
  | "已購買"
  | "到虹家"
  | "集運回台"
  | "到台灣"
  | "已出貨";

type Props = {
  disabled?: boolean;
  packageNumberOptions: string[];
  onApply: (args: {
    type: OrdersBulkActionType;
    value: string | OrdersBulkPaymentStatus | OrdersBulkProductStatus;
  }) => void | Promise<void>;
};

export default function OrdersBulkActionPopover({
  disabled,
  packageNumberOptions,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [bulkActionType, setBulkActionType] =
    useState<OrdersBulkActionType>("包裹編號");
  const [bulkPackageNumber, setBulkPackageNumber] = useState("未指定");
  const [bulkPaymentStatus, setBulkPaymentStatus] =
    useState<OrdersBulkPaymentStatus>("未收款");
  const [bulkProductStatus, setBulkProductStatus] =
    useState<OrdersBulkProductStatus>("未購買");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apply = async () => {
    if (disabled) return;
    setIsSubmitting(true);
    try {
      if (bulkActionType === "包裹編號") {
        await onApply({ type: bulkActionType, value: bulkPackageNumber });
      } else if (bulkActionType === "收款狀態") {
        await onApply({ type: bulkActionType, value: bulkPaymentStatus });
      } else {
        await onApply({ type: bulkActionType, value: bulkProductStatus });
      }
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="批次操作"
            title="批次操作"
            disabled={disabled}
          >
            <FolderInputIcon className="h-4 w-4" />
          </Button>
        }
      />
      <PopoverContent className="w-72 space-y-1" align="start">
        <div className="space-y-2">
          <p className="text-sm font-medium">修改欄位</p>
          <Select
            value={bulkActionType}
            onValueChange={(value) => {
              if (value === "包裹編號" || value === "收款狀態" || value === "商品狀態") {
                setBulkActionType(value);
              }
            }}
          >
            <SelectTrigger aria-label="批次操作類型">
              <SelectValue placeholder="批次操作類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="包裹編號">包裹編號</SelectItem>
              <SelectItem value="收款狀態">收款狀態</SelectItem>
              <SelectItem value="商品狀態">商品狀態</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">設定值</p>

          {bulkActionType === "包裹編號" ? (
            <Select
              value={bulkPackageNumber}
              onValueChange={(value) => value && setBulkPackageNumber(value)}
            >
              <SelectTrigger aria-label="批次設定包裹編號">
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
          ) : bulkActionType === "收款狀態" ? (
            <Select
              value={bulkPaymentStatus}
              onValueChange={(value) => {
                if (value === "未收款" || value === "已收款" || value === "已入帳") {
                  setBulkPaymentStatus(value);
                }
              }}
            >
              <SelectTrigger aria-label="批次設定收款狀態">
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
          ) : (
            <Select
              value={bulkProductStatus}
              onValueChange={(value) => {
                if (
                  value === "未購買" ||
                  value === "已購買" ||
                  value === "到虹家" ||
                  value === "集運回台" ||
                  value === "到台灣" ||
                  value === "已出貨"
                ) {
                  setBulkProductStatus(value);
                }
              }}
            >
              <SelectTrigger aria-label="批次設定商品狀態">
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

          <Button
            type="button"
            className="w-full"
            onClick={() => void apply()}
            disabled={disabled || isSubmitting}
          >
            {isSubmitting ? "套用中…" : "套用到已選訂單"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

