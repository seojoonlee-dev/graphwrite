// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "linux")]
  {
    // WebKitGTK's DMABUF renderer crashes on some Wayland setups (e.g. Hyprland)
    // under heavy compositing like the graph view. Disable it before GTK starts.
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    // Native <select> popups are drawn by GTK using the system theme, not page
    // CSS — force a dark theme so the dropdown isn't white-on-white in our dark
    // UI. Respect an explicit user override if one is already set.
    if std::env::var_os("GTK_THEME").is_none() {
      std::env::set_var("GTK_THEME", "Adwaita:dark");
    }
  }

  graphwrite_lib::run();
}
