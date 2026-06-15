# GraphWrite

GraphWrite is a self-hosted, no-bs, extremely simple and lightweight note taking app with live-preview markdown editing. No AI, no encryption, no grammar checking, no drawing, no bloat. Just good old note taking.

GraphWrite uses Express + Node.js as its backend and React + TypeScript as the frontend, with native desktop (Linux) and Android apps built on Tauri. Your notes are stored as plain markdown files on disk, so they are yours to grep, back up, or take elsewhere at any time.

### Features

- **Branching notes.** Inspired by a literal tree, any note can contain child notes, so your notes form a tree instead of a flat list. The sidebar shows the full hierarchy with inline renaming, collapsing, and a context menu (right-click on desktop, long-press on mobile).
- **Live-preview markdown editing.** Markdown is rendered inline as you type — the syntax markers stay hidden until your cursor enters them, Obsidian-style. There is no formatting toolbar; you just write plain markdown. Headings, bold/italic/strikethrough, inline and fenced code (syntax-highlighted, with a copy button), ordered and unordered lists, blockquotes, links, and horizontal rules are all supported. Built on CodeMirror.
- **Graph view.** See your notes as a graph and rearrange them freely. Click and drag to pan, shift + drag to select multiple nodes, double click a node to open the note, and right click a node for file actions. Node positions are remembered, and a reset button restores the automatic layout.
- **Wiki links.** Type `[[name]]` followed by a space to create a link inside your note. Clicking it opens the child note with that name, creating it first if it doesn't exist yet. This makes branching a new note off the one you are writing as simple as naming it. Links are stored as plain `[[name]]` text in the markdown file.
- **Themes & appearance.** Built-in Dark, AMOLED Black and Light themes, a fully custom color palette, several fonts, and interface zoom — all in Settings. Optionally center the editor in a column for a more focused layout.
- **Cross-platform.** Use GraphWrite in the browser, as a desktop app, or on Android. The desktop and mobile apps add niceties like an auto-hiding title bar, a bottom-sheet menu, and haptic feedback.
- **Autosave.** Changes are saved automatically as you type. Ctrl/Cmd + S still works if you want the peace of mind.

### Quick Start

#### Installation (self-hosted server)

Simply clone this repo and build with docker compose.

```
git clone https://github.com/seojoonlee-dev/graphwrite
cd graphwrite
docker compose up --build
```

You shall now be able to access the frontend at [http://localhost:8080](http://localhost:8080). Additionally, the backend will use port 3001 by default. If you wish to manually change which port to use simply edit docker-compose.yml and server.js located in the backend folder.

Notes are stored in `./backend/notes` by default. To keep them somewhere else, change the volume path in docker-compose.yml.

#### Desktop & mobile apps

The desktop (Linux) and Android apps live in the `frontend/` directory and are built with [Tauri](https://tauri.app). They talk to the same self-hosted backend — set its address in Settings (see below). From `frontend/`, build the desktop app with `npm run tauri build`, or the Android app with `npm run tauri android build` (requires the Android SDK and NDK).

#### Accessing from other devices

The frontend looks for the backend at `http://localhost:3001` by default. To use GraphWrite from another device on your network, open Settings and set the server address to the IP of the machine running the backend (for example `http://192.168.0.1:3001`).

> [!WARNING]
> GraphWrite has no authentication. Anyone who can reach the backend port can read, edit, and delete your notes. Keep it on a trusted network, and do not expose it to the internet without putting it behind a reverse proxy with authentication. I am planning on adding authentication in the near future.

#### Updating

Simply pull this repo inside /graphwrite and rebuild with docker compose.

```
cd graphwrite
git pull
docker compose up --build
```

### Note

> [!NOTE]
> This is a very early version of GraphWrite. I am planning on adding authentication and so much more.

> [!NOTE]
> AI DISCLAIMER: I acknowledge the use of Claude Code for initial prototyping of some features including the custom CodeMirror extensions and the graph view. All generated code was then reviewed and rewritten by yours truly.

GraphWrite is licensed under the MIT license.
