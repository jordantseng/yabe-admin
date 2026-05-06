import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import {
  clearPendingPasswordSetupFlag,
} from "@/lib/auth-password-setup";

type FormValues = {
  password: string;
  confirmPassword: string;
};

const MIN_LENGTH = 8;

function SetPasswordPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const password = values.password.trim();
    const confirm = values.confirmPassword.trim();
    if (password.length < MIN_LENGTH) {
      setFormError(`密碼至少 ${MIN_LENGTH} 個字元。`);
      return;
    }
    if (password !== confirm) {
      setFormError("兩次輸入的密碼不一致。");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_configured: true },
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    clearPendingPasswordSetupFlag();
    navigate("/orders", { replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold">設定登入密碼</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            請設定此帳號之後用來登入後台的密碼（至少 {MIN_LENGTH}
            個字元）。
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="set-pw-1" className="text-sm font-medium">
              新密碼
            </label>
            <Input
              id="set-pw-1"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!formError}
              {...register("password", { required: true })}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="set-pw-2" className="text-sm font-medium">
              確認密碼
            </label>
            <Input
              id="set-pw-2"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!formError}
              {...register("confirmPassword", { required: true })}
            />
          </div>
          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "儲存中…" : "完成設定"}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default SetPasswordPage;
