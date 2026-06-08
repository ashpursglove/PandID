import type { ReactNode } from "react";
import type { ElecSymbolIconProps } from "@/electrical/types";

/**
 * Shared SVG wrapper for all SLD glyphs. Matches the P&ID icon convention:
 * stroke uses `currentColor`, which the className flips between sky (selected)
 * and zinc (idle). Glyphs are drawn on a 64×64 grid by default with vertical
 * terminal stubs at top (y 2→16) and bottom (y 48→62).
 */
export function ElecSvg({
  width,
  height,
  selected,
  children,
  viewBox = "0 0 64 64",
}: ElecSymbolIconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      className={selected ? "text-sky-300" : "text-zinc-200"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
    </svg>
  );
}

/** Top terminal stub (line side). */
export function StubTop() {
  return <line x1={32} y1={2} x2={32} y2={16} />;
}

/** Bottom terminal stub (load side). */
export function StubBottom() {
  return <line x1={32} y1={48} x2={32} y2={62} />;
}

/**
 * Three equally-spaced (120°) curved fan blades around a hub, used by the fan
 * and aeration-blower glyphs so they read as a proper impeller rather than a
 * lop-sided swirl.
 */
export function FanBlades({
  cx,
  cy,
  r,
}: {
  cx: number;
  cy: number;
  r: number;
}) {
  const bw = r * 0.55;
  // One petal blade pointing straight up from the hub.
  const blade = `M ${cx} ${cy} C ${cx - bw} ${cy - r * 0.45}, ${cx - bw * 0.35} ${cy - r}, ${cx} ${cy - r} C ${cx + bw * 0.35} ${cy - r}, ${cx + bw} ${cy - r * 0.45}, ${cx} ${cy} Z`;
  return (
    <>
      <path d={blade} />
      <path d={blade} transform={`rotate(120 ${cx} ${cy})`} />
      <path d={blade} transform={`rotate(240 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={1.7} fill="currentColor" stroke="none" />
    </>
  );
}
