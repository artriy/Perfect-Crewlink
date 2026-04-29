mod assets;
mod game_session;
mod hotkeys;

use game_session::{load_region_aliases, AmongUsState, GameSessionManager, GameSessionStatus};
use hotkeys::{HotkeyConfig, HotkeyManager};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalSize, State, WebviewWindow, WindowEvent};

const OFFSETS_BASE_URL: &str = "https://raw.githubusercontent.com/OhMyGuus/BetterCrewlink-Offsets/main";
const OFFSETS_FALLBACK_URL: &str = "https://cdn.jsdelivr.net/gh/OhMyGuus/BetterCrewlink-Offsets@main";

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

#[tauri::command]
fn trigger_app_update() -> Result<(), String> {
    Ok(())
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
fn set_overlay_enabled(
    app: AppHandle,
    overlay_controller: State<'_, OverlayController>,
    enabled: bool,
) -> Result<(), String> {
    overlay_controller.enabled.store(enabled, Ordering::Relaxed);
    refresh_overlay_window(&app, enabled)
}

#[tauri::command]
fn open_lobby_browser(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("lobbies")
        .ok_or_else(|| "Window not found: lobbies".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
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
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found: main".to_string())?;
    window.set_always_on_top(enabled).map_err(|error| error.to_string())
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
        GetWindowLongPtrW, SetParent, SetWindowLongPtrW, SetWindowPos, GWL_STYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOZORDER, WS_CHILD, WS_POPUP, WS_VISIBLE,
    };

    let overlay_hwnd = window.hwnd().map_err(|error| error.to_string())?;
    unsafe {
        SetParent(overlay_hwnd, parent_hwnd).map_err(|error| error.to_string())?;
        let style = GetWindowLongPtrW(overlay_hwnd, GWL_STYLE);
        let mut next_style = style | WS_VISIBLE.0 as isize;
        if parent_hwnd.is_some() {
            next_style |= WS_CHILD.0 as isize;
            next_style &= !(WS_POPUP.0 as isize);
        } else {
            next_style |= WS_POPUP.0 as isize;
            next_style &= !(WS_CHILD.0 as isize);
        }
        SetWindowLongPtrW(overlay_hwnd, GWL_STYLE, next_style);

        if let Some(size) = size {
            SetWindowPos(
                overlay_hwnd,
                None,
                0,
                0,
                size.width as i32,
                size.height as i32,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
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

fn refresh_overlay_window(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "Window not found: overlay".to_string())?;

    if !enabled {
        #[cfg(windows)]
        let _ = detach_overlay_window(&window);
        return window.hide().map_err(|error| error.to_string());
    }

    configure_overlay_window(&window)?;

    #[cfg(windows)]
    {
        let Some(state) = find_among_us_window_state() else {
            let _ = detach_overlay_window(&window);
            return window.hide().map_err(|error| error.to_string());
        };

        if state.is_minimized {
            let _ = detach_overlay_window(&window);
            return window.hide().map_err(|error| error.to_string());
        }

        let _ = window.set_fullscreen(false);
        embed_overlay_window(&window, state)?;
        return window.show().map_err(|error| error.to_string());
    }

    #[cfg(not(windows))]
    {
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
            if let Some(window) = app.get_webview_window("overlay") {
                let _ = configure_overlay_window(&window);
                let _ = window.hide();
            }
            if let Some(window) = app.get_webview_window("lobbies") {
                let _ = window.hide();
            }

            let app_handle = app.handle().clone();
            let overlay_controller_runtime = overlay_controller_runtime.clone();
            std::thread::spawn(move || loop {
                if overlay_controller_runtime.enabled.load(Ordering::Relaxed) {
                    let _ = refresh_overlay_window(&app_handle, true);
                }
                std::thread::sleep(Duration::from_millis(250));
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    "overlay" | "lobbies" => {
                        api.prevent_close();
                        let _ = window.hide();
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
            fetch_offset_lookup,
            fetch_offsets,
            reset_hotkeys,
            set_overlay_enabled,
            open_lobby_browser,
            launch_among_us_game,
            quit_app,
            relaunch_app,
            minimize_window,
            hide_window,
            show_window,
            set_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
