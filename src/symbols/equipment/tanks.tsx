import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Open-top atmospheric tank (rectangular section, no top). */
export function OpenTopTank(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 12 12 L 12 56 L 52 56 L 52 12" />
    </SvgFrame>
  );
}

/** Cone-roof tank: rectangle with triangular roof. */
export function ConeRoofTank(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 12 22 L 32 8 L 52 22 L 52 56 L 12 56 Z" />
      <line x1={12} y1={22} x2={52} y2={22} />
    </SvgFrame>
  );
}

/** Floating-roof tank: cylinder with a recessed roof inside. */
export function FloatingRoofTank(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={12} y={12} width={40} height={44} />
      <rect x={18} y={18} width={28} height={8} />
    </SvgFrame>
  );
}

/** Spherical tank: circle with two leg supports. */
export function SphericalTank(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={28} r={22} />
      <line x1={20} y1={46} x2={14} y2={60} />
      <line x1={44} y1={46} x2={50} y2={60} />
      <line x1={32} y1={50} x2={32} y2={60} />
    </SvgFrame>
  );
}

/** Silo / hopper: rectangular body with conical bottom. */
export function Silo(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 16 8 L 16 42 L 30 56 L 34 56 L 48 42 L 48 8 Z" />
      <line x1={16} y1={42} x2={48} y2={42} />
    </SvgFrame>
  );
}

/** Horizontal vessel with dished heads. */
export function HorizontalVessel(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path
        d="M 14 20
           C 6 20, 6 44, 14 44
           L 50 44
           C 58 44, 58 20, 50 20
           Z"
      />
      <path d="M 14 20 C 18 20, 18 44, 14 44" />
      <path d="M 50 20 C 46 20, 46 44, 50 44" />
    </SvgFrame>
  );
}

/** Knock-out / blowdown drum — horizontal vessel with internal demister. */
export function KnockoutDrum(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path
        d="M 10 18
           C 4 18, 4 46, 10 46
           L 54 46
           C 60 46, 60 18, 54 18
           Z"
      />
      <line x1={10} y1={32} x2={20} y2={32} strokeDasharray="2 2" />
      <line x1={44} y1={32} x2={54} y2={32} strokeDasharray="2 2" />
      <rect x={28} y={22} width={8} height={6} />
    </SvgFrame>
  );
}
