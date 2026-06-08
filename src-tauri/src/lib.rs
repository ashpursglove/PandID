mod file_assoc;
mod startup_log;

use std::time::Instant;

use tauri::{Manager, State};

use file_assoc::FileAssocStatus;
use startup_log::{StartupEntry, StartupEntryStatus, StartupLog};

#[derive(serde::Serialize)]
pub struct StartupReport {
    /// App version (`Cargo.toml::package.version`).
    pub version: &'static str,
    /// Operating system the splash can include in the boot log.
    pub platform: &'static str,
    /// Ordered list of everything the Rust setup hook did.
    pub entries: Vec<StartupEntry>,
}

/// Streamable bootstrap log. The splash calls this once Tauri's IPC is live
/// and replays each entry as a styled line in the splash status panel.
#[tauri::command]
fn get_startup_log(state: State<'_, StartupLog>) -> StartupReport {
    StartupReport {
        version: env!("CARGO_PKG_VERSION"),
        platform: platform_name(),
        entries: state.snapshot(),
    }
}

fn platform_name() -> &'static str {
    if cfg!(windows) {
        "Windows"
    } else if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_os = "linux") {
        "Linux"
    } else {
        "Unknown"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_log = StartupLog::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(startup_log)
        .invoke_handler(tauri::generate_handler![get_startup_log])
        .setup(|app| {
            let log = app.state::<StartupLog>();

            log.push(
                StartupEntryStatus::Info,
                format!(
                    "Ash's MEP Playground v{} on {}",
                    env!("CARGO_PKG_VERSION"),
                    platform_name()
                ),
            );

            log.push(
                StartupEntryStatus::Done,
                "Tauri runtime initialised",
            );

            // Self-healing file-association registration. Failures never
            // block launch — the user can still drag a .pid file onto the
            // window or open it from the File menu.
            let started = Instant::now();
            match file_assoc::ensure_pid_association() {
                Ok(status) => {
                    let detail = format!("{:.0} ms", started.elapsed().as_micros() as f64 / 1000.0);
                    let kind = match status {
                        FileAssocStatus::AlreadyCurrent => StartupEntryStatus::Skipped,
                        FileAssocStatus::Created | FileAssocStatus::Updated => {
                            StartupEntryStatus::Done
                        }
                        FileAssocStatus::NotApplicable => StartupEntryStatus::Info,
                    };
                    log.push_with_detail(kind, status.label(), Some(detail));
                }
                Err(err) => {
                    log.push_with_detail(
                        StartupEntryStatus::Warning,
                        "File association setup skipped",
                        Some(err.to_string()),
                    );
                }
            }

            log.push(
                StartupEntryStatus::Done,
                "Application ready",
            );

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
