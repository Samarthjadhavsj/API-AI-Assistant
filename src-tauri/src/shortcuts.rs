use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tokio::time::{sleep, Duration};

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

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

pub(crate) type MoveWindowTask = Arc<AtomicBool>;

pub(crate) struct MoveWindowState {
    tasks: Mutex<HashMap<String, MoveWindowTask>>,
}

impl Default for MoveWindowState {
    fn default() -> Self {
        MoveWindowState {
            tasks: Mutex::new(HashMap::new()),
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

pub fn start_move_window<R: Runtime>(app: &AppHandle<R>, direction: &str) {
    let state = app.state::<MoveWindowState>();
    let mut tasks = match state.tasks.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    if tasks.contains_key(direction) {
        return;
    }

    let stop_flag: MoveWindowTask = Arc::new(AtomicBool::new(false));
    let flag_clone = stop_flag.clone();
    let dir = direction.to_string();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let interval = Duration::from_millis(16);
        while !flag_clone.load(Ordering::Relaxed) {
            handle_move_window(&app_handle, &dir);
            sleep(interval).await;
        }
    });

    tasks.insert(direction.to_string(), stop_flag);
}

pub fn stop_move_window<R: Runtime>(app: &AppHandle<R>, direction: &str) {
    let state = app.state::<MoveWindowState>();
    let mut tasks = match state.tasks.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    if let Some(flag) = tasks.remove(direction) {
        flag.store(true, Ordering::Relaxed);
    }
}

pub fn stop_all_move_windows<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<MoveWindowState>();
    let mut tasks = match state.tasks.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    for (_direction, flag) in tasks.drain() {
        flag.store(true, Ordering::Relaxed);
    }
}

/// Handle app toggle (hide/show) with input focus and app icon management
fn handle_toggle_window<R: Runtime>(app: &AppHandle<R>) {
    // Get the main window
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    #[cfg(target_os = "windows")]
    {
        let state = app.state::<OverlayState>();
        let is_visible = window.is_visible().unwrap_or(false);

        println!("[TOGGLE DEBUG] is_visible from Tauri: {}", is_visible);
        println!("[TOGGLE DEBUG] user_hidden state: {}", state.user_hidden.load(Ordering::SeqCst));

        if is_visible {
            // Window is visible, hide it
            println!("[TOGGLE] Hiding window (user requested)");
            state.user_hidden.store(true, Ordering::SeqCst);
            if let Err(e) = window.hide() {
                eprintln!("Failed to hide window: {}", e);
            }
        } else {
            // Window is hidden, show it
            println!("[TOGGLE] Showing window (user requested)");
            state.user_hidden.store(false, Ordering::SeqCst);
            if let Err(e) = window.show() {
                eprintln!("Failed to show window: {}", e);
            }
            
            // DO NOT call set_focus() - let user keep focus on their current app
            // DO NOT emit focus-text-input - only focus when user clicks on Hey Frank
            if let Err(e) = window.emit("focus-text-input", json!({})) {
                eprintln!("Failed to emit focus-text-input event: {}", e);
            }
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
            // Window is hidden, show it and handle app icon based on user settings
            if let Err(e) = window.show() {
                eprintln!("Failed to show window: {}", e);
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

    for (action_id, binding) in &config.bindings {
        if binding.enabled && !binding.key.is_empty() {
            if action_id == "move_window" {
                let modifiers = binding.key.trim();
                if modifiers.is_empty() {
                    continue;
                }

                let arrow_keys = vec!["up", "down", "left", "right"];
                for arrow in arrow_keys {
                    let full_key = format!("{}+{}", modifiers, arrow);
                    match full_key.parse::<Shortcut>() {
                        Ok(shortcut) => {
                            let direction_action_id = format!("move_window_{}", arrow);
                            shortcuts_to_register.push((direction_action_id, full_key, shortcut));
                        }
                        Err(e) => {
                            eprintln!("Invalid shortcut '{}' for move_window: {}", full_key, e);
                            return Err(format!(
                                "Invalid shortcut '{}' for move_window: {}",
                                full_key, e
                            ));
                        }
                    }
                }

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

    // First, stop any ongoing window movement
    stop_all_move_windows(&app);

    // Then, unregister all existing shortcuts
    unregister_all_shortcuts(&app)?;

    // Now register all new shortcuts
    let mut successfully_registered = HashMap::new();

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

fn handle_move_window<R: Runtime>(app: &AppHandle<R>, direction: &str) {
    if let Some(window) = app.get_webview_window("main") {
        match window.outer_position() {
            Ok(current_pos) => {
                let step = 12;
                let (new_x, new_y) = match direction {
                    "up" => (current_pos.x, current_pos.y - step),
                    "down" => (current_pos.x, current_pos.y + step),
                    "left" => (current_pos.x - step, current_pos.y),
                    "right" => (current_pos.x + step, current_pos.y),
                    _ => {
                        eprintln!("Invalid direction: {}", direction);
                        return;
                    }
                };

                if let Err(e) =
                    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: new_x,
                        y: new_y,
                    }))
                {
                    eprintln!("Failed to set window position: {}", e);
                }
            }
            Err(e) => {
                eprintln!("Failed to get window position: {}", e);
            }
        }
    } else {
        eprintln!("Main window not found");
    }
}

/// Tauri command to exit the application
#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}
