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
  data: PackageRecord | null;
  error: { message: string } | null;
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

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: data as PackageRecord, error: null };
}

/** Delete package by human-visible `number` (e.g. 1, 2, 3). */
export async function deletePackageByNumber(
  packageNumber: string,
): Promise<{ error: { message: string } | null }> {
  const trimmed = packageNumber.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(asInt) || String(asInt) !== trimmed) {
    return { error: { message: `無效的包裹編號：${packageNumber}` } };
  }

  const { error } = await supabase.from("packages").delete().eq("number", asInt);
  if (error) {
    return { error: { message: error.message } };
  }
  return { error: null };
}

/** Update package international shipping fee by human-visible `number`. */
export async function updatePackageInternationalShippingFeeByNumber(
  packageNumber: string,
  fee: number,
): Promise<{ error: { message: string } | null }> {
  const trimmed = packageNumber.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(asInt) || String(asInt) !== trimmed) {
    return { error: { message: `無效的包裹編號：${packageNumber}` } };
  }
  const normalized = Number.isFinite(fee) ? Math.max(0, fee) : 0;
  const { error } = await supabase
    .from("packages")
    .update({ international_shipping_fee: normalized })
    .eq("number", asInt);
  if (error) {
    return { error: { message: error.message } };
  }
  return { error: null };
}

/** Mark package as settled by human-visible `number`. */
export async function settlePackageByNumber(
  packageNumber: string,
): Promise<{ error: { message: string } | null }> {
  const trimmed = packageNumber.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(asInt) || String(asInt) !== trimmed) {
    return { error: { message: `無效的包裹編號：${packageNumber}` } };
  }
  const { error } = await supabase
    .from("packages")
    .update({ is_settled: true })
    .eq("number", asInt);
  if (error) {
    return { error: { message: error.message } };
  }
  return { error: null };
}

/** Next `packages.number` that the DB will assign (identity sequence peek; no insert). */
export async function peekNextPackageNumber(): Promise<{
  data: number | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase.rpc("peek_next_package_number");
  if (error) {
    return { data: null, error: { message: error.message } };
  }
  if (data == null) {
    return { data: null, error: null };
  }
  const n = typeof data === "number" ? data : Number(data);
  return {
    data: Number.isFinite(n) ? n : null,
    error: null,
  };
}

/** All `packages.number` as strings, ascending (for dropdowns / filters). */
export async function fetchPackageNumbersFromDb(): Promise<{
  data: string[] | null;
  error: { message: string } | null;
}> {
  const res = await fetchPackages();
  if (res.error) {
    return { data: null, error: res.error };
  }
  const nums = (res.data ?? [])
    .map((p) => String(p.number))
    .sort((a, b) => Number(a) - Number(b));
  return { data: nums, error: null };
}

/** Full rows, newest `number` first. */
export async function fetchPackages(): Promise<{
  data: PackageRecord[] | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("number", { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: (data as PackageRecord[] | null) ?? [], error: null };
}
