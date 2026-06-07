import { type OrdersListUrlState } from "@/lib/orders-list-url";

type Props = {
  listUrl: OrdersListUrlState;
  onPatch: (patch: Partial<OrdersListUrlState>) => void;
};

export default function OrdersActiveFiltersChips({ listUrl, onPatch }: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {listUrl.q !== "" && (
        <button
          type="button"
          onClick={() => onPatch({ q: "", page: 1 })}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
        >
          搜尋: {listUrl.q}
          <span aria-hidden="true">×</span>
        </button>
      )}
      {listUrl.payment !== "全部" && (
        <button
          type="button"
          onClick={() => onPatch({ payment: "全部", page: 1 })}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
        >
          收款狀態: {listUrl.payment}
          <span aria-hidden="true">×</span>
        </button>
      )}
      {listUrl.product !== "全部" && (
        <button
          type="button"
          onClick={() => onPatch({ product: "全部", page: 1 })}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
        >
          商品狀態: {listUrl.product}
          <span aria-hidden="true">×</span>
        </button>
      )}
      {listUrl.pkg !== "全部" && (
        <button
          type="button"
          onClick={() => onPatch({ pkg: "全部", page: 1 })}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
        >
          包裹編號: {listUrl.pkg}
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

