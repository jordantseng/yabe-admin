import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import {
  isPasswordConfigured,
  isPendingPasswordSetup,
} from "@/lib/auth-password-setup";

/**
 * 邀請進站且尚未寫入 user_metadata.password_configured 時，僅允許 `/set-password`。
 */
export function RequirePasswordSetup() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  }

  if (!user) {
    return <Outlet />;
  }

  const pending = isPendingPasswordSetup();
  const done = isPasswordConfigured(user);

  if (pending && !done && location.pathname !== "/set-password") {
    return <Navigate to="/set-password" replace />;
  }

  return <Outlet />;
}
