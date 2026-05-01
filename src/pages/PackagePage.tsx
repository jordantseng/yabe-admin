import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  EyeIcon,
  FilterIcon,
  FolderInputIcon,
  PencilIcon,
  XIcon,
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
  createPackage,
  fetchPackageNumbersFromDb,
  peekNextPackageNumber,
  settlePackageByNumber,
  updatePackageInternationalShippingFeeByNumber,
} from "@/lib/packages";
import { packagesListSearchParams } from "@/lib/packages-list-url";
import {
  fetchOrdersForPackagePage,
  packageNumberLabelFromOrderRow,
  revenueStringFromCostPrice,
  updateOrderFields,
  type OrderWithPackageNumber,
  type PackagePageEmptyPackageStub,
} from "@/lib/orders";
import type {
  OrderPayer,
  OrderPaymentStatus,
  OrderProductStatus,
} from "@/types/database";

/** 每頁顯示 1 個包裹（排序新→舊） */
const PACKAGE_GROUPS_PER_PAGE = 1;
const PACKAGE_ROWS_QUERY_KEY = ["packages", "page-rows"] as const;
const PACKAGE_NUMBERS_QUERY_KEY = ["packages", "numbers"] as const;
const PACKAGE_NEXT_NUMBER_QUERY_KEY = ["packages", "next-number-peek"] as const;
const EMPTY_PACKAGE_ROWS: PackageTableRow[] = [];
const EMPTY_PACKAGE_NUMBERS: string[] = [];

/** 包裹列表列（由訂單 + 關聯包裹映射）。 */
export type PackageTableRow = {
  id: string;
  packageNumber: string;
  packageNotes: string;
  packageSettled: boolean;
  item: string;
  quantity: string;
  orderNotes: string;
  purchaseDate: string;
  buyer: string;
  payer: OrderPayer;
  recipientName: string;
  phone: string;
  address: string;
  cost: string;
  price: string;
  domesticShippingFee: string;
  internationalShippingFee: string;
  revenue: string;
  paymentStatus: OrderPaymentStatus;
  productStatus: OrderProductStatus;
};

function toNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

function purchaseDateSlice(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function orderToPackageTableRow(row: OrderWithPackageNumber): PackageTableRow {
  const packageRel = row.packages as {
    international_shipping_fee?: number;
    notes?: string | null;
    is_settled?: boolean;
  } | null;
  return {
    id: row.id,
    packageNumber: packageNumberLabelFromOrderRow(row),
    packageNotes: packageRel?.notes?.trim() ?? "",
    packageSettled: packageRel?.is_settled === true,
    item: row.item,
    quantity: String(row.quantity),
    orderNotes: row.notes ?? "",
    purchaseDate: purchaseDateSlice(row.purchase_date),
    buyer: row.buyer,
    payer: row.payer,
    recipientName: row.recipient_name ?? "",
    phone: row.recipient_phone ?? "",
    address: row.domestic_delivery_address ?? "",
    cost: String(row.cost),
    price: String(row.price),
    domesticShippingFee: String(row.domestic_shipping_fee),
    internationalShippingFee: String(
      packageRel?.international_shipping_fee ?? 0
    ),
    revenue: revenueStringFromCostPrice(row.cost, row.price),
    paymentStatus: row.payment_status,
    productStatus: row.product_status,
  };
}

/** 分組標題排序：數字編號遞減，其餘依字串，「未指定」置底。 */
function comparePackageGroupLabels(a: string, b: string): number {
  if (a === "未指定" && b !== "未指定") return 1;
  if (b === "未指定" && a !== "未指定") return -1;
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const aNum = Number.isFinite(na) && String(na) === a;
  const bNum = Number.isFinite(nb) && String(nb) === b;
  if (aNum && bNum) return nb - na;
  if (aNum && !bNum) return -1;
  if (!aNum && bNum) return 1;
  return a.localeCompare(b, "zh-Hant");
}

function groupPackageRows(
  list: PackageTableRow[]
): { label: string; rows: PackageTableRow[] }[] {
  const map = new Map<string, PackageTableRow[]>();
  for (const row of list) {
    const key = row.packageNumber;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  const labels = Array.from(map.keys()).sort(comparePackageGroupLabels);
  return labels.map((label) => ({ label, rows: map.get(label)! }));
}

type PackageTableGroup = {
  label: string;
  rows: PackageTableRow[];
  emptyStub?: PackagePageEmptyPackageStub;
};

function mergePackageTableGroups(
  rows: PackageTableRow[],
  emptyStubs: PackagePageEmptyPackageStub[],
): PackageTableGroup[] {
  const fromOrders = groupPackageRows(rows);
  const byLabel = new Map<string, PackageTableGroup>();
  for (const g of fromOrders) {
    byLabel.set(g.label, { label: g.label, rows: g.rows });
  }
  for (const stub of emptyStubs) {
    if (!byLabel.has(stub.number)) {
      byLabel.set(stub.number, {
        label: stub.number,
        rows: [],
        emptyStub: stub,
      });
    }
  }
  const labels = Array.from(byLabel.keys()).sort(comparePackageGroupLabels);
  return labels.map((label) => byLabel.get(label)!);
}

function PackagePage() {
  const queryClient = useQueryClient();
  const [listUrl, setListUrl] = useQueryStates(packagesListSearchParams, {
    history: "push",
  });
  const [isCreatePackageDialogOpen, setIsCreatePackageDialogOpen] =
    useState(false);
  const [newPackageNotes, setNewPackageNotes] = useState("");
  const [
    newPackageInternationalShippingFee,
    setNewPackageInternationalShippingFee,
  ] = useState("0");
  const [createPackageError, setCreatePackageError] = useState<string | null>(
    null
  );
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState<string>("全部");
  const [draftFilterProductStatus, setDraftFilterProductStatus] =
    useState<string>("全部");
  const [draftFilterPayer, setDraftFilterPayer] = useState<string>("全部");
  const [rowFieldError, setRowFieldError] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkProductPopoverOpen, setIsBulkProductPopoverOpen] =
    useState(false);
  const [bulkProductStatus, setBulkProductStatus] = useState<
    "未購買" | "已購買" | "到虹家" | "集運回台" | "到台灣" | "已出貨"
  >("未購買");
  const [isEditPackageFeeDialogOpen, setIsEditPackageFeeDialogOpen] =
    useState(false);
  const [packageToEditFee, setPackageToEditFee] = useState<string | null>(null);
  const [editPackageFeeValue, setEditPackageFeeValue] = useState("0");
  const [editPackageNotesValue, setEditPackageNotesValue] = useState("");
  const [editPackageFeeError, setEditPackageFeeError] = useState<string | null>(
    null
  );
  const [settlePackageError, setSettlePackageError] = useState<string | null>(
    null
  );
  const [dismissedRowsError, setDismissedRowsError] = useState<string | null>(
    null
  );
  const [isSettlePackageDialogOpen, setIsSettlePackageDialogOpen] =
    useState(false);
  const [packageToSettle, setPackageToSettle] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rowsQuery = useQuery({
    queryKey: [
      PACKAGE_ROWS_QUERY_KEY,
      listUrl.q,
      listUrl.pkg,
      listUrl.product,
      listUrl.payer,
      listUrl.page,
    ],
    queryFn: async () => {
      const res = await fetchOrdersForPackagePage({
        itemSearch: listUrl.q,
        packageFilter: listUrl.pkg,
        productStatus: listUrl.product,
        payer: listUrl.payer,
        page: listUrl.page,
        packagesPerPage: PACKAGE_GROUPS_PER_PAGE,
      });
      if (res.error) {
        throw new Error(res.error.message);
      }
      return {
        rows: (res.data ?? []).map(orderToPackageTableRow),
        count: res.count,
        emptyPackageStubs: res.emptyPackageStubs,
      };
    },
    placeholderData: (previousData) => previousData,
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

  const nextPackageNumberQuery = useQuery({
    queryKey: PACKAGE_NEXT_NUMBER_QUERY_KEY,
    queryFn: async () => {
      const res = await peekNextPackageNumber();
      if (res.error) {
        throw new Error(res.error.message);
      }
      if (res.data == null) {
        throw new Error("無法取得下一個包裹編號");
      }
      return res.data;
    },
    enabled: isCreatePackageDialogOpen,
  });

  const invalidatePackageRows = () => {
    void queryClient.invalidateQueries({ queryKey: [PACKAGE_ROWS_QUERY_KEY] });
  };
  const createPackageMutation = useMutation({
    mutationFn: createPackage,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: PACKAGE_NUMBERS_QUERY_KEY,
      });
      void queryClient.invalidateQueries({
        queryKey: PACKAGE_NEXT_NUMBER_QUERY_KEY,
      });
      invalidatePackageRows();
    },
  });
  const updateOrderFieldMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      patch: Parameters<typeof updateOrderFields>[1];
    }) => {
      const { error } = await updateOrderFields(args.id, args.patch);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePackageRows(),
  });
  const editPackageFeeMutation = useMutation({
    mutationFn: async (args: { pkg: string; fee: number; notes: string }) => {
      const { error } = await updatePackageInternationalShippingFeeByNumber(
        args.pkg,
        args.fee,
        args.notes,
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePackageRows(),
  });
  const settlePackageMutation = useMutation({
    mutationFn: async (pkg: string) => {
      const { error } = await settlePackageByNumber(pkg);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePackageRows(),
  });

  useEffect(() => {
    if (listUrl.pkg === "未指定") {
      void setListUrl({ pkg: "全部" });
    }
  }, [listUrl.pkg, setListUrl]);

  const totalRows = rowsQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PACKAGE_GROUPS_PER_PAGE));
  const safeCurrentPage = Math.min(listUrl.page, totalPages);

  useEffect(() => {
    if (rowsQuery.isFetching || rowsQuery.isLoading || !rowsQuery.data) {
      return;
    }
    if (safeCurrentPage !== listUrl.page) {
      void setListUrl({ page: safeCurrentPage }, { history: "replace" });
    }
  }, [
    rowsQuery.isFetching,
    rowsQuery.isLoading,
    rowsQuery.data,
    safeCurrentPage,
    listUrl.page,
    setListUrl,
  ]);

  const patchListUrl = (
    patch: Partial<{
      q: string;
      pkg: string;
      product: string;
      payer: string;
      page: number;
    }>
  ) => {
    void setListUrl(patch);
  };
  const applySearch = () => {
    patchListUrl({
      q: (searchInputRef.current?.value ?? "").trim(),
      page: 1,
    });
  };
  const rows = rowsQuery.data?.rows ?? EMPTY_PACKAGE_ROWS;
  const emptyPackageStubs = rowsQuery.data?.emptyPackageStubs ?? [];
  const packageNumberOptions =
    packageNumbersQuery.data ?? EMPTY_PACKAGE_NUMBERS;
  const rowsLoading = rowsQuery.isLoading;
  const rowsError = (rowsQuery.error as Error | null)?.message ?? null;
  const hasOrderFilters =
    listUrl.q.trim() !== "" ||
    listUrl.product !== "全部" ||
    listUrl.payer !== "全部";

  const filterPackageSelectValues = useMemo(() => {
    const ordered: string[] = ["全部"];
    const seen = new Set<string>(ordered);
    for (const p of packageNumberOptions) {
      if (p && !seen.has(p)) {
        ordered.push(p);
        seen.add(p);
      }
    }
    return ordered;
  }, [packageNumberOptions]);

  const packageSelectValues = useMemo(() => {
    const ordered: string[] = ["未指定"];
    const seen = new Set<string>(ordered);
    for (const p of packageNumberOptions) {
      if (p && !seen.has(p)) {
        ordered.push(p);
        seen.add(p);
      }
    }
    return ordered;
  }, [packageNumberOptions]);
  const groupedRows = useMemo(
    () => mergePackageTableGroups(rows, emptyPackageStubs),
    [rows, emptyPackageStubs],
  );
  const totals = useMemo(() => {
    let totalPrice = 0;
    let totalCost = 0;
    let totalDomesticShippingFee = 0;
    for (const row of rows) {
      totalPrice += toNumber(row.price);
      totalCost += toNumber(row.cost);
      totalDomesticShippingFee += toNumber(row.domesticShippingFee);
    }

    let totalInternationalShippingFee = 0;
    const seenPackageNumbers = new Set<string>();
    for (const row of rows) {
      const pkg = row.packageNumber;
      if (pkg === "未指定" || seenPackageNumbers.has(pkg)) {
        continue;
      }
      seenPackageNumbers.add(pkg);
      totalInternationalShippingFee += toNumber(row.internationalShippingFee);
    }

    const totalProfit = totalPrice - totalCost - totalInternationalShippingFee;

    return {
      totalPrice,
      totalCost,
      totalDomesticShippingFee,
      totalInternationalShippingFee,
      totalProfit,
    };
  }, [rows]);

  const handlePackageNumberChange = (id: string, value: string | null) => {
    const target = rows.find((row) => row.id === id);
    if (target?.packageSettled) {
      return;
    }
    if (value) {
      setRowFieldError(null);
      void (async () => {
        try {
          await updateOrderFieldMutation.mutateAsync({
            id,
            patch: { packageNumber: value },
          });
        } catch (error) {
          setRowFieldError((error as Error).message);
        }
      })();
    }
  };

  const handleProductStatusChange = (id: string, value: string | null) => {
    const target = rows.find((row) => row.id === id);
    if (!target) {
      return;
    }
    if (target.packageSettled || target.productStatus === "已出貨") {
      setRowFieldError("商品狀態已出貨後不可再修改");
      return;
    }
    if (value === "已出貨" && target.paymentStatus !== "已入帳") {
      setRowFieldError("收款狀態尚未入帳，不能將商品狀態改為已出貨");
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
      setRowFieldError(null);
      void (async () => {
        try {
          await updateOrderFieldMutation.mutateAsync({
            id,
            patch: { productStatus: value },
          });
        } catch (error) {
          setRowFieldError((error as Error).message);
        }
      })();
    }
  };

  const visibleOrderIds = rows.map((row) => row.id);
  const isAllCurrentPageSelected =
    visibleOrderIds.length > 0 &&
    visibleOrderIds.every((orderId) => selectedOrderIds.includes(orderId));
  const isSomeCurrentPageSelected =
    visibleOrderIds.some((orderId) => selectedOrderIds.includes(orderId)) &&
    !isAllCurrentPageSelected;

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    setSelectedOrderIds((currentSelected) => {
      if (checked) {
        const merged = new Set([...currentSelected, ...visibleOrderIds]);
        return Array.from(merged);
      }
      return currentSelected.filter((id) => !visibleOrderIds.includes(id));
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

  const applyBulkProductStatus = async () => {
    const ids = selectedOrderIds;
    if (ids.length === 0) {
      return;
    }
    setRowFieldError(null);
    const orderById = new Map(rows.map((row) => [row.id, row]));
    const lockedIds = ids.filter((id) => {
      const row = orderById.get(id);
      return row?.productStatus === "已出貨" || row?.packageSettled === true;
    });
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
        setRowFieldError("收款狀態尚未入帳，不能批次改為已出貨");
      } else {
        setRowFieldError("已出貨或包裹已結清的訂單不能透過批次修改商品狀態");
      }
      return;
    }
    const results = await Promise.all(
      updatableIds.map((id) =>
        updateOrderFields(id, { productStatus: bulkProductStatus })
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setRowFieldError(failed.error.message);
      return;
    }
    if (lockedIds.length > 0 || paymentBlockedIds.length > 0) {
      setRowFieldError(
        "部分訂單未變更商品狀態（已出貨、包裹已結清，或收款未入帳時不可改為已出貨）"
      );
    }
    const skippedIds = Array.from(new Set([...lockedIds, ...paymentBlockedIds]));
    setSelectedOrderIds(skippedIds);
    setIsBulkProductPopoverOpen(false);
    invalidatePackageRows();
  };

  const handleCreatePackage = async () => {
    setCreatePackageError(null);
    const { data, error } = await createPackageMutation.mutateAsync({
      notes: newPackageNotes.trim() || null,
      internationalShippingFee: Number.parseFloat(
        newPackageInternationalShippingFee
      ),
    });
    if (error) {
      setCreatePackageError(error.message);
      return;
    }
    if (!data) {
      setCreatePackageError("新增失敗");
      return;
    }
    setNewPackageNotes("");
    setNewPackageInternationalShippingFee("0");
    setIsCreatePackageDialogOpen(false);
  };

  const handleFilterPopoverOpenChange = (open: boolean) => {
    setIsFilterPopoverOpen(open);
    if (open) {
      setDraftFilterPackageNumber(listUrl.pkg);
      setDraftFilterProductStatus(listUrl.product);
      setDraftFilterPayer(listUrl.payer);
    }
  };

  const applyPackageFilter = () => {
    void setListUrl({
      pkg: draftFilterPackageNumber,
      product: draftFilterProductStatus,
      payer: draftFilterPayer,
      page: 1,
    });
    setIsFilterPopoverOpen(false);
  };

  const settlePackage = async (pkg: string): Promise<boolean> => {
    setSettlePackageError(null);
    try {
      await settlePackageMutation.mutateAsync(pkg);
      return true;
    } catch (error) {
      setSettlePackageError((error as Error).message);
      return false;
    }
  };
  const openSettlePackageDialog = (pkg: string) => {
    setSettlePackageError(null);
    setPackageToSettle(pkg);
    setIsSettlePackageDialogOpen(true);
  };
  const confirmSettlePackage = async () => {
    if (!packageToSettle) return;
    const ok = await settlePackage(packageToSettle);
    if (ok) {
      setIsSettlePackageDialogOpen(false);
      setPackageToSettle(null);
    }
  };

  const openEditPackageFeeDialog = (
    pkg: string,
    currentFee: string,
    currentNotes: string,
  ) => {
    const group = groupedRows.find((g) => g.label === pkg);
    const settled =
      group?.rows[0]?.packageSettled === true ||
      group?.emptyStub?.isSettled === true;
    if (settled) {
      return;
    }
    setEditPackageFeeError(null);
    setPackageToEditFee(pkg);
    setEditPackageFeeValue(currentFee);
    setEditPackageNotesValue(currentNotes);
    setIsEditPackageFeeDialogOpen(true);
  };

  const confirmEditPackageFee = async () => {
    if (!packageToEditFee) {
      return;
    }
    const parsed = Number.parseFloat(editPackageFeeValue);
    setEditPackageFeeError(null);
    try {
      await editPackageFeeMutation.mutateAsync({
        pkg: packageToEditFee,
        fee: Number.isNaN(parsed) ? 0 : parsed,
        notes: editPackageNotesValue,
      });
    } catch (error) {
      setEditPackageFeeError((error as Error).message);
      return;
    }
    setPackageToEditFee(null);
    setIsEditPackageFeeDialogOpen(false);
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">包裹管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={isCreatePackageDialogOpen}
            onOpenChange={(open) => {
              setIsCreatePackageDialogOpen(open);
              if (!open) {
                setCreatePackageError(null);
                setNewPackageNotes("");
                setNewPackageInternationalShippingFee("0");
              }
            }}
          >
            <DialogTrigger render={<Button type="button">新增包裹</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增包裹</DialogTitle>
              </DialogHeader>
              {createPackageError && (
                <div
                  className="flex items-start justify-between gap-2 text-sm text-destructive"
                  role="alert"
                >
                  <p>{createPackageError}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive"
                    onClick={() => setCreatePackageError(null)}
                    aria-label="關閉錯誤訊息"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="py-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {nextPackageNumberQuery.isLoading ? (
                      <>正在載入下一個包裹編號…</>
                    ) : nextPackageNumberQuery.isError ? (
                      <>
                        編號由資料庫自動遞增（1、2、3…）。無法預覽下一個編號時仍可直接新增。
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">
                          包裹編號：{nextPackageNumberQuery.data}
                        </span>
                      </>
                    )}
                  </label>
                </div>
                <div className="mt-2 space-y-1">
                  <label className="text-sm font-medium">備註</label>
                  <Input
                    value={newPackageNotes}
                    onChange={(event) => setNewPackageNotes(event.target.value)}
                    placeholder="備註"
                    aria-label="包裹備註"
                  />
                </div>
                <div className="mt-2 space-y-1">
                  <label className="text-sm font-medium">國際運費</label>
                  <Input
                    type="number"
                    value={newPackageInternationalShippingFee}
                    onChange={(event) =>
                      setNewPackageInternationalShippingFee(event.target.value)
                    }
                    placeholder="國際運費"
                    aria-label="國際運費"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">取消</Button>} />
                <Button
                  type="button"
                  onClick={() => void handleCreatePackage()}
                  disabled={createPackageMutation.isPending}
                >
                  {createPackageMutation.isPending ? "新增中…" : "新增"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
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
                aria-label="篩選列表"
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
              <div className="space-y-1">
                <p className="text-sm font-medium">商品狀態</p>
                <Select
                  value={draftFilterProductStatus}
                  onValueChange={(value) => {
                    if (value) {
                      setDraftFilterProductStatus(value);
                    }
                  }}
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
                <p className="text-sm font-medium">付款人</p>
                <Select
                  value={draftFilterPayer}
                  onValueChange={(value) => {
                    if (value) {
                      setDraftFilterPayer(value);
                    }
                  }}
                >
                  <SelectTrigger aria-label="篩選付款人">
                    <SelectValue placeholder="付款人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部付款人</SelectItem>
                    <SelectItem value="虹">虹</SelectItem>
                    <SelectItem value="藍">藍</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={applyPackageFilter}
              >
                套用
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {selectedOrderIds.length > 0 && (
          <Popover
            open={isBulkProductPopoverOpen}
            onOpenChange={setIsBulkProductPopoverOpen}
          >
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="批次修改商品狀態"
                  title="批次修改商品狀態"
                >
                  <FolderInputIcon className="h-4 w-4" />
                </Button>
              }
            />
            <PopoverContent className="w-72 space-y-3" align="end">
              <p className="text-sm font-medium">批次修改商品狀態</p>
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
              <Button
                type="button"
                className="w-full"
                onClick={() => void applyBulkProductStatus()}
              >
                套用到已選訂單
              </Button>
            </PopoverContent>
          </Popover>
        )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        {listUrl.payer !== "全部" && (
          <button
            type="button"
            onClick={() => {
              patchListUrl({ payer: "全部", page: 1 });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            付款人: {listUrl.payer}
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {rowsError && dismissedRowsError !== rowsError && (
        <div
          className="mb-4 flex items-start justify-between gap-2 text-sm text-destructive"
          role="alert"
        >
          <p>{rowsError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={() => setDismissedRowsError(rowsError)}
            aria-label="關閉錯誤訊息"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
      {rowFieldError && (
        <div
          className="mb-4 flex items-start justify-between gap-2 text-sm text-destructive"
          role="alert"
        >
          <p>商品狀態更新失敗：{rowFieldError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={() => setRowFieldError(null)}
            aria-label="關閉錯誤訊息"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
      {settlePackageError && (
        <div
          className="mb-4 flex items-start justify-between gap-2 text-sm text-destructive"
          role="alert"
        >
          <p>包裹結清失敗：{settlePackageError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={() => setSettlePackageError(null)}
            aria-label="關閉錯誤訊息"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-[1300px]">
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
                  disabled={rowsLoading || groupedRows.length === 0}
                />
              </TableHead>
              <TableHead>包裹編號</TableHead>
              <TableHead className="min-w-48">品項</TableHead>
              <TableHead>數量</TableHead>
              <TableHead>購買日期</TableHead>
              <TableHead>購買人</TableHead>
              <TableHead>付款人</TableHead>
              <TableHead>收件人</TableHead>
              <TableHead>電話</TableHead>
              <TableHead className="min-w-48">收件地址</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="text-right">售價</TableHead>
              <TableHead className="text-right">收益</TableHead>
              <TableHead className="text-right">運費</TableHead>
              <TableHead>商品狀態</TableHead>
              <TableHead className="min-w-48">備註</TableHead>
              <TableHead className="w-[88px]">詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsLoading ? (
              Array.from({ length: 12 }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14 ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14 ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14 ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14 ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : rowsError ? (
              <TableRow>
                <TableCell
                  colSpan={17}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  無法載入列表，請見上方錯誤說明。
                </TableCell>
              </TableRow>
            ) : groupedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={17}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {listUrl.q.trim() !== ""
                    ? "沒有符合品項搜尋的訂單。"
                    : listUrl.pkg !== "全部"
                    ? "此篩選條件下沒有訂單，或包裹編號不存在。"
                    : listUrl.payer !== "全部"
                    ? "此付款人篩選下沒有訂單。"
                    : "尚無已指派包裹的訂單。"}
                </TableCell>
              </TableRow>
            ) : (
              groupedRows.map((group) => {
                const headerSettled =
                  group.rows[0]?.packageSettled === true ||
                  group.emptyStub?.isSettled === true;
                const headerIntlFee =
                  group.rows[0]?.internationalShippingFee ??
                  String(group.emptyStub?.internationalShippingFee ?? 0);
                const headerNotes =
                  group.rows[0]?.packageNotes ?? group.emptyStub?.notes ?? "";
                const settleDisabled =
                  group.rows.length === 0 ||
                  !group.rows.every((r) => r.productStatus === "已出貨") ||
                  settlePackageMutation.isPending;
                return (
                <Fragment key={group.label}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell
                      colSpan={16}
                      className="py-3 text-sm font-semibold tracking-tight"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          {group.label === "未指定"
                            ? "未指派包裹"
                            : `包裹${group.label}`}
                        </span>
                        {headerSettled && (
                          <span className="font-normal text-muted-foreground">
                            （已結清）
                          </span>
                        )}
                        {group.label !== "未指定" && (
                          <span className="font-normal text-muted-foreground">
                            國際運費: {headerIntlFee}
                          </span>
                        )}
                        {group.label !== "未指定" && headerNotes !== "" && (
                          <span
                            className="inline-block max-w-[24rem] truncate align-bottom font-normal text-muted-foreground"
                            title={headerNotes}
                          >
                            備註: {headerNotes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {group.label !== "未指定" && !headerSettled && (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label="修改國際運費與備註"
                            title="修改國際運費與備註"
                            onClick={() =>
                              openEditPackageFeeDialog(
                                group.label,
                                headerIntlFee,
                                headerNotes,
                              )
                            }
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <span
                            className="inline-flex size-8 shrink-0"
                            title="結清訂單"
                          >
                            <Button
                              type="button"
                              variant="default"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              aria-label="結清訂單"
                              title="結清訂單"
                              disabled={settleDisabled}
                              onClick={() =>
                                openSettlePackageDialog(group.label)
                              }
                            >
                              <CheckIcon className="h-4 w-4" />
                            </Button>
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {group.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={17}
                        className="py-4 text-center text-sm text-muted-foreground"
                      >
                        {hasOrderFilters
                          ? "此包裹在目前篩選下沒有訂單。"
                          : "此包裹尚無訂單。"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    group.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(row.id)}
                          onChange={(event) =>
                            toggleSelectOrder(row.id, event.target.checked)
                          }
                          aria-label={`選擇訂單 ${row.id}`}
                          disabled={rowsLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.packageNumber}
                          disabled={row.packageSettled}
                          onValueChange={(value) =>
                            handlePackageNumberChange(row.id, value)
                          }
                        >
                          <SelectTrigger
                            className="h-8 w-38"
                            aria-label="包裹編號"
                          >
                            <SelectValue placeholder="包裹編號" />
                          </SelectTrigger>
                          <SelectContent>
                            {packageSelectValues.map((pkg) => (
                              <SelectItem key={pkg} value={pkg}>
                                {pkg}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell
                        className="max-w-56 truncate text-sm text-muted-foreground"
                        title={row.item}
                      >
                        {row.item}
                      </TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="tabular-nums">
                        {row.purchaseDate}
                      </TableCell>
                      <TableCell
                        className="max-w-32 truncate"
                        title={row.buyer}
                      >
                        {row.buyer}
                      </TableCell>
                      <TableCell>{row.payer}</TableCell>
                      <TableCell
                        className="max-w-32 truncate"
                        title={row.recipientName}
                      >
                        {row.recipientName}
                      </TableCell>
                      <TableCell
                        className="max-w-36 truncate"
                        title={row.phone}
                      >
                        {row.phone}
                      </TableCell>
                      <TableCell
                        className="max-w-[20rem] truncate text-sm text-muted-foreground"
                        title={row.address}
                      >
                        {row.address}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.cost}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.price}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.revenue}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.domesticShippingFee}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.productStatus}
                          disabled={
                            row.packageSettled || row.productStatus === "已出貨"
                          }
                          onValueChange={(value) =>
                            handleProductStatusChange(row.id, value)
                          }
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
                      <TableCell
                        className="max-w-56 truncate text-sm text-muted-foreground"
                        title={row.orderNotes}
                      >
                        {row.orderNotes}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/orders/${row.id}`}
                          aria-label="查看訂單詳細"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {rowsLoading ? (
            <>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-28" />
            </>
          ) : (
            <>
              <p>
                總營業額:{" "}
                <span className="font-semibold">
                  {totals.totalPrice.toLocaleString()}
                </span>
              </p>
              <p>
                總成本:{" "}
                <span className="font-semibold">
                  {totals.totalCost.toLocaleString()}
                </span>
              </p>
              <p>
                總國際運費:{" "}
                <span className="font-semibold">
                  {totals.totalInternationalShippingFee.toLocaleString()}
                </span>
              </p>
              <p>
                總運費:{" "}
                <span className="font-semibold">
                  {totals.totalDomesticShippingFee.toLocaleString()}
                </span>
              </p>
              <p>
                收益:{" "}
                <span className="font-semibold">
                  {totals.totalProfit.toLocaleString()}
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
            disabled={rowsLoading || safeCurrentPage === 1}
          >
            上一頁
          </Button>
          {rowsLoading ? (
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
            disabled={rowsLoading || safeCurrentPage === totalPages}
          >
            下一頁
          </Button>
        </div>
      </div>
      <Dialog
        open={isSettlePackageDialogOpen}
        onOpenChange={(open) => {
          setIsSettlePackageDialogOpen(open);
          if (!open) {
            setPackageToSettle(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認結清包裹</DialogTitle>
            <DialogDescription>
              確定要將包裹編號 {packageToSettle ?? "-"} 標記為已結清嗎？
            </DialogDescription>
          </DialogHeader>
          {settlePackageError && (
            <div
              className="flex items-start justify-between gap-2 text-sm text-destructive"
              role="alert"
            >
              <p>{settlePackageError}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive"
                onClick={() => setSettlePackageError(null)}
                aria-label="關閉錯誤訊息"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">取消</Button>} />
            <Button
              type="button"
              onClick={() => void confirmSettlePackage()}
              disabled={settlePackageMutation.isPending}
            >
              {settlePackageMutation.isPending ? "結清中…" : "確認結清"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isEditPackageFeeDialogOpen}
        onOpenChange={(open) => {
          setIsEditPackageFeeDialogOpen(open);
          if (!open) {
            setPackageToEditFee(null);
            setEditPackageFeeError(null);
            setEditPackageFeeValue("0");
            setEditPackageNotesValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改包裹</DialogTitle>
            <DialogDescription>
              包裹編號 {packageToEditFee ?? "-"} 的國際運費與備註。
            </DialogDescription>
          </DialogHeader>
          {editPackageFeeError && (
            <div
              className="flex items-start justify-between gap-2 text-sm text-destructive"
              role="alert"
            >
              <p>{editPackageFeeError}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive"
                onClick={() => setEditPackageFeeError(null)}
                aria-label="關閉錯誤訊息"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="edit-package-fee" className="text-sm font-medium">
                國際運費
              </label>
              <Input
                id="edit-package-fee"
                type="number"
                value={editPackageFeeValue}
                onChange={(event) => setEditPackageFeeValue(event.target.value)}
                placeholder="國際運費"
                aria-label="國際運費"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-package-notes" className="text-sm font-medium">
                備註
              </label>
              <textarea
                id="edit-package-notes"
                value={editPackageNotesValue}
                onChange={(event) =>
                  setEditPackageNotesValue(event.target.value)
                }
                placeholder="包裹備註（可留空）"
                aria-label="包裹備註"
                rows={3}
                className="flex min-h-18 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">取消</Button>} />
            <Button
              type="button"
              onClick={() => void confirmEditPackageFee()}
              disabled={editPackageFeeMutation.isPending}
            >
              {editPackageFeeMutation.isPending ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default PackagePage;
