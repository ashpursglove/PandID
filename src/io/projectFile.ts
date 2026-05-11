/**
 * Versioned `.pid` project file schema + serialise / deserialise / migrate.
 *
 * Forward-compat: bump `LATEST_VERSION` and add a case to `migrate()` whenever
 * the on-disk shape changes. Never break existing files.
 */

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { Fluid, ProjectMeta } from "@/store/projectStore";

export const LATEST_VERSION = 1 as const;

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

export interface ProjectAnalysisV1 {
  id: string;
  name: string;
  type: "single-path";
  inputs: unknown;
  results?: unknown;
}

export type ProjectFile = ProjectFileV1;

export interface SerialiseInput {
  meta: ProjectMeta;
  fluids: Fluid[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  analyses?: ProjectAnalysisV1[];
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
  const current = raw;
  if (current.version === 1) {
    return validateV1(current);
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
