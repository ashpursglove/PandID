import { cn } from "@/lib/utils";

interface SelectProps<T extends string> {
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
}: SelectProps<T>) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500",
        "[color-scheme:dark]",
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
