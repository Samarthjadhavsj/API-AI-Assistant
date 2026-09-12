use std::sync::atomic::Ordering;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::shortcuts::OverlayState;

/// Setup system tray with menu
pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Create menu items
    let toggle_window_item =
        MenuItem::with_id(app, "toggle_window", "Toggle Window", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "Settings", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(app, &[&toggle_window_item, &settings_item, &quit_item])?;

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
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // On left click, toggle the main window
                handle_toggle_window(&app_handle);
            }
        })
        .build(app)?;

    Ok(())
}

/// Handle toggle window from tray
fn handle_toggle_window<R: Runtime>(app: &AppHandle<R>) {
    println!("[TRAY] handle_toggle_window() called from tray");
    if let Some(window) = app.get_webview_window("main") {
        let state = app.state::<OverlayState>();
        let user_hidden = state.user_hidden.load(Ordering::SeqCst);
        let is_visible = window.is_visible().unwrap_or(false);
        println!(
            "[TRAY] BEFORE: user_hidden={}, is_visible={}",
            user_hidden, is_visible
        );

        if user_hidden {
            state.user_hidden.store(false, Ordering::SeqCst);
            println!("[TRAY] Setting user_hidden to false, showing window");
            let show_res = window.show();
            let is_visible_after = window.is_visible().unwrap_or(false);
            println!(
                "[TRAY] Called show(), result: {:?}, is_visible after: {}",
                show_res, is_visible_after
            );

            // Bring window to front by re-asserting always-on-top
            let aot_res = window.set_always_on_top(true);
            println!(
                "[TRAY] Called set_always_on_top(true), result: {:?}",
                aot_res
            );
        } else {
            state.user_hidden.store(true, Ordering::SeqCst);
            println!("[TRAY] Setting user_hidden to true, hiding window");
            let hide_res = window.hide();
            let is_visible_after = window.is_visible().unwrap_or(false);
            println!(
                "[TRAY] Called hide(), result: {:?}, is_visible after: {}",
                hide_res, is_visible_after
            );
        }

        let final_user_hidden = state.user_hidden.load(Ordering::SeqCst);
        let final_is_visible = window.is_visible().unwrap_or(false);
        println!(
            "[TRAY] AFTER: user_hidden={}, is_visible={}",
            final_user_hidden, final_is_visible
        );
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
