---
description: "The right Sidebar's turn-map tab type for the dsh web client: every started Turn of the Session as a node of an editable tree — selecting one moves the conversation to that Turn."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-sidebar-dag

English | [中文](README.zh.md)

## Summary

The right Sidebar's turn map: a Session's every started Turn as one node in a reader's tree, and picking a node moves the conversation to that Turn. The tree is editable — a node can be renamed (a label covering its prompt preview), hung under another node, lifted back out, moved among its siblings, and folded with its subtree — while the outline stays the single source of truth: nodes are never added or dropped, and an untouched tree reads exactly like the plain chain. It is a page type reached from the guide and claims no address, so it opens no resource for another viewer — nothing in `ui-sidebar-right` knows this package. Its labels, its guide entry, and the two lines its dictionary carries for a Session with no Turns and for a deployment without the turn outline all come from the `sidebarDag` namespace.

## Table of Contents

- [What it registers](#what-it-registers)
- [The tree](#the-tree)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="what-it-registers"></a>
## What it registers

- **The type** — `ctx.sidebarRightTabs.register(...)` with kind `dag`, id `@deepseek-ai/dsh-client-ui-sidebar-dag`, band `builtin`, no patterns, and one guide entry (order 20, its title and description from the `sidebarDag` namespace, its glyph the shared branch icon) that opens the type.
- **The body** — the keyed `sidebar.right.pane.tab` seat under that id: the header row carrying the Turn count, the reset-to-chain control while the tree is edited, and with it the control back to the current node while following is suspended, above the tree.
- **The tree store** — a Slot-standard exclusive store (`defineStore` with the `ui-sidebar-dag.tree` persist key) bucketed by tab id, holding each tab's hierarchy, labels, and folds.
- **The chip title** — the keyed `sidebar.right.pane.tab.title` seat under that id: the shared branch glyph at 16px before the type's label.
- **The dictionaries** — the `sidebarDag` namespace through `ctx.locale.register(...)`, both shipped locales in one call; an incomplete pair is refused at registration, so a reader never meets a half-translated tab.

Eight source files under `src/client/`: `definition.tsx` (the type), `DagBody.tsx` (what it draws), `DagTitle.tsx` (the chip title), `face.ts` (how it reaches the conversation and the reading position), `map.ts` (the render list), `tree.ts` (the editable tree's store), `locales.ts` (what it says), and `index.ts` (the wiring). `src/index.ts` is the host half and contributes nothing to the host tree.

<a id="the-tree"></a>
## The tree

Nodes are the Session's own Turns: `useProjection('turnOutline')` read as `{ turn, prompt, response }` in outline order, with no event projection and no second model in this package — the reader's tree is an organisation layer over the outline, never a new set of facts. A Turn whose prompt carries no text keeps its place, unnamed but numbered. An absent outline and an empty Session read as two different lines — the deployment's and the Session's — and neither draws a tree.

Every row is a real button carrying the node mark, the Turn number, and the prompt preview (or its reader label). The current node — the Turn the mounted Chat view reports as its reading line, read from the optional `chatView` service's per-Session location — carries `aria-current` and expands its response preview, so the tree stays scannable and only one row grows; every other row stays one line. A Turn a jump is landing on carries the landing state. Picking a row asks the conversation for that Turn through `conversation.requestView({ kind: 'turn', view: 'chat', turn })` on the tab's Session scope, which moves the transcript there and returns the conversation to Chat when another view is active.

The reader edits the tree through the tab's store:

- **Rename** — the edit control (or `F2`) opens an inline field; a label covers the prompt preview, and a blank label clears back to the prompt.
- **Attach** — the attach control enters the hang mode; clicking a target node hangs the node under it, at the end of its children. A node cannot hang under itself or one of its descendants, and the mode stays on until a valid target is picked.
- **Lift** — the promote control (or `Shift+Tab`) lifts a node out of its parent, dropping it right after the parent as the parent's new sibling.
- **Move** — the move-up / move-down controls shift a node among its siblings.
- **Indent** — `Tab` on a node hangs it under its previous sibling, the outline-writer's move.
- **Fold** — a node with children carries a fold control (and `aria-expanded`); folding hides its subtree, and the count still says how many Turns the Session has.
- **Reset** — while any hierarchy edit stands, the header carries the reset control that returns the tree to the plain outline order (labels and folds stay).

Every edit goes through the store's actions, so an edit lands on a placed Turn: a Turn the tree never placed reads as an unedited root, and the first edit of it materialises the current root order. The tree persists under the store's per-session key, so the reader's organisation survives a reload.

The map follows the current node while the reader stays with it: each advance scrolls the current row into view, and once the reader scrolls that row out of the map's own scrollport the tree stops moving under them and the control back to the current node appears. That control unfolds any folded ancestors first, then returns to the row and resumes following; it is drawn only while the current node is out of view. Rows are a keyboard surface — one tab stop, arrow-key traversal, Home/End, `Tab`/`Shift+Tab` to indent and lift, `F2` to rename, a visible focus ring — and reduced motion drops the smooth scroll and the landing pulse.

What the reader reads is the `sidebarDag` dictionary's: the type label and its chip, the guide entry's title and description, the Turn count, the two empty-state lines, the control back to the current node, the line that labels a prompt-less Turn, and every control of the editable tree.

<a id="model-experience"></a>
## Model Experience

None, as this package draws a Session's turns in the browser and registers nothing model-facing.

#### KV Cache effect

None; the map assembles no model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>
- **Opened by kind only.** The type declares no resource patterns, so no address ever claims a turn map and nothing can deep-link one; a reader reaches it from the guide page.
- **A host without the turn outline reads differently from an empty Session.** The dictionary carries `empty` and `noProjection` as separate lines on purpose: a Session with no started Turns and a deployment that provides no turn outline must not read alike.
- **No virtualisation.** Every node stays in the DOM. The tree carries `content-visibility: auto`, which contains the tree and skips its contents while the pane is not shown; on screen the tree renders whole, so row cost while the reader is looking at the map is not abated. The Turn count is bounded by the Session, not by the product, and the measurement that would force a virtualised list — the row count at which scroll or commit cost stops being acceptable — is not recorded.
- **A failed Turn reads like any other.** Turn errors, retries, and compactions are absent from the turn outline, so a Turn that failed carries the same mark, number, and prompt preview as one that answered, with an empty response preview.
- **The reader's organisation is browser-local.** The tree store persists per session on the client, so a reader's hierarchy, labels, and folds survive a reload but do not follow the Session to another device. Synchronising the organisation with the Host would take a write path the turn outline does not own.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published: the package owns no shared runtime state. The type and its dictionaries are registry contributions that their own registries own and dispose with the plugin's fiber; the tree store is the framework's per-session instance; and the chain's remaining state — the roving tab stop, whether following is suspended, the rename field, and the attach mode — lives inside the body component that reads it, with no second observation to compare against.
