import type { SymbolIconProps } from "@/symbols/types";

export function TapPoint({ width, height, selected }: SymbolIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={width}
      height={height}
      className={selected ? "text-sky-300" : "text-zinc-200"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      <circle cx={8} cy={8} r={3} fill="currentColor" />
    </svg>
  );
}
