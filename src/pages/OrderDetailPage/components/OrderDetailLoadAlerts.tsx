import { XIcon } from "lucide-react";
import Button from "@/components/ui/button";

type OrderDetailLoadAlertsProps = {
  showFetchLoading: boolean;
  displayLoadError: string | null;
  loadError: string | null;
  onDismissLoadError: () => void;
};

export default function OrderDetailLoadAlerts({
  showFetchLoading,
  displayLoadError,
  loadError,
  onDismissLoadError,
}: OrderDetailLoadAlertsProps) {
  return (
    <>
      {showFetchLoading && (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          載入中…
        </p>
      )}
      {displayLoadError && (
        <div
          className="mb-4 flex items-start justify-between gap-2 text-sm text-destructive"
          role="alert"
        >
          <p>{displayLoadError}</p>
          {loadError ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive"
              onClick={onDismissLoadError}
              aria-label="關閉錯誤訊息"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
