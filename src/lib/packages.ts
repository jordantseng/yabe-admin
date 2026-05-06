import { supabase } from "@/lib/supabase";
import type { PackageRow as PackageRecord, PackageStatus } from "@/types/database";

export type CreatePackageInput = {
  status?: PackageStatus;
  notes?: string | null;
  internationalShippingFee?: number;
};

/**
 * Inserts a row into `packages`; `number` is assigned by DB identity.
 */
export async function createPackage(
  input: CreatePackageInput = {},
): Promise<{
  data: PackageRecord;
}> {
  const notes =
    input.notes !== undefined && input.notes !== null
      ? input.notes.trim() || null
      : null;
  const fee =
    input.internationalShippingFee !== undefined
      ? Number(input.internationalShippingFee)
      : 0;

  const { data, error } = await supabase
    .from("packages")
    .insert({
      status: input.status ?? "open",
      notes,
      international_shipping_fee: Number.isFinite(fee) ? Math.max(0, fee) : 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { data: data as PackageRecord };
}

/** Delete package by human-visible `number` (e.g. 1, 2, 3). */
export async function deletePackageByNumber(
  packageNumber: string,
): Promise<void> {
  const trimmed = packageNumber.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(asInt) || String(asInt) !== trimmed) {
    throw new Error(`無效的包裹編號：${packageNumber}`);
  }

  const { error } = await supabase.from("packages").delete().eq("number", asInt);
  if (error) {
    throw new Error(error.message);
  }
}

/** Update package international shipping fee (and optionally notes) by human-visible `number`. */
export async function updatePackageInternationalShippingFeeByNumber(
  packageNumber: string,
  fee: number,
  notes?: string | null,
): Promise<void> {
  const trimmed = packageNumber.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(asInt) || String(asInt) !== trimmed) {
    throw new Error(`無效的包裹編號：${packageNumber}`);
  }
  const normalized = Number.isFinite(fee) ? Math.max(0, fee) : 0;
  const payload: {
    international_shipping_fee: number;
    notes?: string | null;
  } = { international_shipping_fee: normalized };
  if (notes !== undefined) {
    payload.notes = notes === null ? null : String(notes).trim() || null;
  }
  const { error } = await supabase
    .from("packages")
    .update(payload)
    .eq("number", asInt);
  if (error) {
    throw new Error(error.message);
  }
}

/** Mark package as settled by human-visible `number`. */
export async function settlePackageByNumber(
  packageNumber: string,
): Promise<void> {
  const trimmed = packageNumber.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(asInt) || String(asInt) !== trimmed) {
    throw new Error(`無效的包裹編號：${packageNumber}`);
  }
  const { error } = await supabase
    .from("packages")
    .update({ is_settled: true })
    .eq("number", asInt);
  if (error) {
    throw new Error(error.message);
  }
}

/** Next `packages.number` that the DB will assign (identity sequence peek; no insert). */
export async function peekNextPackageNumber(): Promise<{
  data: number | null;
}> {
  const { data, error } = await supabase.rpc("peek_next_package_number");
  if (error) throw new Error(error.message);
  if (data == null) return { data: null };
  const n = typeof data === "number" ? data : Number(data);
  return {
    data: Number.isFinite(n) ? n : null,
  };
}

/** All `packages.number` as strings, ascending (for dropdowns / filters). */
export async function fetchPackageNumbersFromDb(): Promise<{
  data: string[];
}> {
  const res = await fetchPackages();
  const nums = (res.data ?? [])
    .map((p) => String(p.number))
    .sort((a, b) => Number(a) - Number(b));
  return { data: nums };
}

/** Full rows, newest `number` first. */
export async function fetchPackages(): Promise<{
  data: PackageRecord[];
}> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("number", { ascending: false });

  if (error) throw new Error(error.message);
  return { data: (data as PackageRecord[] | null) ?? [] };
}
