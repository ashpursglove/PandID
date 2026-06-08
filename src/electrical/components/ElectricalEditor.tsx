import { useMemo } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import { issueMaps, validateElectrical } from "@/electrical/analysis/validate";
import { useElectricalStore } from "@/electrical/store/electricalStore";
import { ElectricalCanvas } from "./ElectricalCanvas";
import { ElectricalPalette } from "./ElectricalPalette";
import { ElectricalInspector } from "./ElectricalInspector";
import { ElectricalWarnings } from "./ElectricalWarnings";
import { ElecIssuesContext } from "./issuesContext";

export function ElectricalEditor() {
  const nodes = useElectricalStore((s) => s.nodes);
  const edges = useElectricalStore((s) => s.edges);

  const issues = useMemo(
    () => validateElectrical(nodes, edges),
    [nodes, edges],
  );
  const maps = useMemo(() => issueMaps(issues), [issues]);

  return (
    <ReactFlowProvider>
      <ElecIssuesContext.Provider
        value={{
          nodeSeverity: maps.nodeSeverity,
          edgeSeverity: maps.edgeSeverity,
        }}
      >
        <div className="flex h-full w-full">
          <ElectricalPalette className="w-60 shrink-0" />
          <main className="relative flex-1 overflow-hidden">
            <ElectricalCanvas />
            <ElectricalWarnings issues={issues} />
          </main>
          <ElectricalInspector className="w-80 shrink-0" />
        </div>
      </ElecIssuesContext.Provider>
    </ReactFlowProvider>
  );
}
