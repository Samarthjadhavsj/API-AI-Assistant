use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

#[cfg(target_os = "windows")]
use std::sync::atomic::AtomicU32;
#[cfg(target_os = "windows")]
use std::sync::OnceLock;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT, MOD_SHIFT, VK_BACK,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, GetMessageW, PeekMessageW, PostThreadMessageW, TranslateMessage, MSG,
    PM_NOREMOVE, WM_HOTKEY, WM_QUIT,
};

#[cfg(target_os = "windows")]
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
#[cfg(target_os = "windows")]
static GLOBAL_APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

/// Fixed hotkey ID used with RegisterHotKey.
#[cfg(target_os = "windows")]
const HOTKEY_ID_SHIFT_BACKSPACE: i32 = 1;

#[cfg(target_os = "windows")]
extern "system" {
    fn GetCurrentThreadId() -> u32;
}

#[cfg(target_os = "windows")]
pub fn setup_windows_hook(app: &AppHandle) {
    eprintln!("[HOTKEY] Registering Shift+Backspace hotkey");
    let _ = GLOBAL_APP_HANDLE.set(app.clone());
    if HOOK_THREAD_ID.load(Ordering::SeqCst) != 0 {
        return;
    }

    std::thread::spawn(move || {
        let thread_id = unsafe { GetCurrentThreadId() };
        HOOK_THREAD_ID.store(thread_id, Ordering::SeqCst);

        // Create the thread message queue before calling RegisterHotKey.
        unsafe {
            let mut dummy_msg = MSG::default();
            let _ = PeekMessageW(
                &mut dummy_msg,
                HWND(std::ptr::null_mut()),
                0,
                0,
                PM_NOREMOVE,
            );
        }

        // Register Shift+Backspace as a system-wide hotkey on this thread.
        let registered = unsafe {
            RegisterHotKey(
                HWND(std::ptr::null_mut()),
                HOTKEY_ID_SHIFT_BACKSPACE,
                MOD_SHIFT | MOD_NOREPEAT,
                VK_BACK.0 as u32,
            )
        };
        if registered.is_err() {
            return;
        }

        let mut msg = MSG::default();
        loop {
            // GetMessageW returns 0 on WM_QUIT, -1 on error, positive otherwise.
            let result = unsafe { GetMessageW(&mut msg, HWND(std::ptr::null_mut()), 0, 0) };
            if result.0 <= 0 {
                // 0 = WM_QUIT, -1 = error — either way, exit the loop.
                break;
            }
            if msg.message == WM_HOTKEY && msg.wParam.0 as i32 == HOTKEY_ID_SHIFT_BACKSPACE {
                eprintln!("[HOTKEY] Shift+Backspace detected, toggling window");
                if let Some(app) = GLOBAL_APP_HANDLE.get() {
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        handle_toggle_window(&app_clone);
                    });
                }
            } else {
                unsafe {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }
        }

        // Unregister the hotkey before the thread exits.
        let _ = unsafe { UnregisterHotKey(HWND(std::ptr::null_mut()), HOTKEY_ID_SHIFT_BACKSPACE) };
    });
}

#[cfg(target_os = "windows")]
pub fn cleanup_windows_hook() {
    let thread_id = HOOK_THREAD_ID.swap(0, Ordering::SeqCst);
    if thread_id != 0 {
        unsafe {
            let _ = PostThreadMessageW(thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
}

// State for overlay window - tracks if user intentionally hid it
pub struct OverlayState {
    pub user_hidden: Arc<AtomicBool>,
}

impl Default for OverlayState {
    fn default() -> Self {
        OverlayState {
            user_hidden: Arc::new(AtomicBool::new(true)), // starts hidden
        }
    }
}

// State for window visibility (legacy, keeping for compatibility)
pub struct WindowVisibility {
    #[allow(dead_code)]
    pub is_hidden: Mutex<bool>,
}

// State for registered shortcuts
pub struct RegisteredShortcuts {
    pub shortcuts: Mutex<HashMap<String, String>>, // action_id -> shortcut_key
}

impl Default for RegisteredShortcuts {
    fn default() -> Self {
        RegisteredShortcuts {
            shortcuts: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutBinding {
    pub action: String,
    pub key: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutsConfig {
    pub bindings: HashMap<String, ShortcutBinding>,
}

/// Initialize global shortcuts for the application
pub fn setup_global_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Let the frontend initialize from localStorage
    let state = app.state::<RegisteredShortcuts>();
    let _registered = match state.shortcuts.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Mutex poisoned in setup, recovering...");
            poisoned.into_inner()
        }
    };
    eprintln!("Global shortcuts state initialized, waiting for frontend config");

    Ok(())
}

/// Handle shortcut action based on action_id
pub fn handle_shortcut_action<R: Runtime>(app: &AppHandle<R>, action_id: &str) {
    // Only toggle_window shortcut is active now
    match action_id {
        "toggle_window" => handle_toggle_window(app),
        _ => {
            eprintln!("Unknown shortcut action: {}", action_id);
        }
    }
}

/// Handle app toggle (hide/show) with input focus and app icon management
pub(crate) fn handle_toggle_window<R: Runtime>(app: &AppHandle<R>) {
    // Get the main window
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[TOGGLE] Error: Could not get main window");
        return;
    };

    #[cfg(target_os = "windows")]
    {
        let state = app.state::<OverlayState>();
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            // Window is visible, hide it
            eprintln!("[TOGGLE] Hiding window");
            state.user_hidden.store(true, Ordering::SeqCst);
            if let Err(e) = window.hide() {
                eprintln!("Failed to hide window: {}", e);
            }
        } else {
            // Window is hidden, show it
            eprintln!("[TOGGLE] Showing window");
            state.user_hidden.store(false, Ordering::SeqCst);
            if let Err(e) = window.show() {
                eprintln!("Failed to show window: {}", e);
            }

            // Bring window to front by re-asserting always-on-top
            if let Err(e) = window.set_always_on_top(true) {
                eprintln!("Failed to set always on top: {}", e);
            }

            // DO NOT call set_focus() - let user keep focus on their current app
            // DO NOT emit focus-text-input - only focus when user clicks on Hey Frank
        }

        // Emit event to close popovers
        if let Err(e) = window.emit("toggle-window-visibility", ()) {
            eprintln!("Failed to emit toggle-window-visibility event: {}", e);
        }

        return;
    }

    #[cfg(not(target_os = "windows"))]
    match window.is_visible() {
        Ok(true) => {
            #[cfg(target_os = "macos")]
            {
                println!("[MACOS] Hiding panel");
                let panel = app.get_webview_window("main").unwrap();
                let _ = panel.hide();
            }
            // Window is visible, hide it and handle app icon based on user settings
            println!("[NON-WINDOWS] Hiding window");
            if let Err(e) = window.hide() {
                eprintln!("Failed to hide window: {}", e);
            }
        }
        Ok(false) => {
            // Window is hidden, show it and bring to front
            if let Err(e) = window.show() {
                eprintln!("Failed to show window: {}", e);
            }

            // Bring window to front by re-asserting always-on-top
            if let Err(e) = window.set_always_on_top(true) {
                eprintln!("Failed to set always on top: {}", e);
            }

            // DO NOT call set_focus() - let user keep focus on their current app

            #[cfg(target_os = "macos")]
            {
                let panel = app.get_webview_panel("main").unwrap();
                panel.show();
            }

            // DO NOT emit focus-text-input - only focus when user clicks
        }
        Err(e) => {
            eprintln!("Failed to check window visibility: {}", e);
        }
    }
}

/// Handle screenshot shortcut
/// Tauri command to get all registered shortcuts
#[tauri::command]
pub fn get_registered_shortcuts<R: Runtime>(
    app: AppHandle<R>,
) -> Result<HashMap<String, String>, String> {
    let state = app.state::<RegisteredShortcuts>();
    let registered = match state.shortcuts.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Mutex poisoned in get_registered_shortcuts, recovering...");
            poisoned.into_inner()
        }
    };
    Ok(registered.clone())
}

/// Tauri command to update shortcuts dynamically
#[tauri::command]
pub fn update_shortcuts<R: Runtime>(
    app: AppHandle<R>,
    config: ShortcutsConfig,
) -> Result<(), String> {
    eprintln!("Updating shortcuts with {} bindings", config.bindings.len());

    let mut shortcuts_to_register = Vec::new();
    let mut successfully_registered = HashMap::new();

    for (action_id, binding) in &config.bindings {
        if binding.enabled && !binding.key.is_empty() {
            #[cfg(target_os = "windows")]
            if action_id == "toggle_window"
                && binding.key.trim().eq_ignore_ascii_case("shift+backspace")
            {
                // Handled via WH_KEYBOARD_LL on Windows to avoid RegisterHotKey Backspace suppression
                eprintln!(
                    "Registered shortcut: {} -> {} (WH_KEYBOARD_LL hook)",
                    action_id, binding.key
                );
                successfully_registered.insert(action_id.clone(), binding.key.clone());
                continue;
            }

            match binding.key.parse::<Shortcut>() {
                Ok(shortcut) => {
                    shortcuts_to_register.push((action_id.clone(), binding.key.clone(), shortcut));
                }
                Err(e) => {
                    eprintln!(
                        "Invalid shortcut '{}' for action '{}': {}",
                        binding.key, action_id, e
                    );
                    return Err(format!(
                        "Invalid shortcut '{}' for action '{}': {}",
                        binding.key, action_id, e
                    ));
                }
            }
        }
    }

    // Unregister all existing shortcuts
    unregister_all_shortcuts(&app)?;

    // Now register all new shortcuts
    let mut registration_failures: Vec<(String, String, String)> = Vec::new();

    for (action_id, shortcut_str, shortcut) in shortcuts_to_register {
        match app.global_shortcut().register(shortcut) {
            Ok(_) => {
                eprintln!("Registered shortcut: {} -> {}", action_id, shortcut_str);
                successfully_registered.insert(action_id, shortcut_str);
            }
            Err(e) => {
                eprintln!("Failed to register {} shortcut: {}", action_id, e);
                registration_failures.push((action_id, shortcut_str, e.to_string()));
            }
        }
    }

    // Update state with successfully registered shortcuts
    {
        let state = app.state::<RegisteredShortcuts>();
        let mut registered = match state.shortcuts.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("Mutex poisoned in update_shortcuts, recovering...");
                poisoned.into_inner()
            }
        };

        registered.clear();
        registered.extend(successfully_registered);
    }

    if !registration_failures.is_empty() {
        if let Some(window) = app.get_webview_window("main") {
            if let Err(e) = window.emit("shortcut-registration-error", &registration_failures) {
                eprintln!("Failed to emit shortcut registration error event: {}", e);
            }
        }

        let error_messages: Vec<String> = registration_failures
            .into_iter()
            .map(|(action, key, error)| format!("{} ({}) - {}", action, key, error))
            .collect();

        return Err(format!(
            "Some shortcuts could not be registered: {}",
            error_messages.join("; ")
        ));
    }

    Ok(())
}

/// Unregister all currently registered shortcuts
fn unregister_all_shortcuts<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let state = app.state::<RegisteredShortcuts>();
    let registered = match state.shortcuts.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Mutex poisoned in unregister_all_shortcuts, recovering...");
            poisoned.into_inner()
        }
    };

    for (action_id, shortcut_str) in registered.iter() {
        // Shift+Backspace is handled via RegisterHotKey on Windows, not through
        // tauri_plugin_global_shortcut, so skip it here to avoid a failed unregister.
        #[cfg(target_os = "windows")]
        if action_id == "toggle_window"
            && shortcut_str.trim().eq_ignore_ascii_case("shift+backspace")
        {
            continue;
        }
        if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
            match app.global_shortcut().unregister(shortcut) {
                Ok(_) => {
                    eprintln!("Unregistered shortcut: {} -> {}", action_id, shortcut_str);
                }
                Err(e) => {
                    eprintln!("Failed to unregister shortcut {}: {}", shortcut_str, e);
                }
            }
        }
    }

    Ok(())
}

/// Tauri command to check if shortcuts are registered
#[tauri::command]
pub fn check_shortcuts_registered<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let state = app.state::<RegisteredShortcuts>();
    let registered = match state.shortcuts.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Mutex poisoned in check_shortcuts_registered, recovering...");
            poisoned.into_inner()
        }
    };
    Ok(!registered.is_empty())
}

/// Tauri command to validate shortcut key
#[tauri::command]
pub fn validate_shortcut_key(key: String) -> Result<bool, String> {
    match key.parse::<Shortcut>() {
        Ok(_) => Ok(true),
        Err(e) => {
            eprintln!("Invalid shortcut '{}': {}", key, e);
            Ok(false)
        }
    }
}

/// Tauri command to set app icon visibility in dock/taskbar
#[tauri::command]
pub fn set_app_icon_visibility<R: Runtime>(app: AppHandle<R>, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, use activation policy to control dock icon
        let policy = if visible {
            tauri::ActivationPolicy::Regular
        } else {
            tauri::ActivationPolicy::Accessory
        };

        app.set_activation_policy(policy).map_err(|e| {
            eprintln!("Failed to set activation policy: {}", e);
            format!("Failed to set activation policy: {}", e)
        })?;
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, control taskbar icon visibility
        if let Some(window) = app.get_webview_window("main") {
            window
                .set_skip_taskbar(!visible)
                .map_err(|e| format!("Failed to set taskbar visibility: {}", e))?;
        } else {
            eprintln!("Main window not found on Windows");
        }
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, control panel icon visibility
        if let Some(window) = app.get_webview_window("main") {
            window
                .set_skip_taskbar(!visible)
                .map_err(|e| format!("Failed to set panel visibility: {}", e))?;
        } else {
            eprintln!("Main window not found on Linux");
        }
    }

    Ok(())
}

/// Tauri command to set always on top state
#[tauri::command]
pub fn set_always_on_top<R: Runtime>(app: AppHandle<R>, enabled: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_always_on_top(enabled)
            .map_err(|e| format!("Failed to set always on top: {}", e))?;
    } else {
        return Err("Main window not found".to_string());
    }

    Ok(())
}

/// Tauri command to exit the application
#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle) {
    #[cfg(target_os = "windows")]
    cleanup_windows_hook();
    app_handle.exit(0);
}
