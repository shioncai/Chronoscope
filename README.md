# Chronoscope

> A cross-scale event timeline, from deep time to this afternoon.

Chronoscope puts events of wildly different scales on a single axis. The formation of the Earth, the fall of Rome, and something that happened last Tuesday all live on the same timeline, so you can compare when they happened and how long they lasted. It runs entirely on your own device, and the data stays yours.

## What you can do with it

**Work across enormous time scales.** One axis spans billions of years ago down to the second. BCE dates and geological units (ka, Ma, Ga) are first-class, not a workaround.

**Record time you are not sure about.** You can write "about 3.8 billion years ago" or "the 1990s", attach a margin of error, and create events that have only a start or only an end.

**Switch between two views that share one set of filters.** The timeline gives you a detail axis plus an overview bar that holds the whole span on one screen, with a viewport window you drag to move between the big picture and the fine grain. You can zoom the axis and magnify the display. The list view shows the same events in columns, with checkboxes for moving, tagging, or deleting many events at once. Search, filters, and sorting carry across both views.

**Organize with folders and tags.** Folders nest, can be dragged to a new parent, and can be given a color that follows their events onto the timeline. Selecting folders in the sidebar narrows what both views show. Tags support AND and OR filtering, events can link to each other, notes are written in Markdown, and full-text search covers everything.

**Delete without fear.** Deleting is a soft delete you can undo from the recycle bin. Deleting a folder takes its children with it, and restoring an event brings back the folder hierarchy it belonged to.

**Export and import.** One click writes all of your data to a single JSON file for backup or for moving to another machine. Import merges into what is already there rather than replacing it, and anything that conflicts is shown to you instead of being silently overwritten.

**Pick your language and theme.** The interface is available in English and Chinese, with light and dark themes.

**Stay local and offline.** There is no server and no account. Your data never leaves the device.

## Getting started

### Desktop (Windows portable, recommended)

1. Unzip the `Chronoscope` folder somewhere writable, such as your desktop, your documents folder, or a USB drive. Avoid read-only locations like `C:\Program Files\`.
2. Run `Chronoscope.exe` inside that folder.

Nothing is installed, nothing runs in the background, and nothing goes online. All of your data lives in the `data\` subfolder next to `Chronoscope.exe`, so the data travels with the folder wherever you copy it, and copying the folder is a complete backup.

### Android

Download the APK from the releases page and open it. Android will ask you to allow installing from an unknown source, since this does not come from the Play Store.

The app is fully offline and asks for no permissions beyond the one its own web view needs. Android keeps app data in a private sandbox, so — unlike the desktop version — **uninstalling the app erases your events**. Export a JSON backup before you uninstall.

### Web

Chronoscope is also a PWA. Open it in a browser and you can install it to your desktop and use it offline like a standalone app. In this case the data is stored in the browser. See below for running it locally.

## Your data belongs to you

Everything is stored on your device. No server sees it, and there is no sign-up.

To back up or migrate, use Export in the app to get a JSON file, then use Import on the other machine. Import merges with the existing data and prompts you on conflicts. On the desktop version you can also just copy the `data\` folder.

## Updating the desktop version

Replace the old `Chronoscope` folder with the new one, then copy the `data\` folder from the old version into the new one. Your data carries over untouched. If you want to be careful, export a JSON backup from inside the app first.

## Running from source

```bash
npm install
npm run dev             # start the dev server in a browser
npm run electron:build  # build the Windows portable app into release/
npm run android:build   # build the signed Android APK into release/
```

Building the Windows package needs `7z` on your system for the zip step. Wine is not required. Building the APK needs a JDK and the Android command-line SDK, and signing needs a keystore of your own.
