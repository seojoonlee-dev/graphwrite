<div align="center">
  <img width="128" height="128" alt="icon_corner_radius" src="https://github.com/user-attachments/assets/8574f1df-e830-4d76-a290-790f26eb4f4f" />
  <h1>GraphWrite</h1>
</div>

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
![Markdown](https://img.shields.io/badge/markdown-%23000000.svg?style=for-the-badge&logo=markdown&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white)

<img width="1330" height="718" alt="image" src="https://github.com/user-attachments/assets/056be0e3-8694-4d21-9c02-db2311ef29a1" />



GraphWrite is a self-hosted, no-bs, customizable, lightweight note taking app with live-preview markdown editing. No AI, no encryption, no grammar checking, no drawing, no telemetry, no bloat. Just good old note taking.

The whole point of GraphWrite is to stay small. The backend is an Express server with exactly two dependencies. The desktop and mobile apps are built on Tauri, which uses the operating system's own webview instead of shipping a full copy of Chromium, so a Windows installer is around 2 MB rather than the hundreds of megabytes a typical Electron note app weighs. Your notes are stored as plain markdown files on disk, so they are yours to grep, back up, or take elsewhere at any time.

## Why so light?

I believe being lightweight is a prerequisite for note taking apps. GraphWrite was built to have as small as a footprint as possible while having all the features I wanted to pack into it.

| | Installer / download | Startup time | Storage model |
| --- | --- | --- | --- |
| **GraphWrite** | ~2 MB (Windows `.msi`/`.exe`, Linux `.deb`) | ~216-272ms | Saves wherever you want on the backend, Tauri app |
| Obsidian | ~150 MB+ install | ~915-1010ms, **~4.2x slower** | Local files, Electron app |
| Notion | ~200 MB install | ~960-1035ms, **~4.4x slower** | Cloud-hosted, Electron app |

(All numbers are measured on my arch linux desktop running hyprland with a similar amount of notes loaded with minimum amout of plugins and extentions installed on both. These are "window on screen" times and not "fully painted/interactive" times. For all three, content finishes rendering shortly after.)

For reference, GraphWrite's own footprint:

- Compiled frontend bundle: ~2.7 MB
- Windows installer: ~2.1 MB (`.exe`) / ~2.5 MB (`.msi`)
- Linux `.deb`: ~2.8 MB
- Native desktop binary: ~5.2 MB
- Backend runtime: Express 5 plus `cors`, and nothing else

(The Linux AppImage is larger, around 95 MB, because an AppImage bundles its own webview runtime so it can run anywhere. This is one of the main limitations of the current version and I am actively working on migrating away from WebKit to using native elements. This applies to the android version. The `.deb`, which uses the system `webkit2gtk`, is the lightweight option on Linux.)

## Graph View

<img width="1330" height="718" alt="image" src="https://github.com/user-attachments/assets/502ac829-97bf-4a5e-b02e-b1a9e3e5e920" />


Because notes in GraphWrite branch into child notes, your whole collection naturally forms a tree, and the graph view shows you that tree at a glance. Each note is a node, and every branch from a parent note to its children is drawn as an edge, so you can see how your notes connect rather than scrolling a flat list.

The layout is generated automatically (left to right, using dagre), and from there it is yours to rearrange:

- Click and drag to pan around the canvas.
- Shift + drag to box-select multiple nodes.
- Double click a node to open that note.
- Right click a node for file actions.

The graph is rendered with React Flow.

## Features

- **Branching notes.** Inspired by a literal tree, any note can contain child notes, so your notes form a tree instead of a flat list. The sidebar shows the full hierarchy with inline renaming, collapsing, and a context menu (right-click on desktop, long-press on mobile).
- **Live-preview markdown editing.** Markdown is rendered inline as you type. The syntax markers stay hidden until your cursor enters them, Obsidian-style. There is no formatting toolbar; you just write plain markdown. Headings, bold/italic/strikethrough, inline and fenced code (syntax-highlighted, with a copy button), ordered and unordered lists, blockquotes, links, and horizontal rules are all supported. Built on CodeMirror.
- **Wiki links.** Type `[[name]]` to create a link inside your note. Clicking it opens the child note with that name, creating it first if it does not exist yet. This makes branching a new note off the one you are writing as simple as naming it. Links are stored as plain `[[name]]` text in the markdown file.
- **Themes and appearance.** Built-in Dark, AMOLED Black and Light themes, a fully custom color palette, several fonts, and interface zoom, all in Settings. Optionally center the editor in a column for a more focused layout.
- **Cross-platform.** Use GraphWrite in the browser, on the desktop, or on mobile. The mobile apps add niceties like an auto-hiding title bar, a bottom-sheet menu, and haptic feedback.
- **Autosave.** Changes are saved automatically as you type. Ctrl/Cmd + S still works if you want the peace of mind.

## Platforms

| Platform | Status |
| --- | --- |
| Browser | ✅ Supported |
| Linux (desktop) | ✅ Supported |
| Windows (desktop) | ✅ Supported |
| Android | ✅ Supported |
| macOS (desktop) | ✅ Supported |
| iOS | 🚧 In progress |

> [!NOTE]
> Android app is not on Google Play Store just yet. You can download and install the apk in the Release tab.

> [!NOTE]
> I am planning on releasing it on the aur and even flatpak for linux.

All clients talk to the same self-hosted backend, so your notes are the same everywhere. You can also host the backend on multiple computers and change between them. It is extremely easy to change the backend server in the frontend.

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


### Hosting only the backend

Run just the backend if you want a central note store that your GraphWrite clients (the desktop, mobile, or a frontend hosted elsewhere) connect to. Your notes live wherever you mount the volume.

```
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
```

```
docker compose up -d
```

Or without a compose file:

```
docker run -d --name graphwrite-backend \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -v "$(pwd)/notes:/app/notes" \
  --restart always \
  seojoonleedev/graphwrite-backend:latest
```

The backend is now reachable at http://your-machine-ip:3001. In each GraphWrite client, open Settings and set the server address to that URL.

### Hosting only the frontend

Run just the frontend if your backend already runs somewhere else and you only need to serve the web app. The frontend is a static site; it does not bundle a backend, so you point it at one from Settings.

```
services:
  frontend:
    image: seojoonleedev/graphwrite-frontend:latest
    container_name: graphwrite-frontend
    ports:
      - "8080:80"
    restart: always
```

Or without a compose file:

```
docker run -d --name graphwrite-frontend \
  -p 8080:80 \
  --restart always \
  seojoonleedev/graphwrite-frontend:latest
```

Open http://localhost:8080, then in Settings set the server address to your backend (for example http://192.168.0.1:3001). The frontend will not store or load any notes until it can reach a backend.

> [!NOTE]
> It is recommended to use port 3001 as the frontend defaults to it.

You will now be able to access the frontend at [http://localhost:8080](http://localhost:8080). The backend uses port 3001 by default. To change which ports are used, edit the port mappings in `docker-compose.yml`.

Notes are stored in `./notes` by default. To keep them somewhere else, change the volume path in `docker-compose.yml`.

### Updating (Docker)

Pull the latest images and recreate the containers.

```
docker compose pull
docker compose up -d
```

### Desktop and mobile apps

Installers for Windows and Mac are available in the Release tab along side the android apk.

### Accessing from other devices

The frontend looks for the backend at `http://localhost:3001` by default. To use GraphWrite from another device on your network, open Settings and set the server address to the IP of the machine running the backend (for example `http://192.168.0.1:3001`).

> [!WARNING]
> GraphWrite has no authentication. Anyone who can reach the backend port can read, edit, and delete your notes. Keep it on a trusted network, and do not expose it to the internet without putting it behind a reverse proxy with authentication. I personally recommend you use Tailscale to access your notes anywhere for now. Authentication is planned.

## Building from source

If you would rather build from the latest source instead of using the prebuilt images, you can clone the repo and build the bundled `docker-compose.yml`, which builds both the backend and the frontend locally.

### Install latest (git)

```
git clone https://github.com/seojoonlee-dev/graphwrite
cd graphwrite
docker compose up --build -d
```

The frontend will be available at [http://localhost:8080](http://localhost:8080) and the backend on port 3001, the same as the prebuilt setup. Notes are stored in `./backend/notes` by default; change the volume path in `docker-compose.yml` to keep them elsewhere.

### Update to latest (git)

Pull the repo inside your `graphwrite` directory and rebuild.

```
cd graphwrite
git pull
docker compose up --build -d
```

### Desktop and mobile apps

The desktop and mobile apps live in the `frontend/` directory and are built with [Tauri](https://tauri.app). To build manually, run these commands:

- Desktop (Linux / Windows / macOS): `npm run tauri build`
- Android: `npm run tauri android build` (requires the Android SDK and NDK)

> [!NOTE]
> This is a very early version of GraphWrite (currently v0.1.0). Authentication, native UI(instead of using WebKit with Tauri), a custom graph library instead of react flow and much MUCH more are on the way. Stay tuned!

## AI Disclosure

> [!NOTE]
> AI tools (Claude Code) were used during development to help prototype parts of the app, including the custom CodeMirror live-preview extensions and the graph view. All generated code was reviewed, and edited or rewritten where needed, by yours truly. GraphWrite itself ships no AI features and sends your notes to no AI service.

GraphWrite is licensed under the MIT license.
