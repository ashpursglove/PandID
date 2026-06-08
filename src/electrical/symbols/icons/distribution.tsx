import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg } from "./base";

/** Busbar — thick horizontal bar with a top feed. The glyph is authored at the
 *  node's actual width (dynamic viewBox) so the bar genuinely stretches with
 *  the "Drawn width" slider instead of just centering. Outgoing taps are drawn
 *  by the feeders that connect to it. */
export function Busbar({ width = 128, height = 32, selected }: ElecSymbolIconProps) {
  return (
    <ElecSvg
      width={width}
      height={height}
      selected={selected}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line x1={width / 2} y1={2} x2={width / 2} y2={12} />
      <rect x={6} y={12} width={Math.max(2, width - 12)} height={6} rx={1} fill="currentColor" />
    </ElecSvg>
  );
}

/** Distribution board — panel rectangle with a top feed, drawn at the node's
 *  actual width so it widens with the slider. */
export function DistributionBoard({ width = 96, height = 64, selected }: ElecSymbolIconProps) {
  return (
    <ElecSvg
      width={width}
      height={height}
      selected={selected}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line x1={width / 2} y1={2} x2={width / 2} y2={10} />
      <rect x={10} y={10} width={Math.max(2, width - 20)} height={Math.max(2, height - 20)} rx={2} />
      <line x1={10} y1={22} x2={width - 10} y2={22} />
    </ElecSvg>
  );
}

/** Motor control centre — panel divided into evenly spaced vertical sections
 *  that scale to the node's width. */
export function Mcc({ width = 96, height = 64, selected }: ElecSymbolIconProps) {
  const innerL = 10;
  const innerR = width - 10;
  const sections = Math.max(2, Math.round((innerR - innerL) / 26));
  const dividers = Array.from(
    { length: sections - 1 },
    (_, i) => innerL + ((i + 1) * (innerR - innerL)) / sections,
  );
  return (
    <ElecSvg
      width={width}
      height={height}
      selected={selected}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line x1={width / 2} y1={2} x2={width / 2} y2={10} />
      <rect x={10} y={10} width={Math.max(2, width - 20)} height={Math.max(2, height - 20)} rx={2} />
      {dividers.map((x, i) => (
        <line key={i} x1={x} y1={10} x2={x} y2={height - 10} />
      ))}
    </ElecSvg>
  );
}

/** Bus tie breaker — cross contact on a horizontal link. */
export function BusTie(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p} viewBox="0 0 64 32">
      <line x1={2} y1={16} x2={24} y2={16} />
      <line x1={24} y1={10} x2={40} y2={22} />
      <line x1={24} y1={22} x2={40} y2={10} />
      <line x1={40} y1={16} x2={62} y2={16} />
    </ElecSvg>
  );
}
