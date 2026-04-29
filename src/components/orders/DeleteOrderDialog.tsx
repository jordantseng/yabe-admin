import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: () => void;
};

export function DeleteOrderDialog({
  open,
  onOpenChange,
  orderId,
  error,
  isSubmitting,
  onConfirm,
}: DeleteOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除訂單</DialogTitle>
          <DialogDescription>
            確定要刪除訂單 {orderId ?? ""} 嗎？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "刪除中…" : "刪除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
