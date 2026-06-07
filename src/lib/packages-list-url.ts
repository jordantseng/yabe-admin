import { createParser, parseAsString, parseAsStringLiteral } from "nuqs";
import {
  ORDERS_PRODUCT_OPTIONS,
  type OrdersListUrlState,
} from "./orders-list-url";

const parseAsPackageFilter = createParser({
  parse(value) {
    const t = value.trim();
    return t === "" ? null : t;
  },
  serialize: String,
}).withDefault("全部");

const parseAsPackagesPage = createParser({
  parse(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) {
      return null;
    }
    return n;
  },
  serialize: String,
}).withDefault(1);

/** Parsers for `/packages` list URL state (use with `useQueryStates` from nuqs). */
export const packagesListSearchParams = {
  q: parseAsString.withDefault(""),
  pkg: parseAsPackageFilter,
  product: parseAsStringLiteral(ORDERS_PRODUCT_OPTIONS).withDefault("全部"),
  payer: parseAsString.withDefault("全部"),
  page: parseAsPackagesPage,
};

export type PackagesListUrlState = {
  q: string;
  pkg: string;
  product: OrdersListUrlState["product"];
  payer: string;
  page: number;
};
