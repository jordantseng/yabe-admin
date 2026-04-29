/**
 * Same-tab sync when package list changes (e.g. after createPackage).
 * Options are loaded from Supabase via fetchPackageNumbersFromDb — not localStorage.
 */
export const PACKAGE_NUMBER_OPTIONS_CHANGED_EVENT =
  "yabe:package-number-options-changed";

export function notifyPackageNumberOptionsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PACKAGE_NUMBER_OPTIONS_CHANGED_EVENT));
}
