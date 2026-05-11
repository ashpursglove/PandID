import type { SymbolIconProps } from "@/symbols/types";
import { Bowtie } from "./Bowtie";

/**
 * Pneumatic diaphragm actuator (open circle) on top of an inline bowtie body —
 * the most common ISA 5.1 control-valve glyph. The vertical line is the stem.
 */
export function ControlValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={32} x2={32} y2={20} />
          <circle cx={32} cy={12} r={8} />
          <line x1={26} y1={12} x2={38} y2={12} />
        </g>
      }
    />
  );
}
