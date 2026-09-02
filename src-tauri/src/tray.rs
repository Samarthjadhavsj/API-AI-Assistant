use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

/// Setup system tray with menu
pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Create menu items
    let toggle_window_item = MenuItem::with_id(app, "toggle_window", "Toggle Window", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "Settings", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(
        app,
        &[
            &toggle_window_item,
            &settings_item,
            &quit_item,
        ],
    )?;

    // Get the tray icon based on platform
    #[cfg(target_os = "windows")]
    let icon = app.default_window_icon().cloned().unwrap();
    
    #[cfg(target_os = "macos")]
    let icon = app.default_window_icon().cloned().unwrap();
    
    #[cfg(target_os = "linux")]
    let icon = app.default_window_icon().cloned().unwrap();

    // Build tray icon
    let app_handle = app.clone();
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle_window" => {
                handle_toggle_window(app);
            }
            "open_settings" => {
                handle_open_settings(app);
            }
            "quit" => {
                handle_quit(app);
            }
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    // On left click, toggle the main window
                    handle_toggle_window(&app_handle);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

/// Handle toggle window from tray
fn handle_toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(visible) => {
                if visible {
                    println!("[TRAY] Hiding window via tray toggle");
                    let _ = window.hide();
                } else {
                    println!("[TRAY] Showing window via tray toggle - bringing to front");
                    let _ = window.show();
                    // Bring window to front by re-asserting always-on-top
                    let _ = window.set_always_on_top(true);
                    // Do NOT call set_focus() - let user keep focus on their current app
                }
            }
            Err(e) => {
                eprintln!("Error checking window visibility: {}", e);
            }
        }
    }
}

/// Open the settings workspace in the existing compact assistant window.
/// The frontend route owns resizing the main window and restores the search
/// bar when the user presses Back.
fn handle_open_settings<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main) = app.get_webview_window("main") {
        if let Err(e) = main.show() {
            eprintln!("Failed to show compact settings: {}", e);
            return;
        }
        if let Err(e) = main.set_focus() {
            eprintln!("Failed to focus compact settings: {}", e);
            return;
        }
        if let Err(e) = main.eval("window.location.href = '/toggle/settings'") {
            eprintln!("Failed to navigate to compact settings: {}", e);
        }
    } else {
        eprintln!("Main window not found while opening compact settings");
    }
}

/// Handle quit from tray
fn handle_quit<R: Runtime>(app: &AppHandle<R>) {
    app.exit(0);
}
