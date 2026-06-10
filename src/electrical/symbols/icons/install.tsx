import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, FanBlades, SpareCaption, StubBottom, StubTop } from "./base";

function CenterText({ children, size = 11, y = 36 }: { children: string; size?: number; y?: number }) {
  return (
    <text
      x={32}
      y={y}
      fontSize={size}
      fill="currentColor"
      stroke="none"
      textAnchor="middle"
      fontFamily="Inter, Helvetica, Arial, sans-serif"
    >
      {children}
    </text>
  );
}

/* --------------------------- protection extras -------------------------- */

/** Residual current device (RCD / RCCB). */
export function Rcd(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={18} width={24} height={28} rx={2} />
      <circle cx={28} cy={26} r={1.6} fill="currentColor" />
      <line x1={28} y1={26} x2={38} y2={38} />
      <text x={32} y={44} fontSize={6} fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Inter, Helvetica, Arial, sans-serif">I∆n</text>
      <StubBottom />
    </ElecSvg>
  );
}

/** RCBO — combined RCD + MCB. */
export function Rcbo(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.6} fill="currentColor" />
      <line x1={32} y1={20} x2={42} y2={34} />
      <rect x={24} y={36} width={16} height={9} rx={1} />
      <text x={32} y={43} fontSize={5} fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Inter, Helvetica, Arial, sans-serif">I∆n</text>
      <line x1={32} y1={45} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Motor protection circuit breaker. */
export function Mpcb(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={20} width={24} height={24} rx={2} />
      <CenterText size={13}>M</CenterText>
      <StubBottom />
    </ElecSvg>
  );
}

/** Spare (reserved) MPCB — line-side only, no outgoing connection. */
export function MpcbSpare(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={18} width={24} height={22} rx={2} />
      <CenterText size={12} y={33}>
        M
      </CenterText>
      <SpareCaption />
    </ElecSvg>
  );
}

/** Manual / automatic change-over (transfer) switch — 2 sources → 1 load. */
export function ChangeoverSwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={20} y1={2} x2={20} y2={16} />
      <line x1={44} y1={2} x2={44} y2={16} />
      <circle cx={20} cy={18} r={1.8} fill="currentColor" />
      <circle cx={44} cy={18} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={22} y2={20} />
      <line x1={32} y1={44} x2={44} y2={26} strokeDasharray="2 2" />
      <line x1={32} y1={44} x2={32} y2={62} />
    </ElecSvg>
  );
}

/* --------------------------- sources / renewables ---------------------- */

/** Solar PV array / string. */
export function PvArray(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <rect x={12} y={14} width={40} height={26} rx={1} />
      <line x1={12} y1={23} x2={52} y2={23} />
      <line x1={12} y1={31} x2={52} y2={31} />
      <line x1={25} y1={14} x2={25} y2={40} />
      <line x1={39} y1={14} x2={39} y2={40} />
      <line x1={32} y1={40} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Wind turbine. */
export function WindTurbine(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <circle cx={32} cy={20} r={3} />
      <line x1={32} y1={17} x2={32} y2={6} />
      <line x1={32} y1={22} x2={22} y2={28} />
      <line x1={32} y1={22} x2={42} y2={28} />
      <line x1={32} y1={23} x2={32} y2={48} />
      <line x1={32} y1={48} x2={32} y2={62} />
      <line x1={26} y1={48} x2={38} y2={48} />
    </ElecSvg>
  );
}

/** Solar charge controller / MPPT. */
export function ChargeController(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={14} y={18} width={36} height={28} rx={2} />
      <CenterText size={8} y={35}>MPPT</CenterText>
      <StubBottom />
    </ElecSvg>
  );
}

/* -------------------------------- loads -------------------------------- */

/** EV charger. */
export function EvCharger(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={18} width={24} height={30} rx={2} />
      <path d="M 34 24 L 28 34 L 34 34 L 30 42" />
      <circle cx={32} cy={45} r={1.4} fill="currentColor" />
    </ElecSvg>
  );
}

/** HVAC / air-handling unit. */
export function Hvac(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={16} y={18} width={32} height={28} rx={2} />
      <circle cx={32} cy={32} r={9} />
      <path d="M 32 32 L 32 24 M 32 32 L 39 36 M 32 32 L 25 36" />
    </ElecSvg>
  );
}

/** Fan / exhaust fan. */
export function Fan(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={15} />
      <FanBlades cx={32} cy={36} r={11} />
    </ElecSvg>
  );
}

/** Water heater / immersion. */
export function WaterHeater(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={22} y={18} width={20} height={30} rx={6} />
      <path d="M 27 40 v -6 l 2 -3 l 3 6 l 3 -6 l 2 3 v 6" />
    </ElecSvg>
  );
}

/** Emergency light (with battery backup). */
export function EmergencyLight(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={34} r={13} />
      <line x1={23} y1={25} x2={41} y2={43} />
      <line x1={23} y1={43} x2={41} y2={25} />
      <text x={32} y={37} fontSize={7} fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Inter, Helvetica, Arial, sans-serif">E</text>
    </ElecSvg>
  );
}

/** Floodlight / projector. */
export function Floodlight(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <path d="M 22 22 L 42 22 L 46 40 L 18 40 Z" />
      <line x1={26} y1={44} x2={24} y2={50} />
      <line x1={32} y1={44} x2={32} y2={51} />
      <line x1={38} y1={44} x2={40} y2={50} />
    </ElecSvg>
  );
}

/* ----------------------------- control / ELV --------------------------- */

/** PLC / control panel. */
export function Plc(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={14} y={18} width={36} height={28} rx={2} />
      <line x1={20} y1={18} x2={20} y2={14} />
      <line x1={26} y1={18} x2={26} y2={14} />
      <CenterText size={9} y={36}>PLC</CenterText>
      <StubBottom />
    </ElecSvg>
  );
}

/** Fire alarm panel. */
export function FireAlarmPanel(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={16} y={18} width={32} height={28} rx={2} />
      <path d="M 26 36 a 6 6 0 0 1 12 0 z" />
      <line x1={32} y1={26} x2={32} y2={30} />
      <line x1={28} y1={38} x2={36} y2={38} />
    </ElecSvg>
  );
}

/** CCTV camera. */
export function Cctv(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={18} y={28} width={22} height={12} rx={2} />
      <path d="M 40 31 L 48 28 L 48 40 L 40 37 Z" />
      <line x1={24} y1={40} x2={24} y2={46} />
    </ElecSvg>
  );
}

/* --------------------------- distribution / earth ---------------------- */

/** Earth / equipotential bonding bar. */
export function EarthBar(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p} viewBox="0 0 96 40">
      <line x1={48} y1={2} x2={48} y2={12} />
      <rect x={10} y={12} width={76} height={5} rx={1} fill="currentColor" />
      <line x1={48} y1={17} x2={48} y2={26} />
      <line x1={38} y1={26} x2={58} y2={26} />
      <line x1={42} y1={31} x2={54} y2={31} />
      <line x1={45} y1={36} x2={51} y2={36} />
      <line x1={22} y1={17} x2={22} y2={30} />
      <line x1={74} y1={17} x2={74} y2={30} />
    </ElecSvg>
  );
}

/** Junction / pull box. */
export function JunctionBox(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={20} width={24} height={24} rx={1} />
      <CenterText size={9} y={35}>JB</CenterText>
      <StubBottom />
    </ElecSvg>
  );
}
