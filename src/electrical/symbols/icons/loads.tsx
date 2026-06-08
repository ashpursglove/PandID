import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubTop } from "./base";

/** Induction motor — circle with M. */
export function Motor(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={16} />
      <text
        x={32}
        y={42}
        fontSize={18}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        M
      </text>
    </ElecSvg>
  );
}

/** Motor circle carrying an "M" plus a phase legend (e.g. "1~" or "3~"). */
function MotorWithPhase({ phase, ...p }: ElecSymbolIconProps & { phase: string }) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={16} />
      <text
        x={32}
        y={38}
        fontSize={15}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        M
      </text>
      <text
        x={32}
        y={49}
        fontSize={8}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        {phase}
      </text>
    </ElecSvg>
  );
}

/** Single-phase induction motor — M with a 1~ legend. */
export function Motor1Ph(p: ElecSymbolIconProps) {
  return <MotorWithPhase {...p} phase="1~" />;
}

/** Three-phase induction motor — M with a 3~ legend. */
export function Motor3Ph(p: ElecSymbolIconProps) {
  return <MotorWithPhase {...p} phase="3~" />;
}

/** Vibratory feeder / vibrating filter screen — sieve box on springs. */
export function VibrationFilter(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={14} y={22} width={36} height={15} rx={1.5} />
      {/* sieve mesh */}
      <line x1={20} y1={22} x2={14} y2={31} />
      <line x1={28} y1={22} x2={14} y2={37} />
      <line x1={36} y1={22} x2={20} y2={37} />
      <line x1={44} y1={22} x2={28} y2={37} />
      <line x1={50} y1={26} x2={36} y2={37} />
      {/* support springs */}
      <path d="M 20 37 l 0 2 l 3 1.5 l -6 1.5 l 6 1.5 l -3 1.5 l 0 2" />
      <path d="M 44 37 l 0 2 l 3 1.5 l -6 1.5 l 6 1.5 l -3 1.5 l 0 2" />
      {/* vibration arrows */}
      <path d="M 52 24 l 3 -3 m 0 0 l -0.5 2.5 m 0.5 -2.5 l -2.5 0.5" />
    </ElecSvg>
  );
}

/** Lighting load — luminaire (circle with cross). */
export function LightingLoad(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={14} />
      <line x1={22} y1={26} x2={42} y2={46} />
      <line x1={22} y1={46} x2={42} y2={26} />
    </ElecSvg>
  );
}

/** Socket outlet / small power. */
export function SocketLoad(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <path d="M 16 40 a 16 16 0 0 1 32 0" />
      <line x1={16} y1={40} x2={48} y2={40} />
      <line x1={32} y1={24} x2={32} y2={16} />
    </ElecSvg>
  );
}

/** Generic load — downward arrow into a bar. */
export function GenericLoad(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <line x1={32} y1={16} x2={32} y2={42} />
      <path d="M 24 34 L 32 44 L 40 34" />
      <line x1={20} y1={48} x2={44} y2={48} />
    </ElecSvg>
  );
}

/** Resistive heater — box with a heating element zigzag. */
export function Heater(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={18} y={24} width={28} height={20} rx={1} />
      <path d="M 22 34 h 4 l 2 -5 l 4 10 l 4 -10 l 4 10 l 2 -5 h 4" />
    </ElecSvg>
  );
}

/** Capacitor bank — power-factor correction. */
export function CapacitorBank(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <line x1={18} y1={32} x2={46} y2={32} />
      <line x1={18} y1={38} x2={46} y2={38} />
      <line x1={32} y1={16} x2={32} y2={32} />
      <line x1={32} y1={38} x2={32} y2={62} />
    </ElecSvg>
  );
}
