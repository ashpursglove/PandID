/**
 * Versioned `.pid` project file schema + serialise / deserialise / migrate.
 *
 * Forward-compat: bump `LATEST_VERSION` and add a case to `migrate()` whenever
 * the on-disk shape changes. Never break existing files.
 */

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { Fluid, ProjectMeta } from "@/store/projectStore";
import type { DrawingPage } from "@/store/drawingsStore";
import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";

export const LATEST_VERSION = 3 as const;

export interface ProjectFileV1 {
  version: 1;
  meta: ProjectMeta;
  fluids: Fluid[];
  diagram: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
  };
  analyses: ProjectAnalysisV1[];
}

/** V2 adds the Drawings tab payload: pages + a project-wide company logo. */
export interface ProjectFileV2 extends Omit<ProjectFileV1, "version"> {
  version: 2;
  drawings: DrawingPage[];
  companyLogo: string | null;
}

/** V3 adds the electrical single-line diagram (SLD) discipline. */
export interface ProjectFileV3 extends Omit<ProjectFileV2, "version"> {
  version: 3;
  electrical: {
    nodes: ElecNode[];
    edges: ElecEdge[];
  };
}

export interface ProjectAnalysisV1 {
  id: string;
  name: string;
  type: "single-path";
  inputs: unknown;
  results?: unknown;
}

export type ProjectFile = ProjectFileV3;

export interface SerialiseInput {
  meta: ProjectMeta;
  fluids: Fluid[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  analyses?: ProjectAnalysisV1[];
  drawings?: DrawingPage[];
  companyLogo?: string | null;
  electricalNodes?: ElecNode[];
  electricalEdges?: ElecEdge[];
}

export function serialise(input: SerialiseInput): string {
  const file: ProjectFile = {
    version: LATEST_VERSION,
    meta: input.meta,
    fluids: input.fluids,
    diagram: {
      nodes: input.nodes,
      edges: input.edges,
    },
    analyses: input.analyses ?? [],
    drawings: input.drawings ?? [],
    companyLogo: input.companyLogo ?? null,
    electrical: {
      nodes: input.electricalNodes ?? [],
      edges: input.electricalEdges ?? [],
    },
  };
  return JSON.stringify(file, null, 2);
}

export class ProjectParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectParseError";
  }
}

export function deserialise(text: string): ProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ProjectParseError(
      `File is not valid JSON: ${(e as Error).message}`,
    );
  }
  if (!raw || typeof raw !== "object") {
    throw new ProjectParseError("File root must be an object.");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== "number") {
    throw new ProjectParseError("Missing `version` field.");
  }
  return migrate(obj);
}

/**
 * Walks any older file forward to the latest version. Each step is its own
 * function for clarity. Add new steps below the existing ones.
 */
function migrate(raw: Record<string, unknown>): ProjectFile {
  let current: Record<string, unknown> = raw;
  if (current.version === 1) {
    current = migrateV1toV2(validateV1(current)) as unknown as Record<
      string,
      unknown
    >;
  }
  if (current.version === 2) {
    current = migrateV2toV3(validateV2(current)) as unknown as Record<
      string,
      unknown
    >;
  }
  if (current.version === 3) {
    return validateV3(current);
  }
  throw new ProjectParseError(
    `Unknown project file version: ${current.version}`,
  );
}

function validateV1(raw: Record<string, unknown>): ProjectFileV1 {
  const meta = raw.meta as ProjectMeta | undefined;
  const fluids = raw.fluids as Fluid[] | undefined;
  const diagram = raw.diagram as ProjectFileV1["diagram"] | undefined;
  if (!meta || !fluids || !diagram) {
    throw new ProjectParseError("Missing meta, fluids, or diagram section.");
  }
  if (!Array.isArray(diagram.nodes) || !Array.isArray(diagram.edges)) {
    throw new ProjectParseError("Diagram nodes/edges must be arrays.");
  }
  return {
    version: 1,
    meta,
    fluids,
    diagram: {
      nodes: diagram.nodes,
      edges: diagram.edges,
    },
    analyses: Array.isArray(raw.analyses)
      ? (raw.analyses as ProjectAnalysisV1[])
      : [],
  };
}

function migrateV1toV2(v1: ProjectFileV1): ProjectFileV2 {
  return {
    ...v1,
    version: 2,
    drawings: [],
    companyLogo: null,
  };
}

function validateV2(raw: Record<string, unknown>): ProjectFileV2 {
  const v1 = validateV1({ ...raw, version: 1 });
  const drawings = Array.isArray(raw.drawings)
    ? (raw.drawings as DrawingPage[])
    : [];
  const companyLogo =
    typeof raw.companyLogo === "string" ? raw.companyLogo : null;
  return {
    ...v1,
    version: 2,
    drawings,
    companyLogo,
  };
}

function migrateV2toV3(v2: ProjectFileV2): ProjectFileV3 {
  return {
    ...v2,
    version: 3,
    electrical: { nodes: [], edges: [] },
  };
}

function validateV3(raw: Record<string, unknown>): ProjectFileV3 {
  const v2 = validateV2({ ...raw, version: 2 });
  const elecRaw = raw.electrical as
    | { nodes?: unknown; edges?: unknown }
    | undefined;
  const electrical = {
    nodes: Array.isArray(elecRaw?.nodes) ? (elecRaw!.nodes as ElecNode[]) : [],
    edges: Array.isArray(elecRaw?.edges) ? (elecRaw!.edges as ElecEdge[]) : [],
  };
  return {
    ...v2,
    version: 3,
    electrical,
  };
}
