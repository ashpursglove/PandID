import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Plate heat exchanger — stacked plates between end frames. */
export function PlateHeatExchanger(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={10} y={14} width={44} height={36} />
      {[16, 22, 28, 34, 40, 46].map((x) => (
        <line key={x} x1={x} y1={14} x2={x} y2={50} />
      ))}
    </SvgFrame>
  );
}

/** Air-cooled (fin-fan) heat exchanger — tube bundle with circular fan below. */
export function AirCooledExchanger(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={4} y={14} width={56} height={14} />
      <line x1={4} y1={20} x2={60} y2={20} />
      <circle cx={32} cy={44} r={12} />
      <line x1={20} y1={44} x2={44} y2={44} />
      <line x1={32} y1={32} x2={32} y2={56} />
      <line x1={23.5} y1={35.5} x2={40.5} y2={52.5} />
      <line x1={23.5} y1={52.5} x2={40.5} y2={35.5} />
    </SvgFrame>
  );
}

/** Kettle reboiler — horizontal vessel with bundle inside. */
export function KettleReboiler(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path
        d="M 8 22
           C 2 22, 2 50, 8 50
           L 40 50
           C 46 50, 46 22, 40 22
           Z"
      />
      <line x1={48} y1={50} x2={56} y2={50} />
      <line x1={56} y1={50} x2={56} y2={22} />
      <line x1={56} y1={22} x2={48} y2={22} />
      <rect x={14} y={30} width={22} height={10} />
      <line x1={14} y1={35} x2={36} y2={35} />
    </SvgFrame>
  );
}

/** Fired heater / furnace — box with flame at the base. */
export function FiredHeater(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={12} y={8} width={40} height={42} />
      <line x1={12} y1={36} x2={52} y2={36} />
      <path d="M 20 50 Q 22 44, 26 48 Q 30 42, 32 48 Q 34 42, 38 48 Q 42 44, 44 50" />
      <line x1={32} y1={8} x2={32} y2={2} />
    </SvgFrame>
  );
}

/** Cooling tower — trapezoidal shell with water lines. */
export function CoolingTower(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 14 14 L 50 14 L 56 56 L 8 56 Z" />
      <line x1={12} y1={28} x2={52} y2={28} strokeDasharray="3 2" />
      <line x1={11} y1={42} x2={53} y2={42} strokeDasharray="3 2" />
    </SvgFrame>
  );
}

/** Condenser — horizontal tubes drawn over a vessel, with droplets. */
export function Condenser(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={6} y={18} width={52} height={28} rx={14} />
      <line x1={10} y1={26} x2={54} y2={26} />
      <line x1={10} y1={38} x2={54} y2={38} />
      <path d="M 20 18 L 20 12 M 28 18 L 28 8 M 36 18 L 36 12 M 44 18 L 44 8" />
    </SvgFrame>
  );
}
