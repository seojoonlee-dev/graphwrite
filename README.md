# GraphWrite

GraphWrite is a self hosted, no-bs, extremely simple and lightweight note taking app which offers WYSIWYG markdown editing using Tiptap. No AI, no encryption, no grammar checking, no drawing, no bloat. Just good old note taking.

GraphWrite uses Express + Node.js as its backend and React + TypeScript as the frontend. Your notes are stored as plain markdown files on disk, so they are yours to grep, back up, or take elsewhere at any time.

### Features

- **Branching notes.** Inspired by a literal tree, any note can contain child notes, so your notes form a tree instead of a flat list. The sidebar shows the full hierarchy with inline renaming, collapsing, and a right-click context menu.
- **WYSIWYG markdown editing.** Markdown is done completely headlessly, meaning there isn't a bold button to bold your text (unless you decide to add one. it's open source after all). Instead it uses the Tiptap editor's built-in markdown shortcuts. Refer to the official Tiptap documents for more info: [https://tiptap.dev/docs/examples/basics/markdown-shortcuts](https://tiptap.dev/docs/examples/basics/markdown-shortcuts)
- **Graph view.** See your notes as a graph and rearrange them freely. Click and drag to pan, shift + drag to select multiple nodes, double click a node to open the note, and right click a node for file actions. Node positions are remembered, and a reset button restores the automatic layout.
- **Wiki links.** Type `[[name]]` followed by a space to create a link inside your note. Clicking it opens the child note with that name, creating it first if it doesn't exist yet. This makes branching a new note off the one you are writing as simple as naming it. Links are stored as plain `[[name]]` text in the markdown file.
- **Autosave.** Changes are saved automatically as you type. Ctrl/Cmd + S still works if you want the peace of mind.

### Quick Start

#### Installation

Simply clone this repo and build with docker compose.

```
git clone https://github.com/seojoonlee-dev/graphwrite
cd graphwrite
docker compose up --build
```

You shall now be able to access the frontend at [http://localhost:8080](http://localhost:8080). Additionally, the backend will use port 3001 by default. If you wish to manually change which port to use simply edit docker-compose.yml and server.js located in the backend folder.

Notes are stored in `./backend/notes` by default. To keep them somewhere else, change the volume path in docker-compose.yml.

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
> This is a very early version of GraphWrite. I am planning on adding customization in the browser, authentication and so much more.

> [!NOTE]
> AI DISCLAIMER: I acknowledge the use of Claude Code for initial prototyping of some features including the custom TipTap extentions and the graphview. All generated code was then reviewed and rewritten by yours truly.

GraphWrite is licensed under the MIT license.
