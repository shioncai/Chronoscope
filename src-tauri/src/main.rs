// Tauri host for Chronoscope — the small Windows shell. It uses the WebView2 that
// Windows already has, instead of carrying its own copy of Chromium: ~5MB against
// Electron's 140MB, of which 95MB was one bundled browser.
//
// Twin of electron/main.cjs. Both exist on purpose — that one is self-contained
// (it works without WebView2) and it is the engine an existing user's data was
// written by, which is why it stays. A change to the window, the pre-paint
// background, or the data directory here has to be made there too.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::{Manager, Theme};

// Painted before the renderer's first frame. The app's own default follows the
// system preference (see resolveInitialTheme), so match it here or the window
// flashes the wrong theme on launch. A stored override can still disagree — the
// shell cannot read the renderer's localStorage — but that flash lasts one paint,
// where a hard-coded colour was wrong for every launch of the other theme.
// Mirrors --bg in src/ui/styles/tokens.css.
const BG_DAY: &str = "#f0efec";
const BG_NIGHT: &str = "#121211";

/// Everything the web view writes — IndexedDB above all — lands in a `data`
/// folder next to the executable, so the portable folder is self-contained and
/// nothing goes near %AppData%. This is the whole portable promise.
fn data_dir() -> PathBuf {
    let exe = std::env::current_exe().expect("cannot locate the executable");
    let dir = exe
        .parent()
        .expect("the executable has no parent directory")
        .join("data");
    fs::create_dir_all(&dir).expect("cannot create the data directory");
    dir
}

fn parse_hex(color: &str) -> (u8, u8, u8, u8) {
    let h = color.trim_start_matches('#');
    let n = u32::from_str_radix(h, 16).expect("background colour is not hex");
    (((n >> 16) & 0xff) as u8, ((n >> 8) & 0xff) as u8, (n & 0xff) as u8, 0xff)
}

fn main() {
    // WebView2 reads this when it starts, so it has to be set before the runtime
    // is built. There is no way to move the profile afterwards — and the origin
    // the app is served from is likewise frozen: IndexedDB is scoped by origin,
    // so changing either in a later version makes every user's events vanish.
    std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", data_dir());

    tauri::Builder::default()
        .setup(|app| {
            let win = app
                .get_webview_window("main")
                .expect("the main window is missing from tauri.conf.json");
            let dark = matches!(win.theme(), Ok(Theme::Dark));
            let (r, g, b, a) = parse_hex(if dark { BG_NIGHT } else { BG_DAY });
            let _ = win.set_background_color(Some(tauri::window::Color(r, g, b, a)));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Chronoscope");
}
