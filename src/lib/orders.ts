import { err, ok, type Result } from "neverthrow";
import { supabase } from "@/lib/supabase";
import type { ServiceError } from "@/lib/service-error";
import type { OrderRow as OrderRecord } from "@/types/database";

/** Order row from `select('*, packages(number)')`. */
export type OrderWithPackageNumber = OrderRecord & {
  packages: {
    number: number;
    international_shipping_fee?: number;
    notes?: string | null;
    is_settled?: boolean;
  } | null;
};

/** Human-visible package group label for an order row (與包裹頁分組一致). */
export function packageNumberLabelFromOrderRow(row: OrderWithPackageNumber): string {
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

/** 資料庫有包裹、但目前篩選結果內沒有任何訂單時，仍顯示分組標題用。 */
export type PackagePageEmptyPackageStub = {
  number: string;
  notes: string;
  internationalShippingFee: number;
  isSettled: boolean;
};

export type OrdersTableRow = {
  id: string;
  item: string;
  notes: string;
  purchaseDate: string;
  recipientName: string;
  phone: string;
  quantity: string;
  buyer: string;
  payer: OrderRecord["payer"];
  cost: string;
  price: string;
  domesticShippingFee: string;
  revenue: string;
  paymentStatus: OrderRecord["payment_status"];
  productStatus: OrderRecord["product_status"];
  packageNumber: string;
};

export type OrderDetailFormValues = {
  item: string;
  notes: string;
  purchaseDate: string;
  recipientName: string;
  phone: string;
  quantity: number;
  buyer: string;
  domesticDeliveryAddress: string;
  payer: string;
  cost: number;
  price: number;
  domesticShippingFee: number;
  revenue: number;
  paymentStatus: string;
  productStatus: string;
  packageNumber: string;
};

function purchaseDateFromRecord(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

/** 收益 = 售價 − 成本 (matches DB generated column). */
export function revenueFromCostPrice(
  cost: string | number,
  price: string | number,
): number {
  const c = typeof cost === "string" ? Number.parseFloat(cost) : Number(cost);
  const p = typeof price === "string" ? Number.parseFloat(price) : Number(price);
  const nc = Number.isNaN(c) ? 0 : c;
  const np = Number.isNaN(p) ? 0 : p;
  return np - nc;
}

export function revenueStringFromCostPrice(
  cost: string | number,
  price: string | number,
): string {
  return String(revenueFromCostPrice(cost, price));
}

export function orderRecordToTableRow(row: OrderRecord): OrdersTableRow {
  return {
    id: row.id,
    item: row.item,
    notes: row.notes ?? "",
    purchaseDate: purchaseDateFromRecord(row.purchase_date),
    recipientName: row.recipient_name ?? row.buyer,
    phone: row.recipient_phone ?? "",
    quantity: String(row.quantity),
    buyer: row.buyer,
    payer: row.payer,
    cost: String(row.cost),
    price: String(row.price),
    domesticShippingFee: String(row.domestic_shipping_fee),
    revenue: revenueStringFromCostPrice(row.cost, row.price),
    paymentStatus: row.payment_status,
    productStatus: row.product_status,
    packageNumber: row.package_number,
  };
}

export function orderRecordToDetailForm(row: OrderRecord): OrderDetailFormValues {
  return {
    item: row.item,
    notes: row.notes ?? "",
    purchaseDate: purchaseDateFromRecord(row.purchase_date),
    recipientName: row.recipient_name ?? "",
    phone: row.recipient_phone ?? "",
    quantity: Number(row.quantity),
    buyer: row.buyer,
    domesticDeliveryAddress: row.domestic_delivery_address ?? "",
    payer: row.payer,
    cost: Number(row.cost),
    price: Number(row.price),
    domesticShippingFee: Number(row.domestic_shipping_fee),
    revenue: revenueFromCostPrice(row.cost, row.price),
    paymentStatus: row.payment_status,
    productStatus: row.product_status,
    packageNumber: row.package_number,
  };
}

export type FetchOrdersOptions = {
  itemSearch?: string;
  paymentStatus?: string;
  productStatus?: string;
  packageNumber?: string;
  sortPurchaseDate?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function escapeIlikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** PostgREST `.or()` 內文字欄位值用雙引號包起，避免 `未指定` 等被誤判。 */
function postgrestFilterQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOrderListFilters(query: any, options: FetchOrdersOptions) {
  let q = query;
  const trimmedItem = options.itemSearch?.trim() ?? "";
  if (trimmedItem.length > 0) {
    q = q.ilike("item", `%${escapeIlikePattern(trimmedItem)}%`);
  }
  const pay = options.paymentStatus?.trim();
  if (pay && pay !== "全部") q = q.eq("payment_status", pay);
  const prod = options.productStatus?.trim();
  if (prod && prod !== "全部") q = q.eq("product_status", prod);
  const pkg = options.packageNumber?.trim();
  if (pkg && pkg !== "全部") q = q.eq("package_number", pkg);
  return q;
}

export type FetchOrdersTotalsResult = {
  totalCost: number;
  totalProfit: number;
};

export async function fetchOrdersTotals(
  options: FetchOrdersOptions = {},
): Promise<Result<FetchOrdersTotalsResult, ServiceError>> {
  let query = supabase.from("orders").select("cost, price");
  query = applyOrderListFilters(query, options);
  const { data, error } = await query;

  if (error) return err({ message: error.message });

  let totalCost = 0;
  let totalProfit = 0;
  for (const row of data ?? []) {
    const c = Number(row.cost);
    totalCost += Number.isNaN(c) ? 0 : c;
    totalProfit += revenueFromCostPrice(row.cost, row.price);
  }
  return ok({ totalCost, totalProfit });
}

export type CreateOrderInput = {
  item: string;
  notes?: string;
  purchaseDate: string;
  recipientName?: string;
  phone?: string;
  quantity: number;
  buyer: string;
  domesticDeliveryAddress?: string;
  payer: OrderRecord["payer"];
  cost: number;
  price: number;
  domesticShippingFee: number;
  paymentStatus: OrderRecord["payment_status"];
  productStatus: OrderRecord["product_status"];
  packageNumber: string;
};

export async function createOrder(
  input: CreateOrderInput,
): Promise<Result<OrderRecord, ServiceError>> {
  const purchaseDate =
    input.purchaseDate.trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      item: input.item.trim(),
      notes: input.notes?.trim() || null,
      purchase_date: purchaseDate,
      recipient_name: (input.recipientName ?? "").trim() || null,
      recipient_phone: (input.phone ?? "").trim() || null,
      quantity: Number.isFinite(input.quantity) ? Math.max(1, Math.trunc(input.quantity)) : 1,
      buyer: input.buyer.trim(),
      domestic_delivery_address: (input.domesticDeliveryAddress ?? "").trim(),
      payer: input.payer,
      cost: input.cost,
      price: input.price,
      domestic_shipping_fee: Number.isFinite(input.domesticShippingFee)
        ? Math.max(0, input.domesticShippingFee)
        : 0,
      payment_status: input.paymentStatus,
      product_status: input.productStatus,
      package_number: input.packageNumber,
    })
    .select()
    .single();

  if (error) return err({ message: error.message });
  return ok(data as OrderRecord);
}

export async function fetchOrders(
  options: FetchOrdersOptions = {},
): Promise<
  Result<{ data: OrderRecord[]; count: number }, ServiceError>
> {
  const sortDir = options.sortPurchaseDate ?? "desc";
  const ascending = sortDir === "asc";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 5));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("orders").select("*", { count: "exact" });
  query = applyOrderListFilters(query, options);
  query = query
    .order("purchase_date", { ascending })
    .order("created_at", { ascending })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) return err({ message: error.message });
  return ok({
    data: (data as OrderRecord[] | null) ?? [],
    count: count ?? 0,
  });
}

export type FetchOrdersForPackagePageOptions = {
  itemSearch?: string;
  /** `全部` | numeric (`1`, `2`) | legacy `package_number`（僅限已指派 `package_id`） */
  packageFilter?: string;
  productStatus?: string;
  /** `全部` | `虹` | `藍` */
  payer?: string;
  page?: number;
  /** 每頁幾個包裹分組（預設 2；依建立時間新→舊分頁） */
  packagesPerPage?: number;
};

type PkgListRow = {
  id: string;
  number: number;
  notes: string | null;
  international_shipping_fee: number;
  is_settled: boolean;
  created_at: string;
};

/**
 * 包裹頁：以 **包裹** 分頁。排序為 **新→舊**（`packages.created_at` 遞減，同時間則 `number` 遞減）。
 * 只載入本頁包裹底下訂單；第 1 頁且篩選「全部」時併入 `未指定` 訂單。
 * `count` = 用於分頁的包裹總數；`emptyPackageStubs` = 本頁包裹在篩選後無訂單時仍顯示空分組。
 */
export async function fetchOrdersForPackagePage(
  options: FetchOrdersForPackagePageOptions = {},
): Promise<
  Result<
    {
      data: OrderWithPackageNumber[];
      count: number;
      emptyPackageStubs: PackagePageEmptyPackageStub[];
    },
    ServiceError
  >
> {
  const raw = options.packageFilter?.trim() ?? "全部";
  const pkgFilter = raw === "未指定" ? "全部" : raw;
  const page = Math.max(1, options.page ?? 1);
  const packagesPerPage = Math.min(50, Math.max(1, options.packagesPerPage ?? 2));

  const { data: pkgs, error: pkgsError } = await supabase
    .from("packages")
    .select("id, number, notes, international_shipping_fee, is_settled, created_at");
  if (pkgsError) {
    return err({ message: pkgsError.message });
  }

  const pkgRows = ((pkgs ?? []) as PkgListRow[]).slice().sort((a, b) => {
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    const na = Number.isFinite(ta) ? ta : 0;
    const nb = Number.isFinite(tb) ? tb : 0;
    if (nb !== na) return nb - na;
    return b.number - a.number;
  });
  const packageNumbers = new Set(pkgRows.map((p) => String(p.number)));

  let pagePackages: PkgListRow[];
  let packageCountForPagination: number;

  if (pkgFilter === "全部") {
    packageCountForPagination = pkgRows.length;
    const fromPkg = (page - 1) * packagesPerPage;
    pagePackages = pkgRows.slice(fromPkg, fromPkg + packagesPerPage);
  } else {
    const asInt = Number.parseInt(pkgFilter, 10);
    const matching = pkgRows.filter((p) => {
      if (Number.isFinite(asInt) && String(asInt) === pkgFilter) {
        return p.number === asInt;
      }
      return String(p.number) === pkgFilter;
    });
    packageCountForPagination = matching.length;
    pagePackages = matching;
  }

  const orParts: string[] = [];
  if (pagePackages.length > 0) {
    const ids = pagePackages.map((p) => p.id).join(",");
    const nums = pagePackages
      .map((p) => postgrestFilterQuoted(String(p.number)))
      .join(",");
    orParts.push(`package_id.in.(${ids})`);
    orParts.push(`package_number.in.(${nums})`);
  }
  if (page === 1 && pkgFilter === "全部") {
    orParts.push(
      `and(package_id.is.null,package_number.eq.${postgrestFilterQuoted("未指定")})`,
    );
  }

  if (orParts.length === 0) {
    const emptyStubs: PackagePageEmptyPackageStub[] = pagePackages.map((p) => ({
      number: String(p.number),
      notes: p.notes?.trim() ?? "",
      internationalShippingFee: p.international_shipping_fee ?? 0,
      isSettled: p.is_settled === true,
    }));
    return ok({
      data: [],
      count: packageCountForPagination,
      emptyPackageStubs: emptyStubs,
    });
  }

  let query = supabase
    .from("orders")
    .select("*, packages(number, international_shipping_fee, notes, is_settled)")
    .or(orParts.join(","))
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  const itemSearch = options.itemSearch?.trim() ?? "";
  if (itemSearch.length > 0) {
    query = query.ilike("item", `%${escapeIlikePattern(itemSearch)}%`);
  }
  const prod = options.productStatus?.trim();
  if (prod && prod !== "全部") {
    query = query.eq("product_status", prod);
  }
  const payerFilter = options.payer?.trim() ?? "全部";
  if (payerFilter === "虹" || payerFilter === "藍") {
    query = query.eq("payer", payerFilter);
  }

  const { data, error } = await query;

  if (error) return err({ message: error.message });

  const pageNumSet = new Set(pagePackages.map((p) => String(p.number)));
  const pageIdSet = new Set(pagePackages.map((p) => p.id));

  const scoped = ((data as OrderWithPackageNumber[] | null) ?? []).filter((row) => {
    const label = packageNumberLabelFromOrderRow(row);
    if (label === "未指定") {
      return page === 1 && pkgFilter === "全部";
    }
    const byFk = row.package_id != null && pageIdSet.has(row.package_id);
    const byLegacy =
      !!row.package_number &&
      row.package_number !== "未指定" &&
      pageNumSet.has(row.package_number) &&
      packageNumbers.has(row.package_number);
    return byFk || byLegacy;
  });

  const sorted = [...scoped].sort((a, b) => {
    const buyerCmp = a.buyer.localeCompare(b.buyer, "zh-Hant");
    if (buyerCmp !== 0) return buyerCmp;
    const aDate = Date.parse(a.purchase_date);
    const bDate = Date.parse(b.purchase_date);
    return bDate - aDate;
  });

  const packageNumbersWithOrders = new Set<string>();
  for (const row of sorted) {
    packageNumbersWithOrders.add(packageNumberLabelFromOrderRow(row));
  }

  const emptyPackageStubs: PackagePageEmptyPackageStub[] = [];
  for (const p of pagePackages) {
    const label = String(p.number);
    if (!packageNumbersWithOrders.has(label)) {
      emptyPackageStubs.push({
        number: label,
        notes: p.notes?.trim() ?? "",
        internationalShippingFee: p.international_shipping_fee ?? 0,
        isSettled: p.is_settled === true,
      });
    }
  }

  return ok({
    data: sorted,
    count: packageCountForPagination,
    emptyPackageStubs,
  });
}

export type OrderListFieldsPatch = {
  payer?: OrderRecord["payer"];
  paymentStatus?: OrderRecord["payment_status"];
  productStatus?: OrderRecord["product_status"];
  packageNumber?: string;
};

export async function updateOrderFields(
  orderId: string,
  patch: OrderListFieldsPatch,
): Promise<Result<void, ServiceError>> {
  const needsExistingStateCheck = patch.productStatus !== undefined;
  const needsProductStatusCheck = patch.productStatus === "已出貨";
  const isLockedFieldPatch =
    patch.payer !== undefined ||
    patch.paymentStatus !== undefined ||
    patch.packageNumber !== undefined;
  if (isLockedFieldPatch || needsProductStatusCheck || needsExistingStateCheck) {
    const { data: existing, error: existingError } = await supabase
      .from("orders")
      .select("product_status, payment_status")
      .eq("id", orderId)
      .single();
    if (existingError) return err({ message: existingError.message });
    if (existing?.product_status === "已出貨") {
      if (
        patch.productStatus !== undefined &&
        patch.productStatus !== existing.product_status
      ) {
        return err({ message: "商品狀態已出貨後不可再修改" });
      }
      return err({
        message: "商品狀態已出貨，不能修改付款人、收款狀態或包裹編號",
      });
    }
    if (needsProductStatusCheck && existing?.payment_status !== "已入帳") {
      return err({
        message: "收款狀態尚未入帳，不能將商品狀態改為已出貨",
      });
    }
  }

  const row: Record<string, string | null> = {};
  if (patch.payer !== undefined) row.payer = patch.payer;
  if (patch.paymentStatus !== undefined) row.payment_status = patch.paymentStatus;
  if (patch.productStatus !== undefined) row.product_status = patch.productStatus;
  if (patch.packageNumber !== undefined) {
    const packageNumber = patch.packageNumber.trim();
    row.package_number = packageNumber;

    if (packageNumber === "未指定") {
      row.package_id = null;
    } else {
      const asInt = Number.parseInt(packageNumber, 10);
      if (Number.isFinite(asInt) && String(asInt) === packageNumber) {
        const { data: pkgRow, error: pkgErr } = await supabase
          .from("packages")
          .select("id")
          .eq("number", asInt)
          .maybeSingle();
        if (pkgErr) return err({ message: pkgErr.message });
        if (!pkgRow) {
          return err({ message: `找不到包裹編號 ${packageNumber}` });
        }
        row.package_id = pkgRow.id;
      } else {
        row.package_id = null;
      }
    }
  }

  if (Object.keys(row).length === 0) return ok(undefined);

  const { error } = await supabase.from("orders").update(row).eq("id", orderId);
  if (error) return err({ message: error.message });
  return ok(undefined);
}

export async function updateOrderFromDetailForm(
  orderId: string,
  values: OrderDetailFormValues,
): Promise<Result<OrderRecord, ServiceError>> {
  const { data: existing, error: existingError } = await supabase
    .from("orders")
    .select(
      "product_status, payer, payment_status, package_number, item, notes, purchase_date, recipient_name, recipient_phone, quantity, buyer, domestic_delivery_address, cost, price, domestic_shipping_fee",
    )
    .eq("id", orderId)
    .single();
  if (existingError) return err({ message: existingError.message });

  const purchaseDate =
    values.purchaseDate.trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const safeCost = Number.isFinite(values.cost) ? values.cost : 0;
  const safePrice = Number.isFinite(values.price) ? values.price : 0;
  const safeDomesticShippingFee = Number.isFinite(values.domesticShippingFee)
    ? values.domesticShippingFee
    : 0;

  if (existing?.product_status === "已出貨") {
    const nextPackageNumber = values.packageNumber.trim();
    const hasLockedFieldChanged =
      existing.payer !== values.payer ||
      existing.payment_status !== values.paymentStatus ||
      existing.package_number !== nextPackageNumber;
    const hasProductStatusChanged = values.productStatus !== existing.product_status;
    if (hasProductStatusChanged) {
      return err({ message: "商品狀態已出貨後不可再修改" });
    }
    if (hasLockedFieldChanged) {
      return err({
        message: "商品狀態已出貨，不能修改付款人、收款狀態或包裹編號",
      });
    }
    const hasDisallowedFieldChanged =
      existing.item !== values.item.trim() ||
      (existing.notes ?? "") !== (values.notes.trim() || "") ||
      purchaseDateFromRecord(existing.purchase_date) !== purchaseDate ||
      (existing.recipient_name ?? "") !== (values.recipientName.trim() || null) ||
      (existing.recipient_phone ?? "") !== (values.phone.trim() || null) ||
      Number(existing.quantity) !==
        (Number.isFinite(values.quantity)
          ? Math.max(1, Math.trunc(values.quantity))
          : 1) ||
      existing.buyer !== values.buyer.trim() ||
      (existing.domestic_delivery_address ?? "") !==
        values.domesticDeliveryAddress.trim() ||
      Number(existing.price) !== safePrice ||
      Number(existing.domestic_shipping_fee) !== safeDomesticShippingFee;
    if (hasDisallowedFieldChanged) {
      return err({ message: "商品狀態已出貨後只能修改成本" });
    }
  }

  if (values.productStatus === "已出貨" && values.paymentStatus !== "已入帳") {
    return err({
      message: "收款狀態尚未入帳，不能將商品狀態改為已出貨",
    });
  }

  const packageNumber = values.packageNumber.trim();
  let packageId: string | null = null;
  if (packageNumber !== "未指定") {
    const asInt = Number.parseInt(packageNumber, 10);
    if (Number.isFinite(asInt) && String(asInt) === packageNumber) {
      const { data: pkgRow, error: pkgErr } = await supabase
        .from("packages")
        .select("id")
        .eq("number", asInt)
        .maybeSingle();
      if (pkgErr) return err({ message: pkgErr.message });
      if (!pkgRow) {
        return err({ message: `找不到包裹編號 ${packageNumber}` });
      }
      packageId = pkgRow.id;
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      item: values.item.trim(),
      notes: values.notes.trim() || null,
      purchase_date: purchaseDate,
      recipient_name: values.recipientName.trim() || null,
      recipient_phone: values.phone.trim() || null,
      quantity: Number.isFinite(values.quantity) ? Math.max(1, Math.trunc(values.quantity)) : 1,
      buyer: values.buyer.trim(),
      domestic_delivery_address: values.domesticDeliveryAddress.trim(),
      payer: values.payer as OrderRecord["payer"],
      cost: safeCost,
      price: safePrice,
      domestic_shipping_fee: safeDomesticShippingFee,
      payment_status: values.paymentStatus as OrderRecord["payment_status"],
      product_status: values.productStatus as OrderRecord["product_status"],
      package_number: packageNumber,
      package_id: packageId,
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) return err({ message: error.message });
  return ok(data as OrderRecord);
}

export async function deleteOrderById(
  orderId: string,
): Promise<Result<void, ServiceError>> {
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) return err({ message: error.message });
  return ok(undefined);
}

export async function fetchOrderById(
  orderId: string,
): Promise<Result<OrderRecord | null, ServiceError>> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return err({ message: error.message });
  return ok(data as OrderRecord | null);
}
