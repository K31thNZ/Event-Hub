import { cn } from "@/lib/utils";

type WordBankOption = {
  value: string;
  label: string;
  icon?: string;
  subLabel?: string;
};

type WordBankSelectorProps = {
  options: WordBankOption[];
  selected: string[];
  onToggle: (values: string[]) => void;
  multiSelect?: boolean;
  className?: string;
};

export function WordBankSelector({
  options,
  selected,
  onToggle,
  multiSelect = false,
  className,
}: WordBankSelectorProps) {
  const handleToggle = (value: string) => {
    if (multiSelect) {
      onToggle(
        selected.includes(value)
          ? selected.filter(v => v !== value)
          : [...selected, value]
      );
    } else {
      onToggle(selected.includes(value) ? [] : [value]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map(opt => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleToggle(opt.value)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border transition-all active:scale-95",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {opt.icon && <span className="text-base leading-none">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.subLabel && (
              <span className="text-xs opacity-70 ml-0.5">({opt.subLabel})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
