import { useShallow } from "zustand/react/shallow";
import { RotateCcw, RotateCw } from "lucide-react";

import { useDiagramStore } from "@/store/diagramStore";
import { useProjectStore } from "@/store/projectStore";
import { getSymbol } from "@/symbols/registry";
import { LINE_STYLES, LINE_TYPE_ORDER } from "@/symbols/lines/lineStyles";
import type { LineType, PipeEdgeData } from "@/types/diagram";
import { cn } from "@/lib/utils";

import { ParamField } from "./ParamField";
import { TextInput } from "./fields/TextInput";
import { Select } from "./fields/Select";
import { PresetDropdown, type PresetItem } from "./PresetDropdown";
import { PIPE_PARAM_SCHEMA } from "./schemas";
import {
  PIPE_MATERIAL_OPTIONS,
  PIPE_NOMINAL_OPTIONS,
  type PipeMaterialId,
  resolvePipePreset,
} from "@/presets/pipes";
import {
  PUMP_PRESETS,
  PUMP_TIER_OPTIONS,
  type PumpPresetValues,
  type PumpTierId,
  pumpPresetsForTier,
  synthesizeCentrifugalCurve,
} from "@/presets/pumps";
import { VALVE_PRESETS, type ValvePreset } from "@/presets/valves";
import {
  FILTER_MESH_OPTIONS,
  FILTER_PRESETS,
  FILTER_SIZE_OPTIONS,
} from "@/presets/filters";

interface InspectorProps {
  className?: string;
}

export function Inspector({ className }: InspectorProps) {
  const { selectedNode, selectedEdge } = useDiagramStore(
    useShallow((s) => ({
      selectedNode:
        s.selectedNodeId !== null
          ? s.nodes.find((n) => n.id === s.selectedNodeId)
          : null,
      selectedEdge:
        s.selectedEdgeId !== null
          ? s.edges.find((e) => e.id === s.selectedEdgeId)
          : null,
    })),
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-l border-zinc-800 bg-[var(--color-panel)]",
        className,
      )}
    >
      <header className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Inspector
      </header>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {!selectedNode && !selectedEdge && <ProjectMetaForm />}
        {selectedNode && <NodeForm nodeId={selectedNode.id} />}
        {!selectedNode && selectedEdge && <EdgeForm edgeId={selectedEdge.id} />}
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      {title && (
        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {title}
        </h3>
      )}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function NodeForm({ nodeId }: { nodeId: string }) {
  const node = useDiagramStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);

  if (!node) return null;
  const symbol = getSymbol(node.data.symbolType);
  if (!symbol) {
    return (
      <p className="text-xs text-red-300">
        Unknown symbol type: {node.data.symbolType}
      </p>
    );
  }

  const params = (node.data.params ?? {}) as Record<string, unknown>;

  return (
    <>
      <Section>
        <Row label="Type">
          <span className="text-xs text-zinc-200">{symbol.label}</span>
        </Row>
        <Row label="ID">
          <span className="font-mono text-[10px] text-zinc-500">
            {node.id}
          </span>
        </Row>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-zinc-400">
            Tag
          </span>
          <TextInput
            value={node.data.tag ?? ""}
            placeholder={symbol.defaultLabel}
            onChange={(v) => updateNodeData(nodeId, { tag: v })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-zinc-400">
            Label
          </span>
          <TextInput
            value={node.data.label ?? ""}
            onChange={(v) => updateNodeData(nodeId, { label: v })}
          />
        </label>
        <RotationRow nodeId={nodeId} />
      </Section>

      {renderNodePresets(symbol.type, params, (next) =>
        updateNodeData(nodeId, { params: next }),
      )}

      {symbol.paramSchema && symbol.paramSchema.length > 0 && (
        <Section title="Parameters">
          {symbol.paramSchema.map((field) => (
            <ParamField
              key={field.key}
              schema={field}
              value={params[field.key]}
              onChange={(value) =>
                updateNodeData(nodeId, {
                  params: { ...params, [field.key]: value },
                })
              }
            />
          ))}
        </Section>
      )}
    </>
  );
}

const PUMP_SYMBOL_TYPES = new Set([
  "centrifugal-pump",
  "vertical-centrifugal-pump",
  "submersible-pump",
  "pd-pump",
  "gear-pump",
  "piston-pump",
  "screw-pump",
  "diaphragm-pump",
  "peristaltic-pump",
  "vacuum-pump",
]);

function renderNodePresets(
  symbolType: string,
  params: Record<string, unknown>,
  setParams: (next: Record<string, unknown>) => void,
) {
  if (PUMP_SYMBOL_TYPES.has(symbolType)) {
    return <PumpPresetSection params={params} setParams={setParams} />;
  }
  const valvePresets = VALVE_PRESETS[symbolType];
  if (valvePresets) {
    return (
      <ValveSizeSection
        presets={valvePresets}
        params={params}
        setParams={setParams}
      />
    );
  }
  if (FILTER_PRESETS[symbolType]) {
    return (
      <FilterPresetSection
        symbolType={symbolType}
        params={params}
        setParams={setParams}
      />
    );
  }
  return null;
}

type PumpDefMode = "catalogue" | "duty-point";

function PumpPresetSection({
  params,
  setParams,
}: {
  params: Record<string, unknown>;
  setParams: (next: Record<string, unknown>) => void;
}) {
  const mode: PumpDefMode =
    (params.pumpDefinitionMode as PumpDefMode | undefined) ?? "catalogue";

  return (
    <Section title="Pump definition">
      <div className="flex gap-1 rounded-md border border-zinc-800 bg-[var(--color-panel-2)] p-0.5">
        <ModeTab
          label="From catalogue"
          active={mode === "catalogue"}
          onClick={() =>
            setParams({ ...params, pumpDefinitionMode: "catalogue" })
          }
        />
        <ModeTab
          label="Custom duty point"
          active={mode === "duty-point"}
          onClick={() =>
            setParams({
              ...params,
              pumpDefinitionMode: "duty-point",
              pumpPresetId: undefined,
            })
          }
        />
      </div>

      {mode === "catalogue" ? (
        <PumpCataloguePicker params={params} setParams={setParams} />
      ) : (
        <PumpDutyPointForm params={params} setParams={setParams} />
      )}
    </Section>
  );
}

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded px-2 py-1 text-[11px] font-medium transition",
        active
          ? "bg-zinc-700 text-zinc-50"
          : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      {label}
    </button>
  );
}

function PumpCataloguePicker({
  params,
  setParams,
}: {
  params: Record<string, unknown>;
  setParams: (next: Record<string, unknown>) => void;
}) {
  let tier = (params.pumpPresetTier as PumpTierId | undefined) ?? "medium";
  const presetId = params.pumpPresetId as string | undefined;
  if (presetId) {
    const found = PUMP_PRESETS.find((p) => p.id === presetId);
    if (found) tier = found.tier;
  } else if (!PUMP_TIER_OPTIONS.some((t) => t.id === tier)) {
    tier = "medium";
  }

  const models = pumpPresetsForTier(tier);
  const items: PresetItem<PumpPresetValues>[] = models.map((p) => ({
    id: p.id,
    label: p.label,
    values: p.values,
  }));

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11px] font-medium text-zinc-400">
          Duty class
        </span>
        <Select
          value={tier}
          options={PUMP_TIER_OPTIONS.map((t) => ({
            value: t.id,
            label: t.label,
          }))}
          onChange={(t) => {
            const nextTier = t as PumpTierId;
            const inTier = pumpPresetsForTier(nextTier).some(
              (p) => p.id === presetId,
            );
            setParams({
              ...params,
              pumpPresetTier: nextTier,
              ...(inTier ? {} : { pumpPresetId: undefined }),
            });
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11px] font-medium text-zinc-400">
          Model / rating
        </span>
        <PresetDropdown
          items={items}
          selectedId={presetId}
          placeholder="Choose a rating…"
          onSelect={(item) => {
            const full = models.find((m) => m.id === item.id);
            setParams({
              ...params,
              ...item.values,
              pumpPresetId: item.id,
              pumpPresetTier: full?.tier ?? tier,
              pumpDefinitionMode: "catalogue",
            });
          }}
          onClear={() => setParams({ ...params, pumpPresetId: undefined })}
        />
      </label>
      <p className="px-1 text-[10px] leading-snug text-zinc-500">
        Pick a class then a specific rating. Selecting a preset overwrites the
        rated point and curve. Switch to <em>Custom duty point</em> if your
        actual pump doesn't match any of the presets.
      </p>
    </>
  );
}

function PumpDutyPointForm({
  params,
  setParams,
}: {
  params: Record<string, unknown>;
  setParams: (next: Record<string, unknown>) => void;
}) {
  const ratedQ = numberOrDefault(params.ratedFlowM3H, 50);
  const ratedH = numberOrDefault(params.ratedHeadM, 30);
  const shutoffH = numberOrDefault(
    params.shutoffHeadM,
    Math.round(ratedH * 1.25 * 10) / 10,
  );
  const shutoffAuto = params.shutoffHeadMOverride !== true;

  function regenerate(next: {
    ratedFlowM3H?: number;
    ratedHeadM?: number;
    shutoffHeadM?: number;
    shutoffHeadMOverride?: boolean;
  }) {
    const q = next.ratedFlowM3H ?? ratedQ;
    const h = next.ratedHeadM ?? ratedH;
    const overrideFlag =
      next.shutoffHeadMOverride ?? (params.shutoffHeadMOverride as boolean | undefined);
    const sh =
      next.shutoffHeadM ??
      (overrideFlag ? shutoffH : Math.round(h * 1.25 * 10) / 10);
    setParams({
      ...params,
      pumpDefinitionMode: "duty-point",
      pumpPresetId: undefined,
      ratedFlowM3H: q,
      ratedHeadM: h,
      shutoffHeadM: sh,
      shutoffHeadMOverride: overrideFlag,
      curve: synthesizeCentrifugalCurve(q, h, sh),
    });
  }

  return (
    <>
      <DutyPointField
        label="Rated flow"
        unit="m³/h"
        value={ratedQ}
        onChange={(v) => regenerate({ ratedFlowM3H: v })}
      />
      <DutyPointField
        label="Rated head"
        unit="m"
        value={ratedH}
        onChange={(v) => regenerate({ ratedHeadM: v })}
      />
      <DutyPointField
        label="Shut-off head"
        unit="m"
        hint={shutoffAuto ? "auto (1.25 × rated)" : undefined}
        value={shutoffH}
        onChange={(v) =>
          regenerate({ shutoffHeadM: v, shutoffHeadMOverride: true })
        }
      />
      {!shutoffAuto && (
        <button
          type="button"
          onClick={() =>
            regenerate({
              shutoffHeadM: Math.round(ratedH * 1.25 * 10) / 10,
              shutoffHeadMOverride: false,
            })
          }
          className="self-start px-1 text-[10px] text-sky-400 hover:text-sky-300"
        >
          ↺ reset shut-off to 1.25 × rated
        </button>
      )}
      <p className="px-1 text-[10px] leading-snug text-zinc-500">
        Enter the duty point and we'll synthesise a typical centrifugal curve
        (parabolic-ish, runout at ~1.5 × rated flow). The full curve still
        appears below in <em>Pump curve</em> if you want to tweak individual
        points.
      </p>
    </>
  );
}

function DutyPointField({
  label,
  unit,
  hint,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between px-1">
        <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
      </span>
      <TextInput
        type="number"
        unit={unit}
        value={String(value)}
        onChange={(v) => {
          const n = Number.parseFloat(v);
          if (Number.isFinite(n) && n > 0) onChange(n);
        }}
      />
    </label>
  );
}

function numberOrDefault(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function FilterPresetSection({
  symbolType,
  params,
  setParams,
}: {
  symbolType: string;
  params: Record<string, unknown>;
  setParams: (next: Record<string, unknown>) => void;
}) {
  const presets = FILTER_PRESETS[symbolType] ?? [];
  const sizeId = (params.filterSizeId as string | undefined) ?? "";
  const meshId = (params.filterMeshId as string | undefined) ?? "";

  function apply(size: string, mesh: string) {
    const found = presets.find((p) =>
      p.id.endsWith(`-${size}-${mesh}`),
    );
    const next: Record<string, unknown> = {
      ...params,
      filterSizeId: size || undefined,
      filterMeshId: mesh || undefined,
    };
    if (found) {
      Object.assign(next, found.values);
    }
    setParams(next);
  }

  return (
    <Section title="Filter sizing">
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11px] font-medium text-zinc-400">
          Line size
        </span>
        <Select
          value={sizeId}
          options={[
            { value: "", label: "— choose DN —" },
            ...FILTER_SIZE_OPTIONS.map((o) => ({
              value: o.id,
              label: o.label,
            })),
          ]}
          onChange={(v) => apply(v, meshId)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11px] font-medium text-zinc-400">
          Mesh / element rating
        </span>
        <Select
          value={meshId}
          options={[
            { value: "", label: "— choose mesh —" },
            ...FILTER_MESH_OPTIONS.map((o) => ({
              value: o.id,
              label: o.label,
            })),
          ]}
          onChange={(v) => apply(sizeId, v)}
        />
      </label>
      <p className="px-1 text-[10px] text-zinc-500">
        Picks a clean-element K and connection ID. Replace as soon as you have
        the vendor's pressure-drop curve.
      </p>
    </Section>
  );
}

function ValveSizeSection({
  presets,
  params,
  setParams,
}: {
  presets: ValvePreset[];
  params: Record<string, unknown>;
  setParams: (next: Record<string, unknown>) => void;
}) {
  const nominal =
    (params.valveNominalId as string | undefined) ??
    (params.valvePresetDn as string | undefined) ??
    "";

  return (
    <Section title="Valve sizing">
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11px] font-medium text-zinc-400">
          Nominal size (DN)
        </span>
        <Select
          value={nominal}
          options={[
            { value: "", label: "— choose DN —" },
            ...presets.map((p) => ({
              value: p.nominalId,
              label: p.nominalId,
            })),
          ]}
          onChange={(dn) => {
            const p = presets.find((x) => x.nominalId === dn);
            if (p) {
              setParams({
                ...params,
                ...p.values,
                valveNominalId: p.nominalId,
                valvePresetId: p.id,
              });
            } else {
              setParams({
                ...params,
                valveNominalId: undefined,
                valvePresetId: undefined,
              });
            }
          }}
        />
      </label>
      <p className="px-1 text-[10px] text-zinc-500">
        Valve family is the symbol you placed; this sets a typical fully-open Cv
        for the nominal bore.
      </p>
    </Section>
  );
}

function EdgeForm({ edgeId }: { edgeId: string }) {
  const edge = useDiagramStore((s) => s.edges.find((e) => e.id === edgeId));
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);

  if (!edge) return null;

  const data: PipeEdgeData = edge.data ?? {};
  const pipe = data.pipe ?? {};

  function patchPipe(patch: Record<string, unknown>) {
    const clearsPreset =
      "innerDiameterMm" in patch || "roughnessMm" in patch;
    updateEdgeData(edgeId, {
      pipe: {
        ...pipe,
        ...patch,
        ...(clearsPreset
          ? { presetMaterialId: undefined, presetNominalId: undefined }
          : {}),
      },
    });
  }

  const mat = (pipe.presetMaterialId as PipeMaterialId | undefined) ?? "";
  const nom = pipe.presetNominalId ?? "";

  function applyPipePreset(m: PipeMaterialId | "", n: string) {
    const nextPipe = {
      ...pipe,
      presetMaterialId: m || undefined,
      presetNominalId: n || undefined,
    };
    if (m && n) {
      const v = resolvePipePreset(m, n);
      if (v) {
        Object.assign(nextPipe, v);
      }
    }
    updateEdgeData(edgeId, { pipe: nextPipe });
  }

  return (
    <>
      <Section>
        <Row label="Type">
          <span className="text-xs text-zinc-200">Pipe / signal</span>
        </Row>
        <Row label="From">
          <span className="font-mono text-[10px] text-zinc-500">
            {edge.source}
          </span>
        </Row>
        <Row label="To">
          <span className="font-mono text-[10px] text-zinc-500">
            {edge.target}
          </span>
        </Row>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-zinc-400">
            Line type
          </span>
          <Select
            value={data.lineType ?? "process"}
            options={LINE_TYPE_ORDER.map((t) => ({
              value: t,
              label: LINE_STYLES[t].label,
            }))}
            onChange={(v) => updateEdgeData(edgeId, { lineType: v as LineType })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-zinc-400">
            Tag
          </span>
          <TextInput
            value={data.tag ?? ""}
            placeholder='e.g. 4"-PS-001'
            onChange={(v) => updateEdgeData(edgeId, { tag: v })}
          />
        </label>
      </Section>

      <Section title="Pipe preset">
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-zinc-400">
            Material / construction
          </span>
          <Select
            value={mat}
            options={[
              { value: "", label: "— material —" },
              ...PIPE_MATERIAL_OPTIONS.map((o) => ({
                value: o.id,
                label: o.label,
              })),
            ]}
            onChange={(v) => applyPipePreset((v || "") as PipeMaterialId | "", nom)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-zinc-400">
            Nominal size
          </span>
          <Select
            value={nom}
            options={[
              { value: "", label: "— DN / NPS —" },
              ...PIPE_NOMINAL_OPTIONS.map((o) => ({
                value: o.id,
                label: o.label,
              })),
            ]}
            onChange={(n) =>
              applyPipePreset((mat || "") as PipeMaterialId | "", n)
            }
          />
        </label>
        <p className="px-1 text-[10px] text-zinc-500">
          Pick material then size (or both); inner diameter and roughness fill in
          automatically. Editing those fields manually clears the preset link.
        </p>
      </Section>

      <Section title="Pipe">
        {PIPE_PARAM_SCHEMA.map((field) => (
          <ParamField
            key={field.key}
            schema={field}
            value={(pipe as Record<string, unknown>)[field.key]}
            onChange={(value) => patchPipe({ [field.key]: value })}
          />
        ))}
      </Section>
    </>
  );
}

function RotationRow({ nodeId }: { nodeId: string }) {
  const node = useDiagramStore((s) => s.nodes.find((n) => n.id === nodeId));
  const rotateSelected = useDiagramStore((s) => s.rotateSelected);
  const rotation = ((node?.data.rotation as number | undefined) ?? 0) % 360;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="px-1 text-[11px] font-medium text-zinc-400">
        Rotation
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Rotate left (Shift+R)"
          onClick={() => rotateSelected(-90)}
          className="flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
        >
          <RotateCcw size={13} />
        </button>
        <span className="w-10 text-center font-mono text-xs text-zinc-200">
          {rotation}°
        </span>
        <button
          type="button"
          title="Rotate right (R)"
          onClick={() => rotateSelected(90)}
          className="flex h-7 w-7 items-center justify-center rounded border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
        >
          <RotateCw size={13} />
        </button>
      </div>
    </div>
  );
}

function ProjectMetaForm() {
  const meta = useProjectStore((s) => s.meta);
  const setMeta = useProjectStore((s) => s.setMeta);

  const field = (label: string, key: keyof typeof meta, placeholder?: string) => (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-[11px] font-medium text-zinc-400">
        {label}
      </span>
      <TextInput
        value={meta[key]}
        placeholder={placeholder}
        onChange={(v) => setMeta({ [key]: v } as Partial<typeof meta>)}
      />
    </label>
  );

  return (
    <>
      <p className="mb-3 rounded border border-zinc-800 bg-zinc-900 p-2 text-[11px] text-zinc-400">
        Nothing selected. Editing project metadata used by the PDF title block.
      </p>
      <Section title="Project">
        {field("Title", "title")}
        {field("Drawing number", "drawingNumber")}
      </Section>
      <Section title="Title block">
        <div className="grid grid-cols-2 gap-2">
          {field("Drawn by", "drawnBy")}
          {field("Checked", "checkedBy")}
          {field("Approved", "approvedBy")}
          {field("Date", "date")}
          {field("Scale", "scale")}
          {field("Revision", "revision")}
          {field("Sheet", "sheet")}
          {field("Total sheets", "totalSheets")}
        </div>
      </Section>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="truncate text-right">{children}</span>
    </div>
  );
}
