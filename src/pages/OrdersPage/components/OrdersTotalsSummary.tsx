import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrdersTotals } from "@/lib/orders";
import { type OrdersListUrlState } from "@/lib/orders-list-url";

const ORDERS_TOTALS_QUERY_KEY = ["orders", "totals"] as const;

export function OrdersTotalsSummary({ listUrl }: { listUrl: OrdersListUrlState }) {
  const totalsQuery = useQuery({
    queryKey: [
      ...ORDERS_TOTALS_QUERY_KEY,
      listUrl.q,
      listUrl.payment,
      listUrl.product,
      listUrl.pkg,
    ],
    queryFn: async () => {
      const res = await fetchOrdersTotals({
        itemSearch: listUrl.q || undefined,
        paymentStatus: listUrl.payment,
        productStatus: listUrl.product,
        packageNumber: listUrl.pkg,
      });
      if (res.error) {
        throw new Error(res.error.message);
      }
      return { totalCost: res.totalCost, totalProfit: res.totalProfit };
    },
    placeholderData: (previousData) => previousData,
  });

  const loading = totalsQuery.isFetching || totalsQuery.isLoading;
  if (loading) {
    return (
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">總成本:</span>
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">總收益:</span>
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    );
  }

  if (totalsQuery.error) {
    return (
      <div className="flex flex-wrap items-center gap-4 text-sm text-destructive">
        無法載入總成本/總收益
      </div>
    );
  }

  const totalCost = totalsQuery.data?.totalCost ?? 0;
  const totalProfit = totalsQuery.data?.totalProfit ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <p>
        總成本: <span className="font-semibold">{totalCost.toLocaleString()}</span>
      </p>
      <p>
        總收益:{" "}
        <span className="font-semibold">{totalProfit.toLocaleString()}</span>
      </p>
    </div>
  );
}

