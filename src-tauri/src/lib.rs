use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    ffi::OsStr,
    fs,
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex},
    time::SystemTime,
};
use tauri::{Emitter, Manager, State};
use thiserror::Error;

const WORKSPACE_FOLDER: &str = ".typeset";
const LAYOUT_FILE: &str = "LAYOUT.md";
const WORKSPACE_CONFIG_FILE: &str = "workspace.json";
const GETTING_STARTED_FOLDER: &str = "Getting Started";
const GETTING_STARTED_FILE: &str = "Getting Started.md";

type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
enum AppError {
    #[error("Filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("Invalid name: {0}")]
    InvalidName(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Already exists: {0}")]
    AlreadyExists(String),
    #[error("Unsupported file: {0}")]
    UnsupportedFile(String),
    #[error("Workspace error: {0}")]
    Workspace(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Clone, Default)]
struct StartupFiles(Arc<Mutex<Vec<String>>>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceInfo {
    root_path: String,
    layout_path: String,
    tree: Vec<TreeNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSettings {
    root_path: String,
    default_root_path: String,
    allowed_roots: Vec<String>,
    workspace_folder: String,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredWorkspaceConfig {
    root_path: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum NodeKind {
    Folder,
    Note,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TreeNode {
    id: String,
    kind: NodeKind,
    name: String,
    path: String,
    children: Vec<TreeNode>,
    has_children: bool,
    bytes: u64,
    own_bytes: u64,
    note_count: usize,
    folder_count: usize,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NoteDocument {
    path: String,
    name: String,
    content: String,
    external: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutSyncResult {
    root_path: String,
    layouts_written: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Heading {
    level: u8,
    text: String,
    slug: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutIndex {
    version: u8,
    folder: String,
    generated_at: String,
    entries: Vec<LayoutEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutEntry {
    id: String,
    kind: String,
    title: String,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    layout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    child_layout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_children: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    h1: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    headings: Vec<Heading>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    links: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    entry_count: Option<usize>,
}

#[tauri::command]
fn init_workspace(app: tauri::AppHandle) -> AppResult<WorkspaceInfo> {
    let root = workspace_root(&app)?;
    let seed_getting_started = should_seed_getting_started(&root)?;
    fs::create_dir_all(&root)?;
    if seed_getting_started {
        seed_getting_started_note(&root)?;
    }
    sync_all_layouts(&root)?;

    workspace_info(&root)
}

#[tauri::command]
fn get_workspace_settings(app: tauri::AppHandle) -> AppResult<WorkspaceSettings> {
    let root = workspace_root(&app)?;
    let default_root = default_workspace_root(&app)?;
    let allowed_roots = allowed_workspace_roots(&app)?
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect();

    Ok(WorkspaceSettings {
        root_path: root.to_string_lossy().to_string(),
        default_root_path: default_root.to_string_lossy().to_string(),
        allowed_roots,
        workspace_folder: WORKSPACE_FOLDER.to_string(),
    })
}

#[tauri::command]
fn set_workspace_location(app: tauri::AppHandle, path: String) -> AppResult<WorkspaceInfo> {
    if std::env::var("TYPESET_WORKSPACE_DIR").is_ok() {
        return Err(AppError::Workspace(
            "TYPESET_WORKSPACE_DIR is active, so the workspace location cannot be changed in settings"
                .to_string(),
        ));
    }

    let root = normalize_workspace_location(&app, &path)?;
    let seed_getting_started = should_seed_getting_started(&root)?;
    fs::create_dir_all(&root)?;
    if seed_getting_started {
        seed_getting_started_note(&root)?;
    }
    sync_all_layouts(&root)?;
    write_workspace_config(&app, &root)?;
    workspace_info(&root)
}

fn workspace_info(root: &Path) -> AppResult<WorkspaceInfo> {
    Ok(WorkspaceInfo {
        root_path: root.to_string_lossy().to_string(),
        layout_path: root.join(LAYOUT_FILE).to_string_lossy().to_string(),
        tree: list_tree_inner(&root)?,
    })
}

fn should_seed_getting_started(root: &Path) -> AppResult<bool> {
    if !root.exists() {
        return Ok(true);
    }

    if !root.is_dir() {
        return Err(AppError::InvalidPath(root.to_string_lossy().to_string()));
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.eq_ignore_ascii_case(LAYOUT_FILE) {
            continue;
        }
        return Ok(false);
    }

    Ok(true)
}

fn seed_getting_started_note(root: &Path) -> AppResult<()> {
    let folder = root.join(GETTING_STARTED_FOLDER);
    let note = folder.join(GETTING_STARTED_FILE);
    if note.exists() {
        return Ok(());
    }

    fs::create_dir_all(&folder)?;
    fs::write(note, getting_started_content())?;
    Ok(())
}

fn getting_started_content() -> &'static str {
    r#"# Getting Started With Typeset

Welcome to Typeset. This starter note lives in your managed workspace so you can test the app immediately after install.

## Workspace

Typeset keeps managed notes in a `.typeset` folder. By default that folder is created at:

```text
Documents/.typeset
```

You can change the workspace location from Settings. For safety, Typeset currently allows `.typeset` folders inside Documents, Desktop, or Downloads.

## Sidebar

- Overview shows storage totals, recent notes, and the largest folders.
- Recent shows the last opened Markdown files on this device.
- Folders shows only managed workspace folders and notes.

## Notes And Sub-Notes

Managed notes must be `.md` files.

```text
Topic.md
Topic/Child.md
Topic/Child/Grandchild.md
```

Create folders and notes from the Folders header. Right-click a folder or note for actions like new sub-note, rename, move, delete, and folder color.

## Editor

- Preview renders Markdown.
- Source is the main Markdown editor.
- Split shows Source and Preview together.
- Save writes managed notes back to the workspace.
- Undo, redo, and save also work from the floating editor dock.

## Open External Markdown

After installing Typeset, Windows can show Typeset under Open with for `.md` files. External files opened from anywhere on your PC appear in Recent, but they do not appear in the Folders tree and are not indexed into `LAYOUT.md`.

Use Import when you want to copy an external Markdown file into the managed workspace.

## Agent Indexes

Typeset generates a `LAYOUT.md` file in every workspace folder. These files contain frontmatter, a machine-readable JSON block, and a readable tree so agents can understand your notes quickly.

Do not edit `LAYOUT.md` directly. Typeset regenerates it after note changes.
"#
}

#[tauri::command]
fn list_tree(app: tauri::AppHandle) -> AppResult<Vec<TreeNode>> {
    let root = ensure_workspace(&app)?;
    list_tree_inner(&root)
}

#[tauri::command]
fn read_note(app: tauri::AppHandle, path: String) -> AppResult<NoteDocument> {
    let root = ensure_workspace(&app)?;
    read_note_inner(&root, &path, false)
}

#[tauri::command]
fn save_note(app: tauri::AppHandle, path: String, content: String) -> AppResult<NoteDocument> {
    let root = ensure_workspace(&app)?;
    let target = resolve_existing(&root, &path)?;
    ensure_note_file(&target)?;
    fs::write(&target, content)?;
    sync_all_layouts(&root)?;
    read_note_inner(&root, &path, false)
}

#[tauri::command]
fn create_note(app: tauri::AppHandle, parent: String, name: String) -> AppResult<TreeNode> {
    let root = ensure_workspace(&app)?;
    let node = create_note_inner(&root, &parent, &name)?;
    sync_all_layouts(&root)?;
    Ok(node)
}

#[tauri::command]
fn create_sub_note(
    app: tauri::AppHandle,
    parent_note: String,
    name: String,
) -> AppResult<TreeNode> {
    let root = ensure_workspace(&app)?;
    let node = create_sub_note_inner(&root, &parent_note, &name)?;
    sync_all_layouts(&root)?;
    Ok(node)
}

#[tauri::command]
fn create_folder(app: tauri::AppHandle, parent: String, name: String) -> AppResult<TreeNode> {
    let root = ensure_workspace(&app)?;
    let node = create_folder_inner(&root, &parent, &name)?;
    sync_all_layouts(&root)?;
    Ok(node)
}

#[tauri::command]
fn rename_node(app: tauri::AppHandle, path: String, new_name: String) -> AppResult<()> {
    let root = ensure_workspace(&app)?;
    rename_node_inner(&root, &path, &new_name)?;
    sync_all_layouts(&root)?;
    Ok(())
}

#[tauri::command]
fn move_node(app: tauri::AppHandle, path: String, new_parent: String) -> AppResult<()> {
    let root = ensure_workspace(&app)?;
    move_node_inner(&root, &path, &new_parent)?;
    sync_all_layouts(&root)?;
    Ok(())
}

#[tauri::command]
fn delete_node(app: tauri::AppHandle, path: String) -> AppResult<()> {
    let root = ensure_workspace(&app)?;
    delete_node_inner(&root, &path)?;
    sync_all_layouts(&root)?;
    Ok(())
}

#[tauri::command]
fn sync_layouts(app: tauri::AppHandle) -> AppResult<LayoutSyncResult> {
    let root = ensure_workspace(&app)?;
    let layouts_written = sync_all_layouts(&root)?;

    Ok(LayoutSyncResult {
        root_path: root.to_string_lossy().to_string(),
        layouts_written,
    })
}

#[tauri::command]
fn open_external_note(path: String) -> AppResult<NoteDocument> {
    let external = PathBuf::from(path);
    if !external.is_absolute() {
        return Err(AppError::InvalidPath(
            "External notes must use an absolute path".to_string(),
        ));
    }
    ensure_markdown_file(&external)?;
    let content = fs::read_to_string(&external)?;
    let name = external
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("External.md")
        .to_string();

    Ok(NoteDocument {
        path: external.to_string_lossy().to_string(),
        name,
        content,
        external: true,
    })
}

#[tauri::command]
fn import_external_note(
    app: tauri::AppHandle,
    external_path: String,
    destination_parent: String,
    name: Option<String>,
) -> AppResult<TreeNode> {
    let root = ensure_workspace(&app)?;
    let node = import_external_note_inner(&root, &external_path, &destination_parent, name)?;
    sync_all_layouts(&root)?;
    Ok(node)
}

#[tauri::command]
fn take_startup_files(state: State<'_, StartupFiles>) -> AppResult<Vec<String>> {
    let mut files = state
        .0
        .lock()
        .map_err(|_| AppError::Workspace("Could not read startup files".to_string()))?;
    Ok(std::mem::take(&mut *files))
}

fn workspace_root(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    if let Ok(override_path) = std::env::var("TYPESET_WORKSPACE_DIR") {
        return normalize_workspace_location(app, &override_path);
    }

    if let Some(root_path) = read_workspace_config(app)?.root_path {
        return normalize_workspace_location(app, &root_path);
    }

    default_workspace_root(app)
}

fn ensure_workspace(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let root = workspace_root(app)?;
    if !root.exists() {
        fs::create_dir_all(&root)?;
    }
    Ok(root)
}

fn default_workspace_root(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| AppError::Workspace(error.to_string()))?;
    Ok(documents.join(WORKSPACE_FOLDER))
}

fn normalize_workspace_location(app: &tauri::AppHandle, input: &str) -> AppResult<PathBuf> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidPath(
            "Workspace location cannot be empty".to_string(),
        ));
    }

    let candidate = PathBuf::from(trimmed);
    if !candidate.is_absolute() {
        return Err(AppError::InvalidPath(
            "Workspace location must be an absolute path".to_string(),
        ));
    }
    ensure_workspace_path_components(&candidate)?;

    let root = if path_file_name_is(&candidate, WORKSPACE_FOLDER) {
        candidate
    } else {
        candidate.join(WORKSPACE_FOLDER)
    };
    validate_workspace_location(app, &root)?;
    Ok(root)
}

fn validate_workspace_location(app: &tauri::AppHandle, root: &Path) -> AppResult<()> {
    ensure_workspace_path_components(root)?;
    if !path_file_name_is(root, WORKSPACE_FOLDER) {
        return Err(AppError::InvalidPath(format!(
            "Workspace folder must be named {WORKSPACE_FOLDER}"
        )));
    }

    let parent = root
        .parent()
        .ok_or_else(|| AppError::InvalidPath(root.to_string_lossy().to_string()))?;
    if !parent.exists() || !parent.is_dir() {
        return Err(AppError::InvalidPath(
            "Workspace parent folder must already exist".to_string(),
        ));
    }

    let parent_canonical = parent.canonicalize()?;
    for allowed_root in allowed_workspace_roots(app)? {
        if let Ok(allowed_canonical) = allowed_root.canonicalize() {
            if parent_canonical == allowed_canonical
                || parent_canonical.starts_with(&allowed_canonical)
            {
                return Ok(());
            }
        }
    }

    Err(AppError::InvalidPath(
        "Workspace must be inside Documents, Desktop, or Downloads".to_string(),
    ))
}

fn ensure_workspace_path_components(path: &Path) -> AppResult<()> {
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
    {
        return Err(AppError::InvalidPath(
            "Workspace location cannot contain . or .. segments".to_string(),
        ));
    }
    Ok(())
}

fn path_file_name_is(path: &Path, expected: &str) -> bool {
    path.file_name()
        .and_then(OsStr::to_str)
        .map(|name| name.eq_ignore_ascii_case(expected))
        .unwrap_or(false)
}

fn allowed_workspace_roots(app: &tauri::AppHandle) -> AppResult<Vec<PathBuf>> {
    let mut roots = Vec::new();
    push_allowed_root(&mut roots, app.path().document_dir());
    push_allowed_root(&mut roots, app.path().desktop_dir());
    push_allowed_root(&mut roots, app.path().download_dir());

    if roots.is_empty() {
        return Err(AppError::Workspace(
            "Could not resolve Documents, Desktop, or Downloads".to_string(),
        ));
    }

    Ok(roots)
}

fn push_allowed_root<E>(roots: &mut Vec<PathBuf>, path: Result<PathBuf, E>) {
    let Ok(path) = path else {
        return;
    };
    if !roots.iter().any(|existing| {
        existing
            .to_string_lossy()
            .eq_ignore_ascii_case(path.to_string_lossy().as_ref())
    }) {
        roots.push(path);
    }
}

fn workspace_config_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| AppError::Workspace(error.to_string()))?;
    Ok(config_dir.join(WORKSPACE_CONFIG_FILE))
}

fn read_workspace_config(app: &tauri::AppHandle) -> AppResult<StoredWorkspaceConfig> {
    let path = workspace_config_path(app)?;
    if !path.exists() {
        return Ok(StoredWorkspaceConfig::default());
    }

    let content = fs::read_to_string(path)?;
    serde_json::from_str(&content).map_err(|error| AppError::Workspace(error.to_string()))
}

fn write_workspace_config(app: &tauri::AppHandle, root: &Path) -> AppResult<()> {
    let path = workspace_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let config = StoredWorkspaceConfig {
        root_path: Some(root.to_string_lossy().to_string()),
    };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| AppError::Workspace(error.to_string()))?;
    fs::write(path, content)?;
    Ok(())
}

fn create_note_inner(root: &Path, parent: &str, name: &str) -> AppResult<TreeNode> {
    let parent_dir = resolve_folder(root, parent)?;
    let file_name = normalize_note_name(name)?;
    ensure_no_case_collision(&parent_dir, &file_name)?;

    let target = parent_dir.join(&file_name);
    fs::write(&target, default_note_content(&file_name))?;
    tree_node_for_path(root, &target)
}

fn create_sub_note_inner(root: &Path, parent_note: &str, name: &str) -> AppResult<TreeNode> {
    let parent_note_path = resolve_existing(root, parent_note)?;
    ensure_note_file(&parent_note_path)?;
    let child_dir = companion_folder_for_note(&parent_note_path)?;
    fs::create_dir_all(&child_dir)?;

    let file_name = normalize_note_name(name)?;
    ensure_no_case_collision(&child_dir, &file_name)?;

    let target = child_dir.join(&file_name);
    fs::write(&target, default_note_content(&file_name))?;
    tree_node_for_path(root, &target)
}

fn create_folder_inner(root: &Path, parent: &str, name: &str) -> AppResult<TreeNode> {
    let parent_dir = resolve_folder(root, parent)?;
    let folder_name = normalize_folder_name(name)?;
    ensure_no_case_collision(&parent_dir, &folder_name)?;

    let target = parent_dir.join(&folder_name);
    fs::create_dir(&target)?;
    tree_node_for_path(root, &target)
}

fn rename_node_inner(root: &Path, path: &str, new_name: &str) -> AppResult<()> {
    let source = resolve_existing(root, path)?;
    let parent = source
        .parent()
        .ok_or_else(|| AppError::InvalidPath(path.to_string()))?;

    if source.is_dir() {
        let folder_name = normalize_folder_name(new_name)?;
        ensure_no_case_collision_for_rename(parent, &folder_name, &source)?;
        fs::rename(&source, parent.join(folder_name))?;
        return Ok(());
    }

    ensure_note_file(&source)?;
    let file_name = normalize_note_name(new_name)?;
    let destination = parent.join(&file_name);
    ensure_no_case_collision_for_rename(parent, &file_name, &source)?;

    let source_companion = companion_folder_for_note(&source)?;
    let destination_companion = parent.join(note_stem(&file_name)?);
    if source_companion.exists()
        && destination_companion.exists()
        && source_companion != destination_companion
    {
        return Err(AppError::AlreadyExists(
            destination_companion.to_string_lossy().to_string(),
        ));
    }

    fs::rename(&source, &destination)?;
    if source_companion.exists() && source_companion != destination_companion {
        fs::rename(source_companion, destination_companion)?;
    }

    Ok(())
}

fn move_node_inner(root: &Path, path: &str, new_parent: &str) -> AppResult<()> {
    let source = resolve_existing(root, path)?;
    let destination_parent = resolve_folder(root, new_parent)?;

    if source == destination_parent {
        return Err(AppError::InvalidPath(
            "A node cannot be moved into itself".to_string(),
        ));
    }

    if source.is_dir() {
        if destination_parent.starts_with(&source) {
            return Err(AppError::InvalidPath(
                "A folder cannot be moved into its own descendant".to_string(),
            ));
        }
        let name = source
            .file_name()
            .and_then(OsStr::to_str)
            .ok_or_else(|| AppError::InvalidPath(path.to_string()))?;
        ensure_no_case_collision(&destination_parent, name)?;
        fs::rename(&source, destination_parent.join(name))?;
        return Ok(());
    }

    ensure_note_file(&source)?;
    let file_name = source
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| AppError::InvalidPath(path.to_string()))?;
    ensure_no_case_collision(&destination_parent, file_name)?;

    let source_companion = companion_folder_for_note(&source)?;
    let destination_companion = destination_parent.join(note_stem(file_name)?);
    if source_companion.exists() && destination_companion.exists() {
        return Err(AppError::AlreadyExists(
            destination_companion.to_string_lossy().to_string(),
        ));
    }

    fs::rename(&source, destination_parent.join(file_name))?;
    if source_companion.exists() {
        fs::rename(source_companion, destination_companion)?;
    }

    Ok(())
}

fn delete_node_inner(root: &Path, path: &str) -> AppResult<()> {
    let target = resolve_existing(root, path)?;
    if target.is_dir() {
        fs::remove_dir_all(target)?;
        return Ok(());
    }

    ensure_note_file(&target)?;
    let companion = companion_folder_for_note(&target)?;
    fs::remove_file(&target)?;
    if companion.exists() {
        fs::remove_dir_all(companion)?;
    }
    Ok(())
}

fn import_external_note_inner(
    root: &Path,
    external_path: &str,
    destination_parent: &str,
    name: Option<String>,
) -> AppResult<TreeNode> {
    let external = PathBuf::from(external_path);
    if !external.is_absolute() {
        return Err(AppError::InvalidPath(
            "External notes must use an absolute path".to_string(),
        ));
    }
    ensure_markdown_file(&external)?;
    let content = fs::read_to_string(&external)?;
    let import_name = name.unwrap_or_else(|| {
        external
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("Imported.md")
            .to_string()
    });
    let node = create_note_inner(root, destination_parent, &import_name)?;
    let target = resolve_existing(root, &node.path)?;
    fs::write(target, content)?;
    Ok(node)
}

fn list_tree_inner(root: &Path) -> AppResult<Vec<TreeNode>> {
    fs::create_dir_all(root)?;
    build_children(root, root)
}

fn build_children(root: &Path, folder: &Path) -> AppResult<Vec<TreeNode>> {
    let mut notes = Vec::new();
    let mut folders = Vec::new();

    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.eq_ignore_ascii_case(LAYOUT_FILE) {
            continue;
        }
        if path.is_dir() {
            folders.push(path);
        } else if is_markdown_path(&path) {
            notes.push(path);
        }
    }

    notes.sort_by_key(|path| sort_key(path));
    folders.sort_by_key(|path| sort_key(path));

    let companion_names: BTreeSet<String> = notes
        .iter()
        .filter_map(|note| {
            note.file_stem()
                .and_then(OsStr::to_str)
                .map(|stem| stem.to_lowercase())
        })
        .collect();

    let mut nodes = Vec::new();

    for folder_path in folders {
        let folder_name = folder_path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_lowercase();
        if companion_names.contains(&folder_name) {
            continue;
        }
        nodes.push(tree_node_for_path(root, &folder_path)?);
    }

    for note in notes {
        nodes.push(tree_node_for_path(root, &note)?);
    }

    Ok(nodes)
}

fn tree_node_for_path(root: &Path, path: &Path) -> AppResult<TreeNode> {
    let relative = relative_to_root(root, path)?;
    let path_string = slash_path(&relative);
    let name = path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_string();

    if path.is_dir() {
        let children = build_children(root, path)?;
        let summary = summarize_children(&children);
        let updated_at = fs::metadata(path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .map(system_time_rfc3339);
        return Ok(TreeNode {
            id: format!("folder:{path_string}"),
            kind: NodeKind::Folder,
            name,
            path: path_string,
            has_children: !children.is_empty(),
            children,
            bytes: summary.bytes,
            own_bytes: 0,
            note_count: summary.note_count,
            folder_count: summary.folder_count,
            updated_at,
        });
    }

    ensure_note_file(path)?;
    let metadata = fs::metadata(path)?;
    let own_bytes = metadata.len();
    let updated_at = metadata.modified().ok().map(system_time_rfc3339);
    let companion = companion_folder_for_note(path)?;
    let children = if companion.exists() {
        build_children(root, &companion)?
    } else {
        Vec::new()
    };
    let summary = summarize_children(&children);

    Ok(TreeNode {
        id: format!("note:{path_string}"),
        kind: NodeKind::Note,
        name,
        path: path_string,
        has_children: !children.is_empty(),
        children,
        bytes: own_bytes + summary.bytes,
        own_bytes,
        note_count: 1 + summary.note_count,
        folder_count: summary.folder_count,
        updated_at,
    })
}

#[derive(Default)]
struct TreeSummary {
    bytes: u64,
    note_count: usize,
    folder_count: usize,
}

fn summarize_children(children: &[TreeNode]) -> TreeSummary {
    let mut summary = TreeSummary::default();
    for child in children {
        summary.bytes += child.bytes;
        summary.note_count += child.note_count;
        summary.folder_count += child.folder_count;
        if child.kind == NodeKind::Folder {
            summary.folder_count += 1;
        }
    }
    summary
}

fn read_note_inner(root: &Path, path: &str, external: bool) -> AppResult<NoteDocument> {
    let target = resolve_existing(root, path)?;
    ensure_note_file(&target)?;
    let content = fs::read_to_string(&target)?;
    let relative = relative_to_root(root, &target)?;
    let name = target
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("Untitled.md")
        .to_string();

    Ok(NoteDocument {
        path: slash_path(&relative),
        name,
        content,
        external,
    })
}

fn sync_all_layouts(root: &Path) -> AppResult<usize> {
    fs::create_dir_all(root)?;
    let mut folders = Vec::new();
    collect_folders(root, &mut folders)?;
    folders.sort();

    for folder in &folders {
        write_layout(root, folder)?;
    }

    Ok(folders.len())
}

fn collect_folders(folder: &Path, folders: &mut Vec<PathBuf>) -> AppResult<()> {
    folders.push(folder.to_path_buf());
    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_folders(&path, folders)?;
        }
    }
    Ok(())
}

fn write_layout(root: &Path, folder: &Path) -> AppResult<()> {
    let entries = layout_entries_for_folder(root, folder)?;
    let folder_relative = relative_to_root(root, folder)?;
    let folder_label = if folder_relative.as_os_str().is_empty() {
        ".".to_string()
    } else {
        slash_path(&folder_relative)
    };
    let generated_at = now_rfc3339();
    let index = LayoutIndex {
        version: 1,
        folder: folder_label.clone(),
        generated_at: generated_at.clone(),
        entries,
    };
    let json = serde_json::to_string_pretty(&index)
        .map_err(|error| AppError::Workspace(error.to_string()))?;

    let mut content = String::new();
    content.push_str("---\n");
    content.push_str("typeset_layout_version: 1\n");
    content.push_str(&format!(
        "folder: \"{}\"\n",
        folder_label.replace('"', "\\\"")
    ));
    content.push_str(&format!("generated_at: \"{}\"\n", generated_at));
    content.push_str(&format!("entry_count: {}\n", index.entries.len()));
    content.push_str("---\n\n");
    content.push_str(&format!("# Typeset Layout: {}\n\n", folder_label));
    content.push_str("<!-- TYPESET_INDEX_BEGIN -->\n");
    content.push_str("```json\n");
    content.push_str(&json);
    content.push_str("\n```\n");
    content.push_str("<!-- TYPESET_INDEX_END -->\n\n");
    content.push_str("## Tree\n");
    if index.entries.is_empty() {
        content.push_str("- No entries\n");
    } else {
        for entry in &index.entries {
            if entry.kind == "note" {
                if let Some(child_layout) = &entry.child_layout {
                    content.push_str(&format!(
                        "- [{}]({}) -> [children]({})\n",
                        entry.title, entry.path, child_layout
                    ));
                } else {
                    content.push_str(&format!("- [{}]({})\n", entry.title, entry.path));
                }
            } else if let Some(layout) = &entry.layout {
                content.push_str(&format!("- [{}/]({})\n", entry.title, layout));
            }
        }
    }

    fs::write(folder.join(LAYOUT_FILE), content)?;
    Ok(())
}

fn layout_entries_for_folder(root: &Path, folder: &Path) -> AppResult<Vec<LayoutEntry>> {
    let mut notes = Vec::new();
    let mut folders = Vec::new();

    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.eq_ignore_ascii_case(LAYOUT_FILE) {
            continue;
        }
        if path.is_dir() {
            folders.push(path);
        } else if is_markdown_path(&path) {
            notes.push(path);
        }
    }

    notes.sort_by_key(|path| sort_key(path));
    folders.sort_by_key(|path| sort_key(path));

    let companion_names: BTreeSet<String> = notes
        .iter()
        .filter_map(|note| {
            note.file_stem()
                .and_then(OsStr::to_str)
                .map(|stem| stem.to_lowercase())
        })
        .collect();

    let mut entries = Vec::new();
    for folder_path in folders {
        let folder_name_lower = folder_path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_lowercase();
        if companion_names.contains(&folder_name_lower) {
            continue;
        }
        entries.push(folder_layout_entry(root, &folder_path)?);
    }
    for note in notes {
        entries.push(note_layout_entry(root, &note)?);
    }

    Ok(entries)
}

fn folder_layout_entry(root: &Path, folder: &Path) -> AppResult<LayoutEntry> {
    let relative = relative_to_root(root, folder)?;
    let title = folder
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_string();
    let entry_count = fs::read_dir(folder)?.filter_map(Result::ok).count();
    let path = slash_path(&relative);

    Ok(LayoutEntry {
        id: format!("folder:{path}"),
        kind: "folder".to_string(),
        title,
        path: format!("{path}/"),
        layout: Some(format!("{path}/{LAYOUT_FILE}")),
        child_layout: None,
        has_children: None,
        h1: None,
        headings: Vec::new(),
        tags: Vec::new(),
        links: Vec::new(),
        updated_at: None,
        bytes: None,
        entry_count: Some(entry_count),
    })
}

fn note_layout_entry(root: &Path, note: &Path) -> AppResult<LayoutEntry> {
    let relative = relative_to_root(root, note)?;
    let path = slash_path(&relative);
    let content = fs::read_to_string(note).unwrap_or_default();
    let headings = extract_headings(&content);
    let h1 = headings
        .iter()
        .find(|heading| heading.level == 1)
        .map(|heading| heading.text.clone())
        .or_else(|| {
            note.file_stem()
                .and_then(OsStr::to_str)
                .map(ToString::to_string)
        });
    let tags = extract_tags(&content);
    let links = extract_links(&content);
    let metadata = fs::metadata(note)?;
    let updated_at = metadata.modified().ok().map(system_time_rfc3339);
    let companion = companion_folder_for_note(note)?;
    let has_children = companion.exists();
    let child_layout = if has_children {
        let child_relative = relative_to_root(root, &companion)?;
        Some(format!("{}/{LAYOUT_FILE}", slash_path(&child_relative)))
    } else {
        None
    };

    Ok(LayoutEntry {
        id: format!("note:{path}"),
        kind: "note".to_string(),
        title: note
            .file_stem()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_string(),
        path,
        layout: None,
        child_layout,
        has_children: Some(has_children),
        h1,
        headings,
        tags,
        links,
        updated_at,
        bytes: Some(metadata.len()),
        entry_count: None,
    })
}

fn resolve_folder(root: &Path, relative: &str) -> AppResult<PathBuf> {
    let path = resolve_existing(root, relative)?;
    if !path.is_dir() {
        return Err(AppError::InvalidPath(format!("{relative} is not a folder")));
    }
    Ok(path)
}

fn resolve_existing(root: &Path, relative: &str) -> AppResult<PathBuf> {
    let relative = normalize_relative_path(relative)?;
    let candidate = root.join(relative);
    if !candidate.exists() {
        return Err(AppError::NotFound(candidate.to_string_lossy().to_string()));
    }
    ensure_inside_root(root, &candidate)
}

fn ensure_inside_root(root: &Path, candidate: &Path) -> AppResult<PathBuf> {
    let root_canonical = root.canonicalize()?;
    let candidate_canonical = candidate.canonicalize()?;
    if !candidate_canonical.starts_with(&root_canonical) {
        return Err(AppError::InvalidPath(
            candidate.to_string_lossy().to_string(),
        ));
    }
    Ok(candidate_canonical)
}

fn relative_to_root(root: &Path, path: &Path) -> AppResult<PathBuf> {
    let root_canonical = root.canonicalize()?;
    let path_canonical = path.canonicalize()?;
    let relative = path_canonical
        .strip_prefix(&root_canonical)
        .map_err(|_| AppError::InvalidPath(path.to_string_lossy().to_string()))?;
    Ok(relative.to_path_buf())
}

fn normalize_relative_path(input: &str) -> AppResult<PathBuf> {
    let normalized = input.trim().replace('\\', "/");
    if normalized.is_empty() || normalized == "." {
        return Ok(PathBuf::new());
    }

    let path = Path::new(&normalized);
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => result.push(part),
            Component::CurDir => {}
            _ => {
                return Err(AppError::InvalidPath(input.to_string()));
            }
        }
    }
    Ok(result)
}

fn normalize_note_name(input: &str) -> AppResult<String> {
    let name = input.trim();
    if name.is_empty() {
        return Err(AppError::InvalidName("Name cannot be empty".to_string()));
    }
    let with_ext = if name.to_lowercase().ends_with(".md") {
        name.to_string()
    } else {
        format!("{name}.md")
    };
    validate_file_name(&with_ext)?;
    if with_ext.eq_ignore_ascii_case(LAYOUT_FILE) {
        return Err(AppError::InvalidName(
            "LAYOUT.md is generated by Typeset".to_string(),
        ));
    }
    if !with_ext.to_lowercase().ends_with(".md") {
        return Err(AppError::InvalidName(
            "Notes must use the .md extension".to_string(),
        ));
    }
    Ok(with_ext)
}

fn normalize_folder_name(input: &str) -> AppResult<String> {
    let name = input.trim();
    validate_file_name(name)?;
    if name.to_lowercase().ends_with(".md") {
        return Err(AppError::InvalidName(
            "Folders cannot use the .md extension".to_string(),
        ));
    }
    Ok(name.to_string())
}

fn validate_file_name(name: &str) -> AppResult<()> {
    if name.is_empty() {
        return Err(AppError::InvalidName("Name cannot be empty".to_string()));
    }
    if name != name.trim() || name.ends_with('.') {
        return Err(AppError::InvalidName(
            "Names cannot start or end with spaces or dots".to_string(),
        ));
    }
    if name.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err(AppError::InvalidName(
            "Name contains a character Windows cannot use".to_string(),
        ));
    }
    let stem = Path::new(name)
        .file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or(name)
        .to_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if reserved.contains(&stem.as_str()) {
        return Err(AppError::InvalidName(
            "Name is reserved by Windows".to_string(),
        ));
    }
    Ok(())
}

fn ensure_no_case_collision(parent: &Path, candidate_name: &str) -> AppResult<()> {
    for entry in fs::read_dir(parent)? {
        let entry_name = entry?.file_name().to_string_lossy().to_string();
        if entry_name.eq_ignore_ascii_case(candidate_name) {
            return Err(AppError::AlreadyExists(candidate_name.to_string()));
        }
    }
    Ok(())
}

fn ensure_no_case_collision_for_rename(
    parent: &Path,
    candidate_name: &str,
    current: &Path,
) -> AppResult<()> {
    for entry in fs::read_dir(parent)? {
        let entry_path = entry?.path();
        let entry_name = entry_path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_string();
        if entry_name.eq_ignore_ascii_case(candidate_name) && entry_path != current {
            return Err(AppError::AlreadyExists(candidate_name.to_string()));
        }
    }
    Ok(())
}

fn ensure_note_file(path: &Path) -> AppResult<()> {
    ensure_markdown_file(path)?;
    let name = path.file_name().and_then(OsStr::to_str).unwrap_or_default();
    if name.eq_ignore_ascii_case(LAYOUT_FILE) {
        return Err(AppError::UnsupportedFile(
            "LAYOUT.md is generated by Typeset".to_string(),
        ));
    }
    Ok(())
}

fn ensure_markdown_file(path: &Path) -> AppResult<()> {
    if !is_markdown_path(path) {
        return Err(AppError::UnsupportedFile(
            path.to_string_lossy().to_string(),
        ));
    }
    Ok(())
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .map(|extension| extension.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

fn companion_folder_for_note(note: &Path) -> AppResult<PathBuf> {
    let parent = note
        .parent()
        .ok_or_else(|| AppError::InvalidPath(note.to_string_lossy().to_string()))?;
    let stem = note
        .file_stem()
        .and_then(OsStr::to_str)
        .ok_or_else(|| AppError::InvalidPath(note.to_string_lossy().to_string()))?;
    Ok(parent.join(stem))
}

fn note_stem(file_name: &str) -> AppResult<&str> {
    if !file_name.to_lowercase().ends_with(".md") {
        return Err(AppError::InvalidName(file_name.to_string()));
    }
    Ok(&file_name[..file_name.len() - 3])
}

fn default_note_content(file_name: &str) -> String {
    let title = note_stem(file_name).unwrap_or(file_name);
    format!("# {title}\n\n")
}

fn sort_key(path: &Path) -> String {
    path.file_name()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_lowercase()
}

fn slash_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn extract_headings(content: &str) -> Vec<Heading> {
    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim_start();
            let level = trimmed
                .chars()
                .take_while(|character| *character == '#')
                .count();
            if level == 0 || level > 6 {
                return None;
            }
            let rest = trimmed[level..].trim();
            if rest.is_empty() {
                return None;
            }
            let text = rest.trim_end_matches('#').trim().to_string();
            if text.is_empty() {
                return None;
            }
            Some(Heading {
                level: level as u8,
                slug: slugify(&text),
                text,
            })
        })
        .collect()
}

fn extract_tags(content: &str) -> Vec<String> {
    let mut tags = BTreeSet::new();
    for token in content.split(|character: char| {
        character.is_whitespace()
            || matches!(
                character,
                ',' | ';' | '(' | ')' | '[' | ']' | '{' | '}' | '<' | '>'
            )
    }) {
        if let Some(tag) = token.strip_prefix('#') {
            let clean = tag
                .trim_matches(|character: char| {
                    !character.is_ascii_alphanumeric()
                        && character != '-'
                        && character != '_'
                        && character != '/'
                })
                .to_lowercase();
            if !clean.is_empty()
                && clean
                    .chars()
                    .any(|character| character.is_ascii_alphabetic())
            {
                tags.insert(clean);
            }
        }
    }
    tags.into_iter().collect()
}

fn extract_links(content: &str) -> Vec<String> {
    let mut links = BTreeSet::new();
    let mut rest = content;
    while let Some(start) = rest.find("](") {
        let after = &rest[start + 2..];
        if let Some(end) = after.find(')') {
            let target = after[..end].trim();
            if target.to_lowercase().contains(".md") {
                links.insert(target.to_string());
            }
            rest = &after[end + 1..];
        } else {
            break;
        }
    }
    links.into_iter().collect()
}

fn slugify(text: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for character in text.to_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            last_dash = false;
        } else if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }
    slug.trim_matches('-').to_string()
}

fn now_rfc3339() -> String {
    system_time_rfc3339(SystemTime::now())
}

fn system_time_rfc3339(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn startup_markdown_args(args: impl IntoIterator<Item = String>) -> Vec<String> {
    args.into_iter()
        .filter(|arg| arg.to_lowercase().ends_with(".md"))
        .collect()
}

#[cfg(target_os = "windows")]
fn set_windows_titlebar_color(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
    };

    fn colorref(red: u32, green: u32, blue: u32) -> u32 {
        red | (green << 8) | (blue << 16)
    }

    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let caption_color = colorref(0x17, 0x17, 0x17);
    let text_color = colorref(0xf5, 0xf5, 0xf5);

    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd.0,
            DWMWA_CAPTION_COLOR as u32,
            &caption_color as *const u32 as _,
            std::mem::size_of_val(&caption_color) as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd.0,
            DWMWA_TEXT_COLOR as u32,
            &text_color as *const u32 as _,
            std::mem::size_of_val(&text_color) as u32,
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_files = StartupFiles(Arc::new(Mutex::new(startup_markdown_args(
        std::env::args().skip(1),
    ))));
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let files = startup_markdown_args(args);
            if !files.is_empty() {
                let _ = app.emit("typeset://external-open", files);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(startup_files)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                set_windows_titlebar_color(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_workspace,
            get_workspace_settings,
            set_workspace_location,
            list_tree,
            read_note,
            save_note,
            create_note,
            create_sub_note,
            create_folder,
            rename_node,
            move_node,
            delete_node,
            sync_layouts,
            open_external_note,
            import_external_note,
            take_startup_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "typeset-test-{}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn rejects_windows_reserved_names() {
        assert!(normalize_note_name("CON").is_err());
        assert!(normalize_folder_name("LPT1").is_err());
        assert_eq!(normalize_note_name("Topic").unwrap(), "Topic.md");
    }

    #[test]
    fn creates_sub_notes_in_sibling_folder() {
        let root = test_root();
        create_note_inner(&root, ".", "Topic").unwrap();
        let child = create_sub_note_inner(&root, "Topic.md", "Child").unwrap();

        assert_eq!(child.path, "Topic/Child.md");
        assert!(root.join("Topic.md").exists());
        assert!(root.join("Topic").join("Child.md").exists());
    }

    #[test]
    fn renames_note_with_companion_folder() {
        let root = test_root();
        create_note_inner(&root, ".", "Topic").unwrap();
        create_sub_note_inner(&root, "Topic.md", "Child").unwrap();

        rename_node_inner(&root, "Topic.md", "Renamed").unwrap();

        assert!(root.join("Renamed.md").exists());
        assert!(root.join("Renamed").join("Child.md").exists());
        assert!(!root.join("Topic.md").exists());
        assert!(!root.join("Topic").exists());
    }

    #[test]
    fn writes_layout_with_machine_index() {
        let root = test_root();
        create_note_inner(&root, ".", "Topic").unwrap();
        fs::write(root.join("Topic.md"), "# Topic\n\n## Next Steps\n\n#tag\n").unwrap();

        sync_all_layouts(&root).unwrap();
        let layout = fs::read_to_string(root.join(LAYOUT_FILE)).unwrap();

        assert!(layout.contains("TYPESET_INDEX_BEGIN"));
        assert!(layout.contains("\"path\": \"Topic.md\""));
        assert!(layout.contains("\"slug\": \"next-steps\""));
        assert!(layout.contains("\"tags\": ["));
    }

    #[test]
    fn seeds_getting_started_for_empty_workspace() {
        let root = test_root();

        assert!(should_seed_getting_started(&root).unwrap());
        seed_getting_started_note(&root).unwrap();
        sync_all_layouts(&root).unwrap();

        assert!(root
            .join(GETTING_STARTED_FOLDER)
            .join(GETTING_STARTED_FILE)
            .exists());

        let layout = fs::read_to_string(root.join(LAYOUT_FILE)).unwrap();
        assert!(layout.contains("Getting Started/LAYOUT.md"));
    }

    #[test]
    fn does_not_seed_getting_started_when_workspace_has_notes() {
        let root = test_root();
        fs::write(root.join("Topic.md"), "# Topic\n").unwrap();

        assert!(!should_seed_getting_started(&root).unwrap());
    }

    #[test]
    fn opens_external_markdown_even_when_named_layout() {
        let root = test_root();
        let external = root.join(LAYOUT_FILE);
        fs::write(&external, "# External Layout\n").unwrap();

        let document = open_external_note(external.to_string_lossy().to_string()).unwrap();

        assert!(document.external);
        assert_eq!(document.name, LAYOUT_FILE);
        assert!(document.content.contains("External Layout"));
    }

    #[test]
    fn blocks_path_traversal() {
        let root = test_root();
        assert!(resolve_existing(&root, "../outside.md").is_err());
    }
}
