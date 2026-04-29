import { startTransition, useCallback, useEffect, useState } from "react";
import {
  ArrowUpDownIcon,
  EyeIcon,
  FilterIcon,
  FolderInputIcon,
  Trash2Icon,
} from "lucide-react";
import { useQueryStates } from "nuqs";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  type OrdersTableRow as OrderRow,
} from "@/lib/orders";
import {
  ordersListSearchParams,
  type OrdersListUrlState,
} from "@/lib/orders-list-url";

const PACKAGE_OPTIONS_STORAGE_KEY = "package-number-options";
const ORDERS_PAGE_SIZE = 5;

function OrdersPage() {
  const [isCreatePackageDialogOpen, setIsCreatePackageDialogOpen] =
    useState(false);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [newPackageNumber, setNewPackageNumber] = useState("");
  const [packageNumberOptions, setPackageNumberOptions] = useState(() => {
    if (typeof window === "undefined") {
      return ["PKG-001", "PKG-002", "PKG-003"];
    }

    const savedOptions = window.localStorage.getItem(
      PACKAGE_OPTIONS_STORAGE_KEY
    );
    if (!savedOptions) {
      return ["PKG-001", "PKG-002", "PKG-003"];
    }

    try {
      const parsed = JSON.parse(savedOptions);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((item) => typeof item === "string")
      ) {
        return parsed;
      }
    } catch {
      // Ignore malformed localStorage value and fallback to default.
    }

    return ["PKG-001", "PKG-002", "PKG-003"];
  });
  const [listUrl, setListUrl] = useQueryStates(ordersListSearchParams, {
    history: "push",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [draftFilterPaymentStatus, setDraftFilterPaymentStatus] =
    useState<OrdersListUrlState["payment"]>("全部");
  const [draftFilterProductStatus, setDraftFilterProductStatus] =
    useState<OrdersListUrlState["product"]>("全部");
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState<string>("全部");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [aggregateTotalCost, setAggregateTotalCost] = useState(0);
  const [aggregateTotalProfit, setAggregateTotalProfit] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [listFieldError, setListFieldError] = useState<string | null>(null);
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);
  const [isCreateOrderSubmitting, setIsCreateOrderSubmitting] = useState(false);
  const [deleteOrderError, setDeleteOrderError] = useState<string | null>(null);
  const [isDeleteOrderSubmitting, setIsDeleteOrderSubmitting] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isMoveToPopoverOpen, setIsMoveToPopoverOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [bulkPackageNumber, setBulkPackageNumber] = useState("未指定");
  const [newOrder, setNewOrder] = useState<Omit<OrderRow, "id">>({
    item: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    buyer: "",
    payer: "虹",
    cost: "0",
    price: "0",
    revenue: "0",
    paymentStatus: "未收款",
    productStatus: "未購買",
    packageNumber: "未指定",
  });

  const patchListUrl = useCallback(
    (patch: Partial<OrdersListUrlState>, opts?: { replace?: boolean }) => {
      void setListUrl(patch, {
        history: opts?.replace === true ? "replace" : "push",
      });
    },
    [setListUrl]
  );

  const reloadOrdersList = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { q, payment, product, pkg, sort, page } = listUrl;

  useEffect(() => {
    let cancelled = false;
    const state = { q, payment, product, pkg, sort, page };

    startTransition(() => {
      setOrdersError(null);
      setOrdersLoading(true);
    });

    const listQueryFilter = {
      itemSearch: state.q || undefined,
      paymentStatus: state.payment,
      productStatus: state.product,
      packageNumber: state.pkg,
    };

    void (async () => {
      const [ordersRes, totalsRes] = await Promise.all([
        fetchOrders({
          ...listQueryFilter,
          sortPurchaseDate: state.sort,
          page: state.page,
          pageSize: ORDERS_PAGE_SIZE,
        }),
        fetchOrdersTotals(listQueryFilter),
      ]);

      if (cancelled) {
        return;
      }

      startTransition(() => {
        setOrdersLoading(false);
        if (ordersRes.error) {
          setOrdersError(ordersRes.error.message);
          return;
        }
        if (totalsRes.error) {
          setOrdersError(totalsRes.error.message);
          return;
        }
        setOrders((ordersRes.data ?? []).map(orderRecordToTableRow));
        setTotalRowCount(ordersRes.count);
        setAggregateTotalCost(totalsRes.totalCost);
        setAggregateTotalProfit(totalsRes.totalProfit);
        const totalPages = Math.max(
          1,
          Math.ceil(ordersRes.count / ORDERS_PAGE_SIZE)
        );
        const nextPage = Math.min(state.page, totalPages);
        if (nextPage !== state.page) {
          void setListUrl({ page: nextPage }, { history: "replace" });
        }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [q, payment, product, pkg, sort, page, refreshKey, setListUrl]);

  useEffect(() => {
    const extras = orders
      .map((o) => o.packageNumber)
      .filter((p) => p && p !== "未指定");
    if (extras.length === 0) {
      return;
    }
    startTransition(() => {
      setPackageNumberOptions((prev) => {
        const merged = Array.from(new Set([...prev, ...extras]));
        if (
          merged.length === prev.length &&
          merged.every((v, i) => v === prev[i])
        ) {
          return prev;
        }
        window.localStorage.setItem(
          PACKAGE_OPTIONS_STORAGE_KEY,
          JSON.stringify(merged)
        );
        return merged;
      });
    });
  }, [orders]);

  const handleCreatePackageNumber = () => {
    const trimmedPackageNumber = newPackageNumber.trim();
    if (!trimmedPackageNumber) {
      return;
    }

    setPackageNumberOptions((currentOptions) => {
      if (currentOptions.includes(trimmedPackageNumber)) {
        return currentOptions;
      }

      const nextOptions = [...currentOptions, trimmedPackageNumber];
      window.localStorage.setItem(
        PACKAGE_OPTIONS_STORAGE_KEY,
        JSON.stringify(nextOptions)
      );

      return nextOptions;
    });
    setNewPackageNumber("");
    setIsCreatePackageDialogOpen(false);
  };

  const persistListPatch = async (
    orderId: string,
    patch: Parameters<typeof updateOrderFields>[1]
  ) => {
    setListFieldError(null);
    const { error } = await updateOrderFields(orderId, patch);
    if (error) {
      setListFieldError(error.message);
      return;
    }
    reloadOrdersList();
  };

  const handlePackageNumberChange = (orderId: string, value: string | null) => {
    if (value) {
      void persistListPatch(orderId, { packageNumber: value });
    }
  };
  const handleFilterPaymentStatusChange = (value: string | null) => {
    if (value) {
      setDraftFilterPaymentStatus(value as OrdersListUrlState["payment"]);
    }
  };
  const handleFilterProductStatusChange = (value: string | null) => {
    if (value) {
      setDraftFilterProductStatus(value as OrdersListUrlState["product"]);
    }
  };
  const handleFilterPackageNumberChange = (value: string | null) => {
    if (value) {
      setDraftFilterPackageNumber(value);
    }
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
  const openDeleteDialog = (orderId: string) => {
    setDeleteOrderError(null);
    setOrderToDeleteId(orderId);
    setIsDeleteDialogOpen(true);
  };
  const confirmDeleteOrder = async () => {
    if (!orderToDeleteId) return;
    setDeleteOrderError(null);
    setIsDeleteOrderSubmitting(true);
    const { error } = await deleteOrderById(orderToDeleteId);
    setIsDeleteOrderSubmitting(false);
    if (error) {
      setDeleteOrderError(error.message);
      return;
    }
    setOrderToDeleteId(null);
    setIsDeleteDialogOpen(false);
    reloadOrdersList();
  };

  const handleCreateOrder = async () => {
    const item = newOrder.item.trim();
    const buyer = newOrder.buyer.trim();
    if (!item || !buyer) {
      return;
    }

    const costNumber = Number.parseFloat(newOrder.cost);
    const priceNumber = Number.parseFloat(newOrder.price);

    setCreateOrderError(null);
    setIsCreateOrderSubmitting(true);
    const { error } = await createOrder({
      item,
      purchaseDate: newOrder.purchaseDate,
      buyer,
      payer: newOrder.payer,
      cost: Number.isNaN(costNumber) ? 0 : costNumber,
      price: Number.isNaN(priceNumber) ? 0 : priceNumber,
      paymentStatus: newOrder.paymentStatus,
      productStatus: newOrder.productStatus,
      packageNumber: newOrder.packageNumber,
    });
    setIsCreateOrderSubmitting(false);
    if (error) {
      setCreateOrderError(error.message);
      return;
    }

    setNewOrder({
      item: "",
      purchaseDate: new Date().toISOString().slice(0, 10),
      buyer: "",
      payer: "虹",
      cost: "0",
      price: "0",
      revenue: "0",
      paymentStatus: "未收款",
      productStatus: "未購買",
      packageNumber: "未指定",
    });
    setIsCreateOrderDialogOpen(false);
    patchListUrl({ page: 1 });
    reloadOrdersList();
  };

  const totalPages = Math.max(1, Math.ceil(totalRowCount / ORDERS_PAGE_SIZE));
  const safeCurrentPage = Math.min(listUrl.page, totalPages);
  const paginatedOrders = orders;
  const paginatedOrderIds = paginatedOrders.map((order) => order.id);
  const totalCost = aggregateTotalCost;
  const totalProfit = aggregateTotalProfit;
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
      ids.map((id) => updateOrderFields(id, { packageNumber: bulkPackageNumber }))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setListFieldError(failed.error.message);
      return;
    }
    setSelectedOrderIds([]);
    setIsMoveToPopoverOpen(false);
    reloadOrdersList();
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
            onClick={() => reloadOrdersList()}
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
        <p>訂單管理</p>
        <div className="flex items-center gap-2">
          <Dialog
            open={isCreateOrderDialogOpen}
            onOpenChange={(open) => {
              setIsCreateOrderDialogOpen(open);
              if (!open) {
                setCreateOrderError(null);
              }
            }}
          >
            <DialogTrigger render={<Button type="button">建立新訂單</Button>} />
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>建立新訂單</DialogTitle>
                <DialogDescription>請填寫訂單資訊。</DialogDescription>
              </DialogHeader>
              {createOrderError && (
                <p className="text-sm text-destructive" role="alert">
                  {createOrderError}
                </p>
              )}
              <div className="grid gap-3 py-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-item"
                    className="text-sm font-medium"
                  >
                    品項
                  </label>
                  <Input
                    id="new-order-item"
                    value={newOrder.item}
                    onChange={(event) =>
                      setNewOrder((current) => ({
                        ...current,
                        item: event.target.value,
                      }))
                    }
                    placeholder="品項"
                    aria-label="品項"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-purchase-date"
                    className="text-sm font-medium"
                  >
                    購買日期
                  </label>
                  <Input
                    id="new-order-purchase-date"
                    type="date"
                    value={newOrder.purchaseDate}
                    onChange={(event) =>
                      setNewOrder((current) => ({
                        ...current,
                        purchaseDate: event.target.value,
                      }))
                    }
                    aria-label="購買日期"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-buyer"
                    className="text-sm font-medium"
                  >
                    購買人
                  </label>
                  <Input
                    id="new-order-buyer"
                    value={newOrder.buyer}
                    onChange={(event) =>
                      setNewOrder((current) => ({
                        ...current,
                        buyer: event.target.value,
                      }))
                    }
                    placeholder="購買人"
                    aria-label="購買人"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">付款人</label>
                  <Select
                    value={newOrder.payer}
                    onValueChange={(value) => {
                      if (value === "虹" || value === "藍") {
                        setNewOrder((current) => ({
                          ...current,
                          payer: value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger aria-label="付款人">
                      <SelectValue placeholder="付款人" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="虹">虹</SelectItem>
                      <SelectItem value="藍">藍</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-cost"
                    className="text-sm font-medium"
                  >
                    成本
                  </label>
                  <Input
                    id="new-order-cost"
                    type="number"
                    value={newOrder.cost}
                    onChange={(event) =>
                      setNewOrder((current) => ({
                        ...current,
                        cost: event.target.value,
                      }))
                    }
                    placeholder="成本"
                    aria-label="成本"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="new-order-price"
                    className="text-sm font-medium"
                  >
                    售價
                  </label>
                  <Input
                    id="new-order-price"
                    type="number"
                    value={newOrder.price}
                    onChange={(event) =>
                      setNewOrder((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                    placeholder="售價"
                    aria-label="售價"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">收款狀態</label>
                  <Select
                    value={newOrder.paymentStatus}
                    onValueChange={(value) => {
                      if (
                        value === "未收款" ||
                        value === "已收款" ||
                        value === "已入帳"
                      ) {
                        setNewOrder((current) => ({
                          ...current,
                          paymentStatus: value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger aria-label="收款狀態">
                      <SelectValue placeholder="收款狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未收款">未收款</SelectItem>
                      <SelectItem value="已收款">已收款</SelectItem>
                      <SelectItem value="已入帳">已入帳</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">商品狀態</label>
                  <Select
                    value={newOrder.productStatus}
                    onValueChange={(value) => {
                      if (
                        value === "未購買" ||
                        value === "已購賣" ||
                        value === "到虹家" ||
                        value === "集運回台" ||
                        value === "到台灣" ||
                        value === "已出貨"
                      ) {
                        setNewOrder((current) => ({
                          ...current,
                          productStatus: value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger aria-label="商品狀態">
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
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">包裹編號</label>
                  <Select
                    value={newOrder.packageNumber}
                    onValueChange={(value) => {
                      if (value) {
                        setNewOrder((current) => ({
                          ...current,
                          packageNumber: value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger aria-label="包裹編號">
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
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">取消</Button>} />
                <Button
                  type="button"
                  onClick={() => void handleCreateOrder()}
                  disabled={
                    !newOrder.item.trim() ||
                    !newOrder.buyer.trim() ||
                    isCreateOrderSubmitting
                  }
                >
                  {isCreateOrderSubmitting ? "建立中…" : "建立訂單"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isCreatePackageDialogOpen}
            onOpenChange={setIsCreatePackageDialogOpen}
          >
            <DialogTrigger
              render={<Button type="button">建立包裹編號</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>建立包裹編號</DialogTitle>
                <DialogDescription>請輸入新的包裹編號。</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Input
                  value={newPackageNumber}
                  onChange={(event) => setNewPackageNumber(event.target.value)}
                  placeholder="例如：PKG-002"
                  aria-label="新的包裹編號"
                />
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">取消</Button>} />
                <Button
                  type="button"
                  onClick={handleCreatePackageNumber}
                  disabled={!newPackageNumber.trim()}
                >
                  建立
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Input
          key={listUrl.q}
          defaultValue={listUrl.q}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              patchListUrl({
                q: event.currentTarget.value.trim(),
                page: 1,
              });
            }
          }}
          placeholder="搜尋品項（按 Enter）"
          aria-label="搜尋品項，按 Enter 查詢"
          className="max-w-sm"
        />

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
                  onValueChange={handleFilterPaymentStatusChange}
                >
                  <SelectTrigger aria-label="篩選收款狀態">
                    <SelectValue placeholder="收款狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部收款狀態</SelectItem>
                    <SelectItem value="未收款">未收款</SelectItem>
                    <SelectItem value="已收款">已收款</SelectItem>
                    <SelectItem value="已入帳">已入帳</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">商品狀態</p>
                <Select
                  value={draftFilterProductStatus}
                  onValueChange={handleFilterProductStatusChange}
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
                  onValueChange={handleFilterPackageNumberChange}
                >
                  <SelectTrigger aria-label="篩選包裹編號">
                    <SelectValue placeholder="包裹編號" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部包裹編號</SelectItem>
                    <SelectItem value="未指定">未指定</SelectItem>
                    {packageNumberOptions.map((packageNumber) => (
                      <SelectItem key={packageNumber} value={packageNumber}>
                        {packageNumber}
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

      <div className="mb-4 flex flex-wrap gap-2">
        {listUrl.q !== "" && (
          <button
            type="button"
            onClick={() => {
              patchListUrl({ q: "", page: 1 });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            品項: {listUrl.q}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {listUrl.payment !== "全部" && (
          <button
            type="button"
            onClick={() => {
              patchListUrl({ payment: "全部", page: 1 });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            收款狀態: {listUrl.payment}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {listUrl.product !== "全部" && (
          <button
            type="button"
            onClick={() => {
              patchListUrl({ product: "全部", page: 1 });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            商品狀態: {listUrl.product}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {listUrl.pkg !== "全部" && (
          <button
            type="button"
            onClick={() => {
              patchListUrl({ pkg: "全部", page: 1 });
            }}
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
              <TableHead>訂單編號</TableHead>
              <TableHead>品項</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => {
                    patchListUrl({
                      page: 1,
                      sort: listUrl.sort === "asc" ? "desc" : "asc",
                    });
                  }}
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
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
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
              paginatedOrders.map((order) => (
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
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.item}</TableCell>
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
                    <SelectTrigger className="h-8 w-28" aria-label="收款狀態">
                      <SelectValue placeholder="收款狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未收款">未收款</SelectItem>
                      <SelectItem value="已收款">已收款</SelectItem>
                      <SelectItem value="已入帳">已入帳</SelectItem>
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

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteOrderError(null);
            setOrderToDeleteId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除這筆訂單嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          {deleteOrderError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteOrderError}
            </p>
          )}
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderToDeleteId(null)}
                  disabled={isDeleteOrderSubmitting}
                >
                  取消
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteOrder()}
              disabled={isDeleteOrderSubmitting}
            >
              {isDeleteOrderSubmitting ? "刪除中…" : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {ordersLoading ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">總成本（依目前篩選）:</span>
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">總收益（依目前篩選）:</span>
                <Skeleton className="h-5 w-24" />
              </div>
            </>
          ) : (
            <>
              <p>
                總成本（依目前篩選）:{" "}
                <span className="font-semibold">
                  {totalCost.toLocaleString()}
                </span>
              </p>
              <p>
                總收益（依目前篩選）:{" "}
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
              patchListUrl({
                page: Math.min(totalPages, safeCurrentPage + 1),
              })
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
