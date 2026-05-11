import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Off-page connector — pentagon pointing right with reference label area. */
export function OffPageConnector(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 6 16 L 40 16 L 56 32 L 40 48 L 6 48 Z" />
    </SvgFrame>
  );
}

/** Pipe junction / tee — three short stubs meeting at a node. */
export function PipeTee(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <line x1={32} y1={32} x2={32} y2={56} />
      <circle cx={32} cy={32} r={2.5} fill="currentColor" />
    </SvgFrame>
  );
}
