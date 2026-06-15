# GraphWrite

GraphWrite is a self-hosted, no-bs, extremely lightweight note taking app with live-preview markdown editing. No AI, no encryption, no grammar checking, no drawing, no telemetry, no bloat. Just good old note taking.

The whole point of GraphWrite is to stay small. The backend is an Express server with exactly two dependencies. The desktop and mobile apps are built on Tauri, which uses the operating system's own webview instead of shipping a full copy of Chromium, so a Windows installer is around 2 MB rather than the hundreds of megabytes a typical Electron note app weighs. Your notes are stored as plain markdown files on disk, so they are yours to grep, back up, or take elsewhere at any time.

## Why so light?

Most modern note apps bundle an entire browser engine into every install and keep it resident in memory the whole time they run. GraphWrite does not. It reuses the webview already on your system, ships a tiny native binary, and keeps the server down to Express plus a couple hundred lines of code.

| | Installer / download | Typical RAM in use | Storage model |
| --- | --- | --- | --- |
| **GraphWrite** | ~2 MB (Windows `.msi`/`.exe`, Linux `.deb`) | Tens of MB (shares the OS webview) | Plain `.md` files on your own machine |
| Obsidian | ~150 MB+ install | ~180-250 MB, spiking to 700 MB+ or several GB with large vaults and plugins | Local files, Electron app |
| Notion | ~200 MB install | ~400-600 MB, spiking past 800 MB | Cloud-hosted, Electron app |

Numbers for Obsidian and Notion vary heavily with vault size, plugins, and open content; the figures above are representative ranges, not fixed measurements. The takeaway is the order of magnitude: GraphWrite is built to be the small one.

For reference, GraphWrite's own footprint:

- Compiled frontend bundle: ~2.7 MB
- Windows installer: ~2.1 MB (`.exe`) / ~2.5 MB (`.msi`)
- Linux `.deb`: ~2.8 MB
- Native desktop binary: ~5.2 MB
- Backend runtime: Express 5 plus `cors`, and nothing else

(The Linux AppImage is larger, around 95 MB, because an AppImage bundles its own webview runtime so it can run anywhere. The `.deb`, which uses the system `webkit2gtk`, is the lightweight option on Linux.)

## Features

- **Branching notes.** Inspired by a literal tree, any note can contain child notes, so your notes form a tree instead of a flat list. The sidebar shows the full hierarchy with inline renaming, collapsing, and a context menu (right-click on desktop, long-press on mobile).
- **Live-preview markdown editing.** Markdown is rendered inline as you type. The syntax markers stay hidden until your cursor enters them, Obsidian-style. There is no formatting toolbar; you just write plain markdown. Headings, bold/italic/strikethrough, inline and fenced code (syntax-highlighted, with a copy button), ordered and unordered lists, blockquotes, links, and horizontal rules are all supported. Built on CodeMirror.
- **Graph view.** See your notes as a graph and rearrange them freely. Click and drag to pan, shift + drag to select multiple nodes, double click a node to open the note, and right click a node for file actions. Node positions are remembered, and a reset button restores the automatic layout.
- **Wiki links.** Type `[[name]]` followed by a space to create a link inside your note. Clicking it opens the child note with that name, creating it first if it does not exist yet. This makes branching a new note off the one you are writing as simple as naming it. Links are stored as plain `[[name]]` text in the markdown file.
- **Themes and appearance.** Built-in Dark, AMOLED Black and Light themes, a fully custom color palette, several fonts, and interface zoom, all in Settings. Optionally center the editor in a column for a more focused layout.
- **Cross-platform.** Use GraphWrite in the browser, on the desktop, or on mobile. The desktop and mobile apps add niceties like an auto-hiding title bar, a bottom-sheet menu, and haptic feedback.
- **Autosave.** Changes are saved automatically as you type. Ctrl/Cmd + S still works if you want the peace of mind.

## Platforms

| Platform | Status |
| --- | --- |
| Browser | Supported |
| Linux (desktop) | Supported |
| Windows (desktop) | Supported |
| Android | Supported |
| macOS (desktop) | Planned before launch |
| iOS | In progress |

All clients talk to the same self-hosted backend, so your notes are the same everywhere.

## Quick Start

### Installation (Docker)

GraphWrite is published as prebuilt images for both the backend and the frontend, so you do not need to clone or build anything. Create a `docker-compose.yml` like the following:

```yaml
services:
  backend:
    image: seojoonleedev/graphwrite-backend:latest
    container_name: graphwrite-backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    volumes:
      - ./notes:/app/notes
    restart: always

  frontend:
    image: seojoonleedev/graphwrite-frontend:latest
    container_name: graphwrite-frontend
    ports:
      - "8080:80"
    restart: always
```

Then bring it up:

```
docker compose up -d
```

You will now be able to access the frontend at [http://localhost:8080](http://localhost:8080). The backend uses port 3001 by default. To change which ports are used, edit the port mappings in `docker-compose.yml`.

Notes are stored in `./notes` by default. To keep them somewhere else, change the volume path in `docker-compose.yml`.

### Updating (Docker)

Pull the latest images and recreate the containers.

```
docker compose pull
docker compose up -d
```

### Desktop and mobile apps

The desktop and mobile apps live in the `frontend/` directory and are built with [Tauri](https://tauri.app). They talk to the same self-hosted backend, so set its address in Settings (see below). From `frontend/`:

- Desktop (Linux / Windows / macOS): `npm run tauri build`
- Android: `npm run tauri android build` (requires the Android SDK and NDK)

### Accessing from other devices

The frontend looks for the backend at `http://localhost:3001` by default. To use GraphWrite from another device on your network, open Settings and set the server address to the IP of the machine running the backend (for example `http://192.168.0.1:3001`).

> [!WARNING]
> GraphWrite has no authentication. Anyone who can reach the backend port can read, edit, and delete your notes. Keep it on a trusted network, and do not expose it to the internet without putting it behind a reverse proxy with authentication. Authentication is planned.

## Building from source

If you would rather build from the latest source instead of using the prebuilt images, you can clone the repo and build the bundled `docker-compose.yml`, which builds both the backend and the frontend locally.

### Install latest (git)

```
git clone https://github.com/seojoonlee-dev/graphwrite
cd graphwrite
docker compose up --build
```

The frontend will be available at [http://localhost:8080](http://localhost:8080) and the backend on port 3001, the same as the prebuilt setup. Notes are stored in `./backend/notes` by default; change the volume path in `docker-compose.yml` to keep them elsewhere.

### Update to latest (git)

Pull the repo inside your `graphwrite` directory and rebuild.

```
cd graphwrite
git pull
docker compose up --build
```

## Note

> [!NOTE]
> This is a very early version of GraphWrite (0.1.0). Authentication, macOS support, and much more are on the way.

## AI Disclosure

> [!NOTE]
> AI tools (Claude Code) were used during development to help prototype parts of the app, including the custom CodeMirror live-preview extensions and the graph view, and to draft this README. All generated code was reviewed, and edited or rewritten where needed, by the author. GraphWrite itself ships no AI features and sends your notes to no AI service.

GraphWrite is licensed under the MIT license.
