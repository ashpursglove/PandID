import { getSymbol } from "@/symbols/registry";
import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import { includeInReports } from "@/io/reporting";
import {
  PIPE_MATERIAL_OPTIONS,
  PIPE_NOMINAL_OPTIONS,
  type PipeMaterialId,
} from "@/presets/pipes";
import { FITTING_PRESETS } from "@/components/Inspector/fields/FittingsEditor";

export interface EquipmentBomRow {
  id: string;
  itemNo: number;
  tag: string;
  description: string;
  category: string;
  size?: string;
  material?: string;
  quantity: number;
  /** Free-form remarks (rated head/flow for pumps, Cv for valves, …). */
  remarks?: string;
}

export interface PipeBomRow {
  id: string;
  itemNo: number;
  description: string;
  size?: string;
  material?: string;
  totalLengthM: number;
  segments: number;
  remarks?: string;
}

export interface FittingBomRow {
  id: string;
  itemNo: number;
  description: string;
  kind: string;
  /** Pipe size the fittings live on (e.g. "DN50"). */
  size?: string;
  /** Pipe material the fittings live on (e.g. "PVC"). */
  material?: string;
  totalCount: number;
}

export interface BomData {
  equipment: EquipmentBomRow[];
  pipes: PipeBomRow[];
  fittings: FittingBomRow[];
}

/** Build a BOM from the live diagram. Equipment is grouped per node (tag-level
 * detail), pipes are aggregated by material × nominal-size, and fittings
 * (elbows, tees, gate valves…) are aggregated by kind × pipe-spec — that's the
 * grouping procurement actually cares about because a 90° elbow on DN50 PVC is
 * not the same part as one on DN80 steel.
 */
export function buildBom(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: { includePipes: boolean } = { includePipes: true },
): BomData {
  const equipment = buildEquipmentRows(nodes);
  const pipes = options.includePipes ? buildPipeRows(edges) : [];
  const fittings = options.includePipes ? buildFittingRows(edges) : [];
  return { equipment, pipes, fittings };
}

function buildEquipmentRows(nodes: DiagramNode[]): EquipmentBomRow[] {
  // Group identical items so procurement sees one line per part. "Identical"
  // means same symbol type, size, material AND spec (remarks) — a DN50 PVC gate
  // valve and a DN80 steel one stay on separate lines, but ten matching DN50
  // valves collapse into a single "10 ×" row. The individual tags are collected
  // so the user can still see exactly which instances make up the count.
  const byKey = new Map<
    string,
    EquipmentBomRow & { tags: string[] }
  >();
  let itemNo = 0;
  for (const n of nodes) {
    if (!includeInReports(n.data)) continue;
    const symbol = getSymbol(n.data.symbolType);
    if (!symbol) continue;
    // Skip pure visual "connector" symbols (tap points, off-page connectors…)
    // since they don't represent purchaseable equipment — but keep connectors
    // explicitly flagged as real items (e.g. a pipe tee).
    if (symbol.category === "connector" && !symbol.countInBom) continue;
    const tag = (n.data.tag as string | undefined) ?? n.id;
    const params = (n.data.params ?? {}) as Record<string, unknown>;
    const description = symbol.label;
    const category = symbol.subcategory ?? symbol.category;
    const size = formatSize(symbol.type, params);
    const material = formatMaterial(params);
    const remarks = formatRemarks(symbol.type, params);
    const key = `${symbol.type}::${size ?? ""}::${material ?? ""}::${remarks ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.tags.push(tag);
    } else {
      itemNo += 1;
      byKey.set(key, {
        id: key,
        itemNo,
        tag,
        tags: [tag],
        description,
        category,
        size,
        material,
        quantity: 1,
        remarks,
      });
    }
  }
  // Collapse the collected tags into the visible `tag` field once per group.
  return [...byKey.values()].map(({ tags, ...row }) => ({
    ...row,
    tag: tags.join(", "),
  }));
}

function pipeSpecLabels(pipe: NonNullable<DiagramEdge["data"]>["pipe"]): {
  material: string;
  size: string;
} {
  const p = pipe ?? {};
  const materialId = p.presetMaterialId as PipeMaterialId | undefined;
  const nominalId = p.presetNominalId as string | undefined;
  const material =
    PIPE_MATERIAL_OPTIONS.find((m) => m.id === materialId)?.label ??
    "Unspecified";
  const size =
    PIPE_NOMINAL_OPTIONS.find((s) => s.id === nominalId)?.label ??
    (p.innerDiameterMm
      ? `⌀ ${Number(p.innerDiameterMm).toFixed(1)} mm ID`
      : "—");
  return { material, size };
}

function buildPipeRows(edges: DiagramEdge[]): PipeBomRow[] {
  const byKey = new Map<string, PipeBomRow>();
  let itemNo = 0;
  for (const e of edges) {
    if (!includeInReports(e.data)) continue;
    // Bolted (direct, no-pipe) joins carry no pipe — skip them so they don't
    // show up as phantom "Unspecified, 0 m" process pipes.
    if (e.data?.direct) continue;
    const lineType = e.data?.lineType ?? "process";
    if (lineType !== "process") continue; // utility / electrical aren't pipe BOM
    const pipe = e.data?.pipe ?? {};
    const { material: materialLabel, size: sizeLabel } = pipeSpecLabels(pipe);
    const key = `${materialLabel}::${sizeLabel}`;
    const len = Number(pipe.lengthM ?? 0);
    const existing = byKey.get(key);
    if (existing) {
      existing.totalLengthM += len;
      existing.segments += 1;
    } else {
      itemNo += 1;
      byKey.set(key, {
        id: key,
        itemNo,
        description: "Process pipe",
        size: sizeLabel,
        material: materialLabel,
        totalLengthM: len,
        segments: 1,
        remarks: undefined,
      });
    }
  }
  return [...byKey.values()];
}

function buildFittingRows(edges: DiagramEdge[]): FittingBomRow[] {
  const byKey = new Map<string, FittingBomRow>();
  let itemNo = 0;
  for (const e of edges) {
    if (!includeInReports(e.data)) continue;
    if (e.data?.direct) continue;
    const lineType = e.data?.lineType ?? "process";
    if (lineType !== "process") continue;
    const pipe = e.data?.pipe ?? {};
    const fittings = pipe.fittings ?? [];
    if (fittings.length === 0) continue;
    const { material, size } = pipeSpecLabels(pipe);
    for (const f of fittings) {
      const count = Math.max(1, Math.round(Number(f.count ?? 1)));
      const preset = FITTING_PRESETS.find((p) => p.kind === f.kind);
      const description = preset?.label ?? prettifyKind(f.kind);
      const key = `${f.kind}::${material}::${size}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.totalCount += count;
      } else {
        itemNo += 1;
        byKey.set(key, {
          id: key,
          itemNo,
          description,
          kind: f.kind,
          size,
          material,
          totalCount: count,
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.description.localeCompare(b.description),
  );
}

function prettifyKind(kind: string): string {
  return kind
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatSize(
  _type: string,
  params: Record<string, unknown>,
): string | undefined {
  if (typeof params.valveNominalId === "string") return params.valveNominalId;
  if (typeof params.filterSizeId === "string")
    return String(params.filterSizeId).toUpperCase();
  if (typeof params.nominalDn === "string") return params.nominalDn;
  if (typeof params.ratedFlowM3H === "number")
    return `${params.ratedFlowM3H} m³/h`;
  return undefined;
}

function formatMaterial(params: Record<string, unknown>): string | undefined {
  if (typeof params.material === "string") return params.material;
  return undefined;
}

function formatRemarks(
  type: string,
  params: Record<string, unknown>,
): string | undefined {
  const parts: string[] = [];
  if (typeof params.ratedHeadM === "number")
    parts.push(`${params.ratedHeadM} m head`);
  if (typeof params.ratedFlowM3H === "number" && type.endsWith("pump"))
    parts.push(`${params.ratedFlowM3H} m³/h`);
  if (typeof params.cv === "number") parts.push(`Cv ${params.cv}`);
  if (typeof params.volumeM3 === "number")
    parts.push(`${params.volumeM3} m³`);
  if (typeof params.kValue === "number") parts.push(`K=${params.kValue}`);
  return parts.length ? parts.join(", ") : undefined;
}
