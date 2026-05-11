import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Centrifugal compressor — trapezoid expanding in flow direction. */
export function CentrifugalCompressor(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 12 18 L 52 8 L 52 56 L 12 46 Z" />
      <line x1={12} y1={32} x2={4} y2={32} />
      <line x1={52} y1={32} x2={60} y2={32} />
    </SvgFrame>
  );
}

/** Reciprocating compressor — circle with vertical cylinder above. */
export function ReciprocatingCompressor(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={44} r={14} />
      <rect x={24} y={6} width={16} height={26} />
      <line x1={32} y1={32} x2={32} y2={44} />
    </SvgFrame>
  );
}

/** Rotary screw compressor — long body with diagonal helices. */
export function ScrewCompressor(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={4} y={20} width={56} height={24} rx={4} />
      <path d="M 8 24 L 32 40" />
      <path d="M 16 24 L 40 40" />
      <path d="M 24 24 L 48 40" />
      <path d="M 32 24 L 56 40" />
    </SvgFrame>
  );
}

/** Fan / blower — squirrel-cage with rotor arrows. */
export function Fan(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={32} r={20} />
      <path d="M 32 14 Q 44 22 44 32 Q 44 42 32 50 Q 20 42 20 32 Q 20 22 32 14 Z" />
      <line x1={32} y1={14} x2={32} y2={50} />
    </SvgFrame>
  );
}
