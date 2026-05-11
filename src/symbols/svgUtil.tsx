import type { CSSProperties, ReactNode } from "react";

import type { SymbolIconProps } from "@/symbols/types";

interface SvgFrameProps extends SymbolIconProps {
  viewBox?: string;
  children: ReactNode;
  strokeWidth?: number;
  style?: CSSProperties;
}

/**
 * Shared SVG wrapper used by every glyph. Centralises the
 * theme-aware stroke colour and base attributes so individual symbol
 * components stay focused on geometry.
 */
export function SvgFrame({
  width,
  height,
  selected,
  viewBox = "0 0 64 64",
  strokeWidth = 1.5,
  children,
  style,
}: SvgFrameProps) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      className={selected ? "text-sky-300" : "text-zinc-200"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </svg>
  );
}
