//! Windows file-association registration for `.pid` project files.
//!
//! Runs on every launch from the Tauri `setup` hook and is **idempotent** —
//! if the keys already point at this exe with the right ProgID, nothing
//! changes and Explorer isn't bothered. If the exe has moved (e.g. the user
//! re-downloaded the portable binary to a different folder), the keys are
//! rewritten so double-click still works.
//!
//! Two distribution paths converge on the same end state:
//!
//!  • **NSIS installer** — `tauri build` writes the same registry keys at
//!    install time via the `bundle.fileAssociations` config. This runtime
//!    hook is a no-op when those keys already exist.
//!  • **Portable .exe** — no installer ever ran, so this hook is the only
//!    thing creating the association. First launch sets everything up, then
//!    subsequent launches are silent.
//!
//! Keys are written under `HKEY_CURRENT_USER\Software\Classes\…` so we never
//! need admin elevation. Uninstall by the NSIS installer cleans these up; for
//! portable users the worst case is a stale association whose Open command
//! points at a deleted exe, which Windows already handles gracefully.

use serde::Serialize;

/// Outcome of `ensure_pid_association`, surfaced to the splash screen so the
/// user can see exactly what happened on this launch.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum FileAssocStatus {
    /// Keys already pointed at this exe — nothing to do.
    AlreadyCurrent,
    /// First time we saw this exe path; keys created.
    Created,
    /// Keys existed but pointed somewhere else; keys updated.
    Updated,
    /// Platform doesn't need / support a runtime association (macOS, Linux).
    /// Only constructed on non-Windows targets — the dead-code lint can't see
    /// across the `cfg` gate, so we silence it explicitly.
    #[allow(dead_code)]
    NotApplicable,
}

impl FileAssocStatus {
    pub fn label(self) -> &'static str {
        match self {
            FileAssocStatus::AlreadyCurrent => "File association already up to date",
            FileAssocStatus::Created => "File association registered",
            FileAssocStatus::Updated => "File association refreshed",
            FileAssocStatus::NotApplicable => "File association not required on this platform",
        }
    }
}

#[cfg(windows)]
pub fn ensure_pid_association() -> std::io::Result<FileAssocStatus> {
    use std::env;
    use winreg::enums::*;
    use winreg::RegKey;

    let exe_path = env::current_exe()?;
    let exe_str = exe_path.to_string_lossy().to_string();

    // The ProgID is the long-lived identifier Windows uses to look up icons
    // and Open verbs for the .pid extension. Keep it stable across versions.
    const PROG_ID: &str = "PandIDProject";
    const PROG_FRIENDLY: &str = "Ash's MEP Playground project";

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let already = association_is_current(&hkcu, &exe_str, PROG_ID);
    let had_prior = hkcu
        .open_subkey(r"Software\Classes\.pid")
        .ok()
        .and_then(|k| k.get_value::<String, _>("").ok())
        .is_some();

    if already {
        return Ok(FileAssocStatus::AlreadyCurrent);
    }

    // --- .pid → ProgID
    let (ext_key, _) = hkcu.create_subkey(r"Software\Classes\.pid")?;
    ext_key.set_value("", &PROG_ID.to_string())?;
    ext_key.set_value("Content Type", &"application/x-pandid".to_string())?;

    // --- ProgID metadata
    let (prog_key, _) =
        hkcu.create_subkey(format!(r"Software\Classes\{}", PROG_ID))?;
    prog_key.set_value("", &PROG_FRIENDLY.to_string())?;
    prog_key.set_value("FriendlyTypeName", &PROG_FRIENDLY.to_string())?;

    // --- Icon — pulled out of the exe's icon resource group 0.
    //     Windows Explorer renders the first icon embedded in the binary.
    let (icon_key, _) = hkcu.create_subkey(format!(
        r"Software\Classes\{}\DefaultIcon",
        PROG_ID
    ))?;
    icon_key.set_value("", &format!("\"{}\",0", exe_str))?;

    // --- Open verb
    let (cmd_key, _) = hkcu.create_subkey(format!(
        r"Software\Classes\{}\shell\open\command",
        PROG_ID
    ))?;
    cmd_key.set_value("", &format!("\"{}\" \"%1\"", exe_str))?;

    // --- Application registration so "Open with" shows our friendly name.
    let (app_key, _) =
        hkcu.create_subkey(r"Software\Classes\Applications\pandid.exe")?;
    app_key.set_value("FriendlyAppName", &"Ash's MEP Playground".to_string())?;
    let (app_icon_key, _) =
        hkcu.create_subkey(r"Software\Classes\Applications\pandid.exe\DefaultIcon")?;
    app_icon_key.set_value("", &format!("\"{}\",0", exe_str))?;

    // Tell Explorer to refresh its icon / association cache so the new icon
    // shows up on existing .pid files in the current session, no sign-out
    // required. SHCNE_ASSOCCHANGED with null pids is the documented form.
    unsafe { shell_assoc_changed() };

    Ok(if had_prior {
        FileAssocStatus::Updated
    } else {
        FileAssocStatus::Created
    })
}

/// Compare what's currently in the registry against what we'd write — used to
/// short-circuit the common "already registered" path on every launch.
#[cfg(windows)]
fn association_is_current(
    hkcu: &winreg::RegKey,
    exe_str: &str,
    prog_id: &str,
) -> bool {
    use winreg::enums::KEY_READ;

    let read_value = |path: &str| -> Option<String> {
        hkcu.open_subkey_with_flags(path, KEY_READ)
            .ok()
            .and_then(|k| k.get_value::<String, _>("").ok())
    };

    let want_command = format!("\"{}\" \"%1\"", exe_str);
    let want_icon = format!("\"{}\",0", exe_str);

    matches!(read_value(r"Software\Classes\.pid"), Some(v) if v == prog_id)
        && matches!(
            read_value(&format!(r"Software\Classes\{}\shell\open\command", prog_id)),
            Some(v) if v == want_command
        )
        && matches!(
            read_value(&format!(r"Software\Classes\{}\DefaultIcon", prog_id)),
            Some(v) if v == want_icon
        )
}

/// FFI shim for `SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL)`.
/// Pulled in directly via `#[link]` so we don't have to drag in the whole
/// `windows-sys` crate just for one shell call.
#[cfg(windows)]
unsafe fn shell_assoc_changed() {
    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(
            w_event_id: i32,
            u_flags: u32,
            dw_item1: *const core::ffi::c_void,
            dw_item2: *const core::ffi::c_void,
        );
    }
    const SHCNE_ASSOCCHANGED: i32 = 0x0800_0000;
    const SHCNF_IDLIST: u32 = 0;
    SHChangeNotify(
        SHCNE_ASSOCCHANGED,
        SHCNF_IDLIST,
        core::ptr::null(),
        core::ptr::null(),
    );
}

/// Stub for non-Windows builds so the call-site in `lib.rs` stays clean.
#[cfg(not(windows))]
pub fn ensure_pid_association() -> std::io::Result<FileAssocStatus> {
    Ok(FileAssocStatus::NotApplicable)
}
