import { Toolbar } from "@/components/Toolbar/Toolbar";
import { Editor } from "@/pages/Editor";
import { Analysis } from "@/pages/Analysis";
import { Drawings } from "@/pages/Drawings";
import { ElectricalWorkspace } from "@/electrical/components/ElectricalWorkspace";
import { useUIStore } from "@/store/uiStore";
import { useDirtyTracker } from "@/hooks/useDirtyTracker";

export default function App() {
  const tab = useUIStore((s) => s.tab);
  useDirtyTracker();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--color-canvas)] text-zinc-100">
      <Toolbar />
      <div className="flex-1 overflow-hidden">
        {tab === "editor" ? (
          <Editor />
        ) : tab === "analysis" ? (
          <Analysis />
        ) : tab === "drawings" ? (
          <Drawings />
        ) : (
          <ElectricalWorkspace />
        )}
      </div>
    </div>
  );
}
