# Chronoscope

> A cross-scale event timeline, from deep time to this afternoon.

Chronoscope puts events of wildly different scales on a single axis. The formation of the Earth, the fall of Rome, and something that happened last Tuesday all live on the same timeline, so you can compare when they happened and how long they lasted. It runs entirely on your own device, and the data stays yours.

## What you can do with it

**Work across enormous time scales.** One axis spans billions of years ago down to the minute. BCE dates and geological units (ka, Ma, Ga) are first-class, not a workaround. Switch the timeline to its **log axis** and the Big Bang and this afternoon fit on one screen, each era getting room in proportion to how far back it is.

**Record time you are not sure about.** You can write "about 3.8 billion years ago" or "the 1990s", attach a margin of error, and create events that have only a start or only an end.

**Two views, one set of filters.** The timeline gives you a detail axis plus an overview bar that holds the whole span on one screen. Zoom, pan, jump to **Now** or **Fit** everything; hover an event for its date, click it for a detail card; turn on **lanes** to give every top-level folder its own band. The list view shows the same events in sortable columns, with checkboxes for moving, tagging, or deleting many at once. Search, filters, and sorting carry across both views, and a filter bar always says what is being hidden.

**Organize with folders and tags.** Folders nest, can be dragged to a new parent, and carry a color that follows their events onto the timeline. Tags filter with AND or OR and rename with a double-click. Events can link to each other, notes are written in Markdown, and search covers titles, notes, folder and tag names.

**Undo anything.** Every change — an edit, a batch move, an import, emptying the recycle bin — can be undone and redone (Ctrl+Z / Ctrl+Shift+Z), up to 100 steps back. Deleting also goes through the recycle bin first; deleting a folder takes its children with it, and restoring an event brings back the folders it belonged to.

**Import and export.** A JSON backup holds everything. A CSV sheet opens in any spreadsheet, and a sheet you write by hand imports straight back (see [CSV format](#csv-format)). The timeline exports as a PNG image. Imports merge into what is already there, and conflicts are shown to you instead of being silently overwritten.

**Start in seconds.** An empty Chronoscope offers a sample timeline — from the Big Bang to an afternoon tea — that one Undo takes away again.

**Keyboard first, touch friendly.** Every common action has a shortcut (press `?` in the app). On a phone the list becomes cards, the sidebar becomes a drawer, and the timeline pinches and pans.

**Pick your language and theme.** English and Chinese; day, night, or follow the system.

**Stay local and offline.** There is no server and no account. Your data never leaves the device.

## Getting started

### Desktop (Windows portable, recommended)

1. Download `Chronoscope-<version>-win.zip` and unzip the `Chronoscope` folder somewhere writable — your desktop, your documents folder, a USB drive. Avoid read-only locations like `C:\Program Files\`.
2. Run `Chronoscope.exe` inside that folder.

Nothing is installed, nothing runs in the background, and nothing goes online. All of your data lives in the `data\` subfolder next to `Chronoscope.exe`, so the data travels with the folder wherever you copy it, and copying the folder is a complete backup.

This download is about 1 MB, because it uses the web view Windows already has. If it will not start, your machine is missing WebView2 — take `Chronoscope-<version>-win-electron.zip` instead, which is far larger but carries everything it needs.

### Android

Download the APK from the releases page and open it. Android will ask you to allow installing from an unknown source, since this does not come from the Play Store.

The app is fully offline and asks for no permissions beyond the one its own web view needs. Android keeps app data in a private sandbox, so — unlike the desktop version — **uninstalling the app erases your events**. Export a JSON backup before you uninstall.

### Web

Chronoscope is also a PWA. Open it in a browser and you can install it to your desktop and use it offline like a standalone app. In this case the data is stored in the browser. See below for running it locally.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `N` | New event |
| `/` or `Ctrl K` | Search |
| `1` / `2` | List view / timeline view |
| `[` | Show or hide the sidebar |
| `Ctrl Z` / `Ctrl Shift Z` (or `Ctrl Y`) | Undo / redo |
| `?` | Show every shortcut |
| `←` `→` (with `Shift` for faster) | Pan the timeline |
| `+` / `−` | Zoom the timeline |
| `0` / `T` | Fit everything / go to now |
| `L` / `G` | Linear ↔ log axis / lanes by folder |
| `Enter` / `Del` | Edit / delete the selected event |
| `Ctrl A` / `Del` / `Esc` | In the list: select all / delete checked / clear |
| `Ctrl Enter` | Save in the editor |

On macOS, `Ctrl` is `⌘`.

## CSV format

The first row names the columns; only a title column is required, and the order does not matter. Headers are matched in English or Chinese:

| Column | Accepted headers |
| --- | --- |
| title | `title`, `name`, `event`, `标题`, `名称`, `事件` |
| start | `start`, `date`, `from`, `when`, `起点`, `开始`, `时间`, `日期` |
| end | `end`, `to`, `until`, `终点`, `结束` |
| folder | `folder`, `category`, `group`, `文件夹`, `分类` — nest with `/`, e.g. `History / Ancient` |
| tags | `tags`, `tag`, `labels`, `标签` — separate with `;` |
| note | `note`, `description`, `备注`, `描述` — Markdown |

A time cell can be written the way you would say it:

| Write | Means |
| --- | --- |
| `2026-03-15 14:30`, `2026-03-15`, `1969-07`, `1969` | a calendar date, to the minute, day, month or year |
| `500 BCE`, `500 BC`, `公元前500年`, `-0499` | before the common era (`-0499` is ISO astronomical numbering) |
| `1990s`, `1990 [decade]`, `1900 [century]` | a coarse calendar precision |
| `12 ka`, `66 Ma`, `4.6 Ga`, `46亿年前` | before present, as geology writes it |
| `… ± 3 d`, `… -1/+2 y`, `… ± 5 Ma` | an uncertainty range (units `d`, `y`, `ka`, `Ma`, `Ga`) |

Exported sheets use exactly this format and start with a UTF-8 BOM so Excel reads Chinese correctly. Rows whose time cannot be read are skipped and counted in the import summary.

## Your data belongs to you

Everything is stored on your device. No server sees it, and there is no sign-up.

To back up or migrate, use Export in the app to get a JSON file, then use Import on the other machine. Import merges with the existing data and prompts you on conflicts. On the desktop version you can also just copy the `data\` folder.

## Updating the desktop version

Replace the old `Chronoscope` folder with the new one, then copy the `data\` folder from the old version into the new one. Your data carries over untouched. If you want to be careful, export a JSON backup from inside the app first.

**Moving between the two Windows downloads is a different matter.** `-win` and `-win-electron` run on different web engines, which store their data in different formats, so copying `data\` across will not bring your events with it. To switch: **Export** a JSON file from the build you are leaving, then **Import** it into the one you are moving to.

## Running from source

```bash
npm install
npm run dev             # start the dev server in a browser
npm test                # run the test suite (Vitest)
npm run build           # type-check (tests included) and build the PWA into dist/
npm run tauri:build     # build the small Windows app into release/
npm run electron:build  # build the self-contained Windows app into release/
npm run android:build   # build the signed Android APK into release/
```

Packaging needs `7z` for the zip step. The Tauri build needs a Rust toolchain; the Android build needs a JDK and the Android command-line SDK, and signing it needs a keystore of your own. Wine is not required for any of them. Build the three packages one at a time: they share `dist/`.

### Project layout

```
src/
  domain/     pure model — the cross-scale time representation, formatting,
              parsing, axis ticks (linear and log), the CSV time grammar
  data/       persistence behind a repository interface (Dexie / IndexedDB;
              an in-memory twin for tests), tombstone deletes, HLC clocks
  state/      the app store: every change is a reversible Change (undo/redo),
              selectors, import/export (JSON, CSV), preferences, theme
  i18n/       hand-rolled zh/en catalog
  platform/   file saving per shell (browser, Tauri, Capacitor)
  ui/
    app/        shell, top bar, filter bar, empty states, shortcuts, data transfer
    sidebar/    overview, folder tree, tags, footer
    list/       the table / card list and its batch bar
    timeline/   scene (pure, tested) → renderer (canvas) → TimelineView
    editor/     event editor, time inputs, link picker
    dialogs/    about, shortcuts, import result, conflicts
    components/ shared controls: icons, popover, toast, confirm, color picker
    styles/     tokens.css (the contract) and one stylesheet per region
electron/  src-tauri/  android/   the three native shells
```

Each layer depends only on the one below it, so the time model is tested on its own and the storage can be swapped.
