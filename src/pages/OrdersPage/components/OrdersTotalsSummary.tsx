import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "@/components/ui/snackbar";
import Skeleton from "@/components/ui/skeleton";
import { fetchOrdersTotals } from "@/lib/orders";
import { type OrdersListUrlState } from "@/lib/orders-list-url";
import { unwrapResultOrThrow } from "@/lib/result-utils";
import { ordersKeys } from "@/lib/queryKeys";

type OrdersTotalsSummaryProps = {
  listUrl: OrdersListUrlState;
};

export default function OrdersTotalsSummary({ listUrl }: OrdersTotalsSummaryProps) {
  const { showSnackbar } = useSnackbar();
  const lastTotalsLoadErrorRef = useRef<string | null>(null);
  const totalsQuery = useQuery({
    queryKey: ordersKeys.totalsForList(listUrl),
    queryFn: async () => {
      const res = unwrapResultOrThrow(
        await fetchOrdersTotals({
          itemSearch: listUrl.q || undefined,
          paymentStatus: listUrl.payment,
          productStatus: listUrl.product,
          packageNumber: listUrl.pkg,
        }),
      );
      return { totalCost: res.totalCost, totalProfit: res.totalProfit };
    },
    placeholderData: (previousData) => previousData,
  });

  const totalsError = (totalsQuery.error as Error | null)?.message ?? null;

  useEffect(() => {
    if (!totalsError) {
      lastTotalsLoadErrorRef.current = null;
      return;
    }
    if (lastTotalsLoadErrorRef.current === totalsError) {
      return;
    }
    lastTotalsLoadErrorRef.current = totalsError;
    showSnackbar(`無法載入總成本/總收益：${totalsError}`, {
      variant: "error",
      duration: 8000,
      action: {
        label: "重試",
        onClick: () => {
          lastTotalsLoadErrorRef.current = null;
          void totalsQuery.refetch();
        },
      },
    });
  }, [totalsError, showSnackbar, totalsQuery.refetch]);

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
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        總成本/總收益暫無法顯示
      </div>
    );
  }

  const totalCost = totalsQuery.data?.totalCost ?? 0;
  const totalProfit = totalsQuery.data?.totalProfit ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <p>
        總成本:{" "}
        <span className="font-semibold">{totalCost.toLocaleString()}</span>
      </p>
      <p>
        總收益:{" "}
        <span className="font-semibold">{totalProfit.toLocaleString()}</span>
      </p>
    </div>
  );
}
