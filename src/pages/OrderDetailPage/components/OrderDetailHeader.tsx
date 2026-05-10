import Button from "@/components/ui/button";

type OrderDetailHeaderProps = {
  onBack: () => void;
};

export default function OrderDetailHeader({ onBack }: OrderDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">訂單詳細</h1>
      </div>
      <Button type="button" variant="outline" onClick={onBack}>
        返回
      </Button>
    </div>
  );
}
