import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDownIcon,
  EyeIcon,
  FilterIcon,
  FolderInputIcon,
  Trash2Icon,
} from "lucide-react";
import { useQueryStates } from "nuqs";
import { Link } from "react-router-dom";
import {
  CreateOrderDialog,
  type NewOrderDraft,
} from "@/components/orders/CreateOrderDialog";
import { DeleteOrderDialog } from "@/components/orders/DeleteOrderDialog";
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
  createOrder,
  deleteOrderById,
  fetchOrders,
  fetchOrdersTotals,
  orderRecordToTableRow,
  updateOrderFields,
} from "@/lib/orders";
import {
  ordersListSearchParams,
  type OrdersListUrlState,
} from "@/lib/orders-list-url";
import { fetchPackageNumbersFromDb } from "@/lib/packages";

const ORDERS_PAGE_SIZE = 15;
const ORDERS_QUERY_KEY = ["orders", "list"] as const;
const ORDERS_TOTALS_QUERY_KEY = ["orders", "totals"] as const;
const PACKAGE_NUMBERS_QUERY_KEY = ["packages", "numbers"] as const;

function paymentStatusTextClass(status: string): string {
  if (status === "未收款") return "text-red-500";
  if (status === "已收款") return "text-amber-500";
  if (status === "已入帳") return "text-green-500";
  return "";
}

function createEmptyNewOrderDraft(): NewOrderDraft {
  return {
    item: "",
    notes: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    buyer: "",
    domesticDeliveryAddress: "",
    payer: "虹",
    cost: "0",
    price: "0",
    domesticShippingFee: "0",
    revenue: "0",
    paymentStatus: "未收款",
    productStatus: "未購買",
    packageNumber: "未指定",
  };
}

function OrdersPage() {
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [listUrl, setListUrl] = useQueryStates(ordersListSearchParams, {
    history: "push",
  });
  const [draftFilterPaymentStatus, setDraftFilterPaymentStatus] =
    useState<OrdersListUrlState["payment"]>("全部");
  const [draftFilterProductStatus, setDraftFilterProductStatus] =
    useState<OrdersListUrlState["product"]>("全部");
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState<string>("全部");
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [listFieldError, setListFieldError] = useState<string | null>(null);
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);
  const [deleteOrderError, setDeleteOrderError] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isMoveToPopoverOpen, setIsMoveToPopoverOpen] = useState(false);
  const [bulkPackageNumber, setBulkPackageNumber] = useState("未指定");
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [newOrder, setNewOrder] = useState<NewOrderDraft>(createEmptyNewOrderDraft);

  const ordersQuery = useQuery({
    queryKey: [ORDERS_QUERY_KEY, listUrl],
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
  });

  const totalsQuery = useQuery({
    queryKey: [
      ORDERS_TOTALS_QUERY_KEY,
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
  });

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
    void queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [ORDERS_TOTALS_QUERY_KEY] });
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
    onSuccess: () => {
      invalidateOrdersData();
    },
    onError: (error) => {
      setListFieldError(error.message);
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      invalidateOrdersData();
    },
    onError: (error) => {
      setCreateOrderError(error.message);
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
    setListFieldError(null);
    await persistFieldMutation.mutateAsync({ orderId, patch });
  };

  const handlePackageNumberChange = (orderId: string, value: string | null) => {
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

  const handleCreateOrder = async () => {
    const item = newOrder.item.trim();
    const buyer = newOrder.buyer.trim();
    if (!item || !buyer) {
      return;
    }

    const costNumber = Number.parseFloat(newOrder.cost);
    const priceNumber = Number.parseFloat(newOrder.price);
    const domesticShippingFeeNumber = Number.parseFloat(
      newOrder.domesticShippingFee
    );

    setCreateOrderError(null);
    const createResult = await createOrderMutation.mutateAsync({
      item,
      notes: newOrder.notes,
      purchaseDate: newOrder.purchaseDate,
      buyer,
      domesticDeliveryAddress: newOrder.domesticDeliveryAddress,
      payer: newOrder.payer,
      cost: Number.isNaN(costNumber) ? 0 : costNumber,
      price: Number.isNaN(priceNumber) ? 0 : priceNumber,
      domesticShippingFee: Number.isNaN(domesticShippingFeeNumber)
        ? 0
        : domesticShippingFeeNumber,
      paymentStatus: newOrder.paymentStatus,
      productStatus: newOrder.productStatus,
      packageNumber: newOrder.packageNumber,
    });
    if (createResult.error) {
      setCreateOrderError(createResult.error.message);
      return;
    }

    setNewOrder(createEmptyNewOrderDraft());
    setIsCreateOrderDialogOpen(false);
  };

  const orders = ordersQuery.data?.rows ?? [];
  const packageNumberOptions = packageNumbersQuery.data ?? [];
  const totalRowCount = ordersQuery.data?.count ?? 0;
  const totalCost = totalsQuery.data?.totalCost ?? 0;
  const totalProfit = totalsQuery.data?.totalProfit ?? 0;
  const ordersLoading = ordersQuery.isLoading || totalsQuery.isLoading;
  const ordersError =
    (ordersQuery.error as Error | null)?.message ??
    (totalsQuery.error as Error | null)?.message ??
    null;

  const totalPages = Math.max(1, Math.ceil(totalRowCount / ORDERS_PAGE_SIZE));
  const safeCurrentPage = Math.min(listUrl.page, totalPages);
  useEffect(() => {
    if (safeCurrentPage !== listUrl.page) {
      patchListUrl({ page: safeCurrentPage }, { replace: true });
    }
  }, [listUrl.page, patchListUrl, safeCurrentPage]);

  const filterPackageSelectValues = ["全部", ...packageNumberOptions];
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
    const results = await Promise.all(
      ids.map((id) =>
        updateOrderFields(id, { packageNumber: bulkPackageNumber })
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setListFieldError(failed.error.message);
      return;
    }
    setSelectedOrderIds([]);
    setIsMoveToPopoverOpen(false);
    invalidateOrdersData();
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      {ordersError && (
        <div
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">無法載入訂單</p>
          <p className="mt-1 text-destructive/90">{ordersError}</p>
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
          <p className="font-medium">更新失敗</p>
          <p className="mt-1 text-destructive/90">{listFieldError}</p>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">訂單管理</h1>
        <div className="flex items-center gap-2">
          <CreateOrderDialog
            open={isCreateOrderDialogOpen}
            onOpenChange={(open) => {
              setIsCreateOrderDialogOpen(open);
              if (!open) {
                setCreateOrderError(null);
                setNewOrder(createEmptyNewOrderDraft());
              }
            }}
            createOrderError={createOrderError}
            isSubmitting={createOrderMutation.isPending}
            newOrder={newOrder}
            setNewOrder={setNewOrder}
            packageNumberOptions={packageNumberOptions}
            onCreate={() => void handleCreateOrder()}
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
                      <SelectItem value="已購賣">已購賣</SelectItem>
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
                    aria-label="move to"
                    title="move to"
                  >
                    <FolderInputIcon className="h-4 w-4" />
                  </Button>
                }
              />
              <PopoverContent className="w-64 space-y-3" align="start">
                <p className="text-sm font-medium">指定包裹編號</p>
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
                <Button
                  type="button"
                  className="w-full"
                  onClick={applyBulkPackageNumber}
                >
                  套用到已選訂單
                </Button>
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
              <TableHead className="w-[96px] max-w-[96px]">訂單編號</TableHead>
              <TableHead>品項</TableHead>
              <TableHead>備註</TableHead>
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
              <TableHead>成本</TableHead>
              <TableHead>售價</TableHead>
              <TableHead>店到店運費</TableHead>
              <TableHead>收益</TableHead>
              <TableHead>收款狀態</TableHead>
              <TableHead>商品狀態</TableHead>
              <TableHead>包裹編號</TableHead>
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
                  <TableCell className="w-[96px] max-w-[96px]">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
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
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!ordersLoading &&
              orders.map((order) => (
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
                  <TableCell className="w-[96px] max-w-[96px]">
                    <div className="w-[96px] truncate" title={order.id}>
                      {order.id}
                    </div>
                  </TableCell>
                  <TableCell>{order.item}</TableCell>
                  <TableCell className="max-w-52 truncate" title={order.notes}>
                    {order.notes}
                  </TableCell>
                  <TableCell>{order.purchaseDate}</TableCell>
                  <TableCell>{order.buyer}</TableCell>
                  <TableCell>
                    <Select
                      value={order.payer}
                      onValueChange={(value) => {
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
                  <TableCell>{order.cost}</TableCell>
                  <TableCell>{order.price}</TableCell>
                  <TableCell>{order.domesticShippingFee}</TableCell>
                  <TableCell>{order.revenue}</TableCell>
                  <TableCell>
                    <Select
                      value={order.paymentStatus}
                      onValueChange={(value) => {
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
                      value={order.productStatus}
                      onValueChange={(value) => {
                        if (
                          value === "未購買" ||
                          value === "已購賣" ||
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
                      <SelectTrigger className="h-8 w-32" aria-label="商品狀態">
                        <SelectValue placeholder="商品狀態" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="未購買">未購買</SelectItem>
                        <SelectItem value="已購賣">已購賣</SelectItem>
                        <SelectItem value="到虹家">到虹家</SelectItem>
                        <SelectItem value="集運回台">集運回台</SelectItem>
                        <SelectItem value="到台灣">到台灣</SelectItem>
                        <SelectItem value="已出貨">已出貨</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.packageNumber}
                      onValueChange={(value) =>
                        handlePackageNumberChange(order.id, value)
                      }
                    >
                      <SelectTrigger className="h-8 w-32" aria-label="包裹編號">
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
              ))}
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
        orderId={orderToDeleteId}
        error={deleteOrderError}
        isSubmitting={deleteOrderMutation.isPending}
        onConfirm={() => void confirmDeleteOrder()}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {ordersLoading ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">總成本:</span>
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">總收益:</span>
                <Skeleton className="h-5 w-24" />
              </div>
            </>
          ) : (
            <>
              <p>
                總成本:{" "}
                <span className="font-semibold">
                  {totalCost.toLocaleString()}
                </span>
              </p>
              <p>
                總收益:{" "}
                <span className="font-semibold">
                  {totalProfit.toLocaleString()}
                </span>
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patchListUrl({ page: Math.max(1, safeCurrentPage - 1) })
            }
            disabled={ordersLoading || safeCurrentPage === 1}
          >
            上一頁
          </Button>
          {ordersLoading ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <span className="text-sm text-muted-foreground">
              第 {safeCurrentPage} / {totalPages} 頁
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patchListUrl({ page: Math.min(totalPages, safeCurrentPage + 1) })
            }
            disabled={ordersLoading || safeCurrentPage === totalPages}
          >
            下一頁
          </Button>
        </div>
      </div>
    </main>
  );
}

export default OrdersPage;
