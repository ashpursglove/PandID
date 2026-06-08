import { useRef, useState } from "react";
import { Copy, ImagePlus, Trash2, Upload } from "lucide-react";

import { useDrawingsStore, type DrawingPage } from "@/store/drawingsStore";
import { useProjectStore, type ProjectMeta } from "@/store/projectStore";
import { TextInput } from "@/components/Inspector/fields/TextInput";

interface Props {
  page: DrawingPage;
}

export function PageInspector({ page }: Props) {
  const updatePage = useDrawingsStore((s) => s.updatePage);
  const renamePage = useDrawingsStore((s) => s.renamePage);
  const updateTitleBlock = useDrawingsStore((s) => s.updateTitleBlock);
  const companyLogo = useDrawingsStore((s) => s.companyLogo);
  const setCompanyLogo = useDrawingsStore((s) => s.setCompanyLogo);
  const allPages = useDrawingsStore((s) => s.pages);
  const projectMeta = useProjectStore((s) => s.meta);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const tb = page.titleBlock;
  const otherPages = allPages.filter((p) => p.id !== page.id);

  /**
   * Copy the entire title-block override from another page. We replace —
   * not merge — so the destination ends up identical, including any fields
   * the source had explicitly cleared (which fall back to project meta).
   */
  function copyTitleBlockFrom(sourceId: string) {
    const src = allPages.find((p) => p.id === sourceId);
    if (!src) return;
    updatePage(page.id, { titleBlock: { ...src.titleBlock } });
    setCopyOpen(false);
  }

  function setTbField<K extends keyof ProjectMeta>(key: K, value: ProjectMeta[K]) {
    updateTitleBlock(page.id, { [key]: value });
  }

  function clearTbField<K extends keyof ProjectMeta>(key: K) {
    const next = { ...tb };
    delete next[key];
    updatePage(page.id, { titleBlock: next });
  }

  async function onPickLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo is larger than 2 MB — please pick a smaller file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setCompanyLogo(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-[var(--color-panel)]">
      <header className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Page settings
      </header>

      <div className="flex flex-col gap-4 p-3 text-sm">
        <Section title="Page">
          <Field label="Title">
            <TextInput
              value={page.title}
              onChange={(v) => renamePage(page.id, v)}
            />
          </Field>
          <p className="text-[10px] text-zinc-500">
            Type: <span className="text-zinc-300">{page.type}</span>
          </p>
        </Section>

        {page.type === "title" && (
          <Section title="Title / section text">
            <Field label="Heading">
              <textarea
                value={page.titlePage?.heading ?? ""}
                onChange={(e) =>
                  updatePage(page.id, {
                    titlePage: {
                      heading: e.target.value,
                      subheading: page.titlePage?.subheading ?? "",
                    },
                  })
                }
                rows={3}
                placeholder="e.g. Electrical Single-Line Diagrams"
                className="w-full resize-y rounded border border-zinc-700 bg-[var(--color-panel-2)] px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-500"
              />
            </Field>
            <Field label="Subheading (optional)">
              <textarea
                value={page.titlePage?.subheading ?? ""}
                onChange={(e) =>
                  updatePage(page.id, {
                    titlePage: {
                      heading: page.titlePage?.heading ?? "",
                      subheading: e.target.value,
                    },
                  })
                }
                rows={3}
                placeholder="e.g. Section 3 — Power distribution and motor control"
                className="w-full resize-y rounded border border-zinc-700 bg-[var(--color-panel-2)] px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-500"
              />
            </Field>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              The heading is drawn big and centred on the sheet and wraps
              automatically — long titles shrink to fit. Great for cover pages
              and section dividers between drawing sets.
            </p>
          </Section>
        )}

        {page.type === "bom" && page.bom && (
          <Section title="Bill of materials">
            <label className="flex items-center gap-2 text-[12px] text-zinc-300">
              <input
                type="checkbox"
                checked={page.bom.includePipes}
                onChange={(e) =>
                  updatePage(page.id, {
                    bom: { includePipes: e.target.checked },
                  })
                }
                className="accent-sky-500"
              />
              Include process pipe summary
            </label>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              The BOM is generated from the live diagram every time you
              render — make changes in the Editor and they'll show up here.
            </p>
          </Section>
        )}

        {page.type === "analysis" && page.analysis && (
          <Section title="Captured analysis">
            <p className="text-[12px] text-zinc-300">
              {page.analysis.startLabel} →{" "}
              <span className="text-zinc-200">{page.analysis.endLabel}</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Fluid: {page.analysis.fluidName}
            </p>
            <p className="text-[11px] text-zinc-500">
              Mode: {page.analysis.mode === "forward" ? "Predict flow" : "Target flow"}
              {page.analysis.targetQM3h != null
                ? ` (${page.analysis.targetQM3h.toFixed(2)} m³/h)`
                : ""}
            </p>
            <p className="text-[10px] text-zinc-500">
              Operating point:{" "}
              {page.analysis.result.qM3h.toFixed(2)} m³/h ·{" "}
              {page.analysis.result.pumpHeadM.toFixed(2)} m head
            </p>
          </Section>
        )}

        <Section title="Title block overrides">
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Empty fields fall back to the project-wide title block. Useful for
            different revisions or subtitles per sheet.
          </p>

          {otherPages.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setCopyOpen((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-zinc-700 bg-[var(--color-panel-2)] px-2 py-1 text-[11px] text-zinc-200 transition hover:border-sky-500 hover:text-sky-200"
              >
                <Copy size={11} /> Copy title block from another page…
              </button>
              {copyOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-700 bg-[var(--color-panel-2)] shadow-lg">
                  {otherPages.map((p, idx) => {
                    const sample =
                      p.titleBlock.title ??
                      p.titleBlock.drawingNumber ??
                      "(falls back to project)";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => copyTitleBlockFrom(p.id)}
                        className="flex w-full items-start justify-between gap-2 border-b border-zinc-800 px-2.5 py-1.5 text-left text-[11px] last:border-0 hover:bg-zinc-800"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-zinc-100">
                            {idx + 1}. {p.title}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-500">
                            {sample}
                          </span>
                        </span>
                        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase text-zinc-400">
                          {p.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <TitleField
            label="Company name"
            placeholder={projectMeta.companyName ?? ""}
            value={tb.companyName}
            onChange={(v) =>
              v ? setTbField("companyName", v) : clearTbField("companyName")
            }
          />
          <TitleField
            label="Title"
            placeholder={projectMeta.title}
            value={tb.title}
            onChange={(v) => (v ? setTbField("title", v) : clearTbField("title"))}
          />
          <TitleField
            label="Drawing number"
            placeholder={projectMeta.drawingNumber}
            value={tb.drawingNumber}
            onChange={(v) =>
              v ? setTbField("drawingNumber", v) : clearTbField("drawingNumber")
            }
          />
          <TitleField
            label="Drawn by"
            placeholder={projectMeta.drawnBy}
            value={tb.drawnBy}
            onChange={(v) => (v ? setTbField("drawnBy", v) : clearTbField("drawnBy"))}
          />
          <TitleField
            label="Checked"
            placeholder={projectMeta.checkedBy}
            value={tb.checkedBy}
            onChange={(v) =>
              v ? setTbField("checkedBy", v) : clearTbField("checkedBy")
            }
          />
          <TitleField
            label="Approved"
            placeholder={projectMeta.approvedBy}
            value={tb.approvedBy}
            onChange={(v) =>
              v ? setTbField("approvedBy", v) : clearTbField("approvedBy")
            }
          />
          <TitleField
            label="Date"
            placeholder={projectMeta.date}
            value={tb.date}
            onChange={(v) => (v ? setTbField("date", v) : clearTbField("date"))}
          />
          <TitleField
            label="Scale"
            placeholder={projectMeta.scale || "NTS"}
            value={tb.scale}
            onChange={(v) => (v ? setTbField("scale", v) : clearTbField("scale"))}
          />
          <TitleField
            label="Revision"
            placeholder={projectMeta.revision || "0"}
            value={tb.revision}
            onChange={(v) =>
              v ? setTbField("revision", v) : clearTbField("revision")
            }
          />
        </Section>

        <Section title="Company logo">
          {companyLogo ? (
            <div className="space-y-2">
              <div className="flex h-20 items-center justify-center rounded border border-zinc-800 bg-white p-2">
                <img
                  src={companyLogo}
                  alt="Company logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded border border-zinc-700 bg-[var(--color-panel-2)] px-2 py-1 text-[11px] text-zinc-200 hover:border-sky-500"
                >
                  <Upload size={11} /> Replace
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyLogo(null)}
                  className="flex items-center justify-center gap-1.5 rounded border border-red-800 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 hover:border-red-500"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-zinc-700 bg-[var(--color-panel-2)] px-3 py-4 text-[12px] text-zinc-400 hover:border-sky-500 hover:text-sky-200"
            >
              <ImagePlus size={14} /> Upload logo (PNG, JPG, SVG)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickLogo(file);
              e.target.value = "";
            }}
          />
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Embedded into the title block on every page of every export.
          </p>
        </Section>

        <Section title="Annotations">
          {page.annotations.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              No annotations yet. Use the toolbar above the page to add text,
              notes, or arrows.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              {page.annotations.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-zinc-800 bg-[var(--color-panel-2)] px-2 py-1"
                >
                  <span className="text-zinc-300">
                    <span className="mr-1 rounded bg-zinc-800 px-1 py-0.5 text-[9px] uppercase text-zinc-400">
                      {a.kind}
                    </span>
                    {a.text ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-[11px] font-medium text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function TitleField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-[11px] font-medium text-zinc-400">{label}</span>
      <TextInput
        value={value ?? ""}
        placeholder={placeholder ?? ""}
        onChange={onChange}
      />
    </label>
  );
}
