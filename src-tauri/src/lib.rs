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
use windows::Win32::Foundation::GetLastError;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, GetWindowLongW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
    HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_TOOLWINDOW,
};

#[cfg(target_os = "windows")]
fn apply_overlay_style(hwnd: HWND) {
    unsafe {
        eprintln!(
            "[OVERLAY] apply_overlay_style() called with HWND: {:?}",
            hwnd
        );

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        eprintln!(
            "[OVERLAY] BEFORE SetWindowLongPtrW: ExStyle = 0x{:X}",
            ex_style
        );

        let new_style = ex_style | WS_EX_TOOLWINDOW.0 as isize;
        eprintln!(
            "[OVERLAY] Setting ExStyle to: 0x{:X} (adding WS_EX_TOOLWINDOW)",
            new_style
        );

        let result = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
        eprintln!(
            "[OVERLAY] SetWindowLongPtrW result: 0x{:X} (previous value)",
            result
        );

        if result == 0 {
            let error = GetLastError();
            eprintln!(
                "[OVERLAY] SetWindowLongPtrW FAILED! GetLastError: {:?}",
                error
            );
        }

        // Verify the change took effect
        let actual_ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        eprintln!(
            "[OVERLAY] AFTER SetWindowLongPtrW: Actual ExStyle = 0x{:X}",
            actual_ex_style
        );

        // Do not set LWA_ALPHA here. A layered-window alpha of 0 hides the whole HWND,
        // including its WebView content. Tauri/WebView2 already provides per-pixel
        // transparency via `transparent: true` and WEBVIEW2_DEFAULT_BACKGROUND_COLOR.
        // Reapplying a zero global alpha on Focused(false) was why the toggle disappeared
        // whenever the user clicked another application.

        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
        );

        eprintln!("[OVERLAY] Applied WS_EX_TOOLWINDOW + HWND_TOPMOST");
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
                    let initial_is_visible = main_window.is_visible().unwrap_or(false);
                    println!("[SETUP] Main window found, initial is_visible={}", initial_is_visible);

                    // Apply Win32 overlay styles (WS_EX_TOOLWINDOW only, removed WS_EX_NOACTIVATE)
                    if let Ok(hwnd) = main_window.hwnd() {
                        let h = windows::Win32::Foundation::HWND(hwnd.0);

                        // DEBUG: Log style/exstyle at startup
                        let startup_style = unsafe { GetWindowLongW(h, GWL_STYLE) };
                        let startup_ex_style = unsafe { GetWindowLongW(h, GWL_EXSTYLE) };
                        println!("[STARTUP DEBUG] Style: 0x{:X}, ExStyle: 0x{:X}", startup_style, startup_ex_style);

                        println!("[SETUP] About to call apply_overlay_style() at startup");
                        apply_overlay_style(h);
                        println!("Applied Win32 overlay styles (WS_EX_TOOLWINDOW + HWND_TOPMOST)");
                    }

                    // Safety net: re-show window on focus loss if user didn't hide it
                    let overlay_state = app.state::<shortcuts::OverlayState>();
                    let user_hidden = overlay_state.user_hidden.clone();
                    let window_for_handler = main_window.clone();

                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(false) = event {
                            let current_user_hidden = user_hidden.load(std::sync::atomic::Ordering::SeqCst);
                            let current_is_visible = window_for_handler.is_visible().unwrap_or(false);
                            println!("[FOCUS LOST] Event fired. user_hidden={}, is_visible={}", current_user_hidden, current_is_visible);

                            // Only re-show if user didn't explicitly hide it
                            if !current_user_hidden {
                                println!("[AUTO-RESTORE] User didn't hide window, re-showing and re-applying overlay styles");
                                let show_res = window_for_handler.show();
                                let is_visible_after_show = window_for_handler.is_visible().unwrap_or(false);
                                println!("[AUTO-RESTORE] Called show(), result: {:?}, is_visible after: {}", show_res, is_visible_after_show);

                                // Re-apply overlay styles
                                if let Ok(hwnd) = window_for_handler.hwnd() {
                                    println!("[AUTO-RESTORE] About to call apply_overlay_style() in focus handler");
                                    apply_overlay_style(HWND(hwnd.0));
                                    println!("[AUTO-RESTORE] Re-applied overlay styles");
                                }
                            } else {
                                println!("[FOCUS LOST] User hid window (user_hidden=true), NOT restoring");
                            }
                        }
                    });

                    println!("Configured window for persistent visibility");
                }
            }

            #[cfg(target_os = "macos")]
            init(app.app_handle());

            // Listen for hide-window-clicked event from frontend
            let app_handle_for_event = app.handle().clone();
            app.listen("hide-window-clicked", move |_event| {
                println!("[X BUTTON] Hide window clicked from frontend");
                if let Some(window) = app_handle_for_event.get_webview_window("main") {
                    let state = app_handle_for_event.state::<shortcuts::OverlayState>();
                    let before_user_hidden = state.user_hidden.load(std::sync::atomic::Ordering::SeqCst);
                    let before_is_visible = window.is_visible().unwrap_or(false);
                    println!("[X BUTTON] BEFORE: user_hidden={}, is_visible={}", before_user_hidden, before_is_visible);

                    state
                        .user_hidden
                        .store(true, std::sync::atomic::Ordering::SeqCst);
                    println!("[X BUTTON] Set user_hidden to true");

                    let hide_res = window.hide();
                    let after_is_visible = window.is_visible().unwrap_or(false);
                    println!("[X BUTTON] Called hide(), result: {:?}, is_visible after: {}", hide_res, after_is_visible);

                    if let Err(e) = hide_res {
                        eprintln!("[X BUTTON] Failed to hide window: {}", e);
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
                                if event.state() == ShortcutState::Pressed {
                                    eprintln!("Shortcut triggered: {}", action_id);
                                    shortcuts::handle_shortcut_action(app, &action_id);
                                }
                            }
                        })
                        .build(),
                )
                .expect("Failed to initialize global shortcut plugin");
            if let Err(e) = shortcuts::setup_global_shortcuts(app.handle()) {
                eprintln!("Failed to setup global shortcuts: {}", e);
            }
            #[cfg(target_os = "windows")]
            shortcuts::setup_windows_hook(app.handle());
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
