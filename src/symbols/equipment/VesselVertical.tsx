import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/**
 * Vertical pressure vessel: cylindrical shell with 2:1 semi-elliptical heads,
 * which is the most common ASME geometry.
 */
export function VesselVertical(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path
        d="M 22 14
           C 22 6, 42 6, 42 14
           L 42 50
           C 42 58, 22 58, 22 50
           Z"
      />
      <path d="M 22 14 C 22 18, 42 18, 42 14" />
      <path d="M 22 50 C 22 46, 42 46, 42 50" />
    </SvgFrame>
  );
}
