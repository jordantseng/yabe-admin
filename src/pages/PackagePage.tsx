import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, FilterIcon, XIcon } from "lucide-react";
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
  settlePackageByNumber,
  updatePackageInternationalShippingFeeByNumber,
} from "@/lib/packages";
import { packagesListSearchParams } from "@/lib/packages-list-url";
import {
  fetchOrdersForPackagePage,
  revenueStringFromCostPrice,
  updateOrderFields,
  type OrderWithPackageNumber,
} from "@/lib/orders";
import type { OrderPayer, OrderProductStatus } from "@/types/database";

const PACKAGE_PAGE_SIZE = 15;
const PACKAGE_ROWS_QUERY_KEY = ["packages", "page-rows"] as const;
const PACKAGE_NUMBERS_QUERY_KEY = ["packages", "numbers"] as const;
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
  const packageRel = row.packages as
    | { international_shipping_fee?: number; notes?: string | null; is_settled?: boolean }
    | null;
  return {
    id: row.id,
    packageNumber: displayPackageNumber(row),
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
    internationalShippingFee: String(packageRel?.international_shipping_fee ?? 0),
    revenue: revenueStringFromCostPrice(row.cost, row.price),
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

function PackagePage() {
  const queryClient = useQueryClient();
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
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [draftFilterPackageNumber, setDraftFilterPackageNumber] =
    useState<string>("全部");
  const [draftFilterProductStatus, setDraftFilterProductStatus] =
    useState<string>("全部");
  const [draftFilterPayer, setDraftFilterPayer] = useState<string>("全部");
  const [rowFieldError, setRowFieldError] = useState<string | null>(null);
  const [isEditPackageFeeDialogOpen, setIsEditPackageFeeDialogOpen] =
    useState(false);
  const [packageToEditFee, setPackageToEditFee] = useState<string | null>(null);
  const [editPackageFeeValue, setEditPackageFeeValue] = useState("0");
  const [editPackageFeeError, setEditPackageFeeError] = useState<string | null>(
    null,
  );
  const [settlePackageError, setSettlePackageError] = useState<string | null>(null);
  const [dismissedRowsError, setDismissedRowsError] = useState<string | null>(null);
  const [isSettlePackageDialogOpen, setIsSettlePackageDialogOpen] = useState(false);
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
        pageSize: PACKAGE_PAGE_SIZE,
      });
      if (res.error) {
        throw new Error(res.error.message);
      }
      return {
        rows: (res.data ?? []).map(orderToPackageTableRow),
        count: res.count,
      };
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

  const invalidatePackageRows = () => {
    void queryClient.invalidateQueries({ queryKey: [PACKAGE_ROWS_QUERY_KEY] });
  };
  const createPackageMutation = useMutation({
    mutationFn: createPackage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PACKAGE_NUMBERS_QUERY_KEY });
      invalidatePackageRows();
    },
  });
  const updateOrderFieldMutation = useMutation({
    mutationFn: async (args: { id: string; patch: Parameters<typeof updateOrderFields>[1] }) => {
      const { error } = await updateOrderFields(args.id, args.patch);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePackageRows(),
  });
  const editPackageFeeMutation = useMutation({
    mutationFn: async (args: { pkg: string; fee: number }) => {
      const { error } = await updatePackageInternationalShippingFeeByNumber(
        args.pkg,
        args.fee,
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
  const totalPages = Math.max(1, Math.ceil(totalRows / PACKAGE_PAGE_SIZE));
  const safeCurrentPage = Math.min(listUrl.page, totalPages);

  useEffect(() => {
    if (safeCurrentPage !== listUrl.page) {
      void setListUrl({ page: safeCurrentPage }, { history: "replace" });
    }
  }, [safeCurrentPage, listUrl.page, setListUrl]);

  const patchListUrl = (
    patch: Partial<{ q: string; pkg: string; product: string; payer: string; page: number }>
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
  const packageNumberOptions = packageNumbersQuery.data ?? EMPTY_PACKAGE_NUMBERS;
  const rowsLoading = rowsQuery.isLoading;
  const rowsError = (rowsQuery.error as Error | null)?.message ?? null;

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
  const groupedRows = useMemo(() => groupPackageRows(rows), [rows]);
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
    if (target?.packageSettled || target?.productStatus === "已出貨") {
      setRowFieldError("商品狀態已出貨後不可再修改");
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

  const handleCreatePackage = async () => {
    setCreatePackageError(null);
    const { data, error } = await createPackageMutation.mutateAsync({
      notes: newPackageNotes.trim() || null,
      internationalShippingFee: Number.parseFloat(newPackageInternationalShippingFee),
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


  const openEditPackageFeeDialog = (pkg: string, currentFee: string) => {
    const group = groupedRows.find((g) => g.label === pkg);
    if (group?.rows[0]?.packageSettled) {
      return;
    }
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
    try {
      await editPackageFeeMutation.mutateAsync({
        pkg: packageToEditFee,
        fee: Number.isNaN(parsed) ? 0 : parsed,
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
            <DialogTrigger
              render={<Button type="button">新增包裹編號</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增包裹編號</DialogTitle>
                <DialogDescription>
                  編號由資料庫自動遞增（1、2、3…）。可填備註。
                </DialogDescription>
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
              Array.from({ length: PACKAGE_PAGE_SIZE }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
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
                  colSpan={16}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  無法載入列表，請見上方錯誤說明。
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={16}
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
              groupedRows.map((group) => (
                <Fragment key={group.label}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell
                      colSpan={15}
                      className="py-3 text-sm font-semibold tracking-tight"
                    >
                      {group.label === "未指定"
                        ? "未指派包裹"
                        : `包裹${group.label}`}
                      {group.rows[0]?.packageSettled === true && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          （已結清）
                        </span>
                      )}
                      {group.label !== "未指定" && (
                        <span className="ml-3 font-normal text-muted-foreground">
                          國際運費: {group.rows[0]?.internationalShippingFee ?? "0"}
                        </span>
                      )}
                      {group.label !== "未指定" &&
                        (group.rows[0]?.packageNotes ?? "") !== "" && (
                          <span
                            className="ml-3 inline-block max-w-[24rem] truncate align-bottom font-normal text-muted-foreground"
                            title={group.rows[0]?.packageNotes ?? ""}
                          >
                            備註: {group.rows[0]?.packageNotes}
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="py-3 space-x-2">
                      {group.label !== "未指定" &&
                        group.rows[0]?.packageSettled !== true && (
                        <Button
                          type="button"
                          variant="default"
                          className="h-8 px-3"
                          disabled={
                            !group.rows.every((r) => r.productStatus === "已出貨") ||
                            settlePackageMutation.isPending
                          }
                          onClick={() => openSettlePackageDialog(group.label)}
                        >
                          結清包裹
                        </Button>
                        )}
                      {group.label !== "未指定" &&
                        group.rows[0]?.packageSettled !== true && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3"
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
                    </TableCell>
                  </TableRow>
                  {group.rows.map((row) => (
                    <TableRow key={row.id}>
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
                      <TableCell className="max-w-32 truncate" title={row.buyer}>
                        {row.buyer}
                      </TableCell>
                      <TableCell>{row.payer}</TableCell>
                      <TableCell className="max-w-32 truncate" title={row.recipientName}>
                        {row.recipientName}
                      </TableCell>
                      <TableCell className="max-w-36 truncate" title={row.phone}>
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
                          disabled={row.packageSettled || row.productStatus === "已出貨"}
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
                <span className="font-semibold">{totals.totalPrice.toLocaleString()}</span>
              </p>
              <p>
                總成本: <span className="font-semibold">{totals.totalCost.toLocaleString()}</span>
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
                收益: <span className="font-semibold">{totals.totalProfit.toLocaleString()}</span>
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
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
