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
} from "@/presets/pumps";
import { VALVE_PRESETS, type ValvePreset } from "@/presets/valves";

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

function renderNodePresets(
  symbolType: string,
  params: Record<string, unknown>,
  setParams: (next: Record<string, unknown>) => void,
) {
  if (symbolType === "centrifugal-pump" || symbolType === "pd-pump") {
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
  return null;
}

function PumpPresetSection({
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
    <Section title="Pump preset">
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
          Curve / rating
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
            });
          }}
          onClear={() =>
            setParams({
              ...params,
              pumpPresetId: undefined,
            })
          }
        />
      </label>
      <p className="px-1 text-[10px] text-zinc-500">
        Pick a class, then a specific curve. Adjust numbers below to match your
        datasheet.
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
