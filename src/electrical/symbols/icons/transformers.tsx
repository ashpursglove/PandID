import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg } from "./base";

/** Two-winding transformer — interlocking circles. */
export function Transformer2W(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={16} />
      <circle cx={32} cy={25} r={12} />
      <circle cx={32} cy={39} r={12} />
      <line x1={32} y1={51} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Three-winding transformer — three interlocking circles. */
export function Transformer3W(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p} viewBox="0 0 64 72">
      <line x1={32} y1={2} x2={32} y2={14} />
      <circle cx={32} cy={24} r={11} />
      <circle cx={24} cy={42} r={11} />
      <circle cx={40} cy={42} r={11} />
      <line x1={24} y1={53} x2={24} y2={70} />
      <line x1={40} y1={53} x2={40} y2={70} />
    </ElecSvg>
  );
}

/** Auto-transformer — single tapped winding. */
export function AutoTransformer(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={16} />
      <circle cx={32} cy={32} r={15} />
      <line x1={32} y1={17} x2={32} y2={47} />
      <line x1={32} y1={47} x2={32} y2={62} />
    </ElecSvg>
  );
}
