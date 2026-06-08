import { createContext, useContext } from "react";

import type { ElecIssueSeverity } from "@/electrical/analysis/validate";

export interface ElecIssuesContextValue {
  nodeSeverity: Map<string, ElecIssueSeverity>;
  edgeSeverity: Map<string, ElecIssueSeverity>;
}

const EMPTY: ElecIssuesContextValue = {
  nodeSeverity: new Map(),
  edgeSeverity: new Map(),
};

export const ElecIssuesContext = createContext<ElecIssuesContextValue>(EMPTY);

export function useNodeIssue(id: string): ElecIssueSeverity | undefined {
  return useContext(ElecIssuesContext).nodeSeverity.get(id);
}

export function useEdgeIssue(id: string): ElecIssueSeverity | undefined {
  return useContext(ElecIssuesContext).edgeSeverity.get(id);
}
