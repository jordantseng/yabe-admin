import { createParser, parseAsString, parseAsStringLiteral } from "nuqs";

export const ORDERS_PAYMENT_OPTIONS = [
  "全部",
  "未收款",
  "已收款",
  "已入帳",
] as const;

export const ORDERS_PRODUCT_OPTIONS = [
  "全部",
  "未購買",
  "已購買",
  "到虹家",
  "集運回台",
  "到台灣",
  "已出貨",
] as const;

export const ORDERS_SORT_OPTIONS = ["asc", "desc"] as const;

const parseAsOrdersPage = createParser({
  parse(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) {
      return null;
    }
    return n;
  },
  serialize: String,
}).withDefault(1);

const parseAsPackageFilter = createParser({
  parse(value) {
    const t = value.trim();
    return t === "" ? null : t;
  },
  serialize: String,
}).withDefault("全部");

/**
 * Parsers for `/orders` list URL state (use with `useQueryStates` from nuqs).
 */
export const ordersListSearchParams = {
  q: parseAsString.withDefault(""),
  payment: parseAsStringLiteral(ORDERS_PAYMENT_OPTIONS).withDefault("全部"),
  product: parseAsStringLiteral(ORDERS_PRODUCT_OPTIONS).withDefault("全部"),
  pkg: parseAsPackageFilter,
  sort: parseAsStringLiteral(ORDERS_SORT_OPTIONS).withDefault("desc"),
  page: parseAsOrdersPage,
};

export type OrdersListUrlState = {
  q: string;
  payment: (typeof ORDERS_PAYMENT_OPTIONS)[number];
  product: (typeof ORDERS_PRODUCT_OPTIONS)[number];
  pkg: string;
  sort: (typeof ORDERS_SORT_OPTIONS)[number];
  page: number;
};
