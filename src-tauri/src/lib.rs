mod file_assoc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            // First-launch / every-launch self-healing for the .pid file
            // association on Windows. Failures are logged and swallowed —
            // we never want a registry hiccup to prevent the app from
            // starting.
            if let Err(e) = file_assoc::ensure_pid_association() {
                eprintln!("file association setup failed: {e}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
