import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

/** Sends signed-in users away from e.g. /login */
export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  }

  if (user) {
    return <Navigate to="/orders" replace />;
  }

  return <Outlet />;
}
