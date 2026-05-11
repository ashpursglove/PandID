import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/**
 * Angle-body relief valve: horizontal inlet, vertical outlet (to atmosphere /
 * flare), and a coil spring above the body that visualises the set-pressure
 * preload. Matches ISA 5.1 PSV convention.
 */
export function ReliefValve(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 6 38 L 6 52 L 32 45 Z" />
      <path d="M 32 45 L 24 22 L 40 22 Z" />
      <line x1={32} y1={22} x2={32} y2={6} />
      <path d="M 26 8 L 38 12 L 26 16 L 38 20" />
      <line x1={26} y1={6} x2={38} y2={6} />
    </SvgFrame>
  );
}
