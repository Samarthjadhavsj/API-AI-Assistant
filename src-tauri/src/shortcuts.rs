use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicIsize, AtomicU32};
#[cfg(target_os = "windows")]
use std::sync::OnceLock;
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, VK_BACK,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, DispatchMessageW, GetClassNameW, GetLayeredWindowAttributes,
    GetMessageW, GetWindow, GetWindowLongW, GetWindowTextW, PeekMessageW, PostMessageW,
    PostThreadMessageW, TranslateMessage, GWL_EXSTYLE, GWL_STYLE, GW_HWNDPREV, HMENU, MSG,
    PM_NOREMOVE, WINDOW_EX_STYLE, WINDOW_STYLE, WM_HOTKEY, WM_QUIT, WS_EX_TOOLWINDOW,
};

#[cfg(target_os = "windows")]
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
#[cfg(target_os = "windows")]
static HOTKEY_HWND: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
static GLOBAL_APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

/// Fixed hotkey ID used with RegisterHotKey.
#[cfg(target_os = "windows")]
const HOTKEY_ID_SHIFT_BACKSPACE: i32 = 1;
const HOTKEY_ID_CTRL_BACKSPACE: i32 = 2; // Temporary diagnostic hotkey

#[cfg(target_os = "windows")]
extern "system" {
    fn GetCurrentThreadId() -> u32;
}

#[cfg(target_os = "windows")]
pub fn setup_windows_hook(app: &AppHandle) {
    let _ = GLOBAL_APP_HANDLE.set(app.clone());
    if HOOK_THREAD_ID.load(Ordering::SeqCst) != 0 {
        return;
    }

    std::thread::spawn(move || {
        let thread_id = unsafe { GetCurrentThreadId() };
        HOOK_THREAD_ID.store(thread_id, Ordering::SeqCst);

        // Use the built-in system window class "STATIC" (available in user32 without extra registration)
        let class_name: Vec<u16> = "STATIC\0".encode_utf16().collect();
        let window_name: Vec<u16> = "FrankHotkeyWindow\0".encode_utf16().collect();

        let hwnd = match unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(WS_EX_TOOLWINDOW.0),
                PCWSTR(class_name.as_ptr()),
                PCWSTR(window_name.as_ptr()),
                WINDOW_STYLE(0),
                0,
                0,
                0,
                0,
                HWND(std::ptr::null_mut()),
                HMENU(std::ptr::null_mut()),
                HINSTANCE(std::ptr::null_mut()),
                None,
            )
        } {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[HOTKEY] Failed to create hidden window: {}", e);
                return;
            }
        };
        // Ensure the thread has a message queue before registering the hotkey
        let mut _msg = MSG::default();
        unsafe {
            let _ = PeekMessageW(&mut _msg, hwnd, 0, 0, PM_NOREMOVE);
        }

        HOTKEY_HWND.store(hwnd.0 as isize, Ordering::SeqCst);
        eprintln!("[HOTKEY] Hidden HWND created: {:?}", hwnd);

        // Register Shift+Backspace hotkey
        let registered_shift = unsafe {
            RegisterHotKey(
                hwnd,
                HOTKEY_ID_SHIFT_BACKSPACE,
                MOD_SHIFT | MOD_NOREPEAT,
                VK_BACK.0 as u32,
            )
        };
        if let Err(e) = registered_shift {
            use windows::Win32::Foundation::GetLastError;
            let err = unsafe { GetLastError().0 };
            eprintln!(
                "[HOTKEY] RegisterHotKey failed for Shift+Backspace: {} (GetLastError={})",
                e, err
            );
            unsafe {
                let _ = DestroyWindow(hwnd);
            }
            return;
        } else {
            eprintln!(
                "[HOTKEY] RegisterHotKey succeeded for Shift+Backspace on HWND {:?}",
                hwnd
            );
        }
        // Register Ctrl+Backspace diagnostic hotkey
        let registered_ctrl = unsafe {
            RegisterHotKey(
                hwnd,
                HOTKEY_ID_CTRL_BACKSPACE,
                MOD_CONTROL | MOD_NOREPEAT,
                VK_BACK.0 as u32,
            )
        };
        if let Err(e) = registered_ctrl {
            use windows::Win32::Foundation::GetLastError;
            let err = unsafe { GetLastError().0 };
            eprintln!(
                "[HOTKEY] RegisterHotKey failed for Ctrl+Backspace: {} (GetLastError={})",
                e, err
            );
        } else {
            eprintln!(
                "[HOTKEY] RegisterHotKey succeeded for Ctrl+Backspace on HWND {:?}",
                hwnd
            );
        }

        let mut msg = MSG::default();
        loop {
            let result = unsafe { GetMessageW(&mut msg, HWND(std::ptr::null_mut()), 0, 0) };
            if result.0 <= 0 {
                break;
            }
            if msg.message == WM_HOTKEY {
                match msg.wParam.0 as i32 {
                    HOTKEY_ID_SHIFT_BACKSPACE => {
                        eprintln!("[HOTKEY] WM_HOTKEY received (Shift+Backspace) on hidden HWND, about to toggle window");
                        if let Some(app) = GLOBAL_APP_HANDLE.get() {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                eprintln!(
                                    "[HOTKEY] Spawning async task to call handle_toggle_window"
                                );
                                handle_toggle_window(&app_clone);
                            });
                        }
                    }
                    HOTKEY_ID_CTRL_BACKSPACE => {
                        eprintln!("[HOTKEY] WM_HOTKEY received (Ctrl+Backspace) on hidden HWND, toggling window");
                        if let Some(app) = GLOBAL_APP_HANDLE.get() {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                handle_toggle_window(&app_clone);
                            });
                        }
                    }
                    _ => {
                        // Other hotkeys (if any) – just log.
                        eprintln!(
                            "[HOTKEY] WM_HOTKEY received with unknown ID {}",
                            msg.wParam.0
                        );
                    }
                }
            } else {
                unsafe {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }
        }

        unsafe {
            let _ = UnregisterHotKey(hwnd, HOTKEY_ID_SHIFT_BACKSPACE);
            let _ = DestroyWindow(hwnd);
        }
        HOTKEY_HWND.store(0, Ordering::SeqCst);
    });
}

#[cfg(target_os = "windows")]
pub fn cleanup_windows_hook() {
    let hwnd_val = HOTKEY_HWND.swap(0, Ordering::SeqCst);
    if hwnd_val != 0 {
        unsafe {
            let _ = PostMessageW(HWND(hwnd_val as *mut _), WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
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
        let state = OverlayState {
            user_hidden: Arc::new(AtomicBool::new(true)), // starts hidden
        };
        eprintln!(
            "[STATE] OverlayState initialized with user_hidden={}",
            state.user_hidden.load(std::sync::atomic::Ordering::SeqCst)
        );
        state
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
    eprintln!("[TOGGLE] handle_toggle_window() entered");
    // Get the main window
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[TOGGLE] Error: Could not get main window");
        return;
    };

    #[cfg(target_os = "windows")]
    {
        let state = app.state::<OverlayState>();
        let user_hidden = state.user_hidden.load(Ordering::SeqCst);
        let is_visible = window.is_visible().unwrap_or(false);
        eprintln!(
            "[TOGGLE] BEFORE: user_hidden={}, is_visible={}",
            user_hidden, is_visible
        );

        if user_hidden {
            state.user_hidden.store(false, Ordering::SeqCst);
            eprintln!(
                "[TOGGLE] Setting user_hidden to false, now: {}",
                state.user_hidden.load(Ordering::SeqCst)
            );

            // DEBUG: Log style/exstyle BEFORE show()
            if let Ok(hwnd) = window.hwnd() {
                let style_before =
                    unsafe { GetWindowLongW(windows::Win32::Foundation::HWND(hwnd.0), GWL_STYLE) };
                let ex_style_before = unsafe {
                    GetWindowLongW(windows::Win32::Foundation::HWND(hwnd.0), GWL_EXSTYLE)
                };
                eprintln!(
                    "[DEBUG] Style BEFORE show(): 0x{:X}, ExStyle BEFORE show(): 0x{:X}",
                    style_before, ex_style_before
                );
            }

            let show_res = window.show();
            let is_visible_after_show = window.is_visible().unwrap_or(false);
            eprintln!(
                "[TOGGLE] Called window.show(), result: {:?}, is_visible after: {}",
                show_res, is_visible_after_show
            );

            // DEBUG: Check window position and size
            let pos = window.outer_position();
            let size = window.outer_size();
            eprintln!("[DEBUG] Position: {:?}, Size: {:?}", pos, size);

            // DEBUG: Check monitor information
            let monitors = window.available_monitors();
            eprintln!("[DEBUG] Available monitors: {:?}", monitors);
            let current_monitor = window.current_monitor();
            eprintln!("[DEBUG] Current monitor: {:?}", current_monitor);

            // DEBUG: Check Win32 window styles
            if let Ok(hwnd) = window.hwnd() {
                let style =
                    unsafe { GetWindowLongW(windows::Win32::Foundation::HWND(hwnd.0), GWL_STYLE) };
                let ex_style = unsafe {
                    GetWindowLongW(windows::Win32::Foundation::HWND(hwnd.0), GWL_EXSTYLE)
                };
                eprintln!("[DEBUG] Style: 0x{:X}, ExStyle: 0x{:X}", style, ex_style);

                // DEBUG: Check if window is layered and get alpha
                if ex_style & 0x80000 != 0 {
                    use windows::Win32::UI::WindowsAndMessaging::LAYERED_WINDOW_ATTRIBUTES_FLAGS;
                    let mut alpha: u8 = 0;
                    let mut flags: LAYERED_WINDOW_ATTRIBUTES_FLAGS =
                        LAYERED_WINDOW_ATTRIBUTES_FLAGS::default();
                    let result = unsafe {
                        GetLayeredWindowAttributes(
                            windows::Win32::Foundation::HWND(hwnd.0),
                            None,
                            Some(&mut alpha),
                            Some(&mut flags),
                        )
                    };
                    eprintln!("[DEBUG] Layered window - GetLayeredWindowAttributes result: {:?}, alpha: {}, flags: {:?}", result, alpha, flags);
                }

                // DEBUG: Check z-order
                let prev_hwnd =
                    unsafe { GetWindow(windows::Win32::Foundation::HWND(hwnd.0), GW_HWNDPREV) };
                eprintln!("[DEBUG] Window above in z-order: HWND({:?})", prev_hwnd);

                // DEBUG: Identify the covering window
                if let Ok(prev) = prev_hwnd {
                    if !prev.is_invalid() {
                        let mut title = [0u16; 256];
                        let mut class = [0u16; 256];
                        let title_len = unsafe { GetWindowTextW(prev, &mut title) };
                        let class_len = unsafe { GetClassNameW(prev, &mut class) };
                        eprintln!(
                            "[DEBUG] Covering window title: {:?}, class: {:?}",
                            String::from_utf16_lossy(&title[..title_len as usize]),
                            String::from_utf16_lossy(&class[..class_len as usize])
                        );
                    } else {
                        eprintln!("[DEBUG] No window above ours (we're at the very top)");
                    }
                }
            }

            // Bring window to front by re-asserting always-on-top
            let aot_res = window.set_always_on_top(true);
            let is_visible_after_aot = window.is_visible().unwrap_or(false);
            eprintln!(
                "[TOGGLE] Called set_always_on_top(true), result: {:?}, is_visible after: {}",
                aot_res, is_visible_after_aot
            );

            // DO NOT call set_focus() - let user keep focus on their current app
            // DO NOT emit focus-text-input - only focus when user clicks on Hey Frank
        } else {
            eprintln!("[TOGGLE] Window is visible, attempting to hide it");
            state.user_hidden.store(true, Ordering::SeqCst);
            eprintln!(
                "[TOGGLE] Set user_hidden to true, now: {}",
                state.user_hidden.load(Ordering::SeqCst)
            );

            let hide_res = window.hide();
            let is_visible_after_hide = window.is_visible().unwrap_or(false);
            eprintln!(
                "[TOGGLE] Called window.hide(), result: {:?}, is_visible after: {}",
                hide_res, is_visible_after_hide
            );

            if let Err(e) = hide_res {
                eprintln!("[TOGGLE] Failed to hide window: {}", e);
            }
        }

        let final_is_visible = window.is_visible().unwrap_or(false);
        let final_user_hidden = state.user_hidden.load(Ordering::SeqCst);
        eprintln!(
            "[TOGGLE] AFTER: user_hidden={}, is_visible={}",
            final_user_hidden, final_is_visible
        );

        if let Err(e) = window.emit("toggle-window-visibility", ()) {
            eprintln!("Failed to emit toggle-window-visibility event: {}", e);
        }
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
                // Handled via RegisterHotKey on Windows to avoid conflict
                eprintln!(
                    "Registered shortcut: {} -> {} (RegisterHotKey)",
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
