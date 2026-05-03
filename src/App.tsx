import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GuestRoute } from "@/components/GuestRoute";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequirePasswordSetup } from "@/components/RequirePasswordSetup";
import LoginPage from "@/pages/LoginPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import OrdersPage from "@/pages/OrdersPage";
import PackagePage from "@/pages/PackagePage";
import SetPasswordPage from "@/pages/SetPasswordPage";

function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route element={<RequirePasswordSetup />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/packages" element={<PackagePage />} />
            <Route path="*" element={<Navigate to="/orders" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
