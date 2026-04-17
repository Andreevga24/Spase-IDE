use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct WorkspaceState(Mutex<Option<PathBuf>>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceEntry {
    name: String,
    rel_path: String,
    is_dir: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    provider: String,
    openai_compat_api_base_url: String,
    openai_compat_model: String,
    ollama_api_base_url: String,
    ollama_model: String,
}

fn app_data_file(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;
    Ok(dir.join(name))
}

#[tauri::command]
async fn app_settings_get(app: tauri::AppHandle) -> Result<Option<AppSettings>, String> {
    let path = app_data_file(&app, "settings.json")?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
    let parsed: AppSettings =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse settings: {e}"))?;
    Ok(Some(parsed))
}

#[tauri::command]
async fn app_settings_set(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = app_data_file(&app, "settings.json")?;
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write settings: {e}"))
}

#[tauri::command]
async fn chat_conversation_get(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = app_data_file(&app, "chat_conversation.json")?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("Failed to read conversation: {e}"))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse conversation: {e}"))?;
    Ok(Some(parsed))
}

#[tauri::command]
async fn chat_conversation_set(app: tauri::AppHandle, conversation: serde_json::Value) -> Result<(), String> {
    let path = app_data_file(&app, "chat_conversation.json")?;
    let json = serde_json::to_string_pretty(&conversation)
        .map_err(|e| format!("Failed to serialize conversation: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write conversation: {e}"))
}

#[tauri::command]
async fn secret_set(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let service = app.config().identifier.clone();
    let entry = keyring::Entry::new(&service, &key).map_err(|e| format!("Keyring error: {e}"))?;
    entry.set_password(&value).map_err(|e| format!("Keyring error: {e}"))
}

#[tauri::command]
async fn secret_get(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let service = app.config().identifier.clone();
    let entry = keyring::Entry::new(&service, &key).map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keyring error: {e}")),
    }
}

fn get_root(state: &WorkspaceState) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .map_err(|_| "Workspace lock poisoned".to_string())?
        .clone()
        .ok_or_else(|| "No workspace opened".to_string())
}

fn resolve_in_root(root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    if rel_path.contains('\0') {
        return Err("Invalid path".to_string());
    }
    let rel = Path::new(rel_path);
    if rel.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }
    let joined = root.join(rel);
    let root_canon = root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve workspace root: {e}"))?;
    let joined_canon = joined
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path: {e}"))?;
    if !joined_canon.starts_with(&root_canon) {
        return Err("Path is outside workspace".to_string());
    }
    Ok(joined_canon)
}

#[tauri::command]
async fn workspace_open(app: tauri::AppHandle, state: tauri::State<'_, WorkspaceState>) -> Result<String, String> {
    let folder = app
        .dialog()
        .file()
        .set_title("Open Workspace Folder")
        .pick_folder()
        .await
        .ok_or_else(|| "Canceled".to_string())?;

    let path = folder
        .as_path()
        .ok_or_else(|| "Invalid folder path".to_string())?
        .to_path_buf();

    *state
        .0
        .lock()
        .map_err(|_| "Workspace lock poisoned".to_string())? = Some(path.clone());

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn workspace_list(
    state: tauri::State<'_, WorkspaceState>,
    rel_dir: Option<String>,
) -> Result<Vec<WorkspaceEntry>, String> {
    let root = get_root(&state)?;
    let dir = match rel_dir {
        None => root,
        Some(p) if p.is_empty() => root,
        Some(p) => resolve_in_root(&root, &p)?,
    };

    let mut entries: Vec<WorkspaceEntry> = Vec::new();
    let rd = fs::read_dir(&dir).map_err(|e| format!("Failed to read dir: {e}"))?;

    for item in rd {
        let item = item.map_err(|e| format!("Failed to read dir entry: {e}"))?;
        let path = item.path();
        let file_type = item
            .file_type()
            .map_err(|e| format!("Failed to get entry type: {e}"))?;
        let is_dir = file_type.is_dir();
        let name = item.file_name().to_string_lossy().to_string();

        let rel_path = path
            .strip_prefix(&root)
            .map_err(|_| "Failed to compute relative path".to_string())?
            .to_string_lossy()
            .replace('\\', "/");

        entries.push(WorkspaceEntry {
            name,
            rel_path,
            is_dir,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
async fn file_read(state: tauri::State<'_, WorkspaceState>, rel_path: String) -> Result<String, String> {
    let root = get_root(&state)?;
    let path = resolve_in_root(&root, &rel_path)?;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
async fn file_write(
    state: tauri::State<'_, WorkspaceState>,
    rel_path: String,
    contents: String,
) -> Result<(), String> {
    let root = get_root(&state)?;
    if rel_path.is_empty() {
        return Err("Empty path".to_string());
    }
    let rel = Path::new(&rel_path);
    if rel.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }
    let target = root.join(rel);
    let target_parent = target.parent().ok_or_else(|| "Invalid path".to_string())?;
    fs::create_dir_all(target_parent).map_err(|e| format!("Failed to create dirs: {e}"))?;

    // For writing we can't canonicalize a non-existent file, so we validate via parent.
    let root_canon = root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve workspace root: {e}"))?;
    let parent_canon = target_parent
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path parent: {e}"))?;
    if !parent_canon.starts_with(&root_canon) {
        return Err("Path is outside workspace".to_string());
    }

    fs::write(&target, contents).map_err(|e| format!("Failed to write file: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WorkspaceState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            workspace_open,
            workspace_list,
            file_read,
            file_write,
            app_settings_get,
            app_settings_set,
            chat_conversation_get,
            chat_conversation_set,
            secret_set,
            secret_get
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
