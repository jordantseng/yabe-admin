import { useCallback, useEffect, useRef, useState } from "react";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowUpDownIcon,
  EyeIcon,
  FilterIcon,
  FolderInputIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useQueryStates } from "nuqs";
import { Link } from "react-router-dom";
import { CreateOrderDialog } from "@/components/orders/CreateOrderDialog";
import OrdersTotalsSummary from "@/components/orders/OrdersTotalsSummary";
import { DeleteOrderDialog } from "@/components/orders/DeleteOrderDialog";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteOrderById,
  fetchOrders,
  fetchOrdersTotals,
  orderRecordToTableRow,
  updateOrderFields,
  type OrderListFieldsPatch,
  type OrdersTableRow,
} from "@/lib/orders";
import {
  ordersListSearchParams,
  type OrdersListUrlState,
} from "@/lib/orders-list-url";
import { fetchPackageNumbersFromDb } from "@/lib/packages";

const ORDERS_PAGE_SIZE = 12;
const ORDERS_QUERY_KEY = ["orders", "list"] as const;
const ORDERS_TOTALS_QUERY_KEY = ["orders", "totals"] as const;
const PACKAGE_NUMBERS_QUERY_KEY = ["packages", "numbers"] as const;

type OrdersListQueryData = { rows: OrdersTableRow[]; count: number };

function applyOrderRowPatch(
  row: OrdersTableRow,
  patch: OrderListFieldsPatch
): OrdersTableRow {
  const next = { ...row };
  if (patch.payer !== undefined) next.payer = patch.payer;
  if (patch.paymentStatus !== undefined) {
    next.paymentStatus = patch.paymentStatus;
  }
  if (patch.productStatus !== undefined) {
    next.productStatus = patch.productStatus;
  }
  if (patch.packageNumber !== undefined) {
    next.packageNumber = patch.packageNumber.trim();
  }
  return next;
}

/** 若 patch 內每個有帶的欄位與列上值相同，則不需打 API */
function patchHasNoEffectiveChange(
  row: OrdersTableRow,
  patch: OrderListFieldsPatch
): boolean {
  if (patch.payer !== undefined && patch.payer !== row.payer) return false;
  if (
    patch.paymentStatus !== undefined &&
    patch.paymentStatus !== row.paymentStatus
  ) {
    return false;
  }
  if (
    patch.productStatus !== undefined &&
    patch.productStatus !== row.productStatus
  ) {
    return false;
  }
  if (patch.packageNumber !== undefined) {
    if (patch.packageNumber.trim() !== row.packageNumber) return false;
  }
  return true;
}

/** 以 API 結果覆寫目前列表／合計快取，不觸發 invalidate（避免整表 skeleton） */
async function syncOrdersListViewCache(
  queryClient: QueryClient,
  listUrl: OrdersListUrlState
) {
  const listRes = await fetchOrders({
    itemSearch: listUrl.q || undefined,
    paymentStatus: listUrl.payment,
    productStatus: listUrl.product,
    packageNumber: listUrl.pkg,
    sortPurchaseDate: listUrl.sort,
    page: listUrl.page,
    pageSize: ORDERS_PAGE_SIZE,
  });
  if (!listRes.error) {
    queryClient.setQueryData<OrdersListQueryData>([...ORDERS_QUERY_KEY, listUrl], {
      rows: (listRes.data ?? []).map(orderRecordToTableRow),
      count: listRes.count,
    });
  }
  const totalsRes = await fetchOrdersTotals({
    itemSearch: listUrl.q || undefined,
    paymentStatus: listUrl.payment,
    productStatus: listUrl.product,
    packageNumber: listUrl.pkg,
  });
  if (!totalsRes.error) {
    queryClient.setQueryData(
      [
        ...ORDERS_TOTALS_QUERY_KEY,
        listUrl.q,
        listUrl.payment,
        listUrl.product,
        listUrl.pkg,
      ],
      { totalCost: totalsRes.totalCost, totalProfit: totalsRes.totalProfit }
    );
  }
}

async function runBulkOrderFieldUpdates(
  queryClient: QueryClient,
  listUrl: OrdersListUrlState,
  updatableIds: string[],
  optimisticPatch: OrderListFieldsPatch,
  mutateOne: (id: string) => Promise<{ error: { message: string } | null }>
): Promise<{ ok: true } | { ok: false; message: string }> {
  await queryClient.cancelQueries({ queryKey: ORDERS_QUERY_KEY });
  const previousEntries = queryClient.getQueriesData<OrdersListQueryData>({
    queryKey: ORDERS_QUERY_KEY,
  });
  const idSet = new Set(updatableIds);
  queryClient.setQueriesData<OrdersListQueryData>(
    { queryKey: ORDERS_QUERY_KEY },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        rows: old.rows.map((row) =>
          idSet.has(row.id) ? applyOrderRowPatch(row, optimisticPatch) : row
        ),
      };
    }
  );
  const results = await Promise.all(updatableIds.map((id) => mutateOne(id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    for (const [key, data] of previousEntries) {
      queryClient.setQueryData(key, data);
    }
    return { ok: false, message: failed.error.message };
  }
  await syncOrdersListViewCache(queryClient, listUrl);
  return { ok: true };
}

function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

function OrdersPage() {
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [listUrl, setListUrl] = useQueryStates(ordersListSearchParams, {
    history: "push",
  });
  const listUrlRef = useRef(listUrl);
  useEffect(() => {
    listUrlRef.current = listUrl;
  }, [listUrl]);
  const [draftFilterPaymentStatus, setDraftFilterPaymentStatus] =
    useState<OrdersListUrlState["payment"]>("全部");
  const [draftFilterProductStatus, setDraftFilterProductStatus] =
    useState<OrdersListUrlState["product"]>("全部");
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState<string>("全部");
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [listFieldError, setListFieldError] = useState<string | null>(null);
  const [deleteOrderError, setDeleteOrderError] = useState<string | null>(null);
  const [dismissedOrdersError, setDismissedOrdersError] = useState<
    string | null
  >(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isMoveToPopoverOpen, setIsMoveToPopoverOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<
    "包裹編號" | "收款狀態" | "商品狀態"
  >("包裹編號");
  const [bulkPackageNumber, setBulkPackageNumber] = useState("未指定");
  const [bulkPaymentStatus, setBulkPaymentStatus] = useState<
    "未收款" | "已收款" | "已入帳"
  >("未收款");
  const [bulkProductStatus, setBulkProductStatus] = useState<
    "未購買" | "已購買" | "到虹家" | "集運回台" | "到台灣" | "已出貨"
  >("未購買");
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const ordersQuery = useQuery({
    queryKey: [...ORDERS_QUERY_KEY, listUrl],
    queryFn: async () => {
      const res = await fetchOrders({
        itemSearch: listUrl.q || undefined,
        paymentStatus: listUrl.payment,
        productStatus: listUrl.product,
        packageNumber: listUrl.pkg,
        sortPurchaseDate: listUrl.sort,
        page: listUrl.page,
        pageSize: ORDERS_PAGE_SIZE,
      });
      if (res.error) {
        throw new Error(res.error.message);
      }
      return {
        rows: (res.data ?? []).map(orderRecordToTableRow),
        count: res.count,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  // Totals are fetched/rendered by `OrdersTotalsSummary`.

  const packageNumbersQuery = useQuery({
    queryKey: PACKAGE_NUMBERS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetchPackageNumbersFromDb();
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.data ?? [];
    },
  });

  const invalidateOrdersData = () => {
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ORDERS_TOTALS_QUERY_KEY });
  };
  const patchListUrl = useCallback(
    (patch: Partial<OrdersListUrlState>, opts?: { replace?: boolean }) => {
      void setListUrl(patch, {
        history: opts?.replace === true ? "replace" : "push",
      });
    },
    [setListUrl]
  );

  const persistFieldMutation = useMutation({
    mutationFn: async ({
      orderId,
      patch,
    }: {
      orderId: string;
      patch: Parameters<typeof updateOrderFields>[1];
    }) => {
      const { error } = await updateOrderFields(orderId, patch);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ orderId, patch }) => {
      await queryClient.cancelQueries({ queryKey: ORDERS_QUERY_KEY });
      const previousEntries = queryClient.getQueriesData<OrdersListQueryData>({
        queryKey: ORDERS_QUERY_KEY,
      });
      queryClient.setQueriesData<OrdersListQueryData>(
        { queryKey: ORDERS_QUERY_KEY },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.map((row) =>
              row.id === orderId ? applyOrderRowPatch(row, patch) : row
            ),
          };
        }
      );
      return { previousEntries };
    },
    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      setListFieldError(error.message);
    },
    onSuccess: async () => {
      await syncOrdersListViewCache(queryClient, listUrlRef.current);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await deleteOrderById(orderId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateOrdersData();
    },
    onError: (error) => {
      setDeleteOrderError(error.message);
    },
  });

  const persistListPatch = async (
    orderId: string,
    patch: Parameters<typeof updateOrderFields>[1]
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (order && patchHasNoEffectiveChange(order, patch)) {
      return;
    }
    setListFieldError(null);
    await persistFieldMutation.mutateAsync({ orderId, patch });
  };

  const handlePackageNumberChange = (
    orderId: string,
    value: string | null,
    isLocked: boolean
  ) => {
    if (isLocked) return;
    if (value) {
      void persistListPatch(orderId, { packageNumber: value });
    }
  };
  const openDeleteDialog = (orderId: string) => {
    setDeleteOrderError(null);
    setOrderToDeleteId(orderId);
    setIsDeleteDialogOpen(true);
  };
  const handleFilterPopoverOpenChange = (open: boolean) => {
    setIsFilterPopoverOpen(open);
    if (open) {
      setDraftFilterPaymentStatus(listUrl.payment);
      setDraftFilterProductStatus(listUrl.product);
      setDraftFilterPackageNumber(listUrl.pkg);
    }
  };
  const applyFilters = () => {
    patchListUrl({
      payment: draftFilterPaymentStatus,
      product: draftFilterProductStatus,
      pkg: draftFilterPackageNumber,
      page: 1,
    });
    setIsFilterPopoverOpen(false);
  };
  const applySearch = () => {
    patchListUrl({
      q: (searchInputRef.current?.value ?? "").trim(),
      page: 1,
    });
  };
  const confirmDeleteOrder = async () => {
    if (!orderToDeleteId) return;
    setDeleteOrderError(null);
    try {
      await deleteOrderMutation.mutateAsync(orderToDeleteId);
    } catch (error) {
      setDeleteOrderError((error as Error).message);
      return;
    }
    setOrderToDeleteId(null);
    setIsDeleteDialogOpen(false);
  };

  const orders = ordersQuery.data?.rows ?? [];
  const packageNumberOptions = packageNumbersQuery.data ?? [];
  const totalRowCount = ordersQuery.data?.count ?? 0;
  /** 換頁、篩選、搜尋或資料重抓時顯示 skeleton（含 isLoading 的首次載入） */
  const ordersLoading = ordersQuery.isFetching || ordersQuery.isLoading;
  const ordersError = (ordersQuery.error as Error | null)?.message ?? null;

  const totalPages = Math.max(1, Math.ceil(totalRowCount / ORDERS_PAGE_SIZE));
  const safeCurrentPage = Math.min(listUrl.page, totalPages);
  useEffect(() => {
    if (ordersQuery.isFetching || ordersQuery.isLoading || !ordersQuery.data) {
      return;
    }
    if (safeCurrentPage !== listUrl.page) {
      patchListUrl({ page: safeCurrentPage }, { replace: true });
    }
  }, [
    ordersQuery.isFetching,
    ordersQuery.isLoading,
    ordersQuery.data,
    listUrl.page,
    patchListUrl,
    safeCurrentPage,
  ]);

  const filterPackageSelectValues = [
    "全部",
    ...packageNumberOptions.toReversed(),
  ];
  const paginatedOrderIds = orders.map((order) => order.id);
  const isAllCurrentPageSelected =
    paginatedOrderIds.length > 0 &&
    paginatedOrderIds.every((orderId) => selectedOrderIds.includes(orderId));
  const isSomeCurrentPageSelected =
    paginatedOrderIds.some((orderId) => selectedOrderIds.includes(orderId)) &&
    !isAllCurrentPageSelected;

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    setSelectedOrderIds((currentSelected) => {
      if (checked) {
        const merged = new Set([...currentSelected, ...paginatedOrderIds]);
        return Array.from(merged);
      }

      return currentSelected.filter((id) => !paginatedOrderIds.includes(id));
    });
  };
  const toggleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((currentSelected) => {
      if (checked) {
        if (currentSelected.includes(orderId)) return currentSelected;
        return [...currentSelected, orderId];
      }

      return currentSelected.filter((id) => id !== orderId);
    });
  };
  const applyBulkPackageNumber = async () => {
    const ids = selectedOrderIds;
    if (ids.length === 0) {
      return;
    }
    setListFieldError(null);
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const lockedIds = ids.filter(
      (id) => orderById.get(id)?.productStatus === "已出貨"
    );
    const eligibleIds = ids.filter((id) => !lockedIds.includes(id));
    if (eligibleIds.length === 0) {
      setListFieldError("已出貨訂單不能透過批次指定包裹編號");
      return;
    }
    const trimmedPkg = bulkPackageNumber.trim();
    const needUpdateIds = eligibleIds.filter((id) => {
      const row = orderById.get(id);
      return row != null && row.packageNumber !== trimmedPkg;
    });
    if (needUpdateIds.length === 0) {
      setListFieldError(null);
      setSelectedOrderIds(lockedIds);
      setIsMoveToPopoverOpen(false);
      return;
    }
    const bulkResult = await runBulkOrderFieldUpdates(
      queryClient,
      listUrlRef.current,
      needUpdateIds,
      { packageNumber: bulkPackageNumber },
      (id) => updateOrderFields(id, { packageNumber: bulkPackageNumber })
    );
    if (bulkResult.ok === false) {
      setListFieldError(bulkResult.message);
      return;
    }
    if (lockedIds.length > 0) {
      setListFieldError("部分已出貨訂單未變更包裹編號（已自動略過）");
    }
    setSelectedOrderIds(lockedIds);
    setIsMoveToPopoverOpen(false);
  };
  const applyBulkPaymentStatus = async () => {
    const ids = selectedOrderIds;
    if (ids.length === 0) {
      return;
    }
    setListFieldError(null);
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const lockedIds = ids.filter(
      (id) => orderById.get(id)?.productStatus === "已出貨"
    );
    const eligibleIds = ids.filter((id) => !lockedIds.includes(id));
    if (eligibleIds.length === 0) {
      setListFieldError("已出貨訂單不能透過批次修改收款狀態");
      return;
    }
    const needUpdateIds = eligibleIds.filter((id) => {
      const row = orderById.get(id);
      return row != null && row.paymentStatus !== bulkPaymentStatus;
    });
    if (needUpdateIds.length === 0) {
      setListFieldError(null);
      setSelectedOrderIds(lockedIds);
      setIsMoveToPopoverOpen(false);
      return;
    }
    const bulkResult = await runBulkOrderFieldUpdates(
      queryClient,
      listUrlRef.current,
      needUpdateIds,
      { paymentStatus: bulkPaymentStatus },
      (id) => updateOrderFields(id, { paymentStatus: bulkPaymentStatus })
    );
    if (bulkResult.ok === false) {
      setListFieldError(bulkResult.message);
      return;
    }
    if (lockedIds.length > 0) {
      setListFieldError("部分已出貨訂單未變更收款狀態（已自動略過）");
    }
    setSelectedOrderIds(lockedIds);
    setIsMoveToPopoverOpen(false);
  };
  const applyBulkProductStatus = async () => {
    const ids = selectedOrderIds;
    if (ids.length === 0) {
      return;
    }
    setListFieldError(null);
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const lockedIds = ids.filter(
      (id) => orderById.get(id)?.productStatus === "已出貨"
    );
    const paymentBlockedIds = ids.filter(
      (id) =>
        bulkProductStatus === "已出貨" &&
        orderById.get(id)?.paymentStatus !== "已入帳"
    );
    const updatableIds = ids.filter(
      (id) => !lockedIds.includes(id) && !paymentBlockedIds.includes(id)
    );
    if (updatableIds.length === 0) {
      if (bulkProductStatus === "已出貨" && paymentBlockedIds.length > 0) {
        setListFieldError("收款狀態尚未入帳，不能批次改為已出貨");
      } else {
        setListFieldError("已出貨訂單不能透過批次修改商品狀態");
      }
      return;
    }
    const needUpdateIds = updatableIds.filter((id) => {
      const row = orderById.get(id);
      return row != null && row.productStatus !== bulkProductStatus;
    });
    if (needUpdateIds.length === 0) {
      if (lockedIds.length > 0 || paymentBlockedIds.length > 0) {
        setListFieldError(
          "部分訂單未變更商品狀態（已出貨或收款未入帳時不可改為已出貨）"
        );
      } else {
        setListFieldError(null);
      }
      const skippedIds = Array.from(
        new Set([...lockedIds, ...paymentBlockedIds])
      );
      setSelectedOrderIds(skippedIds);
      setIsMoveToPopoverOpen(false);
      return;
    }
    const bulkResult = await runBulkOrderFieldUpdates(
      queryClient,
      listUrlRef.current,
      needUpdateIds,
      { productStatus: bulkProductStatus },
      (id) => updateOrderFields(id, { productStatus: bulkProductStatus })
    );
    if (bulkResult.ok === false) {
      setListFieldError(bulkResult.message);
      return;
    }
    if (lockedIds.length > 0 || paymentBlockedIds.length > 0) {
      setListFieldError(
        "部分訂單未變更商品狀態（已出貨或收款未入帳時不可改為已出貨）"
      );
    }
    const skippedIds = Array.from(
      new Set([...lockedIds, ...paymentBlockedIds])
    );
    setSelectedOrderIds(skippedIds);
    setIsMoveToPopoverOpen(false);
  };
  const applySelectedBulkAction = async () => {
    if (bulkActionType === "包裹編號") {
      await applyBulkPackageNumber();
      return;
    }
    if (bulkActionType === "收款狀態") {
      await applyBulkPaymentStatus();
      return;
    }
    await applyBulkProductStatus();
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      {ordersError && dismissedOrdersError !== ordersError && (
        <div
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">無法載入訂單</p>
              <p className="mt-1 text-destructive/90">{ordersError}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive"
              onClick={() => setDismissedOrdersError(ordersError)}
              aria-label="關閉錯誤訊息"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => invalidateOrdersData()}
          >
            重試
          </Button>
        </div>
      )}
      {listFieldError && (
        <div
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">更新失敗</p>
              <p className="mt-1 text-destructive/90">{listFieldError}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive"
              onClick={() => setListFieldError(null)}
              aria-label="關閉錯誤訊息"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">訂單管理</h1>
        <div className="flex items-center gap-2">
          <CreateOrderDialog
            open={isCreateOrderDialogOpen}
            onOpenChange={(open) => {
              setIsCreateOrderDialogOpen(open);
            }}
          />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            ref={searchInputRef}
            key={listUrl.q}
            defaultValue={listUrl.q}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applySearch();
              }
            }}
            placeholder="搜尋品項"
            aria-label="搜尋品項，按 Enter 查詢"
            className="w-full max-w-sm"
          />
          <Button type="button" variant="outline" onClick={applySearch}>
            搜尋
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Popover
            open={isFilterPopoverOpen}
            onOpenChange={handleFilterPopoverOpenChange}
          >
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="篩選"
                >
                  <FilterIcon className="h-4 w-4" />
                </Button>
              }
            />
            <PopoverContent className="w-72 p-3" align="end">
              <p className="px-1 text-xs font-medium text-muted-foreground">
                篩選條件
              </p>
              <div className="my-2 h-px bg-border" />
              <div className="mt-2 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">收款狀態</p>
                  <Select
                    value={draftFilterPaymentStatus}
                    onValueChange={(value) =>
                      setDraftFilterPaymentStatus(
                        value as OrdersListUrlState["payment"]
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label="篩選收款狀態"
                      className={paymentStatusTextClass(
                        draftFilterPaymentStatus
                      )}
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
                      setDraftFilterProductStatus(
                        value as OrdersListUrlState["product"]
                      )
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
                      if (value) {
                        setDraftFilterPackageNumber(value);
                      }
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
                <Button type="button" className="w-full" onClick={applyFilters}>
                  套用
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {selectedOrderIds.length > 0 && (
            <Popover
              open={isMoveToPopoverOpen}
              onOpenChange={setIsMoveToPopoverOpen}
            >
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="批次操作"
                    title="批次操作"
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
                      if (
                        value === "包裹編號" ||
                        value === "收款狀態" ||
                        value === "商品狀態"
                      ) {
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
                      onValueChange={(value) =>
                        value && setBulkPackageNumber(value)
                      }
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
                        if (
                          value === "未收款" ||
                          value === "已收款" ||
                          value === "已入帳"
                        ) {
                          setBulkPaymentStatus(value);
                        }
                      }}
                    >
                      <SelectTrigger
                        aria-label="批次設定收款狀態"
                        className={paymentStatusTextClass(bulkPaymentStatus)}
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
                    onClick={() => void applySelectedBulkAction()}
                  >
                    套用到已選訂單
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {listUrl.q !== "" && (
          <button
            type="button"
            onClick={() => patchListUrl({ q: "", page: 1 })}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            品項: {listUrl.q}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {listUrl.payment !== "全部" && (
          <button
            type="button"
            onClick={() => patchListUrl({ payment: "全部", page: 1 })}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            收款狀態: {listUrl.payment}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {listUrl.product !== "全部" && (
          <button
            type="button"
            onClick={() => patchListUrl({ product: "全部", page: 1 })}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            商品狀態: {listUrl.product}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {listUrl.pkg !== "全部" && (
          <button
            type="button"
            onClick={() => patchListUrl({ pkg: "全部", page: 1 })}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            包裹編號: {listUrl.pkg}
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      <div
        className="my-4 overflow-x-auto"
        aria-busy={ordersLoading}
        aria-label={ordersLoading ? "載入訂單列表中" : undefined}
      >
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeCurrentPageSelected;
                  }}
                  onChange={(event) =>
                    toggleSelectAllCurrentPage(event.target.checked)
                  }
                  aria-label="全選目前頁面訂單"
                  disabled={ordersLoading}
                />
              </TableHead>
              <TableHead>品項</TableHead>
              <TableHead>數量</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() =>
                    patchListUrl({
                      page: 1,
                      sort: listUrl.sort === "asc" ? "desc" : "asc",
                    })
                  }
                  className="inline-flex items-center gap-1 font-medium"
                  disabled={ordersLoading}
                >
                  購買日期
                  <ArrowUpDownIcon className="h-3.5 w-3.5" />
                  <span className="text-xs text-muted-foreground">
                    {listUrl.sort === "asc" ? "舊→新" : "新→舊"}
                  </span>
                </button>
              </TableHead>
              <TableHead>購買人</TableHead>
              <TableHead>付款人</TableHead>
              <TableHead>售價</TableHead>
              <TableHead>成本</TableHead>
              <TableHead>收益</TableHead>
              <TableHead>運費</TableHead>
              <TableHead>收款狀態</TableHead>
              <TableHead>商品狀態</TableHead>
              <TableHead>包裹編號</TableHead>
              <TableHead>備註</TableHead>
              <TableHead>詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersLoading &&
              Array.from({ length: ORDERS_PAGE_SIZE }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!ordersLoading &&
              orders.map((order) => {
                const isLocked = order.productStatus === "已出貨";
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={(event) =>
                          toggleSelectOrder(order.id, event.target.checked)
                        }
                        aria-label={`選擇訂單 ${order.id}`}
                      />
                    </TableCell>
                    <TableCell>{order.item}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{order.purchaseDate}</TableCell>
                    <TableCell>{order.buyer}</TableCell>
                    <TableCell>
                      <Select
                        disabled={isLocked}
                        value={order.payer}
                        onValueChange={(value) => {
                          if (isLocked) return;
                          if (value === "虹" || value === "藍") {
                            void persistListPatch(order.id, { payer: value });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-24" aria-label="付款人">
                          <SelectValue placeholder="付款人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="虹">虹</SelectItem>
                          <SelectItem value="藍">藍</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{order.price}</TableCell>
                    <TableCell>{order.cost}</TableCell>
                    <TableCell>{order.revenue}</TableCell>
                    <TableCell>{order.domesticShippingFee}</TableCell>
                    <TableCell>
                      <Select
                        disabled={isLocked}
                        value={order.paymentStatus}
                        onValueChange={(value) => {
                          if (isLocked) return;
                          if (
                            value === "未收款" ||
                            value === "已收款" ||
                            value === "已入帳"
                          ) {
                            void persistListPatch(order.id, {
                              paymentStatus: value,
                            });
                          }
                        }}
                      >
                        <SelectTrigger
                          className={`h-8 w-28 ${paymentStatusTextClass(
                            order.paymentStatus
                          )}`}
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
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={order.productStatus === "已出貨"}
                        value={order.productStatus}
                        onValueChange={(value) => {
                          if (order.productStatus === "已出貨") {
                            setListFieldError("商品狀態已出貨後不可再修改");
                            return;
                          }
                          if (
                            value === "已出貨" &&
                            order.paymentStatus !== "已入帳"
                          ) {
                            setListFieldError(
                              "收款狀態尚未入帳，不能將商品狀態改為已出貨"
                            );
                            return;
                          }
                          if (
                            value === "未購買" ||
                            value === "已購買" ||
                            value === "到虹家" ||
                            value === "集運回台" ||
                            value === "到台灣" ||
                            value === "已出貨"
                          ) {
                            void persistListPatch(order.id, {
                              productStatus: value,
                            });
                          }
                        }}
                      >
                        <SelectTrigger
                          className="h-8 w-32"
                          aria-label="商品狀態"
                        >
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
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={isLocked}
                        value={order.packageNumber}
                        onValueChange={(value) =>
                          handlePackageNumberChange(order.id, value, isLocked)
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-32"
                          aria-label="包裹編號"
                        >
                          <SelectValue placeholder="包裹編號" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="未指定">未指定</SelectItem>
                          {packageNumberOptions.map((packageNumber) => (
                            <SelectItem
                              key={packageNumber}
                              value={packageNumber}
                            >
                              {packageNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell
                      className="max-w-52 truncate"
                      title={order.notes}
                    >
                      {order.notes}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Link
                        to={`/orders/${order.id}`}
                        aria-label="查看訂單詳細"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label="刪除訂單"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(order.id)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <DeleteOrderDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteOrderError(null);
            setOrderToDeleteId(null);
          }
        }}
        error={deleteOrderError}
        isSubmitting={deleteOrderMutation.isPending}
        onConfirm={() => confirmDeleteOrder()}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <OrdersTotalsSummary listUrl={listUrl} />
        <Pagination
          loading={ordersLoading}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={(page) => patchListUrl({ page })}
        />
      </div>
    </main>
  );
}

export default OrdersPage;
