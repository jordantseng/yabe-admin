import { useRef } from "react";
import { SearchIcon } from "lucide-react";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function SearchBar({
  defaultValue,
  placeholder,
  ariaLabel,
  buttonLabel = "搜尋",
  className,
  inputClassName,
  disabled,
  onSearch,
}: {
  defaultValue?: string | null;
  placeholder: string;
  ariaLabel: string;
  buttonLabel?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  onSearch: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const submit = () => {
    onSearch((inputRef.current?.value ?? "").trim());
  };

  return (
    <div className={["flex items-center gap-2", className].filter(Boolean).join(" ")}>
      <Input
        ref={inputRef}
        key={defaultValue ?? ""}
        defaultValue={defaultValue ?? ""}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={["w-full max-w-sm", inputClassName].filter(Boolean).join(" ")}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={submit}
        disabled={disabled}
        aria-label={buttonLabel}
      >
        <SearchIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

