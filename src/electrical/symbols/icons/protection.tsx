import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubBottom, StubTop } from "./base";

/** Cross-contact breaker glyph centred at (cx, cy). */
function Cross({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
    </>
  );
}

/** Generic circuit breaker / ACB — cross contact on the line. */
export function CircuitBreaker(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <Cross cx={32} cy={32} r={8} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Moulded-case circuit breaker — cross contact inside a box. */
export function Mccb(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={20} width={24} height={24} rx={2} />
      <Cross cx={32} cy={32} r={7} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Miniature circuit breaker — switch contact with thermal box. */
export function Mcb(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.6} fill="currentColor" />
      <line x1={32} y1={20} x2={42} y2={36} />
      <rect x={26} y={38} width={12} height={8} rx={1} />
      <line x1={32} y1={46} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Fuse — rectangle with a conductor through it (IEC). */
export function Fuse(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={24} y={22} width={16} height={20} rx={1} />
      <line x1={32} y1={22} x2={32} y2={42} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Switch-disconnector / isolator — open switch. */
export function SwitchDisconnector(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.8} fill="currentColor" />
      <line x1={32} y1={20} x2={44} y2={38} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Fused switch-disconnector — switch plus fuse. */
export function FusedSwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={26} cy={18} r={1.6} fill="currentColor" />
      <line x1={26} y1={18} x2={38} y2={30} />
      <rect x={24} y={32} width={16} height={14} rx={1} />
      <line x1={32} y1={32} x2={32} y2={46} />
      <line x1={32} y1={46} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Contactor — a power pole (switch contact with the characteristic arc) on the
 *  left, plus the operating coil (A1/A2) on the right so it can be driven from a
 *  control circuit. */
export function Contactor(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      {/* power pole */}
      <line x1={24} y1={2} x2={24} y2={16} />
      <circle cx={24} cy={18} r={1.8} fill="currentColor" />
      <line x1={24} y1={18} x2={34} y2={34} />
      <path d="M 18 40 a 6 6 0 0 1 12 0" />
      <line x1={24} y1={40} x2={24} y2={62} />
      {/* operating coil A1–A2 */}
      <line x1={49} y1={2} x2={49} y2={24} />
      <rect x={42} y={24} width={14} height={16} rx={1} />
      <line x1={46} y1={27} x2={46} y2={37} />
      <line x1={52} y1={27} x2={52} y2={37} />
      <line x1={49} y1={40} x2={49} y2={62} />
    </ElecSvg>
  );
}

/** Protection relay — square with a function marker. */
export function ProtectionRelay(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={20} y={20} width={24} height={24} rx={2} />
      <text
        x={32}
        y={37}
        fontSize={11}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        I&gt;
      </text>
      <StubBottom />
    </ElecSvg>
  );
}

/** Three short oblique phase strokes (///) centred on a single-line conductor
 *  to denote a three-pole (3-phase) device. */
function PhaseTicks({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <line x1={cx - 6} y1={cy + 3} x2={cx - 2} y2={cy - 3} />
      <line x1={cx - 1} y1={cy + 3} x2={cx + 3} y2={cy - 3} />
      <line x1={cx + 4} y1={cy + 3} x2={cx + 8} y2={cy - 3} />
    </>
  );
}

/** Generic on/off control switch — a single break contact. */
export function ControlSwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={43} y2={23} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Single-phase isolator / disconnector — open blade between two contacts. */
export function Isolator1P(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={44} y2={22} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Three-phase isolator — single-line blade with three pole ticks. */
export function Isolator3P(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <PhaseTicks cx={32} cy={10} />
      <circle cx={32} cy={20} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={44} y2={22} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Two-way / changeover switch — one common, two selectable contacts. */
export function TwoWaySwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={22} y1={6} x2={22} y2={22} />
      <line x1={42} y1={6} x2={42} y2={22} />
      <circle cx={22} cy={22} r={1.8} fill="currentColor" />
      <circle cx={42} cy={22} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={22} y2={24} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Rotary selector body with a pointer — shared by HOA and generic selectors. */
function SelectorBody({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      <line x1={cx} y1={cy} x2={cx + r * 0.6} y2={cy - r * 0.75} />
    </>
  );
}

/** Hand-Off-Auto selector switch — three-position rotary with one input and
 *  Hand / Auto output contacts. */
export function HoaSwitch(p: ElecSymbolIconProps) {
  const label = {
    fontSize: 7,
    fill: "currentColor",
    stroke: "none",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    textAnchor: "middle" as const,
  };
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={16} />
      <SelectorBody cx={32} cy={32} r={12} />
      <text x={19} y={30} {...label}>
        H
      </text>
      <text x={32} y={22} {...label}>
        O
      </text>
      <text x={45} y={30} {...label}>
        A
      </text>
      <line x1={24} y1={46} x2={24} y2={62} />
      <line x1={40} y1={46} x2={40} y2={62} />
    </ElecSvg>
  );
}

/** Generic multi-position selector switch. */
export function SelectorSwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={18} />
      <SelectorBody cx={32} cy={32} r={12} />
      <circle cx={22} cy={28} r={1.4} fill="currentColor" />
      <circle cx={42} cy={28} r={1.4} fill="currentColor" />
      <line x1={26} y1={45} x2={26} y2={62} />
      <line x1={38} y1={45} x2={38} y2={62} />
    </ElecSvg>
  );
}

/** Push-button — normally-open momentary contact with a button head. */
export function PushButton(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={13} />
      <circle cx={32} cy={16} r={3} />
      <line x1={32} y1={19} x2={32} y2={26} />
      <line x1={22} y1={26} x2={42} y2={26} />
      <circle cx={26} cy={40} r={1.6} fill="currentColor" />
      <circle cx={38} cy={40} r={1.6} fill="currentColor" />
      <line x1={26} y1={40} x2={26} y2={50} />
      <line x1={38} y1={40} x2={38} y2={50} />
      <line x1={26} y1={50} x2={38} y2={50} />
      <line x1={32} y1={50} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Emergency stop — mushroom head over a break contact. */
export function EmergencyStop(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={14} />
      <circle cx={32} cy={22} r={8} />
      <line x1={32} y1={30} x2={32} y2={36} />
      <circle cx={32} cy={38} r={1.6} fill="currentColor" />
      <line x1={32} y1={52} x2={43} y2={40} />
      <circle cx={32} cy={52} r={1.6} fill="currentColor" />
      <line x1={32} y1={52} x2={32} y2={62} />
    </ElecSvg>
  );
}

/** Limit / position switch — break contact with a roller lever. */
export function LimitSwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={43} y2={24} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <line x1={43} y1={24} x2={49} y2={18} />
      <circle cx={51} cy={16} r={3} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Key-operated switch — break contact with a key glyph. */
export function KeySwitch(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={20} r={1.8} fill="currentColor" />
      <line x1={32} y1={44} x2={43} y2={24} />
      <circle cx={32} cy={44} r={1.8} fill="currentColor" />
      <circle cx={19} cy={50} r={3} />
      <line x1={22} y1={50} x2={31} y2={50} />
      <line x1={28} y1={50} x2={28} y2={53} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Thermal overload relay — box with bimetal hooks (motor O/L protection). */
export function ThermalOverload(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={22} y={22} width={20} height={20} rx={2} />
      <path d="M 27 26 L 27 37 L 32 37" />
      <path d="M 37 26 L 37 37 L 32 37" />
      <StubBottom />
    </ElecSvg>
  );
}
