import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient();

/**
 * 邀請／magic link 會把 access_token 放在 `location.hash`。
 * 必須在 React Router 做任何 `<Navigate>` 之前完成 auth `initialize`，
 * 否則導向 `/orders` 或 `/login` 會先換掉網址，hash 消失就無法建立 session。
 */
async function bootstrap() {
  await supabase.auth.getSession();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NuqsAdapter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </NuqsAdapter>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
