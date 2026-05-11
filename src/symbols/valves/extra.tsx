import type { SymbolIconProps } from "@/symbols/types";
import { Bowtie } from "./Bowtie";
import { SvgFrame } from "@/symbols/svgUtil";

/** Butterfly valve — bowtie with vertical disc line through the centre. */
export function ButterflyValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={22} x2={32} y2={42} strokeWidth={2.5} />
        </g>
      }
    />
  );
}

/** Plug valve — bowtie with rotated-square (taper plug) overlay. */
export function PlugValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <rect
            x={28}
            y={28}
            width={8}
            height={8}
            transform="rotate(45 32 32)"
            fill="currentColor"
          />
        </g>
      }
    />
  );
}

/** Needle valve — bowtie with a tiny inverted triangle (needle) overlay. */
export function NeedleValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={32} x2={32} y2={14} />
          <path d="M 28 14 L 36 14 L 32 32 Z" fill="currentColor" />
        </g>
      }
    />
  );
}

/** Diaphragm valve — bowtie with arched diaphragm above the body. */
export function DiaphragmValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <path d="M 14 28 Q 32 14, 50 28" />
          <line x1={32} y1={20} x2={32} y2={32} />
        </g>
      }
    />
  );
}

/** Pinch valve — bowtie squeezed by two opposing wedges. */
export function PinchValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <path d="M 26 18 L 32 30 L 38 18" fill="currentColor" />
          <path d="M 26 46 L 32 34 L 38 46" fill="currentColor" />
        </g>
      }
    />
  );
}

/** Foot valve — check valve with a strainer cage hanging below. */
export function FootValve(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 8 14 L 8 38 L 32 26 Z" />
      <path d="M 56 14 L 56 38 L 32 26 Z" />
      <circle cx={40} cy={26} r={3} fill="currentColor" />
      <path d="M 16 38 L 16 50 L 48 50 L 48 38" />
      <line x1={20} y1={38} x2={20} y2={50} />
      <line x1={26} y1={38} x2={26} y2={50} />
      <line x1={32} y1={38} x2={32} y2={50} />
      <line x1={38} y1={38} x2={38} y2={50} />
      <line x1={44} y1={38} x2={44} y2={50} />
      <line x1={16} y1={44} x2={48} y2={44} />
    </SvgFrame>
  );
}

/** Angle valve — globe valve with 90° body. */
export function AngleValve(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 6 32 L 32 32 L 32 58 Z" />
      <path d="M 6 32 L 32 32 L 32 6 L 6 32" />
      <circle cx={32} cy={32} r={3} fill="currentColor" />
    </SvgFrame>
  );
}

/** Three-way valve — three bowties meeting at the centre. */
export function ThreeWayValve(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 8 20 L 8 44 L 32 32 Z" />
      <path d="M 56 20 L 56 44 L 32 32 Z" />
      <path d="M 20 56 L 44 56 L 32 32 Z" />
    </SvgFrame>
  );
}

/** Lift-check valve — bowtie with vertical line + cap (lift-disc body). */
export function LiftCheckValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={20} x2={32} y2={32} />
          <rect x={26} y={14} width={12} height={6} />
        </g>
      }
    />
  );
}

/** Solenoid actuated valve — bowtie + rectangle "S" actuator. */
export function SolenoidValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={32} x2={32} y2={20} />
          <rect x={22} y={6} width={20} height={14} />
          <text
            x={32}
            y={17}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            stroke="none"
          >
            S
          </text>
        </g>
      }
    />
  );
}

/** Motor-operated valve — bowtie + circle with "M". */
export function MotorOperatedValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={32} x2={32} y2={20} />
          <circle cx={32} cy={12} r={8} />
          <text
            x={32}
            y={15}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            stroke="none"
          >
            M
          </text>
        </g>
      }
    />
  );
}

/** Hand-operated valve — bowtie with handwheel cap (T-bar). */
export function HandValve(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={32} x2={32} y2={16} />
          <line x1={22} y1={16} x2={42} y2={16} />
        </g>
      }
    />
  );
}

/** Rupture disc — open circle bisected with a dashed diaphragm line. */
export function RuptureDisc(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <line x1={6} y1={32} x2={20} y2={32} />
      <line x1={44} y1={32} x2={58} y2={32} />
      <path d="M 20 20 L 20 44" />
      <path d="M 44 20 L 44 44" />
      <line x1={20} y1={32} x2={44} y2={32} strokeDasharray="3 2" />
      <line x1={32} y1={18} x2={32} y2={46} strokeDasharray="2 2" />
    </SvgFrame>
  );
}

/** Breather valve — atmospheric vent with two arrows in/out. */
export function BreatherValve(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <circle cx={32} cy={36} r={16} />
      <path d="M 32 36 L 32 8 M 26 14 L 32 8 L 38 14" />
      <path d="M 24 32 L 18 32 M 22 28 L 18 32 L 22 36" />
      <path d="M 40 32 L 46 32 M 42 28 L 46 32 L 42 36" />
    </SvgFrame>
  );
}

/** Flame arrestor — rectangle with cross-hatch matrix. */
export function FlameArrestor(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={14} y={22} width={36} height={20} />
      <line x1={22} y1={22} x2={22} y2={42} />
      <line x1={32} y1={22} x2={32} y2={42} />
      <line x1={42} y1={22} x2={42} y2={42} />
      <line x1={14} y1={32} x2={50} y2={32} />
      <line x1={6} y1={32} x2={14} y2={32} />
      <line x1={50} y1={32} x2={58} y2={32} />
    </SvgFrame>
  );
}

/** Pressure regulator (PCV / self-regulating) — bowtie with diaphragm dome. */
export function PressureRegulator(props: SymbolIconProps) {
  return (
    <Bowtie
      {...props}
      overlay={
        <g>
          <line x1={32} y1={32} x2={32} y2={22} />
          <path d="M 22 22 Q 32 8, 42 22 Z" />
          <line x1={32} y1={22} x2={32} y2={10} />
        </g>
      }
    />
  );
}
