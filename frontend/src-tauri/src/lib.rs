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

      // Tiling WMs like Hyprland don't use title bars, but GTK still draws its
      // own client-side decorations. Strip them only under Hyprland (detected
      // via the env var it sets for clients), leaving other Linux DEs / macOS /
      // Windows with their native title bars.
      #[cfg(target_os = "linux")]
      if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some() {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.set_decorations(false);
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
