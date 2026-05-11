import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Cyclone separator — cylindrical top with conical bottom and inlet stub. */
export function Cyclone(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 18 8 L 18 30 L 32 56 L 46 30 L 46 8 Z" />
      <line x1={18} y1={20} x2={6} y2={20} />
      <line x1={32} y1={8} x2={32} y2={2} />
    </SvgFrame>
  );
}

/** Two-phase separator (horizontal) — vessel with mist eliminator pad. */
export function TwoPhaseSeparator(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path
        d="M 10 18
           C 4 18, 4 46, 10 46
           L 54 46
           C 60 46, 60 18, 54 18
           Z"
      />
      <rect x={42} y={22} width={10} height={6} />
      <line x1={10} y1={32} x2={54} y2={32} strokeDasharray="3 2" />
    </SvgFrame>
  );
}

/** Three-phase separator — vessel with two liquid levels + weir. */
export function ThreePhaseSeparator(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path
        d="M 8 18
           C 2 18, 2 46, 8 46
           L 56 46
           C 62 46, 62 18, 56 18
           Z"
      />
      <line x1={8} y1={30} x2={56} y2={30} strokeDasharray="3 2" />
      <line x1={8} y1={38} x2={40} y2={38} />
      <line x1={40} y1={38} x2={40} y2={26} />
      <rect x={48} y={24} width={8} height={6} />
    </SvgFrame>
  );
}

/** Packed column — column with packing pattern. */
export function PackedColumn(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={22} y={4} width={20} height={56} rx={10} />
      <path d="M 24 12 L 40 18 M 24 18 L 40 24 M 24 26 L 40 32 M 24 34 L 40 40 M 24 42 L 40 48" />
      <path d="M 24 18 L 40 12 M 24 26 L 40 18 M 24 34 L 40 26 M 24 42 L 40 34 M 24 50 L 40 42" />
    </SvgFrame>
  );
}
