mod assets;
mod game_session;
mod hotkeys;

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use game_session::{load_region_aliases, AmongUsState, GameSessionManager, GameSessionStatus};
use hotkeys::{HotkeyConfig, HotkeyManager};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalSize, State, UserAttentionType, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

const OFFSETS_BASE_URL: &str = "https://raw.githubusercontent.com/OhMyGuus/BetterCrewlink-Offsets/main";
const OFFSETS_FALLBACK_URL: &str = "https://cdn.jsdelivr.net/gh/OhMyGuus/BetterCrewlink-Offsets@main";
const UPDATE_EVENT: &str = "AUTO_UPDATER_STATE";
const UPDATE_API_URL: &str = "https://api.github.com/repos/artriy/Perfect-Crewlink/releases/latest";
const UPDATE_DOWNLOAD_URL: &str = "https://github.com/artriy/Perfect-Crewlink/releases/latest";

#[derive(Serialize)]
struct MigrationStatus {
    status: &'static str,
}

#[derive(Serialize)]
struct HostPlatform {
    platform: &'static str,
}

#[derive(Serialize)]
struct OffsetLookupResponse {
    lookup: serde_json::Value,
}

#[derive(Serialize)]
struct OffsetsResponse {
    offsets: serde_json::Value,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    draft: bool,
    prerelease: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfoPayload {
    version: String,
    release_url: String,
}

#[derive(Clone, Serialize)]
struct AutoUpdaterPayload {
    state: &'static str,
    info: UpdateInfoPayload,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum PlatformRunType {
    Uri,
    Exe,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GamePlatformInstance {
    run_path: String,
    execute: Vec<String>,
    launch_type: PlatformRunType,
}

#[derive(Clone, Default)]
struct OverlayController {
    enabled: Arc<AtomicBool>,
}

async fn fetch_json(url: &str) -> Result<serde_json::Value, String> {
    reqwest::get(url)
        .await
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_migration_status() -> MigrationStatus {
    MigrationStatus {
        status: "tauri-shell-online",
    }
}

#[tauri::command]
fn get_host_platform() -> HostPlatform {
    let platform = match std::env::consts::OS {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "macos",
        other => other,
    };

    HostPlatform { platform }
}

#[tauri::command]
fn get_system_locale(app: AppHandle) -> String {
    let _ = app;
    sys_locale::get_locale().unwrap_or_else(|| "en".to_string())
}

fn version_parts(version: &str) -> Vec<u64> {
    version
        .trim_start_matches(['v', 'V'])
        .split(['.', '-', '+'])
        .map(|part| {
            part.chars()
                .take_while(|character| character.is_ascii_digit())
                .collect::<String>()
                .parse::<u64>()
                .unwrap_or(0)
        })
        .collect()
}

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    let left_parts = version_parts(left);
    let right_parts = version_parts(right);
    let length = left_parts.len().max(right_parts.len()).max(3);

    for index in 0..length {
        let left_part = left_parts.get(index).copied().unwrap_or(0);
        let right_part = right_parts.get(index).copied().unwrap_or(0);
        match left_part.cmp(&right_part) {
            std::cmp::Ordering::Equal => {}
            ordering => return ordering,
        }
    }

    std::cmp::Ordering::Equal
}

fn check_for_app_updates(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(4));

        let current_version = app.package_info().version.to_string();
        let release = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Perfect Crewlink updater")
            .build()
            .and_then(|client| client.get(UPDATE_API_URL).send())
            .and_then(|response| response.error_for_status())
            .and_then(|response| response.json::<GithubRelease>());

        let Ok(release) = release else {
            return;
        };

        if release.draft || release.prerelease {
            return;
        }

        let latest_version = release.tag_name.trim_start_matches('v').to_string();
        if compare_versions(&latest_version, &current_version) != std::cmp::Ordering::Greater {
            return;
        }

        let _ = app.emit(
            UPDATE_EVENT,
            AutoUpdaterPayload {
                state: "available",
                info: UpdateInfoPayload {
                    version: latest_version,
                    release_url: release.html_url,
                },
            },
        );
    });
}

#[tauri::command]
fn trigger_app_update() -> Result<(), String> {
    tauri_plugin_opener::open_url(UPDATE_DOWNLOAD_URL, None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
fn start_game_session(
    app: AppHandle,
    session: State<'_, GameSessionManager>,
    hotkeys: State<'_, HotkeyManager>,
) -> GameSessionStatus {
    session.ensure_started(app.clone());
    let _ = hotkeys.ensure_started(app, session.snapshot());
    session.status()
}

#[tauri::command]
fn get_initial_game_state(session: State<'_, GameSessionManager>) -> Option<AmongUsState> {
    session.initial_state()
}

#[tauri::command]
fn get_player_colors(session: State<'_, GameSessionManager>) -> Vec<[String; 2]> {
    session.snapshot().lock().unwrap().player_colors.clone()
}

#[tauri::command]
fn get_region_aliases() -> std::collections::HashMap<String, String> {
    load_region_aliases(None)
}

#[tauri::command]
fn request_mod(session: State<'_, GameSessionManager>) -> String {
    session.current_mod()
}

#[tauri::command]
fn generate_avatar_base(color: String, shadow: String, is_alive: bool) -> Result<String, String> {
    assets::generate_base_data_url(&color, &shadow, is_alive)
}

#[tauri::command]
fn read_audio_file_as_data_url(path: String) -> Result<String, String> {
    let extension = std::path::Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    let mime = match extension.as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" | "oga" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        "webm" => "audio/webm",
        _ => "audio/mpeg",
    };
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    Ok(format!(
        "data:{mime};base64,{}",
        BASE64_STANDARD.encode(bytes)
    ))
}

#[tauri::command]
async fn fetch_offset_lookup() -> Result<OffsetLookupResponse, String> {
    match fetch_json(&format!("{OFFSETS_BASE_URL}/lookup.json")).await {
        Ok(lookup) => Ok(OffsetLookupResponse { lookup }),
        Err(_) => {
            let lookup = fetch_json(&format!("{OFFSETS_FALLBACK_URL}/lookup.json")).await?;
            Ok(OffsetLookupResponse { lookup })
        }
    }
}

#[tauri::command]
async fn fetch_offsets(is64_bit: bool, filename: String, _offsets_version: u32) -> Result<OffsetsResponse, String> {
    let arch = if is64_bit { "x64" } else { "x86" };
    let primary = format!("{OFFSETS_BASE_URL}/offsets/{arch}/{filename}");
    let fallback = format!("{OFFSETS_FALLBACK_URL}/offsets/{arch}/{filename}");

    match fetch_json(&primary).await {
        Ok(offsets) => Ok(OffsetsResponse { offsets }),
        Err(_) => {
            let offsets = fetch_json(&fallback).await?;
            Ok(OffsetsResponse { offsets })
        }
    }
}

#[tauri::command]
fn reset_hotkeys(
    app: AppHandle,
    session: State<'_, GameSessionManager>,
    hotkeys: State<'_, HotkeyManager>,
    config: HotkeyConfig,
) -> Result<(), String> {
    hotkeys.reset(app, session.snapshot(), config)
}

#[tauri::command]
async fn set_overlay_enabled(
    app: AppHandle,
    overlay_controller: State<'_, OverlayController>,
    enabled: bool,
) -> Result<(), String> {
    overlay_controller.enabled.store(enabled, Ordering::Relaxed);
    refresh_overlay_window(&app, enabled)
}

fn create_webview_window_from_config(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label)
        .ok_or_else(|| format!("Window config not found: {label}"))?;

    WebviewWindowBuilder::from_config(app, config)
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())
}

fn create_lobby_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    create_webview_window_from_config(app, "lobbies")
}

#[tauri::command]
async fn open_lobby_browser(app: AppHandle) -> Result<(), String> {
    let window = match app.get_webview_window("lobbies") {
        Some(window) => window,
        None => create_lobby_window(&app)?,
    };
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn close_lobby_browser(app: AppHandle) -> Result<(), String> {
    destroy_window_if_exists(&app, "lobbies")
}

#[tauri::command]
async fn launch_among_us_game(platform: GamePlatformInstance) -> Result<(), String> {
    match platform.launch_type {
        PlatformRunType::Uri => {
            tauri_plugin_opener::open_url(platform.run_path.as_str(), None::<&str>)
                .map_err(|error| error.to_string())?;
            Ok(())
        }
        PlatformRunType::Exe => {
            let Some(executable) = platform.execute.first() else {
                return Err("Missing executable".into());
            };

            let command = std::path::Path::new(&platform.run_path).join(executable);
            let mut process = std::process::Command::new(command);
            if platform.execute.len() > 1 {
                process.args(&platform.execute[1..]);
            }
            process.spawn().map_err(|error| error.to_string())?;
            Ok(())
        }
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) -> Result<(), String> {
    for label in ["overlay", "lobbies", "main"] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.hide();
            let _ = window.destroy();
        }
    }

    app.exit(0);
    Ok(())
}

#[tauri::command]
fn relaunch_app(app: AppHandle) -> Result<(), String> {
    app.restart();
}

#[tauri::command]
fn minimize_window(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let window_label = label.unwrap_or_else(|| "main".to_string());
    let window = app
        .get_webview_window(window_label.as_str())
        .ok_or_else(|| format!("Window not found: {window_label}"))?;
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_window(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let window_label = label.unwrap_or_else(|| "main".to_string());
    let window = app
        .get_webview_window(window_label.as_str())
        .ok_or_else(|| format!("Window not found: {window_label}"))?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn show_window(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let window_label = label.unwrap_or_else(|| "main".to_string());
    let window = app
        .get_webview_window(window_label.as_str())
        .ok_or_else(|| format!("Window not found: {window_label}"))?;
    window.show().map_err(|error| error.to_string())
}

#[tauri::command]
fn request_user_attention(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let window_label = label.unwrap_or_else(|| "main".to_string());
    let window = app
        .get_webview_window(window_label.as_str())
        .ok_or_else(|| format!("Window not found: {window_label}"))?;
    window
        .request_user_attention(Some(UserAttentionType::Informational))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found: main".to_string())?;
    window.set_always_on_top(enabled).map_err(|error| error.to_string())
}

fn destroy_window_if_exists(app: &AppHandle, label: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn configure_overlay_window(window: &WebviewWindow) -> Result<(), String> {
    window.set_decorations(false).map_err(|error| error.to_string())?;
    window.set_resizable(false).map_err(|error| error.to_string())?;
    window.set_shadow(false).map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())?;
    window.set_always_on_top(false).map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn sync_overlay_bounds(window: &WebviewWindow) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|error| error.to_string())? {
        let _ = window.set_fullscreen(false);
        window
            .set_position(*monitor.position())
            .map_err(|error| error.to_string())?;
        window
            .set_size(*monitor.size())
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    window.set_fullscreen(true).map_err(|error| error.to_string())
}

#[cfg(windows)]
#[derive(Clone, Copy)]
struct AmongUsWindowState {
    hwnd: windows::Win32::Foundation::HWND,
    size: PhysicalSize<u32>,
    is_minimized: bool,
}

#[cfg(windows)]
fn find_among_us_window_state() -> Option<AmongUsWindowState> {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClientRect, GetWindowTextLengthW, GetWindowTextW, IsIconic,
        IsWindowVisible,
    };

    struct SearchResult {
        state: Option<AmongUsWindowState>,
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }

        let title_length = GetWindowTextLengthW(hwnd);
        if title_length <= 0 {
            return BOOL(1);
        }

        let mut buffer = vec![0u16; title_length as usize + 1];
        let read = GetWindowTextW(hwnd, &mut buffer);
        if read <= 0 {
            return BOOL(1);
        }

        let title = String::from_utf16_lossy(&buffer[..read as usize]);
        if !title.contains("Among Us") {
            return BOOL(1);
        }

        let mut rect = RECT::default();
        if GetClientRect(hwnd, &mut rect).is_err() {
            return BOOL(1);
        }

        let width = (rect.right - rect.left).max(0) as u32;
        let height = (rect.bottom - rect.top).max(0) as u32;
        if width == 0 || height == 0 {
            return BOOL(1);
        }

        let result = unsafe { &mut *(lparam.0 as *mut SearchResult) };
        result.state = Some(AmongUsWindowState {
            hwnd,
            size: PhysicalSize::new(width, height),
            is_minimized: IsIconic(hwnd).as_bool(),
        });
        BOOL(0)
    }

    let mut result = SearchResult { state: None };
    unsafe {
        let _ = EnumWindows(
            Some(enum_windows_proc),
            LPARAM((&mut result as *mut SearchResult) as isize),
        );
    }

    result.state
}

#[cfg(windows)]
fn set_overlay_child_styles(window: &WebviewWindow, parent_hwnd: Option<windows::Win32::Foundation::HWND>, size: Option<PhysicalSize<u32>>) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetParent, GetWindowLongPtrW, SetParent, SetWindowLongPtrW, SetWindowPos, GWL_STYLE,
        HWND_TOP, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        WS_CHILD, WS_POPUP, WS_VISIBLE,
    };

    let overlay_hwnd = window.hwnd().map_err(|error| error.to_string())?;
    unsafe {
        let style = GetWindowLongPtrW(overlay_hwnd, GWL_STYLE);
        let current_parent = GetParent(overlay_hwnd).ok();
        if let Some(parent_hwnd) = parent_hwnd {
            let mut next_style = style;
            next_style |= WS_VISIBLE.0 as isize;
            next_style |= WS_CHILD.0 as isize;
            next_style &= !(WS_POPUP.0 as isize);
            SetWindowLongPtrW(overlay_hwnd, GWL_STYLE, next_style);
            if current_parent != Some(parent_hwnd) {
                SetParent(overlay_hwnd, Some(parent_hwnd)).map_err(|error| error.to_string())?;
            }
        } else {
            if current_parent.is_some() {
                SetParent(overlay_hwnd, None).map_err(|error| error.to_string())?;
            }
            let mut next_style = style;
            next_style |= WS_POPUP.0 as isize;
            next_style &= !(WS_CHILD.0 as isize | WS_VISIBLE.0 as isize);
            SetWindowLongPtrW(overlay_hwnd, GWL_STYLE, next_style);
        }

        if let Some(size) = size {
            SetWindowPos(
                overlay_hwnd,
                Some(HWND_TOP),
                0,
                0,
                size.width as i32,
                size.height as i32,
                SWP_NOACTIVATE | SWP_FRAMECHANGED,
            )
            .map_err(|error| error.to_string())?;
        } else {
            SetWindowPos(
                overlay_hwnd,
                None,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            )
            .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

#[cfg(windows)]
fn embed_overlay_window(window: &WebviewWindow, state: AmongUsWindowState) -> Result<(), String> {
    set_overlay_child_styles(window, Some(state.hwnd), Some(state.size))
}

#[cfg(windows)]
fn detach_overlay_window(window: &WebviewWindow) -> Result<(), String> {
    set_overlay_child_styles(window, None, None)
}

fn create_overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let window = create_webview_window_from_config(app, "overlay")?;
    configure_overlay_window(&window)?;
    Ok(window)
}

fn destroy_overlay_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        #[cfg(windows)]
        {
            let _ = detach_overlay_window(&window);
        }
        window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn refresh_overlay_window(app: &AppHandle, enabled: bool) -> Result<(), String> {
    if !enabled {
        return destroy_overlay_window(app);
    }

    #[cfg(windows)]
    {
        let Some(state) = find_among_us_window_state() else {
            return destroy_overlay_window(app);
        };

        if state.is_minimized {
            return destroy_overlay_window(app);
        }

        let window = match app.get_webview_window("overlay") {
            Some(window) => window,
            None => create_overlay_window(app)?,
        };
        configure_overlay_window(&window)?;
        let _ = window.set_fullscreen(false);
        embed_overlay_window(&window, state)?;
        window.show().map_err(|error| error.to_string())
    }

    #[cfg(not(windows))]
    {
        let window = match app.get_webview_window("overlay") {
            Some(window) => window,
            None => create_overlay_window(app)?,
        };
        configure_overlay_window(&window)?;
        sync_overlay_bounds(&window)?;
        window.show().map_err(|error| error.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = GameSessionManager::default();
    let hotkey_manager = HotkeyManager::default();
    let overlay_controller = OverlayController::default();
    let overlay_controller_runtime = overlay_controller.clone();
    let session_snapshot = session_manager.snapshot();

    tauri::Builder::default()
        .manage(session_manager)
        .manage(hotkey_manager)
        .manage(overlay_controller)
        .setup(move |app| {
            check_for_app_updates(app.handle().clone());

            let app_handle = app.handle().clone();
            let overlay_controller_runtime = overlay_controller_runtime.clone();
            std::thread::spawn(move || loop {
                let delay_ms = if overlay_controller_runtime.enabled.load(Ordering::Relaxed) {
                    let _ = refresh_overlay_window(&app_handle, true);
                    if app_handle.get_webview_window("overlay").is_some() {
                        250
                    } else {
                        1000
                    }
                } else {
                    1000
                };
                std::thread::sleep(Duration::from_millis(delay_ms));
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    "overlay" => {
                        api.prevent_close();
                        let _ = destroy_overlay_window(window.app_handle());
                    }
                    "main" => {
                        api.prevent_close();
                        let _ = quit_app(window.app_handle().clone());
                    }
                    _ => {}
                }
            }
        })
        .register_uri_scheme_protocol("static", {
            let snapshot = session_snapshot.clone();
            move |_ctx, request| assets::handle_static(&snapshot, request)
        })
        .register_asynchronous_uri_scheme_protocol("generate", {
            let snapshot = session_snapshot.clone();
            move |_ctx, request, responder| {
                let snapshot = snapshot.clone();
                std::thread::spawn(move || {
                    responder.respond(assets::handle_generate(&snapshot, request));
                });
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_migration_status,
            get_host_platform,
            get_system_locale,
            trigger_app_update,
            start_game_session,
            get_initial_game_state,
            get_player_colors,
            get_region_aliases,
            request_mod,
            generate_avatar_base,
            read_audio_file_as_data_url,
            fetch_offset_lookup,
            fetch_offsets,
            reset_hotkeys,
            set_overlay_enabled,
            open_lobby_browser,
            close_lobby_browser,
            launch_among_us_game,
            quit_app,
            relaunch_app,
            minimize_window,
            hide_window,
            show_window,
            request_user_attention,
            set_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
