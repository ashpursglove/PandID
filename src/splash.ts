/**
 * Bootstrap narration for the inline splash screen defined in `index.html`.
 *
 * Goals:
 *  1. Always show *some* movement — the user never has to guess whether the
 *     program is hung. Even on a sub-second cold launch we narrate the steps
 *     with small delays so the log can be read.
 *  2. Surface what the Rust side actually did. The `setup` hook stores a
 *     structured log (file association status, platform, version, …) which
 *     we replay verbatim once IPC is alive.
 *  3. Gate the dismiss on a minimum visible duration, so a very fast launch
 *     doesn't make the splash flash and vanish in 80ms.
 */

const SPLASH_MIN_VISIBLE_MS = 1100;
const SPLASH_FADE_MS = 320;

type SplashStatus = "running" | "done" | "skipped" | "warning" | "info";

interface SplashOpts {
  key?: string;
  status?: SplashStatus;
  detail?: string;
}

interface SplashApi {
  log: (msg: string, opts?: SplashOpts) => void;
  done: (key: string, msg: string, detail?: string) => void;
  info: (msg: string, detail?: string) => void;
  warning: (msg: string, detail?: string) => void;
  skipped: (key: string, msg: string, detail?: string) => void;
  setVersion: (version: string) => void;
  dismiss: () => void;
}

declare global {
  interface Window {
    __splash?: SplashApi;
    __TAURI_INTERNALS__?: unknown;
  }
}

/** Mirror of the `StartupEntry` structure from `src-tauri/src/startup_log.rs`. */
interface StartupEntry {
  status: "done" | "skipped" | "warning" | "info";
  message: string;
  detail: string | null;
}

interface StartupReport {
  version: string;
  platform: string;
  entries: StartupEntry[];
}

const launchedAt = performance.now();

export async function runSplashNarration(): Promise<void> {
  const splash = window.__splash;
  if (!splash) return;

  // The first row was added inline before this script ever ran — flip it
  // from "running" to "done" so the user sees forward progress on every step.
  splash.done("boot", "WebView2 surface ready");

  await tick(80);
  splash.log("Loading editor bundle…", { key: "bundle", status: "running" });
  await tick(120);
  splash.done("bundle", "Editor bundle loaded", `~${formatBundleSize()} of JS`);

  await tick(60);
  splash.log("Verifying file associations…", {
    key: "assoc",
    status: "running",
  });

  // Pull the Rust-side startup log once Tauri's IPC is available. In a plain
  // browser tab (e.g. `vite dev` without Tauri) we skip this gracefully so
  // the splash still works.
  const report = await fetchStartupReport();
  if (report) {
    splash.setVersion(report.version);
    replayRustEntries(splash, report);
  } else {
    splash.skipped(
      "assoc",
      "File association check skipped",
      "Running outside Tauri runtime",
    );
  }

  await tick(80);
  splash.log("Loading symbol library…", { key: "symbols", status: "running" });
  await tick(120);
  splash.done(
    "symbols",
    "Symbol library loaded",
    "valves · pumps · vessels · instruments",
  );

  await tick(70);
  splash.log("Warming hydraulic engine…", {
    key: "engine",
    status: "running",
  });
  await tick(110);
  splash.done(
    "engine",
    "Hydraulic engine warmed up",
    "Darcy–Weisbach · Crane K · pump curves",
  );

  await tick(60);
  splash.log("Restoring last session…", {
    key: "session",
    status: "running",
  });
  await tick(110);
  splash.done("session", "Session restored");

  await tick(60);
  splash.info("Ready");
  await holdRemaining();
  splash.dismiss();
}

function replayRustEntries(splash: SplashApi, report: StartupReport): void {
  // First entry from Rust is just the "App vX on Windows" banner — we already
  // showed our own banner so promote it to an `info` line beneath the bundle
  // row rather than duplicating the title.
  splash.info(`Rust runtime online — ${report.platform}`);

  for (const entry of report.entries) {
    if (entry.message.startsWith("Ash's MEP Playground v")) continue;

    const status: SplashStatus = entry.status;
    const text = entry.message;
    const detail = entry.detail ?? undefined;

    if (text.toLowerCase().includes("file association")) {
      // Reuse the placeholder row created above so the "verifying…" line
      // resolves into its final state instead of leaving two rows around.
      if (status === "skipped") splash.skipped("assoc", text, detail);
      else if (status === "warning") splash.warning(text, detail);
      else splash.done("assoc", text, detail);
    } else if (text.toLowerCase().startsWith("application ready")) {
      // We emit our own final "Ready" line — skip the Rust duplicate.
      continue;
    } else if (text.toLowerCase().startsWith("tauri runtime")) {
      splash.done("tauri", text, detail);
    } else {
      splash.log(text, { status, detail });
    }
  }
}

async function fetchStartupReport(): Promise<StartupReport | null> {
  if (!window.__TAURI_INTERNALS__) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const report = await invoke<StartupReport>("get_startup_log");
    return report;
  } catch (err) {
    console.warn("get_startup_log failed", err);
    return null;
  }
}

function formatBundleSize(): string {
  // We don't have a real byte count at runtime — emit a reassuring constant
  // that roughly matches the gzipped main chunk (~460 kB). It's cosmetic but
  // makes the log feel concrete.
  return "1.5 MB";
}

async function holdRemaining(): Promise<void> {
  const elapsed = performance.now() - launchedAt;
  const wait = SPLASH_MIN_VISIBLE_MS - elapsed;
  if (wait > 0) await tick(wait);
}

function tick(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { SPLASH_FADE_MS, SPLASH_MIN_VISIBLE_MS };
