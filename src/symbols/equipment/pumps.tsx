import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Reciprocating / piston pump — circle with horizontal cylinder + piston rod. */
export function PistonPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={24} cy={32} r={16} />
      <rect x={36} y={26} width={22} height={12} />
      <line x1={40} y1={32} x2={56} y2={32} />
      <line x1={40} y1={26} x2={40} y2={38} />
    </SvgFrame>
  );
}

/** Gear pump — two interlocking circles inside a casing. */
export function GearPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={32} r={20} />
      <circle cx={22} cy={32} r={7} />
      <circle cx={42} cy={32} r={7} />
      <line x1={29} y1={32} x2={35} y2={32} />
    </SvgFrame>
  );
}

/** Screw pump — circle with diagonal screw threads. */
export function ScrewPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={32} r={20} />
      <path d="M 18 24 L 46 40" />
      <path d="M 18 30 L 46 46" />
      <path d="M 18 18 L 46 34" />
      <path d="M 22 14 L 42 26" />
    </SvgFrame>
  );
}

/** Diaphragm pump — circle with horizontal diaphragm line + ports. */
export function DiaphragmPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={32} r={20} />
      <path d="M 14 32 Q 32 22, 50 32" />
      <line x1={32} y1={32} x2={32} y2={52} />
      <line x1={26} y1={52} x2={38} y2={52} />
    </SvgFrame>
  );
}

/** Vertical centrifugal (in-line / multistage) pump — taller body, inscribed triangle. */
export function VerticalCentrifugalPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={20} y={6} width={24} height={52} rx={4} />
      <path d="M 32 18 L 42 44 L 22 44 Z" />
      <line x1={32} y1={6} x2={32} y2={2} />
    </SvgFrame>
  );
}

/** Submersible pump — circle with motor block above, suction strainer below. */
export function SubmersiblePump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={20} y={8} width={24} height={14} rx={2} />
      <circle cx={32} cy={36} r={14} />
      <path d="M 32 24 L 40 46 L 24 46 Z" />
      <line x1={22} y1={54} x2={42} y2={54} />
      <line x1={24} y1={54} x2={24} y2={50} />
      <line x1={28} y1={54} x2={28} y2={50} />
      <line x1={32} y1={54} x2={32} y2={50} />
      <line x1={36} y1={54} x2={36} y2={50} />
      <line x1={40} y1={54} x2={40} y2={50} />
    </SvgFrame>
  );
}

/** Peristaltic pump — circle with three rollers around a hose loop. */
export function PeristalticPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={32} r={20} />
      <circle cx={32} cy={32} r={12} />
      <circle cx={32} cy={16} r={3} fill="currentColor" />
      <circle cx={45.86} cy={40} r={3} fill="currentColor" />
      <circle cx={18.14} cy={40} r={3} fill="currentColor" />
    </SvgFrame>
  );
}

/** Vacuum pump — circle with V-arrow indicating vacuum/discharge. */
export function VacuumPump(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={32} r={20} />
      <path d="M 22 24 L 32 40 L 42 24" />
      <text
        x={32}
        y={20}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        stroke="none"
      >
        VAC
      </text>
    </SvgFrame>
  );
}
