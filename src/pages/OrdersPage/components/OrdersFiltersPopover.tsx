import { useMemo, useState } from "react";
import { FilterIcon } from "lucide-react";
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
import { type OrdersListUrlState } from "@/lib/orders-list-url";

type Props = {
  listUrl: OrdersListUrlState;
  packageNumberOptions: string[];
  onApply: (
    patch: Pick<OrdersListUrlState, "payment" | "product" | "pkg" | "page">
  ) => void;
};

export default function OrdersFiltersPopover({
  listUrl,
  packageNumberOptions,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftFilterPaymentStatus, setDraftFilterPaymentStatus] = useState<
    OrdersListUrlState["payment"]
  >(listUrl.payment);
  const [draftFilterProductStatus, setDraftFilterProductStatus] = useState<
    OrdersListUrlState["product"]
  >(listUrl.product);
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] = useState<string>(
    listUrl.pkg
  );

  const filterPackageSelectValues = useMemo(
    () => ["全部", ...packageNumberOptions.toReversed()],
    [packageNumberOptions]
  );

  const paymentStatusTextClass = (status: string): string => {
    if (status === "未收款") return "text-red-500";
    if (status === "已收款") return "text-amber-500";
    if (status === "已入帳") return "text-green-500";
    return "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraftFilterPaymentStatus(listUrl.payment);
      setDraftFilterProductStatus(listUrl.product);
      setDraftFilterPackageNumber(listUrl.pkg);
    }
  };

  const apply = () => {
    onApply({
      payment: draftFilterPaymentStatus,
      product: draftFilterProductStatus,
      pkg: draftFilterPackageNumber,
      page: 1,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="icon" aria-label="篩選">
            <FilterIcon className="h-4 w-4" />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-3" align="end">
        <p className="px-1 text-xs font-medium text-muted-foreground">篩選條件</p>
        <div className="my-2 h-px bg-border" />
        <div className="mt-2 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">收款狀態</p>
            <Select
              value={draftFilterPaymentStatus}
              onValueChange={(value) =>
                setDraftFilterPaymentStatus(value as OrdersListUrlState["payment"])
              }
            >
              <SelectTrigger
                aria-label="篩選收款狀態"
                className={paymentStatusTextClass(draftFilterPaymentStatus)}
              >
                <SelectValue placeholder="收款狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部收款狀態</SelectItem>
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
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">商品狀態</p>
            <Select
              value={draftFilterProductStatus}
              onValueChange={(value) =>
                setDraftFilterProductStatus(value as OrdersListUrlState["product"])
              }
            >
              <SelectTrigger aria-label="篩選商品狀態">
                <SelectValue placeholder="商品狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部商品狀態</SelectItem>
                <SelectItem value="未購買">未購買</SelectItem>
                <SelectItem value="已購買">已購買</SelectItem>
                <SelectItem value="到虹家">到虹家</SelectItem>
                <SelectItem value="集運回台">集運回台</SelectItem>
                <SelectItem value="到台灣">到台灣</SelectItem>
                <SelectItem value="已出貨">已出貨</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">包裹編號</p>
            <Select
              value={draftFilterPackageNumber}
              onValueChange={(value) => {
                if (value) setDraftFilterPackageNumber(value);
              }}
            >
              <SelectTrigger aria-label="篩選包裹編號">
                <SelectValue placeholder="包裹編號" />
              </SelectTrigger>
              <SelectContent>
                {filterPackageSelectValues.map((pkg) => (
                  <SelectItem key={pkg} value={pkg}>
                    {pkg === "全部" ? "全部包裹編號" : pkg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" className="w-full" onClick={apply}>
            套用
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

