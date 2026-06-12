use std::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn python_command(script: &std::path::Path, payload: &str) -> Command {
    let mut cmd = Command::new("python");
    cmd.arg(script).arg(payload);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[tauri::command]
fn get_session_data() -> Result<serde_json::Value, String> {
    let path = std::env::args()
        .nth(1)
        .ok_or_else(|| "no session.json path provided".to_string())?;
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {path}: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))
}

fn skill_dir() -> Result<std::path::PathBuf, String> {
    // exe: <skill_dir>/widget/src-tauri/target/release/widget.exe
    // nth: 0=exe, 1=release/, 2=target/, 3=src-tauri/, 4=widget/, 5=skill_dir/
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .ancestors()
        .nth(5)
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "could not determine skill directory".to_string())
}

#[tauri::command]
fn finish_session(payload: String) -> Result<serde_json::Value, String> {
    let script = skill_dir()?.join("scripts").join("session").join("session-finish.py");
    let output = python_command(&script, &payload)
        .output()
        .map_err(|e| format!("failed to run session-finish.py: {e}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        serde_json::from_str(stdout.trim()).map_err(|e| format!("bad output: {e}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr.chars().take(400).collect())
    }
}

#[tauri::command]
fn cancel_session(payload: String) -> Result<serde_json::Value, String> {
    let script = skill_dir()?.join("scripts").join("session").join("session-cancel.py");
    let output = python_command(&script, &payload)
        .output()
        .map_err(|e| format!("failed to run session-cancel.py: {e}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        serde_json::from_str(stdout.trim()).map_err(|e| format!("bad output: {e}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr.chars().take(400).collect())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![get_session_data, finish_session, cancel_session])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
