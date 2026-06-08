import { RotateCcw, RotateCw } from "lucide-react";

import { useElectricalStore } from "@/electrical/store/electricalStore";
import { getElecSymbol } from "@/electrical/symbols/registry";
import { CONNECTION_STYLES } from "@/electrical/symbols/connectionStyles";
import {
  STANDARD_CSA,
  cableFromPreset,
  defaultCableForConnection,
  getCablePreset,
  groupedPresetsForConnection,
} from "@/electrical/symbols/cablePresets";
import type { ConnectionType, ElecParamField } from "@/electrical/types";
import { IncludeInReportsRow } from "@/components/shared/IncludeInReportsRow";
import { ZoneInspector } from "@/components/shared/ZoneInspector";
import { DEFAULT_ZONE_COLOR, isZoneNode } from "@/components/shared/zone";
import { includeInReports } from "@/io/reporting";
import { cn } from "@/lib/utils";

interface InspectorProps {
  className?: string;
}

const FIELD_CLASS =
  "w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500";
const LABEL_CLASS = "text-[11px] font-medium text-zinc-400";

export function ElectricalInspector({ className }: InspectorProps) {
  // Only subscribe to the *ids* here. The forms below subscribe to their own
  // node/edge slice, so typing in a field doesn't re-render (and remount) this
  // outer component — which previously stole focus after every keystroke.
  const selectedNodeId = useElectricalStore((s) => s.selectedNodeId);
  const selectedEdgeId = useElectricalStore((s) => s.selectedEdgeId);

  return (
    <aside
      className={cn(
        "flex flex-col border-l border-zinc-800 bg-[var(--color-panel)]",
        className,
      )}
    >
      <header className="border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Properties
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {!selectedNodeId && !selectedEdgeId && (
          <p className="px-1 py-6 text-center text-[11px] text-zinc-500">
            Select a component or feeder to edit its properties.
          </p>
        )}
        {selectedNodeId && <NodeForm nodeId={selectedNodeId} />}
        {!selectedNodeId && selectedEdgeId && <EdgeForm edgeId={selectedEdgeId} />}
      </div>
    </aside>
  );
}

function NodeForm({ nodeId }: { nodeId: string }) {
  const n = useElectricalStore((s) => s.nodes.find((x) => x.id === nodeId));
  const updateNodeData = useElectricalStore((s) => s.updateNodeData);
  const rotateSelected = useElectricalStore((s) => s.rotateSelected);
  if (!n) return null;

  if (isZoneNode(n)) {
    return (
      <ZoneInspector
        label={(n.data.zoneLabel as string) ?? ""}
        color={(n.data.zoneColor as string) ?? DEFAULT_ZONE_COLOR}
        onLabel={(zoneLabel) => updateNodeData(nodeId, { zoneLabel })}
        onColor={(zoneColor) => updateNodeData(nodeId, { zoneColor })}
      />
    );
  }

  const symbol = getElecSymbol(n.data.symbolType);
  const params = (n.data.params ?? {}) as Record<string, unknown>;

  const setParam = (key: string, value: unknown) =>
    updateNodeData(nodeId, { params: { ...params, [key]: value } });

  const groups = groupSchema(symbol?.paramSchema ?? []);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">
          {symbol?.label ?? n.data.symbolType}
        </h3>
        {symbol?.description && (
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {symbol.description}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Tag</span>
        <input
          className={FIELD_CLASS}
          value={(n.data.tag as string) ?? ""}
          onChange={(e) => updateNodeData(nodeId, { tag: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Label</span>
        <input
          className={FIELD_CLASS}
          value={(n.data.label as string) ?? ""}
          onChange={(e) => updateNodeData(nodeId, { label: e.target.value })}
        />
      </label>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLASS}>Rotation</span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => rotateSelected(-90)}
            className="rounded border border-zinc-800 bg-zinc-950 p-1 text-zinc-300 hover:border-zinc-600"
            title="Rotate left"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => rotateSelected(90)}
            className="rounded border border-zinc-800 bg-zinc-950 p-1 text-zinc-300 hover:border-zinc-600"
            title="Rotate right"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      <IncludeInReportsRow
        checked={includeInReports(n.data)}
        onChange={(v) => updateNodeData(nodeId, { includeInReports: v })}
        label="Include in BOM & schedules"
      />

      {groups.map(({ group, fields }) => (
        <fieldset key={group} className="flex flex-col gap-2 border-t border-zinc-800 pt-2">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {group}
          </legend>
          {fields.map((f) => (
            <ParamField
              key={f.key}
              field={f}
              value={params[f.key] ?? f.default}
              onChange={(v) => setParam(f.key, v)}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function EdgeForm({ edgeId }: { edgeId: string }) {
  const e = useElectricalStore((s) => s.edges.find((x) => x.id === edgeId));
  const updateEdgeData = useElectricalStore((s) => s.updateEdgeData);
  const removeEdgeById = useElectricalStore((s) => s.removeEdgeById);
  if (!e) return null;
  const data = e.data ?? {};
  const connectionType = data.connectionType ?? "lv-power";
  const cable = data.cable ?? {};

  // Bolted (direct) connection: no cable to configure — just describe it and
  // offer an Unbolt action to break the joint.
  if (connectionType === "direct") {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Bolted connection
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
            A direct, no-cable joint — the two components are bolted together
            (e.g. a breaker on a board's bus). It carries current but isn't a
            cable, so it never appears in cable schedules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeEdgeById(edgeId)}
          className="self-start rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 hover:border-red-500 hover:text-red-300"
        >
          Unbolt (remove connection)
        </button>
      </div>
    );
  }
  const waypointCount = data.waypoints?.length ?? 0;

  const preset = getCablePreset(cable.presetId);
  const presetGroups = groupedPresetsForConnection(connectionType);
  // Sized cables expose the CSA / material / insulation selectors; fixed-build
  // cables (CAT6, coax, fibre…) hide them.
  const showSize = preset ? !preset.fixedSize : true;

  const setCable = (patch: Record<string, unknown>) =>
    updateEdgeData(edgeId, { cable: { ...cable, ...patch } });

  const setConnectionType = (next: ConnectionType) => {
    // Switching discipline (e.g. power → control) swaps the cable to a sensible
    // default for the new type so a power preset can't linger on a signal line.
    updateEdgeData(edgeId, {
      connectionType: next,
      cable: defaultCableForConnection(next),
    });
  };

  const applyPreset = (id: string) => {
    const p = getCablePreset(id);
    if (p) updateEdgeData(edgeId, { cable: cableFromPreset(p, cable) });
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-100">Feeder</h3>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Tag</span>
        <input
          className={FIELD_CLASS}
          value={(data.tag as string) ?? ""}
          onChange={(ev) => updateEdgeData(edgeId, { tag: ev.target.value })}
          placeholder="e.g. W-101"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Connection type</span>
        <select
          className={FIELD_CLASS}
          value={connectionType}
          onChange={(ev) => setConnectionType(ev.target.value as ConnectionType)}
        >
          {Object.values(CONNECTION_STYLES)
            .filter((s) => s.type !== "direct")
            .map((s) => (
              <option key={s.type} value={s.type}>
                {s.label}
              </option>
            ))}
        </select>
      </label>

      <IncludeInReportsRow
        checked={includeInReports(data)}
        onChange={(v) => updateEdgeData(edgeId, { includeInReports: v })}
        label="Include in cable schedule & BOM"
      />

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="accent-sky-500"
          checked={data.showSpec ?? false}
          onChange={(ev) => updateEdgeData(edgeId, { showSpec: ev.target.checked })}
        />
        <span className={LABEL_CLASS}>Show cable type / size on diagram</span>
      </label>
      {(data.showSpec ?? false) && (
        <p className="text-[10px] leading-snug text-zinc-500">
          Drag the cable label on the diagram to reposition it (⠿ handle).
        </p>
      )}

      <div className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Routing</span>
        <p className="text-[10px] leading-snug text-zinc-500">
          Double-click a selected feeder to drop a draggable bend point. Drag
          points to arrange the line; double-click a point to remove it.
        </p>
        {waypointCount > 0 && (
          <button
            type="button"
            onClick={() => updateEdgeData(edgeId, { waypoints: [] })}
            className="self-start rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 hover:border-sky-500 hover:text-sky-200"
          >
            Clear {waypointCount} bend point{waypointCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <fieldset className="flex flex-col gap-2 border-t border-zinc-800 pt-2">
        <legend className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Cable / conductor
        </legend>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Cable type</span>
          <select
            className={FIELD_CLASS}
            value={cable.presetId ?? ""}
            onChange={(ev) => applyPreset(ev.target.value)}
          >
            <option value="" disabled>
              Choose a cable…
            </option>
            {presetGroups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {preset?.conductors && (
          <p className="text-[10px] text-zinc-500">
            Conductors: {preset.conductors}
          </p>
        )}
        {preset?.note && (
          <p className="text-[10px] leading-snug text-zinc-500">{preset.note}</p>
        )}

        {showSize && (
          <>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>CSA (mm²)</span>
              <select
                className={FIELD_CLASS}
                value={String(cable.csaMm2 ?? 2.5)}
                onChange={(ev) => setCable({ csaMm2: Number(ev.target.value) })}
              >
                {STANDARD_CSA.map((s) => (
                  <option key={s} value={s}>
                    {s} mm²
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Material</span>
              <select
                className={FIELD_CLASS}
                value={cable.material ?? "copper"}
                onChange={(ev) =>
                  setCable({
                    material: ev.target.value as "copper" | "aluminium",
                  })
                }
              >
                <option value="copper">Copper</option>
                <option value="aluminium">Aluminium</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Insulation</span>
              <select
                className={FIELD_CLASS}
                value={cable.insulation ?? "XLPE"}
                onChange={(ev) =>
                  setCable({ insulation: ev.target.value as "PVC" | "XLPE" })
                }
              >
                <option value="XLPE">XLPE</option>
                <option value="PVC">PVC</option>
              </select>
            </label>
            <NumberRow
              label="Parallel runs"
              value={cable.parallelRuns ?? 1}
              min={1}
              step={1}
              onChange={(v) => setCable({ parallelRuns: v })}
            />
          </>
        )}

        <NumberRow
          label="Length"
          unit="m"
          value={cable.lengthM ?? 0}
          min={0}
          onChange={(v) => setCable({ lengthM: v })}
        />
      </fieldset>
    </div>
  );
}

function ParamField({
  field,
  value,
  onChange,
}: {
  field: ElecParamField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.kind === "select") {
    return (
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>
          {field.label}
          {field.unit ? ` (${field.unit})` : ""}
        </span>
        <select
          className={FIELD_CLASS}
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(field.numeric ? Number(e.target.value) : e.target.value)
          }
        >
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {field.numeric && field.unit ? `${o} ${field.unit}` : o}
            </option>
          ))}
        </select>
        {field.description && (
          <span className="text-[10px] text-zinc-600">{field.description}</span>
        )}
      </label>
    );
  }
  if (field.kind === "text") {
    return (
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{field.label}</span>
        <input
          className={FIELD_CLASS}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.description && (
          <span className="text-[10px] text-zinc-600">{field.description}</span>
        )}
      </label>
    );
  }
  if (field.kind === "slider") {
    return (
      <SliderRow
        label={field.label}
        unit={field.unit}
        value={typeof value === "number" ? value : Number(value ?? field.default ?? 0)}
        min={field.min ?? 0}
        max={field.max ?? 100}
        step={field.step ?? 1}
        description={field.description}
        onChange={onChange}
      />
    );
  }
  return (
    <NumberRow
      label={field.label}
      unit={field.unit}
      value={typeof value === "number" ? value : Number(value ?? 0)}
      step={field.step}
      min={field.min}
      max={field.max}
      description={field.description}
      onChange={onChange}
    />
  );
}

function NumberRow({
  label,
  unit,
  value,
  step,
  min,
  max,
  description,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>
        {label}
        {unit ? ` (${unit})` : ""}
      </span>
      <input
        type="number"
        className={FIELD_CLASS}
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {description && (
        <span className="text-[10px] text-zinc-600">{description}</span>
      )}
    </label>
  );
}

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  description,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={cn(LABEL_CLASS, "flex items-center justify-between")}>
        <span>{label}</span>
        <span className="tabular-nums text-zinc-300">
          {Number.isFinite(value) ? Math.round(value) : 0}
          {unit ? ` ${unit}` : ""}
        </span>
      </span>
      <input
        type="range"
        className="w-full accent-sky-500"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {description && (
        <span className="text-[10px] text-zinc-600">{description}</span>
      )}
    </label>
  );
}

function groupSchema(
  schema: ElecParamField[],
): { group: string; fields: ElecParamField[] }[] {
  const map = new Map<string, ElecParamField[]>();
  for (const f of schema) {
    const g = f.group ?? "Parameters";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(f);
  }
  return [...map.entries()].map(([group, fields]) => ({ group, fields }));
}
