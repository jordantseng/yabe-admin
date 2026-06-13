import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { XIcon } from "lucide-react";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SnackbarVariant = "default" | "error" | "warning" | "success";

type SnackbarAction = {
  label: string;
  onClick: () => void;
};

type SnackbarItem = {
  id: number;
  message: string;
  variant: SnackbarVariant;
  duration: number;
  action?: SnackbarAction;
};

type ShowSnackbarOptions = {
  variant?: SnackbarVariant;
  duration?: number;
  action?: SnackbarAction;
};

type SnackbarContextValue = {
  showSnackbar: (message: string, options?: ShowSnackbarOptions) => void;
};

const DEFAULT_DURATION_MS = 5000;

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

function snackbarVariantClass(variant: SnackbarVariant): string {
  if (variant === "error") {
    return "border-destructive bg-destructive text-white";
  }
  if (variant === "warning") {
    return "border-amber-500 bg-amber-500 text-white";
  }
  if (variant === "success") {
    return "border-green-600 bg-green-600 text-white";
  }
  return "border-border bg-card text-card-foreground";
}

function snackbarActionButtonClass(variant: SnackbarVariant): string {
  if (variant === "error" || variant === "warning" || variant === "success") {
    return "text-white hover:bg-white/20 hover:text-white";
  }
  return "";
}

function SnackbarToast({
  item,
  onDismiss,
}: {
  item: SnackbarItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration, item.id, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-4 slide-in-from-right-4 fade-in-0",
        snackbarVariantClass(item.variant),
      )}
    >
      <p className="m-0 flex-1 leading-snug">{item.message}</p>
      {item.action ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 shrink-0",
            snackbarActionButtonClass(item.variant),
            (item.variant === "error" ||
              item.variant === "warning" ||
              item.variant === "success") &&
              "border-white/60 bg-transparent",
          )}
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
        >
          {item.action.label}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 shrink-0 p-0",
          item.variant === "error" ||
          item.variant === "warning" ||
          item.variant === "success"
            ? "text-white hover:bg-white/20 hover:text-white"
            : undefined,
        )}
        onClick={() => onDismiss(item.id)}
        aria-label="關閉通知"
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (context == null) {
    throw new Error("useSnackbar must be used within SnackbarProvider");
  }
  return context;
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showSnackbar = useCallback(
    (message: string, options?: ShowSnackbarOptions) => {
      const id = nextIdRef.current + 1;
      nextIdRef.current = id;
      setItems((current) => [
        ...current,
        {
          id,
          message,
          variant: options?.variant ?? "default",
          duration: options?.duration ?? DEFAULT_DURATION_MS,
          action: options?.action,
        },
      ]);
    },
    [],
  );

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col items-end gap-2"
      >
        {items.map((item) => (
          <SnackbarToast key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}
