use crate::game_session::SharedSessionSnapshot;
use serde::Deserialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use tauri::{AppHandle, Emitter};

const TOGGLE_DEAFEN: &str = "TOGGLE_DEAFEN";
const TOGGLE_MUTE: &str = "TOGGLE_MUTE";
const PUSH_TO_TALK: &str = "PUSH_TO_TALK";
const IMPOSTOR_RADIO: &str = "IMPOSTOR_RADIO";

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    pub push_to_talk_shortcut: String,
    pub deafen_shortcut: String,
    pub mute_shortcut: String,
    pub impostor_radio_shortcut: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            push_to_talk_shortcut: "V".to_string(),
            deafen_shortcut: "RControl".to_string(),
            mute_shortcut: "RAlt".to_string(),
            impostor_radio_shortcut: "F".to_string(),
        }
    }
}

#[derive(Default)]
struct PressedState {
    push_to_talk_pressed: bool,
    impostor_radio_pressed: bool,
    speaking: i32,
}

struct HotkeyContext {
    app: Mutex<Option<AppHandle>>,
    snapshot: Mutex<Option<SharedSessionSnapshot>>,
    config: Mutex<HotkeyConfig>,
    pressed: Mutex<PressedState>,
}

impl HotkeyContext {
    fn new() -> Self {
        Self {
            app: Mutex::new(None),
            snapshot: Mutex::new(None),
            config: Mutex::new(HotkeyConfig::default()),
            pressed: Mutex::new(PressedState::default()),
        }
    }

    fn set_runtime(&self, app: AppHandle, snapshot: SharedSessionSnapshot) {
        *self.app.lock().unwrap() = Some(app);
        *self.snapshot.lock().unwrap() = Some(snapshot);
    }

    fn update_config(&self, config: HotkeyConfig) {
        *self.config.lock().unwrap() = config;
        *self.pressed.lock().unwrap() = PressedState::default();
    }

    fn emit<T: serde::Serialize + Clone>(&self, event: &str, payload: T) {
        if let Some(app) = self.app.lock().unwrap().clone() {
            let _ = app.emit(event, payload);
        }
    }

    fn local_player_is_impostor(&self) -> bool {
        let Some(snapshot) = self.snapshot.lock().unwrap().clone() else {
            return false;
        };
        let is_impostor = snapshot.lock().unwrap().local_player_is_impostor();
        is_impostor
    }

    fn handle_key_event(&self, key_code: u32, is_keydown: bool) {
        let config = self.config.lock().unwrap().clone();
        let mut pressed = self.pressed.lock().unwrap();

        if is_keydown {
            if key_matches(&config.push_to_talk_shortcut, key_code) && !pressed.push_to_talk_pressed {
                pressed.push_to_talk_pressed = true;
                pressed.speaking = (pressed.speaking + 1).min(2);
                self.emit(PUSH_TO_TALK, true);
            }

            if key_matches(&config.impostor_radio_shortcut, key_code)
                && !pressed.impostor_radio_pressed
                && self.local_player_is_impostor()
            {
                pressed.impostor_radio_pressed = true;
                pressed.speaking = (pressed.speaking + 1).min(2);
                self.emit(IMPOSTOR_RADIO, true);
                self.emit(PUSH_TO_TALK, true);
            }

            return;
        }

        if key_matches(&config.push_to_talk_shortcut, key_code) && pressed.push_to_talk_pressed {
            pressed.push_to_talk_pressed = false;
            pressed.speaking -= 1;
        }

        if key_matches(&config.deafen_shortcut, key_code) {
            self.emit(TOGGLE_DEAFEN, ());
        }

        if key_matches(&config.mute_shortcut, key_code) {
            self.emit(TOGGLE_MUTE, ());
        }

        if key_matches(&config.impostor_radio_shortcut, key_code)
            && pressed.impostor_radio_pressed
            && self.local_player_is_impostor()
        {
            pressed.impostor_radio_pressed = false;
            pressed.speaking -= 1;
            self.emit(IMPOSTOR_RADIO, false);
        }

        if pressed.speaking < 0 {
            pressed.speaking = 0;
        }

        if pressed.speaking == 0 {
            self.emit(PUSH_TO_TALK, false);
        }
    }
}

pub struct HotkeyManager {
    started: AtomicBool,
    context: Arc<HotkeyContext>,
}

impl HotkeyManager {
    pub fn ensure_started(&self, app: AppHandle, snapshot: SharedSessionSnapshot) -> Result<(), String> {
        self.context.set_runtime(app, snapshot);

        if self
            .started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            start_hook_thread(self.context.clone())?;
        }

        Ok(())
    }

    pub fn reset(
        &self,
        app: AppHandle,
        snapshot: SharedSessionSnapshot,
        config: HotkeyConfig,
    ) -> Result<(), String> {
        self.ensure_started(app, snapshot)?;
        self.context.update_config(config);
        Ok(())
    }
}

impl Default for HotkeyManager {
    fn default() -> Self {
        Self {
            started: AtomicBool::new(false),
            context: Arc::new(HotkeyContext::new()),
        }
    }
}

fn key_matches(shortcut: &str, key_code: u32) -> bool {
    match shortcut {
        "Disabled" => false,
        "Space" => key_code == 0x20,
        "Backspace" => key_code == 0x08,
        "Delete" => key_code == 0x2E,
        "Enter" => key_code == 0x0D,
        "Up" => key_code == 0x26,
        "Down" => key_code == 0x28,
        "Left" => key_code == 0x25,
        "Right" => key_code == 0x27,
        "Home" => key_code == 0x24,
        "End" => key_code == 0x23,
        "PageUp" => key_code == 0x21,
        "PageDown" => key_code == 0x22,
        "Escape" => key_code == 0x1B,
        "Control" => matches!(key_code, 0x11 | 0xA2 | 0xA3),
        "LControl" => key_code == 0xA2,
        "RControl" => key_code == 0xA3,
        "Shift" => matches!(key_code, 0x10 | 0xA0 | 0xA1),
        "LShift" => key_code == 0xA0,
        "RShift" => key_code == 0xA1,
        "Alt" => matches!(key_code, 0x12 | 0xA4 | 0xA5),
        "LAlt" => key_code == 0xA4,
        "RAlt" => key_code == 0xA5,
        "F1" => key_code == 0x70,
        "F2" => key_code == 0x71,
        "F3" => key_code == 0x72,
        "F4" => key_code == 0x73,
        "F5" => key_code == 0x74,
        "F6" => key_code == 0x75,
        "F7" => key_code == 0x76,
        "F8" => key_code == 0x77,
        "F9" => key_code == 0x78,
        "F10" => key_code == 0x79,
        "F11" => key_code == 0x7A,
        "F12" => key_code == 0x7B,
        "MouseButton4" => key_code == 0x05,
        "MouseButton5" => key_code == 0x06,
        "Numpad0" => key_code == 0x60,
        "Numpad1" => key_code == 0x61,
        "Numpad2" => key_code == 0x62,
        "Numpad3" => key_code == 0x63,
        "Numpad4" => key_code == 0x64,
        "Numpad5" => key_code == 0x65,
        "Numpad6" => key_code == 0x66,
        "Numpad7" => key_code == 0x67,
        "Numpad8" => key_code == 0x68,
        "Numpad9" => key_code == 0x69,
        value if value.len() == 1 => value
            .chars()
            .next()
            .map(|character| character.to_ascii_uppercase() as u32 == key_code)
            .unwrap_or(false),
        _ => false,
    }
}

#[cfg(not(windows))]
fn start_hook_thread(_context: Arc<HotkeyContext>) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
static HOTKEY_CONTEXT: OnceLock<Arc<HotkeyContext>> = OnceLock::new();

#[cfg(windows)]
fn start_hook_thread(context: Arc<HotkeyContext>) -> Result<(), String> {
    let _ = HOTKEY_CONTEXT.set(context);

    std::thread::Builder::new()
        .name("bettercrewlink-hotkeys".to_string())
        .spawn(move || unsafe {
            use windows::Win32::UI::WindowsAndMessaging::{
                GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, MSG, WH_KEYBOARD_LL, WH_MOUSE_LL,
            };

            let keyboard_hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0);
            let mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0);

            let (Ok(keyboard_hook), Ok(mouse_hook)) = (keyboard_hook, mouse_hook) else {
                return;
            };

            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).0 > 0 {}

            let _ = UnhookWindowsHookEx(keyboard_hook);
            let _ = UnhookWindowsHookEx(mouse_hook);
        })
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
unsafe extern "system" fn keyboard_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    if code >= 0 {
        let message = wparam.0 as u32;
        let is_keydown = matches!(message, WM_KEYDOWN | WM_SYSKEYDOWN);
        let is_keyup = matches!(message, WM_KEYUP | WM_SYSKEYUP);

        if is_keydown || is_keyup {
            if let Some(context) = HOTKEY_CONTEXT.get() {
                let hook = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
                context.handle_key_event(hook.vkCode, is_keydown);
            }
        }
    }

    CallNextHookEx(None, code, wparam, lparam)
}

#[cfg(windows)]
unsafe extern "system" fn mouse_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, MSLLHOOKSTRUCT, WM_XBUTTONDOWN, WM_XBUTTONUP,
    };

    if code >= 0 {
        let message = wparam.0 as u32;
        if matches!(message, WM_XBUTTONDOWN | WM_XBUTTONUP) {
            if let Some(context) = HOTKEY_CONTEXT.get() {
                let hook = &*(lparam.0 as *const MSLLHOOKSTRUCT);
                let xbutton = ((hook.mouseData >> 16) & 0xffff) as u16;
                let key_code = match xbutton {
                    1 => Some(0x05),
                    2 => Some(0x06),
                    _ => None,
                };

                if let Some(key_code) = key_code {
                    context.handle_key_event(key_code, message == WM_XBUTTONDOWN);
                }
            }
        }
    }

    CallNextHookEx(None, code, wparam, lparam)
}
