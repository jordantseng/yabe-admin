import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import FormField from "@/components/FormField";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useAuth } from "@/auth/useAuth";

const REQUIRED_MSG = "此欄位為必填";

type LoginForm = {
  email: string;
  password: string;
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/orders";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    const { error } = await signInWithPassword(
      values.email.trim(),
      values.password
    );
    if (error) {
      setFormError(error);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold">登入</h1>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Email"
            requiredMark
            error={errors.email?.message}
            errorId="login-email-error"
          >
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={
                !!errors.email || !!formError ? true : undefined
              }
              aria-describedby={
                errors.email
                  ? "login-email-error"
                  : formError
                    ? "login-form-error"
                    : undefined
              }
              {...register("email", {
                required: REQUIRED_MSG,
                validate: (v) => v.trim() !== "" || REQUIRED_MSG,
              })}
            />
          </FormField>
          <FormField
            label="密碼"
            requiredMark
            error={errors.password?.message}
            errorId="login-password-error"
          >
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={
                !!errors.password || !!formError ? true : undefined
              }
              aria-describedby={
                errors.password
                  ? "login-password-error"
                  : formError
                    ? "login-form-error"
                    : undefined
              }
              {...register("password", {
                required: REQUIRED_MSG,
                validate: (v) => v.trim() !== "" || REQUIRED_MSG,
              })}
            />
          </FormField>
          {formError && (
            <p
              id="login-form-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "登入中…" : "登入"}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default LoginPage;
