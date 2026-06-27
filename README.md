<div align="center" id="user-content-toc">
  <img width="128" height="128" alt="icon_corner_radius" src="https://github.com/user-attachments/assets/8574f1df-e830-4d76-a290-790f26eb4f4f" />
</div>

<div align="center" id="user-content-toc">
  <ul align="center" style="list-style: none;">
    <summary align="center">
      <h1>GraphWrite</h1>
    </summary>
  </ul>
</div>

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
![Markdown](https://img.shields.io/badge/markdown-%23000000.svg?style=for-the-badge&logo=markdown&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white)

<hr></hr>
<img width="1190" height="833" alt="image" src="https://github.com/user-attachments/assets/58516047-1fa8-43de-823f-aa28ccf259c2" />



## Table of Contents

- [Why GraphWrite](#why-graphwrite)
- [Graph View](#graph-view)
- [Features](#features)
- [Platforms](#platforms)
- [Quick Start](#quick-start)
  - [Installation (Docker)](#installation-docker)
  - [Hosting only the backend](#hosting-only-the-backend)
  - [Hosting only the frontend](#hosting-only-the-frontend)
  - [Updating (Docker)](#updating-docker)
  - [Desktop and mobile apps](#desktop-and-mobile-apps)
  - [Accessing from other devices](#accessing-from-other-devices)
- [Building from source](#building-from-source)
  - [Install latest (git)](#install-latest-git)
  - [Update to latest (git)](#update-to-latest-git)
  - [Desktop and mobile apps](#desktop-and-mobile-apps-1)
- [Contributing](#contributing)
- [AI Disclosure](#ai-disclosure)



GraphWrite is a self-hosted, no-bs, customizable, lightweight note taking app with live-preview markdown editing. No AI, no encryption, no grammar checking, no telemetry, no bloat. Just good old note taking.

> [!TIP]
> Try GraphWrite right now in your browser — no account, nothing to install: **[graphwrite.app/demo](https://graphwrite.app/demo)**

Notes in GraphWrite branch into child notes, so your whole collection forms a tree, and the graph view shows you that tree so you can see how everything connects rather than scrolling a flat list. Your notes are stored as plain markdown files on disk, so they are yours to grep, back up, or take elsewhere at any time.

## Why GraphWrite

GraphWrite is built around one idea: your notes are connected, so you should be able to see how. Any note can branch into child notes, so a collection grows into a tree instead of a flat, scrolling list — and the graph view draws that tree so you can navigate it visually instead of hunting through folders.

Everything else stays out of the way. Your notes are plain markdown files you own, there is no account and nothing leaves your machine, and the app is small by design: it reuses the webview already on your system instead of bundling a browser engine, ships a tiny native binary, and keeps the backend down to Express plus a couple hundred lines of code.

## Graph View

<img width="1190" height="833" alt="image" src="https://github.com/user-attachments/assets/9cc89167-46c8-4506-8b35-1b43b7b7165f" />


Because notes in GraphWrite branch into child notes, your whole collection naturally forms a tree, and the graph view shows you that tree at a glance. Each note is a node, and every branch from a parent note to its children is drawn as an edge, so you can see how your notes connect rather than scrolling a flat list.

The layout is generated automatically as a tidy left-to-right tree (each note centered on its children, no overlapping branches), and the graph is interactive:

- Click and drag to pan around the canvas.
- Shift + drag to box-select multiple nodes.
- Double click a node to open that note.
- Right click a node for file actions.
- Drag a branch (edge) onto another note to re-parent it, or right-click an edge to detach a note back to the top level.
- Drag outward from a node onto empty canvas to create a child note there.
- Search to highlight the path to any note — matches light up in the accent color, with a soft glow bleeding onto the neighboring branches.

The graph is rendered with React Flow.

## Features

- **Branching notes.** Inspired by a literal tree, any note can contain child notes, so your notes form a tree instead of a flat list. The sidebar shows the full hierarchy with inline renaming, collapsing, and a context menu (right-click on desktop, long-press on mobile).
- **Live-preview markdown editing.** Markdown renders inline as you type, and the syntax markers hide until you need them — no formatting toolbar, just plain markdown. Headings, bold/italic/strikethrough, inline and fenced code (syntax-highlighted, with a copy button), lists, blockquotes, links, and horizontal rules are all supported. Built on CodeMirror.
- **Wiki links.** Type `[[name]]` to create a link inside your note. Clicking it opens the child note with that name, creating it first if it does not exist yet. This makes branching a new note off the one you are writing as simple as naming it. Links are stored as plain `[[name]]` text in the markdown file.
- **Themes and appearance.** Built-in Dark, AMOLED Black and Light themes, a fully custom color palette, several fonts, and interface zoom, all in Settings. Optionally center the editor in a column for a more focused layout.
- **Cross-platform.** Use GraphWrite in the browser, on the desktop, or on mobile. The mobile apps add niceties like an auto-hiding title bar, a bottom-sheet menu, and haptic feedback.
- **Autosave.** Changes are saved automatically as you type (Ctrl/Cmd + S works too).

## Platforms

| Platform | Status |
| --- | --- |
| Browser | ✅ Supported |
| Linux | ✅ Supported |
| Windows | ✅ Supported |
| Android | ✅ Supported |
| macOS | 🚧 In progress |
| iOS | 🚧 In progress |

> [!NOTE]
> Android app is not on Google Play Store just yet. You can download and install the apk in the Release tab.

> [!NOTE]
> I am planning on releasing it on the AUR and even Flatpak for linux.

All clients talk to the same self-hosted backend, so your notes are the same everywhere. You can also run more than one backend and switch between them — changing the server address takes a moment in Settings.

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

## Contributing

Contributions are absolutely welcome. Bug reports, feature ideas, and pull requests all help — open an [issue](https://github.com/seojoonlee-dev/graphwrite/issues) to discuss anything substantial before you start so we do not both build the same thing.

The repo is a few separate pieces:

| Directory | What it is |
| --- | --- |
| `frontend/` | The client (browser, desktop, mobile). React + [Vite](https://vite.dev), packaged for desktop/mobile with [Tauri](https://tauri.app). |
| `backend/` | The self-hosted note store. A small [Express](https://expressjs.com) server that reads and writes plain `.md` files. |
| `website/` | The marketing site at [graphwrite.app](https://graphwrite.app) (and the hosted demo under `/demo`). |

### Local development

Run the backend and the frontend dev server side by side:

```
# Terminal 1 — backend (serves on port 3001)
cd backend
npm install
node server.js

# Terminal 2 — frontend (dev server on port 5173)
cd frontend
npm install
npm run dev
```

The frontend talks to `http://localhost:3001` by default; you can point it at another backend in Settings. To work on the browser-only demo (IndexedDB storage, no backend), run `npm run build:demo` or set `VITE_STORAGE=indexeddb`.

### Guidelines

- **Keep it lightweight.** GraphWrite is deliberately small — no telemetry, no AI, no heavy dependencies. New dependencies should earn their place.
- **Match the surrounding code.** Follow the existing style and naming; run `npm run lint` in `frontend/` before opening a PR.
- **Keep PRs focused.** One change per pull request makes review easier.

## AI Disclosure

> [!NOTE]
> AI tools (Claude Code) were used during development to help prototype parts of the app, including the custom CodeMirror live-preview extensions and the graph view. All generated code was reviewed, and edited or rewritten where needed, by yours truly. GraphWrite itself ships no AI features and sends your notes to no AI service.

GraphWrite is licensed under the MIT license.
