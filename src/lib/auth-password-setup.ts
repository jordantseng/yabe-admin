/** sessionStorage：邀請連結進站（需在 auth 吃掉 URL 前寫入） */
export const PENDING_PASSWORD_SETUP_KEY = "yabe_pending_password_setup";

/**
 * 邀請信導回時，`type=invite` 可能在 hash 或 query（需在第一次 `getSession()` 前呼叫）。
 */
export function captureInvitePendingPasswordSetup(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const typeFromHash = hashParams.get("type");
    const typeFromQuery = url.searchParams.get("type");
    if (typeFromHash === "invite" || typeFromQuery === "invite") {
      sessionStorage.setItem(PENDING_PASSWORD_SETUP_KEY, "1");
    }
  } catch {
    // ignore
  }
}

export function clearPendingPasswordSetupFlag(): void {
  sessionStorage.removeItem(PENDING_PASSWORD_SETUP_KEY);
}

export function isPendingPasswordSetup(): boolean {
  return sessionStorage.getItem(PENDING_PASSWORD_SETUP_KEY) === "1";
}

export function isPasswordConfigured(user: {
  user_metadata?: Record<string, unknown> | null;
}): boolean {
  return user.user_metadata?.password_configured === true;
}
