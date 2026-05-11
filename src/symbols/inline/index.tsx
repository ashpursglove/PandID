import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Orifice plate — two facing flanges with a thin plate between. */
export function OrificePlate(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <line x1={30} y1={14} x2={30} y2={50} strokeWidth={2.5} />
      <line x1={34} y1={14} x2={34} y2={50} strokeWidth={2.5} />
    </SvgFrame>
  );
}

/** Venturi meter — converging/diverging cone profile. */
export function Venturi(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <path d="M 8 18 L 24 26 L 40 26 L 56 18" />
      <path d="M 8 46 L 24 38 L 40 38 L 56 46" />
    </SvgFrame>
  );
}

/** Rotameter / variable-area flow meter — tapered tube with float. */
export function Rotameter(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 22 56 L 18 8 L 46 8 L 42 56 Z" />
      <line x1={22} y1={56} x2={42} y2={56} />
      <line x1={18} y1={8} x2={46} y2={8} />
      <line x1={4} y1={32} x2={20} y2={32} />
      <line x1={44} y1={32} x2={60} y2={32} />
      <path d="M 25 36 L 39 36 L 32 28 Z" fill="currentColor" />
    </SvgFrame>
  );
}

/** Pitot tube / probe — L-shaped probe in the line. */
export function PitotProbe(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <path d="M 32 4 L 32 32 L 40 32" />
      <circle cx={40} cy={32} r={2} fill="currentColor" />
    </SvgFrame>
  );
}

/** Steam trap — circle with "ST" label and inline stubs. */
export function SteamTrap(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={20} y2={32} />
      <line x1={44} y1={32} x2={60} y2={32} />
      <circle cx={32} cy={32} r={12} />
      <text
        x={32}
        y={36}
        textAnchor="middle"
        fontSize={11}
        fill="currentColor"
        stroke="none"
      >
        ST
      </text>
    </SvgFrame>
  );
}

/** Air vent / auto vent — small dome on top of a pipe stub. */
export function AirVent(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={48} x2={60} y2={48} />
      <line x1={32} y1={48} x2={32} y2={26} />
      <circle cx={32} cy={20} r={8} />
      <line x1={32} y1={12} x2={32} y2={6} />
    </SvgFrame>
  );
}

/** Drain — pipe stub down to a triangle. */
export function Drain(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={20} x2={60} y2={20} />
      <line x1={32} y1={20} x2={32} y2={42} />
      <path d="M 24 42 L 40 42 L 32 58 Z" />
    </SvgFrame>
  );
}

/** Sight glass — pipe with cylindrical window section. */
export function SightGlass(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={18} y2={32} />
      <line x1={46} y1={32} x2={60} y2={32} />
      <rect x={18} y={22} width={28} height={20} />
      <line x1={22} y1={26} x2={42} y2={38} />
      <line x1={22} y1={38} x2={42} y2={26} />
    </SvgFrame>
  );
}

/** Sample point — pipe stub with valve symbol on the tap. */
export function SamplePoint(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={20} x2={60} y2={20} />
      <line x1={32} y1={20} x2={32} y2={36} />
      <path d="M 24 36 L 40 36 L 40 52 L 24 52 Z" />
      <path d="M 26 38 L 38 50 M 26 50 L 38 38" />
    </SvgFrame>
  );
}

/** Concentric reducer — two trapezoid lines on a common centreline. */
export function ConcentricReducer(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <path d="M 18 18 L 18 46 L 46 38 L 46 26 Z" />
    </SvgFrame>
  );
}

/** Eccentric reducer — flat top, sloped bottom. */
export function EccentricReducer(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <path d="M 18 22 L 18 42 L 46 38 L 46 22 Z" />
    </SvgFrame>
  );
}

/** Expansion joint / bellows — concertina between two pipe stubs. */
export function ExpansionJoint(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={20} y2={32} />
      <line x1={44} y1={32} x2={60} y2={32} />
      <path d="M 20 22 L 22 42 L 26 22 L 30 42 L 34 22 L 38 42 L 42 22 L 44 42" />
    </SvgFrame>
  );
}

/** Spectacle blind (figure-8) — two circles joined by a tab. */
export function SpectacleBlind(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={60} y2={32} />
      <circle cx={32} cy={22} r={8} fill="currentColor" />
      <circle cx={32} cy={42} r={8} />
      <line x1={32} y1={30} x2={32} y2={34} />
    </SvgFrame>
  );
}

/** Cap / plug — pipe terminated by a half circle. */
export function PipeCap(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={40} y2={32} />
      <path d="M 40 22 L 40 42 A 10 10 0 0 0 40 22 Z" fill="currentColor" />
    </SvgFrame>
  );
}

/** Spray nozzle — pipe with three diverging spray lines. */
export function SprayNozzle(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={4} y1={32} x2={32} y2={32} />
      <path d="M 32 24 L 32 40 L 44 48 L 44 16 Z" />
      <path d="M 44 22 L 60 18" />
      <path d="M 44 32 L 60 32" />
      <path d="M 44 42 L 60 46" />
    </SvgFrame>
  );
}
