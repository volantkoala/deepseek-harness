---
description: "The right Sidebar's turn-map tab type for the dsh web client: every started Turn of the Session as a chain node, selecting one moves the conversation to that Turn."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-sidebar-dag

English | [中文](README.zh.md)

## Summary

The right Sidebar's turn map: a Session's every started Turn as one node in a chain, and picking a node moves the conversation to that Turn. It is a page type reached from the guide and claims no address, so it opens no resource for another viewer — nothing in `ui-sidebar-right` knows this package. Its labels, its guide entry, and the two lines its dictionary carries for a Session with no Turns and for a deployment without the turn outline all come from the `sidebarDag` namespace.

## Table of Contents

- [What it registers](#what-it-registers)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="what-it-registers"></a>
## What it registers

- **The type** — `ctx.sidebarRightTabs.register(...)` with kind `dag`, id `@deepseek-ai/dsh-client-ui-sidebar-dag`, band `builtin`, no patterns, and one guide entry (order 20, its title and description from the `sidebarDag` namespace, its glyph the shared branch icon) that opens the type. The id is the key the type's body and chip title register under in the `sidebar.right.pane.tab` and `sidebar.right.pane.tab.title` seats.
- **The dictionaries** — the `sidebarDag` namespace through `ctx.locale.register(...)`, both shipped locales in one call; an incomplete pair is refused at registration, so a reader never meets a half-translated tab.

Three source files under `src/client/`: `definition.tsx` (the type), `locales.ts` (what it says), and `index.ts` (the wiring). `src/index.ts` is the host half and contributes nothing to the host tree.

<a id="model-experience"></a>
## Model Experience

None, as this package draws a Session's turns in the browser and registers nothing model-facing.

#### KV Cache effect

None; the map assembles no model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>
- **Opened by kind only.** The type declares no resource patterns, so no address ever claims a turn map and nothing can deep-link one; a reader reaches it from the guide page.
- **A host without the turn outline reads differently from an empty Session.** The dictionary carries `empty` and `noProjection` as separate lines on purpose: a Session with no started Turns and a deployment that provides no turn outline must not read alike.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published: this package holds no runtime state. The type and its dictionaries are registry contributions that their own registries own and dispose with the plugin's fiber, and nothing here observes a second time.
