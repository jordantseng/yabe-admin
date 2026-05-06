import Button from "@/components/ui/button";
import Skeleton from "@/components/ui/skeleton";

export default function Pagination({
  loading,
  currentPage,
  totalPages,
  onPageChange,
  prevLabel = "上一頁",
  nextLabel = "下一頁",
  className,
}: {
  loading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const prevPage = Math.max(1, safeCurrentPage - 1);
  const nextPage = Math.min(safeTotalPages, safeCurrentPage + 1);

  return (
    <div className={["flex items-center gap-2", className].filter(Boolean).join(" ")}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(prevPage)}
        disabled={loading || safeCurrentPage === 1}
      >
        {prevLabel}
      </Button>

      {loading ? (
        <Skeleton className="h-5 w-28" />
      ) : (
        <span className="text-sm text-muted-foreground">
          第 {safeCurrentPage} / {safeTotalPages} 頁
        </span>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(nextPage)}
        disabled={loading || safeCurrentPage === safeTotalPages}
      >
        {nextLabel}
      </Button>
    </div>
  );
}

