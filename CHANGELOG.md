# Changelog

## 0.3.0

A ground-up pass over features, interface and code.

### New

- **Log axis.** One click (or `L`) puts the Big Bang and this afternoon on one screen; ticks read in ages ("10 Ga", "1,000 yr ago", "1 mo ago").
- **Lanes.** Group the timeline by top-level folder (`G`), each lane headed with its name and colour.
- **Undo / redo for every change** — edits, batch actions, imports, folder deletes, emptying the bin — with buttons in the top bar, `Ctrl Z` / `Ctrl Shift Z`, and an Undo button on the toast after anything destructive.
- **CSV import and export.** Sheets open in Excel (UTF-8 BOM) and hand-written sheets import back, with headers and time cells accepted in English or Chinese (`1969-07-20`, `500 BCE`, `1990s`, `66 Ma`, `46亿年前`, `± 3 d` …).
- **PNG export** of the whole timeline, at twice screen resolution.
- **Timeline navigation:** zoom buttons, Fit, Go to now, a dashed *now* line, a span readout, hover tooltips, links drawn between the selected event and the ones it references, and full keyboard control.
- **Sample timeline** on first run, and clear empty states for "no events", "nothing matches" and an empty recycle bin.
- **Filter bar** that names every active filter, with one-click removal and Clear all.
- **Keyboard shortcuts** throughout, listed on a sheet (`?`).
- **Duplicate event**, **locate in timeline** from the list, **rename tags** by double-click, **empty recycle bin**, **follow system theme**.
- The editor gained Now / Clear for times, a live duration, Write / Preview for notes, a searchable link picker, defaults taken from the current folder and tag filter, `Ctrl Enter` to save and a warning before discarding changes.
- View, sort, axis, lanes, display size and sidebar width are remembered between sessions.

### Changed

- New interface: a full icon set, clearer buttons and menus, in-app confirm dialogs and toasts instead of browser pop-ups, a card list and full-screen editor on phones, a sidebar footer with Import / Export, a three-way theme switch and a language menu.
- System fonts replace the three bundled web fonts: nothing to download, native rendering, and Chinese text uses the system's own CJK face.
- Lighter on resources: the timeline no longer reallocates its canvas every frame or re-renders the whole app while panning; long lists render only the rows on screen; the Markdown parser loads on first use.
- Deleting several events or an empty folder no longer asks first — Undo is one click away. Purging still asks.

### Fixed

- Tick labels vanished over mid-sized deep-time windows and overlapped when the display was magnified; BCE ticks no longer land on odd years like "1001 BCE".
- Clicking an event's label on the timeline now selects it, at any display size.
- A deleted tag lingered on events (and in the "untagged" count).
- Creating a tag that already existed made a duplicate.
- An event created while a folder or tag filter was active vanished from view the moment it was saved.
- New folders all shared one position, so their order was arbitrary.
- Batch menus did not close on an outside click or Escape and could run off the screen.
- Browser downloads could fail (detached link, URL revoked too early).
- Year 0, negative and fractional years were accepted in the editor.
- Checked rows survived deleting the folder that held them.
- Chinese large-number ages read inconsistently ("约38.0亿年" vs "约38亿年").

Earlier releases: see the [GitHub releases page](https://github.com/ShionChoy/Chronoscope/releases).
