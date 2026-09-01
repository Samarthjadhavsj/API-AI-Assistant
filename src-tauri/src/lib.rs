// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod capture;
mod db;
mod shortcuts;
mod tray;
mod window;
use std::sync::{Arc, Mutex};
use tauri::{Listener, Manager};
use tauri_plugin_posthog::{init as posthog_init, PostHogConfig, PostHogOptions};
use tokio::task::JoinHandle;
mod speaker;
use capture::CaptureState;
use speaker::VadConfig;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOACTIVATE, SWP_NOSIZE, SWP_SHOWWINDOW,
};

#[cfg(target_os = "windows")]
fn ensure_topmost(hwnd: HWND) {
    unsafe {
        // Use SWP_NOACTIVATE to prevent focus stealing while keeping topmost
        // This is crucial for transparent windows to not auto-hide
        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_NOACTIVATE,
        );
        eprintln!("[OVERLAY] Ensured HWND_TOPMOST with SWP_NOACTIVATE");
    }
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
use tauri_nspanel::{cocoa::appkit::NSWindowCollectionBehavior, panel_delegate, WebviewWindowExt};

#[derive(Default)]
pub struct AudioState {
    stream_task: Arc<Mutex<Option<JoinHandle<()>>>>,
    vad_config: Arc<Mutex<VadConfig>>,
    is_capturing: Arc<Mutex<bool>>,
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn resize_main_window(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("no main window")?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix WebView2 transparency on Windows
    // Sets the default background color to transparent (RGBA: 0,0,0,0)
    // This is critical because transparent: true only affects the HWND,
    // not the embedded WebView2 control which has its own DefaultBackgroundColor property
    #[cfg(target_os = "windows")]
    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "00000000");

    // Get PostHog API key
    let posthog_api_key = option_env!("POSTHOG_API_KEY").unwrap_or("").to_string();
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pluely.db", db::migrations())
                .build(),
        )
        .manage(AudioState::default())
        .manage(CaptureState::default())
        .manage(shortcuts::WindowVisibility {
            is_hidden: Mutex::new(false),
        })
        .manage(shortcuts::RegisteredShortcuts::default())
        .manage(shortcuts::MoveWindowState::default())
        .manage(shortcuts::OverlayState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init()) // Add shell plugin
        .plugin(posthog_init(PostHogConfig {
            api_key: posthog_api_key,
            options: Some(PostHogOptions {
                // disable session recording
                disable_session_recording: Some(true),
                // disable pageview
                capture_pageview: Some(false),
                // disable pageleave
                capture_pageleave: Some(false),
                ..Default::default()
            }),
            ..Default::default()
        }));
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut builder = builder
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            resize_main_window,
            window::set_window_height,
            window::move_window,
            capture::capture_to_base64,
            capture::start_screen_capture,
            capture::capture_selected_area,
            capture::close_overlay_window,
            shortcuts::check_shortcuts_registered,
            shortcuts::get_registered_shortcuts,
            shortcuts::update_shortcuts,
            shortcuts::validate_shortcut_key,
            shortcuts::set_app_icon_visibility,
            shortcuts::set_always_on_top,
            shortcuts::exit_app,
            speaker::start_system_audio_capture,
            speaker::stop_system_audio_capture,
            speaker::manual_stop_continuous,
            speaker::check_system_audio_access,
            speaker::request_system_audio_access,
            speaker::get_vad_config,
            speaker::update_vad_config,
            speaker::get_capture_status,
            speaker::get_audio_sample_rate,
        ])
        .setup(|app| {
            // Setup system tray
            if let Err(e) = tray::setup_system_tray(app.handle()) {
                eprintln!("Failed to setup system tray: {}", e);
            }
            
            // Setup main window positioning and configure for persistence
            window::setup_main_window(app).expect("Failed to setup main window");
            
            // Configure window to stay visible (Windows)
            #[cfg(target_os = "windows")]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    // Apply Win32 topmost style on Windows
                    if let Ok(hwnd) = main_window.hwnd() {
                        ensure_topmost(HWND(hwnd.0));
                        println!("Applied HWND_TOPMOST for persistent visibility");
                    }
                    
                    // Re-apply topmost on focus loss ONLY if window is actually visible and not hidden by user
                    let overlay_state = app.state::<shortcuts::OverlayState>();
                    let user_hidden = overlay_state.user_hidden.clone();
                    let window_for_handler = main_window.clone();
                    
                    main_window.on_window_event(move |event| {
                        match event {
                            tauri::WindowEvent::Focused(false) => {
                                // Only re-ensure topmost if user hasn't hidden the window
                                let is_hidden = user_hidden.load(std::sync::atomic::Ordering::SeqCst);
                                
                                // Check if window is actually visible before re-ensuring topmost
                                let is_visible = window_for_handler.is_visible().unwrap_or(false);
                                
                                if !is_hidden && is_visible {
                                    println!("[FOCUS LOST] Re-ensuring topmost (window visible and not user-hidden)");
                                    if let Ok(hwnd) = window_for_handler.hwnd() {
                                        ensure_topmost(HWND(hwnd.0));
                                    }
                                } else {
                                    println!("[FOCUS LOST] Window is hidden or not visible, skipping topmost");
                                }
                            }
                            _ => {}
                        }
                    });
                    
                    println!("Configured window for persistent visibility");
                }
            }
            
            #[cfg(target_os="macos")]
            init(app.app_handle());

            // Listen for hide-window-clicked event from frontend
            let app_handle_for_event = app.handle().clone();
            app.listen("hide-window-clicked", move |_event| {
                println!("[X BUTTON] Hide window clicked from frontend");
                if let Some(window) = app_handle_for_event.get_webview_window("main") {
                    let state = app_handle_for_event.state::<shortcuts::OverlayState>();
                    state.user_hidden.store(true, std::sync::atomic::Ordering::SeqCst);
                    if let Err(e) = window.hide() {
                        eprintln!("Failed to hide window from X button: {}", e);
                    } else {
                        println!("[X BUTTON] Window hidden successfully");
                    }
                }
            });

            // Dashboard creation removed - only toggle window exists now

            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;

                #[allow(deprecated, unexpected_cfgs)]
                if let Err(e) = app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    Some(vec![]),
                )) {
                    eprintln!("Failed to initialize autostart plugin: {}", e);
                }
            }

            // Initialize global shortcut plugin with centralized handler
            app.handle()
                .plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};

                            let action_id = {
                                let state = app.state::<shortcuts::RegisteredShortcuts>();
                                let registered = match state.shortcuts.lock() {
                                    Ok(guard) => guard,
                                    Err(poisoned) => {
                                        eprintln!("Mutex poisoned in handler, recovering...");
                                        poisoned.into_inner()
                                    }
                                };

                                registered.iter().find_map(|(action_id, shortcut_str)| {
                                    if let Ok(s) = shortcut_str.parse::<Shortcut>() {
                                        if &s == shortcut {
                                            return Some(action_id.clone());
                                        }
                                    }
                                    None
                                })
                            };

                            if let Some(action_id) = action_id {
                                match event.state() {
                                    ShortcutState::Pressed => {
                                        if let Some(direction) =
                                            action_id.strip_prefix("move_window_")
                                        {
                                            shortcuts::start_move_window(app, direction);
                                        } else {
                                            eprintln!("Shortcut triggered: {}", action_id);
                                            shortcuts::handle_shortcut_action(app, &action_id);
                                        }
                                    }
                                    ShortcutState::Released => {
                                        if let Some(direction) =
                                            action_id.strip_prefix("move_window_")
                                        {
                                            shortcuts::stop_move_window(app, direction);
                                        }
                                    }
                                }
                            }
                        })
                        .build(),
                )
                .expect("Failed to initialize global shortcut plugin");
            if let Err(e) = shortcuts::setup_global_shortcuts(app.handle()) {
                eprintln!("Failed to setup global shortcuts: {}", e);
            }
            Ok(())
        });

    // Add macOS-specific permissions plugin
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_plugin_macos_permissions::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs)]
fn init(app_handle: &AppHandle) {
    let window: WebviewWindow = app_handle.get_webview_window("main").unwrap();

    let panel = window.to_panel().unwrap();

    let delegate = panel_delegate!(MyPanelDelegate {
        window_did_become_key,
        window_did_resign_key
    });

    let handle = app_handle.to_owned();

    delegate.set_listener(Box::new(move |delegate_name: String| {
        match delegate_name.as_str() {
            "window_did_become_key" => {
                let app_name = handle.package_info().name.to_owned();

                println!("[info]: {:?} panel becomes key window!", app_name);
            }
            "window_did_resign_key" => {
                println!("[info]: panel resigned from key window!");
            }
            _ => (),
        }
    }));

    // Set the window to float level
    #[allow(non_upper_case_globals)]
    const NSFloatWindowLevel: i32 = 4;
    panel.set_level(NSFloatWindowLevel);

    #[allow(non_upper_case_globals)]
    const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;
    panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);

    #[allow(deprecated)]
    panel.set_collection_behaviour(
        NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces,
    );

    panel.set_delegate(delegate);
}
