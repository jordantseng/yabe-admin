import type { Result } from "neverthrow";
import type { ServiceError } from "@/lib/service-error";

/** 給 React Query `queryFn` / `mutationFn` 等仍依賴 throw 的銜接點使用。 */
export function unwrapResultOrThrow<T>(r: Result<T, ServiceError>): T {
  if (r.isErr()) {
    throw new Error(r.error.message);
  }
  return r.value;
}
