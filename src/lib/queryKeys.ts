import type { OrdersListUrlState } from "@/lib/orders-list-url";
import type { PackagesListUrlState } from "@/lib/packages-list-url";

/**
 * Centralized React Query keys.
 *
 * Rules:
 * - Keep them JSON-serializable.
 * - Prefer stable primitives over object identity when the key is derived from URL state.
 * - Expose factory helpers so pages/components don't re-encode key logic.
 */

export const ordersKeys = {
  all: () => ["orders"] as const,
  lists: () => ["orders", "list"] as const,
  list: (listUrl: OrdersListUrlState) =>
    [...ordersKeys.lists(), listUrl] as const,

  totals: () => ["orders", "totals"] as const,
  totalsForList: (listUrl: OrdersListUrlState) =>
    [
      ...ordersKeys.totals(),
      listUrl.q,
      listUrl.payment,
      listUrl.product,
      listUrl.pkg,
    ] as const,
};

export const packagesKeys = {
  all: () => ["packages"] as const,
  pageRows: () => ["packages", "page-rows"] as const,
  pageRowsForList: (listUrl: PackagesListUrlState) =>
    [...packagesKeys.pageRows(), listUrl] as const,

  numbers: () => ["packages", "numbers"] as const,
  nextNumberPeek: () => ["packages", "next-number-peek"] as const,
};

