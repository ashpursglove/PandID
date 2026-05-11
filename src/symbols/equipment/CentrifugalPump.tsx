import type { SymbolIconProps } from "@/symbols/types";

export function CentrifugalPump({ width, height, selected }: SymbolIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={width}
      height={height}
      className={selected ? "text-sky-300" : "text-zinc-200"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      {/* Triangle inscribed in the circle: apex at top (12 o'clock), base at 30° / 150° */}
      <circle cx={32} cy={36} r={18} />
      <path d="M 32 18 L 47.59 45 L 16.41 45 Z" />
      <line x1={12} y1={36} x2={14} y2={36} />
      <line x1={32} y1={14} x2={32} y2={18} />
    </svg>
  );
}
