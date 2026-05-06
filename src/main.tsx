import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { captureInvitePendingPasswordSetup } from "@/lib/auth-password-setup";
import { supabase } from "@/lib/supabase";
import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
    },
  },
});

/**
 * 1) 邀請／magic link：token 可能在 `#`（implicit）或 `?code=`（PKCE）。
 *    從信箱開連結時通常沒有 PKCE verifier，GoTrue 會略過 URL → 必須在 Router 渲染前處理。
 * 2) 若僅有 `?code=` 且第一次 initialize 沒建立 session，再試 `exchangeCodeForSession`
 *    （implicit 流程可不帶 verifier；仍失敗則多半是 Redirect URL / 連結過期）。
 */
async function bootstrap() {
  captureInvitePendingPasswordSetup();
  await supabase.auth.getSession();

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && import.meta.env.DEV) {
      console.warn("[auth] exchangeCodeForSession:", error.message);
    }
  }

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
