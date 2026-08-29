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
    let tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .menu_on_left_click(false)
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
        .on_tray_icon_event(move |tray, event| {
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
                    println!("[TRAY] Showing window via tray toggle");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            Err(e) => {
                eprintln!("Error checking window visibility: {}", e);
            }
        }
    }
}

/// Handle open settings (Dev Space) from tray
fn handle_open_settings<R: Runtime>(app: &AppHandle<R>) {
    // Check if dashboard window exists
    if let Some(dashboard) = app.get_webview_window("dashboard") {
        // If exists, show and focus it
        if let Err(e) = dashboard.show() {
            eprintln!("Failed to show dashboard: {}", e);
        }
        if let Err(e) = dashboard.set_focus() {
            eprintln!("Failed to focus dashboard: {}", e);
        }
        
        // Navigate to dev-space
        if let Err(e) = dashboard.eval("window.location.href = '/dev-space'") {
            eprintln!("Failed to navigate to dev-space: {}", e);
        }
    } else {
        // If doesn't exist, create it
        use crate::window;
        if let Err(e) = window::create_dashboard_window(app) {
            eprintln!("Failed to create dashboard window: {}", e);
            return;
        }
        
        // Show and navigate
        if let Some(dashboard) = app.get_webview_window("dashboard") {
            let _ = dashboard.show();
            let _ = dashboard.set_focus();
            let _ = dashboard.eval("window.location.href = '/dev-space'");
        }
    }
}

/// Handle quit from tray
fn handle_quit<R: Runtime>(app: &AppHandle<R>) {
    app.exit(0);
}
