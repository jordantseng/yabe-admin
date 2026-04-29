import { startTransition, useCallback, useEffect, useState } from "react";
import {
  ArrowUpDownIcon,
  EyeIcon,
  FilterIcon,
  FolderInputIcon,
  Trash2Icon,
} from "lucide-react";
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
  fetchOrders,
  orderRecordToTableRow,
  type OrdersTableRow as OrderRow,
} from "@/lib/orders";

const PACKAGE_OPTIONS_STORAGE_KEY = "package-number-options";

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
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [searchItem, setSearchItem] = useState("");
  /** Last item substring sent to the server (updated on Enter in the search field). */
  const [appliedItemSearch, setAppliedItemSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrders = useCallback(async () => {
    startTransition(() => {
      setOrdersError(null);
      setOrdersLoading(true);
      setCurrentPage(1);
    });
    const { data, error } = await fetchOrders({
      itemSearch: appliedItemSearch || undefined,
    });
    startTransition(() => {
      setOrdersLoading(false);
      if (error) {
        setOrdersError(error.message);
        return;
      }
      setOrders((data ?? []).map(orderRecordToTableRow));
    });
  }, [appliedItemSearch]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

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
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("全部");
  const [filterProductStatus, setFilterProductStatus] = useState("全部");
  const [filterPackageNumber, setFilterPackageNumber] = useState("全部");
  const [draftFilterPaymentStatus, setDraftFilterPaymentStatus] =
    useState("全部");
  const [draftFilterProductStatus, setDraftFilterProductStatus] =
    useState("全部");
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState("全部");
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">(
    "desc"
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isMoveToPopoverOpen, setIsMoveToPopoverOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [bulkPackageNumber, setBulkPackageNumber] = useState("未指定");
  const pageSize = 5;
  const [newOrder, setNewOrder] = useState<Omit<OrderRow, "id">>({
    item: "",
    purchaseDate: "2026-04-29",
    buyer: "",
    payer: "虹",
    cost: "0",
    price: "0",
    revenue: "0",
    paymentStatus: "未收款",
    productStatus: "未購買",
    packageNumber: "未指定",
  });

  const updateOrder = <K extends keyof OrderRow>(
    orderId: string,
    field: K,
    value: OrderRow[K]
  ) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      )
    );
  };
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
  const handlePackageNumberChange = (orderId: string, value: string | null) => {
    if (value) {
      updateOrder(orderId, "packageNumber", value);
    }
  };
  const handleFilterPaymentStatusChange = (value: string | null) => {
    if (value) {
      setDraftFilterPaymentStatus(value);
    }
  };
  const handleFilterProductStatusChange = (value: string | null) => {
    if (value) {
      setDraftFilterProductStatus(value);
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
      setDraftFilterPaymentStatus(filterPaymentStatus);
      setDraftFilterProductStatus(filterProductStatus);
      setDraftFilterPackageNumber(filterPackageNumber);
    }
  };
  const applyFilters = () => {
    setFilterPaymentStatus(draftFilterPaymentStatus);
    setFilterProductStatus(draftFilterProductStatus);
    setFilterPackageNumber(draftFilterPackageNumber);
    setCurrentPage(1);
    setIsFilterPopoverOpen(false);
  };
  const handleDeleteOrder = (orderId: string) => {
    setOrders((currentOrders) =>
      currentOrders.filter((order) => order.id !== orderId)
    );
  };
  const openDeleteDialog = (orderId: string) => {
    setOrderToDeleteId(orderId);
    setIsDeleteDialogOpen(true);
  };
  const confirmDeleteOrder = () => {
    if (!orderToDeleteId) return;
    handleDeleteOrder(orderToDeleteId);
    setOrderToDeleteId(null);
    setIsDeleteDialogOpen(false);
  };
  const handleCreateOrder = () => {
    const item = newOrder.item.trim();
    const buyer = newOrder.buyer.trim();
    if (!item || !buyer) {
      return;
    }

    const nextId = crypto.randomUUID();

    const costNumber = Number.parseFloat(newOrder.cost);
    const priceNumber = Number.parseFloat(newOrder.price);
    const calculatedRevenue =
      (Number.isNaN(priceNumber) ? 0 : priceNumber) -
      (Number.isNaN(costNumber) ? 0 : costNumber);

    setOrders((currentOrders) => [
      ...currentOrders,
      {
        ...newOrder,
        revenue: String(calculatedRevenue),
        id: nextId,
      },
    ]);
    setNewOrder({
      item: "",
      purchaseDate: "2026-04-29",
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
  };

  const filteredOrders = orders.filter((order) => {
    const matchedItem = order.item
      .toLowerCase()
      .includes(searchItem.toLowerCase());
    const matchedPaymentStatus =
      filterPaymentStatus === "全部" ||
      order.paymentStatus === filterPaymentStatus;
    const matchedProductStatus =
      filterProductStatus === "全部" ||
      order.productStatus === filterProductStatus;
    const matchedPackageNumber =
      filterPackageNumber === "全部" ||
      order.packageNumber === filterPackageNumber;

    return (
      matchedItem &&
      matchedPaymentStatus &&
      matchedProductStatus &&
      matchedPackageNumber
    );
  });
  const sortedFilteredOrders = [...filteredOrders].sort((a, b) => {
    const timeA = new Date(a.purchaseDate).getTime();
    const timeB = new Date(b.purchaseDate).getTime();
    return dateSortDirection === "asc" ? timeA - timeB : timeB - timeA;
  });
  const totalProfit = filteredOrders.reduce((sum, order) => {
    const revenue = Number.parseFloat(order.revenue);
    return Number.isNaN(revenue) ? sum : sum + revenue;
  }, 0);
  const totalCost = filteredOrders.reduce((sum, order) => {
    const cost = Number.parseFloat(order.cost);
    return Number.isNaN(cost) ? sum : sum + cost;
  }, 0);
  const totalPages = Math.max(
    1,
    Math.ceil(sortedFilteredOrders.length / pageSize)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedOrders = sortedFilteredOrders.slice(
    startIndex,
    startIndex + pageSize
  );
  const paginatedOrderIds = paginatedOrders.map((order) => order.id);
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
  const applyBulkPackageNumber = () => {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        selectedOrderIds.includes(order.id)
          ? { ...order, packageNumber: bulkPackageNumber }
          : order
      )
    );
    setSelectedOrderIds([]);
    setIsMoveToPopoverOpen(false);
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      {ordersLoading && (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          載入訂單中…
        </p>
      )}
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
            onClick={() => void loadOrders()}
          >
            重試
          </Button>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2">
        <p>訂單管理</p>
        <div className="flex items-center gap-2">
          <Dialog
            open={isCreateOrderDialogOpen}
            onOpenChange={setIsCreateOrderDialogOpen}
          >
            <DialogTrigger render={<Button type="button">建立新訂單</Button>} />
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>建立新訂單</DialogTitle>
                <DialogDescription>請填寫訂單資訊。</DialogDescription>
              </DialogHeader>
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
                  onClick={handleCreateOrder}
                  disabled={!newOrder.item.trim() || !newOrder.buyer.trim()}
                >
                  建立訂單
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
          value={searchItem}
          onChange={(event) => setSearchItem(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setAppliedItemSearch(searchItem.trim());
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
        {appliedItemSearch !== "" && (
          <button
            type="button"
            onClick={() => {
              setSearchItem("");
              setAppliedItemSearch("");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            品項: {appliedItemSearch}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {filterPaymentStatus !== "全部" && (
          <button
            type="button"
            onClick={() => setFilterPaymentStatus("全部")}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            收款狀態: {filterPaymentStatus}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {filterProductStatus !== "全部" && (
          <button
            type="button"
            onClick={() => setFilterProductStatus("全部")}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            商品狀態: {filterProductStatus}
            <span aria-hidden="true">×</span>
          </button>
        )}
        {filterPackageNumber !== "全部" && (
          <button
            type="button"
            onClick={() => setFilterPackageNumber("全部")}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            包裹編號: {filterPackageNumber}
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      <div className="my-4 overflow-x-auto">
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
                />
              </TableHead>
              <TableHead>訂單編號</TableHead>
              <TableHead>品項</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() =>
                    setDateSortDirection((current) =>
                      current === "asc" ? "desc" : "asc"
                    )
                  }
                  className="inline-flex items-center gap-1 font-medium"
                >
                  購買日期
                  <ArrowUpDownIcon className="h-3.5 w-3.5" />
                  <span className="text-xs text-muted-foreground">
                    {dateSortDirection === "asc" ? "舊→新" : "新→舊"}
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
            {paginatedOrders.map((order) => (
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
                        updateOrder(order.id, "payer", value);
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
                        updateOrder(order.id, "paymentStatus", value);
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
                        updateOrder(order.id, "productStatus", value);
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除這筆訂單嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderToDeleteId(null)}
                >
                  取消
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteOrder}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <p>
            總成本（依目前篩選）:{" "}
            <span className="font-semibold">{totalCost.toLocaleString()}</span>
          </p>
          <p>
            總收益（依目前篩選）:{" "}
            <span className="font-semibold">
              {totalProfit.toLocaleString()}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage === 1}
          >
            上一頁
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {safeCurrentPage} / {totalPages} 頁
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
            }
            disabled={safeCurrentPage === totalPages}
          >
            下一頁
          </Button>
        </div>
      </div>
    </main>
  );
}

export default OrdersPage;
