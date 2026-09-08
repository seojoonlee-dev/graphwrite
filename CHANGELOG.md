# Changelog

All notable changes to GraphWrite are documented here.


## v0.1.2 - 2026-09-07

A bug-fix release with a few editor niceties.

### Added

- Arrows: `->`, `<-`, and `<->` render as →, ←, and ↔ in the editor and in
  table cells. The file keeps the plain characters, and they reappear while
  the cursor touches the arrow. Arrows inside code are left alone.
- Reference-style links, as in CommonMark: `[text]`, `[text][]`, and
  `[text][label]` resolve through a `[label]: url` definition anywhere in the
  note and behave exactly like inline links. Definition lines are dimmed but
  stay editable. A `[text]` with no definition is now plain text instead of
  looking like a link.
- Select text and press `[` to wrap it in brackets instead of replacing it.
  The text stays selected, so pressing `[` again turns it into a `[[wikilink]]`.

### Fixed

- Typing a lone `-` under a paragraph no longer turns that paragraph into a
  heading. Only `#` headings are recognised.
- The cursor is no longer misplaced in an empty note on Firefox.
- A half-typed `[[wikilink]` no longer flashes as a link before the closing
  brackets are typed.
- Context menus opened near the edge of the window (sidebar notes, graph
  nodes, and the graph's drag-to-create popup) now stay fully on screen.
- Dragging a connection out of a graph node now always offers "Create New
  Note", regardless of which side of the node the drag started on.
- Text can no longer get selected in the editor while resizing the sidebar,
  including on the Linux desktop app, where the webview ignores the usual CSS
  fix.
- Clicking the empty space below the last line of a note now places the
  cursor there, instead of doing nothing.
- The editor's placeholder text is muted again.

### Improved

- Resizing the sidebar is much smoother: the editor no longer re-renders its
  markdown decorations on every frame of the animation.
- Graph nodes are easier to grab: a drag from any part of the dot starts a
  connection.
- Body text and the placeholder now line up with the note title.
- More breathing room around the title divider on desktop.


## v0.1.1 - 2026-06-28

A small bug-fix release.

### Fixed

- The Vibration setting no longer appears where it does nothing. It now shows
  only on app builds with a vibration motor (Android and iPhone) and is hidden in
  the browser, on desktop, and on iPad.
- **Align editor to the center**: the option is no longer broken. The note title
  and its divider now line up with the body text, the centered column is properly
  centered on tablets (it could previously stick to the left), and the editor
  keeps its full width so the scrollbar stays at the edge of the screen instead of
  in the middle of the page.

### Improved

- The graph view's **reset** button now animates smoothly back to the default
  view instead of snapping to it.


## v0.1.0 - 2026-06-25

Initial public release.

GraphWrite is a self-hosted, lightweight, live-preview markdown note-taking app.
Notes branch into child notes, so your whole collection forms a tree, and a graph
view draws that tree so you can see how everything connects. Notes are stored as
plain markdown files on disk that you fully own.

### Editor

- Live-preview markdown editing built on CodeMirror 6: markdown renders inline as
  you type, and syntax markers stay hidden until your cursor is near them. No
  formatting toolbar.
- Supported markdown: six heading levels, bold, italic, strikethrough and combined
  emphasis, inline code, fenced code blocks (syntax-highlighted, language-labelled,
  with a copy button), ordered and unordered lists with nesting, blockquotes,
  links, tables, and horizontal rules.
- Wiki links: type `[[name]]` to link to another note. Clicking a link opens that
  note, creating it first if it does not exist yet. Links are stored as plain
  `[[name]]` text in the markdown file.
- Autosave: changes are written automatically as you type, with `Ctrl`/`Cmd` + `S`
  also available.

### Notes and organization

- Branching notes: any note can contain child notes, so your notes form a tree
  rather than a flat list.
- Sidebar showing the full hierarchy, with inline renaming, collapsible branches,
  and a context menu (right-click on desktop, long-press on mobile).
- Start screen with quick actions and your recently opened notes, shown when no
  note is open.

### Graph view

- Automatic tidy left-to-right tree layout, with each note centered on its
  children and no overlapping branches. Rendered with React Flow.
- Click and drag to pan; Shift + drag to box-select multiple nodes.
- Double-click a node to open the note; right-click a node for file actions.
- Drag a branch onto another note to re-parent it; right-click a branch to detach a
  note back to the top level.
- Drag outward from a node onto empty canvas to create a child note there.
- Search to highlight the path to any note, with matches lit in the accent color
  and a soft glow on neighboring branches.

### Appearance and settings

- Themes: built-in Dark, AMOLED Black, and Light, plus a fully custom color
  palette.
- Font selection and interface zoom (desktop and mobile apps).
- Optional centered, fixed-width editor column for a more focused layout.
- Optional rounded corners on rendered tables.
- Auto-hide title: the note title slides out of view on scroll-down and returns on
  scroll-up. On by default on phones, off on desktop/web, and toggleable in
  Settings.
- Startup note that opens automatically, and a control to clear recent-notes
  history.
- Adjustable haptic feedback strength on touch devices.

### Platforms

- Supported: Browser, Linux, Windows, and Android.
- In progress: macOS and iOS.
- All clients connect to the same self-hosted backend by URL, so the same notes
  follow you everywhere. The backend address is hot-swappable from Settings with no
  restart, so you can run more than one backend and switch between them.
- Mobile builds add an auto-hiding title bar, a bottom-sheet menu, and haptic
  feedback. Desktop builds reuse the system webview instead of bundling a browser
  engine, keeping the binary small.

### Self-hosting

- Published as prebuilt Docker images for the backend and frontend; the frontend
  can also be pointed at a backend hosted elsewhere.
- Notes are stored as plain markdown files in a directory you choose, so they
  remain easy to grep, back up, or move elsewhere.

### Known limitations

- No authentication yet: anyone who can reach the backend port can read, edit, and
  delete your notes. Keep the backend on a trusted network, and do not expose it to
  the internet without a reverse proxy that adds authentication. Authentication is
  planned.
- The Android app is not on the Google Play Store yet; install the APK from the
  Releases tab.
- macOS and iOS support is still in progress.
