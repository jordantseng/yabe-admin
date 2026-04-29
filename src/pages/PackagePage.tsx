import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { EyeIcon, FilterIcon, Trash2Icon } from "lucide-react";
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
  PACKAGE_NUMBER_OPTIONS_CHANGED_EVENT,
  notifyPackageNumberOptionsChanged,
} from "@/lib/package-number-options";
import {
  createPackage,
  deletePackageByNumber,
  fetchPackageNumbersFromDb,
  updatePackageInternationalShippingFeeByNumber,
} from "@/lib/packages";
import { packagesListSearchParams } from "@/lib/packages-list-url";
import {
  fetchOrdersForPackagePage,
  revenueStringFromCostPrice,
  updateOrderFields,
  type OrderWithPackageNumber,
} from "@/lib/orders";
import type { OrderProductStatus } from "@/types/database";

const PACKAGE_PAGE_SIZE = 15;

/** 包裹列表列（由訂單 + 關聯包裹映射）。 */
export type PackageTableRow = {
  id: string;
  packageNumber: string;
  item: string;
  purchaseDate: string;
  buyer: string;
  address: string;
  cost: string;
  price: string;
  domesticShippingFee: string;
  internationalShippingFee: string;
  revenue: string;
  productStatus: OrderProductStatus;
};

function toNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

function purchaseDateSlice(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function displayPackageNumber(row: OrderWithPackageNumber): string {
  const rel = row.packages as { number: number } | { number: number }[] | null;
  const num = Array.isArray(rel)
    ? rel[0]?.number
    : rel != null
    ? rel.number
    : undefined;
  if (typeof num === "number") {
    return String(num);
  }
  if (row.package_number && row.package_number !== "未指定") {
    return row.package_number;
  }
  return "未指定";
}

function orderToPackageTableRow(row: OrderWithPackageNumber): PackageTableRow {
  return {
    id: row.id,
    packageNumber: displayPackageNumber(row),
    item: row.item,
    purchaseDate: purchaseDateSlice(row.purchase_date),
    buyer: row.buyer,
    address: row.domestic_delivery_address ?? "",
    cost: String(row.cost),
    price: String(row.price),
    domesticShippingFee: String(row.domestic_shipping_fee),
    internationalShippingFee: String(
      ((row.packages as { international_shipping_fee?: number } | null)
        ?.international_shipping_fee ?? 0),
    ),
    revenue: revenueStringFromCostPrice(row.cost, row.price),
    productStatus: row.product_status,
  };
}

/** 分組標題排序：數字編號遞增，其餘依字串，「未指定」置底。 */
function comparePackageGroupLabels(a: string, b: string): number {
  if (a === "未指定" && b !== "未指定") return 1;
  if (b === "未指定" && a !== "未指定") return -1;
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const aNum = Number.isFinite(na) && String(na) === a;
  const bNum = Number.isFinite(nb) && String(nb) === b;
  if (aNum && bNum) return na - nb;
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

function PackagePage() {
  const [listUrl, setListUrl] = useQueryStates(packagesListSearchParams, {
    history: "push",
  });
  const [isCreatePackageDialogOpen, setIsCreatePackageDialogOpen] =
    useState(false);
  const [newPackageNotes, setNewPackageNotes] = useState("");
  const [newPackageInternationalShippingFee, setNewPackageInternationalShippingFee] =
    useState("0");
  const [createPackageError, setCreatePackageError] = useState<string | null>(
    null
  );
  const [isCreatePackageSubmitting, setIsCreatePackageSubmitting] =
    useState(false);
  const [rows, setRows] = useState<PackageTableRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [packageNumberOptions, setPackageNumberOptions] = useState<string[]>(
    []
  );
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState<string>("全部");
  const [rowFieldError, setRowFieldError] = useState<string | null>(null);
  const [isDeletePackageDialogOpen, setIsDeletePackageDialogOpen] =
    useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);
  const [deletePackageError, setDeletePackageError] = useState<string | null>(
    null
  );
  const [isDeletePackageSubmitting, setIsDeletePackageSubmitting] =
    useState(false);
  const [isEditPackageFeeDialogOpen, setIsEditPackageFeeDialogOpen] =
    useState(false);
  const [packageToEditFee, setPackageToEditFee] = useState<string | null>(null);
  const [editPackageFeeValue, setEditPackageFeeValue] = useState("0");
  const [editPackageFeeError, setEditPackageFeeError] = useState<string | null>(
    null,
  );
  const [isEditPackageFeeSubmitting, setIsEditPackageFeeSubmitting] =
    useState(false);
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PACKAGE_PAGE_SIZE));
  const safeCurrentPage = Math.min(listUrl.page, totalPages);
  const paginatedRows = useMemo(() => {
    const from = (safeCurrentPage - 1) * PACKAGE_PAGE_SIZE;
    return rows.slice(from, from + PACKAGE_PAGE_SIZE);
  }, [rows, safeCurrentPage]);

  useEffect(() => {
    const refresh = () => {
      void (async () => {
        const res = await fetchPackageNumbersFromDb();
        if (!res.error && res.data) {
          setPackageNumberOptions(res.data ?? []);
        }
      })();
    };
    refresh();
    window.addEventListener(PACKAGE_NUMBER_OPTIONS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(PACKAGE_NUMBER_OPTIONS_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (listUrl.pkg === "未指定") {
      void setListUrl({ pkg: "全部" });
    }
  }, [listUrl.pkg, setListUrl]);

  useEffect(() => {
    if (safeCurrentPage !== listUrl.page) {
      void setListUrl({ page: safeCurrentPage }, { history: "replace" });
    }
  }, [safeCurrentPage, listUrl.page, setListUrl]);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setRowsLoading(true);
      setRowsError(null);
    });

    void (async () => {
      const res = await fetchOrdersForPackagePage({
        itemSearch: listUrl.q,
        packageFilter: listUrl.pkg,
      });
      if (cancelled) {
        return;
      }
      startTransition(() => {
        setRowsLoading(false);
        if (res.error) {
          setRowsError(res.error.message);
          setRows([]);
          return;
        }
        setRows((res.data ?? []).map(orderToPackageTableRow));
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [listUrl.q, listUrl.pkg, listRefreshKey]);

  const patchListUrl = useCallback(
    (patch: Partial<{ q: string; pkg: string; page: number }>) => {
      void setListUrl(patch);
    },
    [setListUrl]
  );

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

  const groupedRows = useMemo(() => groupPackageRows(paginatedRows), [paginatedRows]);
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

    const totalProfit =
      totalPrice -
      totalCost -
      totalInternationalShippingFee -
      totalDomesticShippingFee;

    return {
      totalPrice,
      totalCost,
      totalDomesticShippingFee,
      totalInternationalShippingFee,
      totalProfit,
    };
  }, [rows]);

  const updateRow = (id: string, patch: Partial<PackageTableRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handlePackageNumberChange = (id: string, value: string | null) => {
    if (value) {
      setRowFieldError(null);
      const previous = rows.find((r) => r.id === id)?.packageNumber;
      updateRow(id, { packageNumber: value });
      void (async () => {
        const { error } = await updateOrderFields(id, { packageNumber: value });
        if (!error) {
          setListRefreshKey((k) => k + 1);
          return;
        }
        setRowFieldError(error.message);
        if (previous) {
          updateRow(id, { packageNumber: previous });
        }
      })();
    }
  };

  const handleProductStatusChange = (id: string, value: string | null) => {
    if (
      value === "未購買" ||
      value === "已購賣" ||
      value === "到虹家" ||
      value === "集運回台" ||
      value === "到台灣" ||
      value === "已出貨"
    ) {
      setRowFieldError(null);
      const previous = rows.find((r) => r.id === id)?.productStatus;
      updateRow(id, { productStatus: value });
      void (async () => {
        const { error } = await updateOrderFields(id, { productStatus: value });
        if (!error) {
          return;
        }
        setRowFieldError(error.message);
        if (previous) {
          updateRow(id, { productStatus: previous });
        }
      })();
    }
  };

  const handleCreatePackage = async () => {
    setCreatePackageError(null);
    setIsCreatePackageSubmitting(true);
    const { data, error } = await createPackage({
      notes: newPackageNotes.trim() || null,
      internationalShippingFee: Number.parseFloat(newPackageInternationalShippingFee),
    });
    setIsCreatePackageSubmitting(false);
    if (error) {
      setCreatePackageError(error.message);
      return;
    }
    if (!data) {
      setCreatePackageError("建立失敗");
      return;
    }
    setNewPackageNotes("");
    setNewPackageInternationalShippingFee("0");
    setIsCreatePackageDialogOpen(false);
    notifyPackageNumberOptionsChanged();
    setListRefreshKey((k) => k + 1);
  };

  const handleFilterPopoverOpenChange = (open: boolean) => {
    setIsFilterPopoverOpen(open);
    if (open) {
      setDraftFilterPackageNumber(listUrl.pkg);
    }
  };

  const applyPackageFilter = () => {
    void setListUrl({ pkg: draftFilterPackageNumber, page: 1 });
    setIsFilterPopoverOpen(false);
  };

  const openDeletePackageDialog = (pkg: string) => {
    setDeletePackageError(null);
    setPackageToDelete(pkg);
    setIsDeletePackageDialogOpen(true);
  };

  const confirmDeletePackage = async () => {
    if (!packageToDelete) {
      return;
    }
    setDeletePackageError(null);
    setIsDeletePackageSubmitting(true);
    const { error } = await deletePackageByNumber(packageToDelete);
    setIsDeletePackageSubmitting(false);
    if (error) {
      setDeletePackageError(error.message);
      return;
    }
    if (listUrl.pkg === packageToDelete) {
      void setListUrl({ pkg: "全部" });
    }
    setPackageToDelete(null);
    setIsDeletePackageDialogOpen(false);
    notifyPackageNumberOptionsChanged();
    setListRefreshKey((k) => k + 1);
  };

  const openEditPackageFeeDialog = (pkg: string, currentFee: string) => {
    setEditPackageFeeError(null);
    setPackageToEditFee(pkg);
    setEditPackageFeeValue(currentFee);
    setIsEditPackageFeeDialogOpen(true);
  };

  const confirmEditPackageFee = async () => {
    if (!packageToEditFee) {
      return;
    }
    const parsed = Number.parseFloat(editPackageFeeValue);
    setEditPackageFeeError(null);
    setIsEditPackageFeeSubmitting(true);
    const { error } = await updatePackageInternationalShippingFeeByNumber(
      packageToEditFee,
      Number.isNaN(parsed) ? 0 : parsed,
    );
    setIsEditPackageFeeSubmitting(false);
    if (error) {
      setEditPackageFeeError(error.message);
      return;
    }
    setPackageToEditFee(null);
    setIsEditPackageFeeDialogOpen(false);
    setListRefreshKey((k) => k + 1);
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
              }
            }}
          >
            <DialogTrigger
              render={<Button type="button">建立包裹編號</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>建立包裹編號</DialogTitle>
                <DialogDescription>
                  編號由資料庫自動遞增（1、2、3…）。可填選填備註。
                </DialogDescription>
              </DialogHeader>
              {createPackageError && (
                <p className="text-sm text-destructive" role="alert">
                  {createPackageError}
                </p>
              )}
              <div className="py-2">
                <Input
                  value={newPackageNotes}
                  onChange={(event) => setNewPackageNotes(event.target.value)}
                  placeholder="備註（選填）"
                  aria-label="包裹備註"
                />
                <Input
                  className="mt-2"
                  type="number"
                  value={newPackageInternationalShippingFee}
                  onChange={(event) =>
                    setNewPackageInternationalShippingFee(event.target.value)
                  }
                  placeholder="國際運費"
                  aria-label="國際運費"
                />
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">取消</Button>} />
                <Button
                  type="button"
                  onClick={() => void handleCreatePackage()}
                  disabled={isCreatePackageSubmitting}
                >
                  {isCreatePackageSubmitting ? "建立中…" : "建立"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          key={listUrl.q}
          defaultValue={listUrl.q}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void setListUrl({ q: event.currentTarget.value.trim(), page: 1 });
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
                aria-label="篩選包裹編號"
              >
                <FilterIcon className="h-4 w-4" />
              </Button>
            }
          />
          <PopoverContent className="w-72 p-3" align="start">
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
      </div>

      {rowsError && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {rowsError}
        </p>
      )}
      {rowFieldError && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          商品狀態更新失敗：{rowFieldError}
        </p>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-[1240px]">
          <TableHeader>
            <TableRow>
              <TableHead>包裹編號</TableHead>
              <TableHead className="min-w-48">品項</TableHead>
              <TableHead>購買日期</TableHead>
              <TableHead>購買人</TableHead>
              <TableHead className="min-w-48">地址</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="text-right">售價</TableHead>
              <TableHead className="text-right">店到店運費</TableHead>
              <TableHead className="text-right">收益</TableHead>
              <TableHead>商品狀態</TableHead>
              <TableHead className="w-[88px]">詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsLoading ? (
              Array.from({ length: PACKAGE_PAGE_SIZE }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  <TableCell>
                    <Skeleton className="h-8 w-32" />
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
                    <Skeleton className="h-4 w-40" />
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
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : rowsError ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  無法載入列表，請見上方錯誤說明。
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {listUrl.q.trim() !== ""
                    ? "沒有符合品項搜尋的訂單。"
                    : listUrl.pkg !== "全部"
                    ? "此篩選條件下沒有訂單，或包裹編號不存在。"
                    : "尚無已指派包裹的訂單。"}
                </TableCell>
              </TableRow>
            ) : (
              groupedRows.map((group) => (
                <Fragment key={group.label}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell
                      colSpan={10}
                      className="py-3 text-sm font-semibold tracking-tight"
                    >
                      {group.label === "未指定"
                        ? "未指派包裹"
                        : `包裹編號 ${group.label}`}
                      <span className="ml-2 font-normal text-muted-foreground">
                        （{group.rows.length} 筆訂單）
                      </span>
                      {group.label !== "未指定" && (
                        <span className="ml-3 font-normal text-muted-foreground">
                          國際運費: {group.rows[0]?.internationalShippingFee ?? "0"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 space-x-2">
                      {group.label !== "未指定" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openEditPackageFeeDialog(
                              group.label,
                              group.rows[0]?.internationalShippingFee ?? "0",
                            )
                          }
                        >
                          修改運費
                        </Button>
                      )}
                      {group.label !== "未指定" && (
                        <button
                          type="button"
                          aria-label={`刪除包裹編號 ${group.label}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-destructive hover:bg-destructive/10"
                          onClick={() => openDeletePackageDialog(group.label)}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                  {group.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Select
                          value={row.packageNumber}
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
                      <TableCell className="max-w-56 text-sm text-muted-foreground">
                        {row.item}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.purchaseDate}
                      </TableCell>
                      <TableCell>{row.buyer}</TableCell>
                      <TableCell className="max-w-[20rem] text-sm text-muted-foreground">
                        {row.address}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.cost}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.price}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.domesticShippingFee}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.revenue}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.productStatus}
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
                            <SelectItem value="已購賣">已購賣</SelectItem>
                            <SelectItem value="到虹家">到虹家</SelectItem>
                            <SelectItem value="集運回台">集運回台</SelectItem>
                            <SelectItem value="到台灣">到台灣</SelectItem>
                            <SelectItem value="已出貨">已出貨</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Link
                          to={`/orders/${row.id}`}
                          aria-label="查看訂單詳細"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted-foreground">總售價: {totals.totalPrice}</span>
        <span className="text-muted-foreground">總成本: {totals.totalCost}</span>
        <span className="text-muted-foreground">
          總國際運費: {totals.totalInternationalShippingFee}
        </span>
        <span className="text-muted-foreground">
          總店到店運費: {totals.totalDomesticShippingFee}
        </span>
        <span className="font-semibold">收益: {totals.totalProfit}</span>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => patchListUrl({ page: Math.max(1, safeCurrentPage - 1) })}
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
      <Dialog
        open={isDeletePackageDialogOpen}
        onOpenChange={(open) => {
          setIsDeletePackageDialogOpen(open);
          if (!open) {
            setPackageToDelete(null);
            setDeletePackageError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除包裹</DialogTitle>
            <DialogDescription>
              確定要刪除包裹編號 {packageToDelete ?? "-"}{" "}
              嗎？已指派此包裹的訂單會改為未指派。
            </DialogDescription>
          </DialogHeader>
          {deletePackageError && (
            <p className="text-sm text-destructive" role="alert">
              {deletePackageError}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">取消</Button>} />
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeletePackage()}
              disabled={isDeletePackageSubmitting}
            >
              {isDeletePackageSubmitting ? "刪除中…" : "刪除包裹"}
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
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改國際運費</DialogTitle>
            <DialogDescription>
              包裹編號 {packageToEditFee ?? "-"} 的國際運費。
            </DialogDescription>
          </DialogHeader>
          {editPackageFeeError && (
            <p className="text-sm text-destructive" role="alert">
              {editPackageFeeError}
            </p>
          )}
          <Input
            type="number"
            value={editPackageFeeValue}
            onChange={(event) => setEditPackageFeeValue(event.target.value)}
            placeholder="國際運費"
            aria-label="國際運費"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline">取消</Button>} />
            <Button
              type="button"
              onClick={() => void confirmEditPackageFee()}
              disabled={isEditPackageFeeSubmitting}
            >
              {isEditPackageFeeSubmitting ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default PackagePage;
