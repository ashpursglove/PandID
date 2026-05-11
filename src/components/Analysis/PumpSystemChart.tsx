import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Maximize2, Move } from "lucide-react";

import type { SinglePathResult } from "@/engine/types";

type Domain = [number, number];

interface PumpSystemChartProps {
  result: SinglePathResult;
}

/**
 * Pump-vs-system chart with auto-scaling and mouse zoom / pan.
 *
 * - Axes auto-size around the operating point on every solve.
 * - Mouse wheel zooms around the cursor.
 * - Click-drag pans both axes.
 * - Double-click or the corner button resets the view.
 */
export function PumpSystemChart({ result }: PumpSystemChartProps) {
  const data = useMemo(() => buildData(result), [result]);
  const natural = useMemo(() => computeNaturalDomains(result), [result]);

  const [xDomain, setXDomain] = useState<Domain>(natural.x);
  const [yDomain, setYDomain] = useState<Domain>(natural.y);

  // Reset to a fresh auto-scaled view whenever a new solve lands.
  useEffect(() => {
    setXDomain(natural.x);
    setYDomain(natural.y);
  }, [natural]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<null | {
    startX: number;
    startY: number;
    initialX: Domain;
    initialY: Domain;
    rect: DOMRect;
  }>(null);

  // Wheel zoom needs a non-passive listener so we can preventDefault and not
  // scroll the surrounding page while the user is centering on the chart.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const xFrac = clamp01((e.clientX - rect.left) / rect.width);
      const yFrac = clamp01(1 - (e.clientY - rect.top) / rect.height);

      const xCenter = xDomain[0] + xFrac * (xDomain[1] - xDomain[0]);
      const yCenter = yDomain[0] + yFrac * (yDomain[1] - yDomain[0]);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;

      setXDomain(zoomAround(xDomain, xCenter, factor));
      setYDomain(zoomAround(yDomain, yCenter, factor));
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [xDomain, yDomain]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: xDomain,
      initialY: yDomain,
      rect: el.getBoundingClientRect(),
    };
    el.style.cursor = "grabbing";

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const dxData = (dx / d.rect.width) * (d.initialX[1] - d.initialX[0]);
      const dyData = (dy / d.rect.height) * (d.initialY[1] - d.initialY[0]);
      setXDomain(clampMinZero([d.initialX[0] - dxData, d.initialX[1] - dxData]));
      // dragging down lowers the view → we want the same data points to move
      // down with the cursor, so domain shifts up by dyData (y-axis is flipped
      // on screen).
      setYDomain(clampMinZero([d.initialY[0] + dyData, d.initialY[1] + dyData]));
    };
    const onUp = () => {
      dragRef.current = null;
      if (el) el.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const reset = () => {
    setXDomain(natural.x);
    setYDomain(natural.y);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onDoubleClick={reset}
      className="relative h-full w-full cursor-grab select-none touch-none"
    >
      <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex items-center gap-1 rounded bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-800">
        <Move size={10} /> drag to pan • scroll to zoom • dbl-click resets
      </div>
      <button
        type="button"
        onClick={reset}
        title="Reset view"
        className="absolute right-2 top-1.5 z-10 inline-flex items-center gap-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <Maximize2 size={10} /> Reset view
      </button>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 28, right: 18, left: 8, bottom: 14 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="2 3" />
          <XAxis
            dataKey="q"
            type="number"
            domain={xDomain}
            allowDataOverflow
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            tickFormatter={fmtNumber}
            label={{
              value: "Q (m³/h)",
              position: "insideBottom",
              offset: -6,
              fill: "#71717a",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            domain={yDomain}
            allowDataOverflow
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            tickFormatter={fmtNumber}
            label={{
              value: "H (m)",
              angle: -90,
              position: "insideLeft",
              fill: "#71717a",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              color: "#e4e4e7",
              fontSize: 11,
            }}
            labelFormatter={(v) =>
              typeof v === "number" ? `Q = ${fmtNumber(v)} m³/h` : `${v}`
            }
            formatter={(v: number) =>
              typeof v === "number" ? `${fmtNumber(v)} m` : `${v}`
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {result.elevationDeltaM > 0.05 && (
            <ReferenceLine
              y={result.elevationDeltaM}
              stroke="#52525b"
              strokeDasharray="4 4"
              label={{
                value: `Static lift ${result.elevationDeltaM.toFixed(1)} m`,
                fill: "#a1a1aa",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="pump"
            name="Pump"
            stroke="#7dd3fc"
            dot={false}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="system"
            name="System"
            stroke="#fda4af"
            dot={false}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
          {result.qM3h > 0 && (
            <ReferenceDot
              x={result.qM3h}
              y={result.pumpHeadM}
              r={5}
              fill="#fde047"
              stroke="#000"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------- helpers ------------------------------------- */

function buildData(result: SinglePathResult) {
  const map = new Map<number, { q: number; pump?: number; system?: number }>();
  for (const p of result.pumpCurveSampled) {
    const key = Number(p.q.toFixed(2));
    map.set(key, { ...(map.get(key) ?? { q: key }), pump: p.h });
  }
  for (const p of result.systemCurveSampled) {
    const key = Number(p.q.toFixed(2));
    map.set(key, { ...(map.get(key) ?? { q: key }), system: p.h });
  }
  return [...map.values()].sort((a, b) => a.q - b.q);
}

function computeNaturalDomains(result: SinglePathResult): {
  x: Domain;
  y: Domain;
} {
  const opQ = Math.max(0, result.qM3h);
  const opH = Math.max(0, result.pumpHeadM);
  const shutoff = Math.max(0, result.pumpShutoffHeadM);
  const elev = Math.max(0, result.elevationDeltaM);
  const maxAchievable = Math.max(
    0,
    result.feasibility.maxAchievableQM3h ?? 0,
  );
  const pumpEnd = lastNonZeroQ(result.pumpCurveSampled);

  // Pick a Q range that hugs the *operating region* rather than the full pump
  // curve. The system curve typically explodes with Q² losses, so anchoring
  // the X-axis to where the action is keeps the intersection visible.
  let xMax = 0;
  if (opQ > 0) xMax = opQ * 1.6;
  else if (maxAchievable > 0) xMax = maxAchievable * 1.6;
  else if (shutoff > 0 && pumpEnd > 0)
    // No operating point and no achievable flow (e.g. pump can't lift static
    // head): show the useful end of the pump curve so the user sees it sits
    // below the elevation line.
    xMax = pumpEnd * 1.05;
  if (!finitePositive(xMax)) xMax = 10;
  xMax = niceCeil(xMax);

  // Pick a Y range that comfortably covers the pump head at the operating
  // point and the shut-off head, but NOT the runaway system-curve values at
  // high Q — those would dwarf everything.
  let yMax = Math.max(
    opH * 1.3,
    shutoff * 1.15,
    elev * 1.4,
    result.systemHeadM * 1.3,
    2,
  );
  if (!finitePositive(yMax)) yMax = 10;
  yMax = niceCeil(yMax);

  return { x: [0, xMax], y: [0, yMax] };
}

function lastNonZeroQ(points: { q: number; h: number }[]): number {
  let last = 0;
  for (const p of points) {
    if (p.h > 0.05) last = p.q;
  }
  return last;
}

function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function finitePositive(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function zoomAround(domain: Domain, center: number, factor: number): Domain {
  const [lo, hi] = domain;
  const newLo = center - (center - lo) / factor;
  const newHi = center + (hi - center) / factor;
  return clampMinZero([newLo, newHi]);
}

function clampMinZero(d: Domain): Domain {
  // Keep the lower bound at zero; flow and head don't go negative on this view.
  // If panning would push past zero, shift the window so the lower edge sits
  // at zero while preserving its width.
  let [lo, hi] = d;
  if (lo < 0) {
    hi -= lo;
    lo = 0;
  }
  if (hi <= lo) hi = lo + 1;
  return [lo, hi];
}

function fmtNumber(v: number): string {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
