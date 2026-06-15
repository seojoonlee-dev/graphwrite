#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "linux")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          // Tiling WMs like Hyprland don't use title bars, but GTK still draws
          // its own client-side decorations. Strip them only under Hyprland
          // (detected via the env var it sets for clients), leaving other Linux
          // DEs / macOS / Windows with their native title bars.
          if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some() {
            let _ = window.set_decorations(false);
          }

          // WebKitGTK ships with smooth (animated) wheel scrolling disabled, so
          // scrolling feels stepped/jagged. Turn it on for the desktop app.
          let _ = window.with_webview(|webview| {
            use webkit2gtk::{SettingsExt, WebViewExt};
            if let Some(settings) = WebViewExt::settings(&webview.inner()) {
              settings.set_enable_smooth_scrolling(true);
            }
          });
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
