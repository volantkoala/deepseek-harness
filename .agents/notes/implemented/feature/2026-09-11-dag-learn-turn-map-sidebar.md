# Agent Note: DAG-learn — a turn map in the right Sidebar

Status: implemented

English | [中文](2026-09-11-dag-learn-turn-map-sidebar.zh.md)

## Problem

A long Session is a chain the reader cannot see. The product has one turn navigator, and it lives inside the Chat transcript: `TurnNavigator` draws a thin mark strip beside the messages, and its marks scroll the transcript to a turn or page history when the target is not loaded. That strip is a few pixels wide, carries no text, and is reachable only from the surface it scrolls. A reader working in any other surface — the right Sidebar's file tree or document preview, the Trajectory ledger, a wide-screen pane arrangement — had no map of where the Session has been and no way to move the transcript.

Two facts made a Sidebar map cheap, and both are load-bearing for the design:

- The host already projects `turnOutline` over the whole log: every started turn, in ascending order, with a bounded prompt preview, a bounded settled-response preview, and the turn's `turn/start` seq. Any session-scoped Slot occupant reads it through `useProjection`, with no event projection of its own.
- The Chat view already implements turn navigation for a loaded target (scroll and land) and for an unloaded one (page history through the outline seq, then land).

What was missing was not a turn model or a landing routine. It was a supported way for a plugin outside the Conversation shell to ask the Conversation to move, and for a plugin outside the Chat view to learn where the transcript currently is. Both were private to the packages that own them: the request state lived in a Slot store the renderer resolves per registration and scope with no public accessor, and the Chat view's active-turn value was component state.

## Decision

DAG-learn is a read-only turn map, a right-Sidebar tab type in the client package `@deepseek-ai/dsh-client-ui-sidebar-dag`. Every started turn is a node in a vertical chain drawn from the host's own turn outline; selecting a node moves the conversation to that turn. The type registers a guide entry beside the file tree's, so a pane with no remembered page opens the guide — a two-entry chooser where the file tree alone was the default, and the default-page flip is one of the decision's consequences. The map persists nothing, edits nothing, and owns no turn data: it is a projection consumer plus two thin cross-package seams.

Three seams carry it, each owned by the package that already owns the corresponding state.

1. **Navigation — `ui-conversation`.** `IConversation`, the scope-addressed outward face other plugins may reach, carries `requestView(request)`, taking the one-shot `ConversationViewRequest` that the addressed view consumes and acknowledges. Inside the Conversation shell this is what the store's one-shot request action does: activate the addressed view's target source, record the view preference, publish the request. The request is a discriminated union — an opaque `focus` identity for a view's own addressing, or a `turn` number for a turn-based view. Trajectory keeps its behaviour and reads the `focus` arm.
2. **Turn addressing — typed, not encoded.** A turn is addressed by number. A client bundle may not import values from another plugin — the bundle purity gate rejects cross-plugin value imports and routes collaboration through cordis services — so a formatter exported by `ui-chat` would not reach the map. Rather than spell one format in two packages, the request carries the turn as a typed field, and no format exists to drift.
3. **Current position — `ui-chat`.** `ui-chat` provides the client service `ctx.chatView`, whose `location(sessionId)` reports the Chat view's own `{ activeTurn, busyTurn }` as a per-Session source. A client bundle may not import values from another plugin, so a cordis service is the only channel a cross-plugin value can travel; the map reads it optionally with `ctx.get`, exactly as `chatFileMentions` is read today. The source reports an empty location while no Chat view is mounted, and an absent service leaves the map drawing no current mark.

### The outside producer

The view-request machinery is complete inside the Conversation shell and unreachable outside it. The request lives in the per-session Slot store that holds `view` and `viewRequest`; the renderer resolves that store per registration and scope, and no service method or public accessor reaches it.

The shell is therefore the applier, not a second owner. The mounted Conversation shell registers itself as the Session's request applier on the conversation service; `requestView` hands the request to that applier, which writes it through the store action exactly as an in-shell caller does. The store stays the single live owner of the request; the service holds no request state of its own. A Session with no mounted shell has no applier, and the call fails loud rather than dropping the request: the invariant is that a right-Sidebar tab shares its Session with the mounted conversation region, so a missing applier is an anomaly worth a message, not silence.

The producer reaches the verb through the Session scope, the same route `ui-conversation`'s own scope-addressed callers use: `sessions.scope(sessionId)` and the `conversation` service resolved from it.

### The node source

`useProjection('turnOutline')` yields `TurnOutlineEntry[]` — `{ turn, seq, prompt, response }` — strictly ascending by turn. Previews exclude injected context and tool results; a response preview appears only once its turn settles.

Consequences that shape the map:

- A turn that is still generating is already a node with its prompt preview and an empty response preview; the preview fills in when the turn settles, without the node appearing, disappearing, or reordering.
- No second source is needed. The map does not read the Chat target snapshot, so it stays independent of the Chat view and keeps rendering in deployments and view configurations where Chat is not mounted.
- The projection's previews are already bounded at the wire, so the map re-bounds nothing; overflow is a visual clip, not a new bound.

Projection values cross the wire, and the projection type table already carries them across it: `turnOutline` is declared in `SessionProjectionMap`, so `useProjection('turnOutline')` hands the map typed entries and the map narrows nothing itself.

### Selecting a node

The tab's session scope supplies the Session and the node supplies its `turn`:

1. the map calls `conversation.requestView({ kind: 'turn', view: 'chat', turn })`;
2. the shell applies the request and the Chat view consumes it: a loaded turn resolves through the same path the rail's loaded mark uses, and a turn outside the loaded window arms the existing pending-jump state with the outline's `seq` and pages history through `loadThrough` before landing;
3. the request is acknowledged.

An unresolvable turn — a node whose turn no longer exists because history moved under the map — is acknowledged with no visible change. The gesture is a user action on stale data, not a configuration error, and it does not wedge the one-shot request.

### The map's own behaviour

The map follows the tail while the reader is at the tail and suspends following once the reader scrolls the current node out of the map's own scrollport, matching the Chat transcript and the Trajectory ledger. While following is suspended, a "back to current" control returns to the current node and resumes following; the control is drawn only while the current node is out of view.

Rows are uniform and dense: node mark, turn number, prompt preview. Only the current node expands its response preview, so the chain stays scannable and the reader's eye lands on one row at a time. A node in flight during a jump carries a landing state; the current node carries `aria-current`.

The map is a keyboard surface: a `nav` landmark containing a list of real buttons, roving tabindex with arrow-key traversal and Home/End, a visible focus ring, and reduced-motion behaviour that disables smooth scrolling and the landing pulse. The chain bounds no content width — the mark column and the spine keep their fixed gutter and every non-current row stays one ellipsized line — so a wide pane widens the preview line rather than the row.

An empty Session shows one line; a deployment without the projection shows a different line, so a missing projection is never presented as an empty Session.

## What this does not do

- No branching: forks, subagent children, and retries are not nodes. A linear chain is a degenerate directed acyclic graph, and that is the whole graph this version draws.
- No node editing, labelling, annotation, persistence, search, filtering, minimap, or zoom.
- No left-Sidebar panel and no entry point on non-browser UI surfaces.
- No virtualised list. The chain keeps every node in the DOM and carries `content-visibility: auto`, which contains it and skips its contents while the pane is not shown, and the measurement that would force virtualisation is unknown — the package README records that gap with its other known limitations.
- No change to the Trajectory focus path, the transcript rail, or any existing turn-navigation behaviour.

## Alternatives considered

**Why not have `ui-chat` own a location service (`chatLocation.reveal` / `activeTurn`) that the map depends on?** It centralises the change in one package, but the Chat view is not always mounted — a reader can be looking at the Trajectory ledger — so `reveal` would have nowhere to land, and returning the conversation to Chat needs the view selection that lives in the Conversation shell. The design would end up reaching into `ui-conversation` anyway, with an extra dependency from a Sidebar plugin to the Chat plugin on top.

**Why not export the focus encoding from `ui-chat` for producers to call?** A client bundle may not import values from another plugin: the bundle purity gate rejects cross-plugin value imports and routes collaboration through cordis services. An exported formatter would therefore not reach the map, leaving two choices — spell one format in two packages, or make the turn a typed field on the request. The typed field deletes the format instead of duplicating it.

**Why not register the map's tab inside `ui-chat` itself and share the jump closure directly?** That is the smallest diff: no new seam at all. It also puts a Sidebar surface inside the Chat target package, against the package-per-role layout, and it makes removing or changing the experiment a change to a core package.

**Why not write the request straight into the Conversation store?** The store instance is resolved by the Slot renderer for a specific registration and scope and has no public accessor by design; exposing one would hand every plugin a mutable handle on shell state. The applier keeps the write set where it belongs.

**Why not reuse the browser's own scroll into view from the Sidebar?** The transcript virtualises and pages; a DOM-level scroll cannot reach a turn that is not loaded, and it would silently show the wrong position when pages shift. The Chat view's landing routine exists precisely because this is not a scroll-position problem.

**Why not derive the node list from the Chat snapshot instead of the projection?** The snapshot holds only the loaded window, so a long Session's early turns would be missing from the map until paged in — the opposite of a map. The projection exists to describe turns a client has not loaded.

## Consequences

- A right-Sidebar tab type draws every started turn of a Session as one chain node in ascending turn order, sourced from the `turnOutline` projection, with no event projection in the map package.
- Selecting a node moves the conversation to that turn with the Chat view as the addressed view: a loaded turn lands through the existing loaded-mark path, and an unloaded turn pages history through the outline seq and lands. Selecting a node while another Conversation view is active returns the conversation to Chat at that turn, because the request carries the view selection with it.
- The one-shot request is a discriminated union carrying the addressed view id beside a typed arm. The string focus encoding the store published before is gone, and no turn formatter is shared between packages: a client bundle forbids cross-plugin value imports, so the turn travels as a field rather than as a format two packages would have to keep in step.
- `requestView` fails loud in two places: `ui-conversation: no Conversation View "<view>" is registered` when the addressed view is not registered, and `conversation.requestView: session "<id>" has no mounted conversation shell` when the addressed Session has no mounted shell. Neither path can silently drop a request.
- The right Sidebar's default page for a pane with no remembered page is now the guide rather than the file tree: `files` (order 10) and `dag` (order 20) are two guide entries, and the surface opens the guide whenever the entry count is not one. The file tree stays reachable as `openTab('files')`.
- A Session's reading position crosses packages as client state, and `ui-chat` is its only writer: a Session whose Chat view is unmounted reports `{ activeTurn: null, busyTurn: null }`, so the map marks no position while nothing is showing one, and an assembly with no Chat plugin draws no current mark at all.
- The projection is optional. A deployment that provides no turn outline draws its own line, distinct from the empty-Session line, and the chain still renders.
- The chain keeps every node in the DOM and carries `content-visibility: auto`, which skips its contents while the pane is not shown; the Session's turn count bounds the row count and nothing below the product bounds that.

What the decision gives up:

- **The applier invariant is a convention, not a structural guarantee.** A request reaches a Session's shell through the applier that shell registers, and nothing prevents a Session's right-Sidebar tab from coexisting with another Session's shell in a floating panel, where a jump can fail loud where a reader expects it to work. The composition spec pins the shipped arrangement.
- **The change touches hot paths in two core packages.** The verb writes the conversation store's view selection, and the Chat view consumes a request on the same state its scrolling drives. Both suites cover their paths.
- **The request contract is a discriminated union.** Trajectory reads the `focus` arm, and the store action publishes whichever arm arrives, so a consumer that still assumed one string focus no longer compiles.
- **No virtualisation until measured.** The row count is bounded by the Session's turn count, which is not bounded by the product. `content-visibility: auto` abates nothing while the map is visible, where the chain is on screen and renders whole; the measurement that would force virtualisation is not recorded and is not guessed at.
- **The guide entry moves the right Sidebar's default page.** Two guide entries mean a new pane opens the guide instead of the file tree. Accepted rather than avoided: the guide is the designed chooser once one type is no longer the only one, and the alternative — registering no guide entry — leaves the map undiscoverable from the interface.
- **The map shows structure, not health.** Turn errors, retries, and compactions are not part of the projection, so a turn that failed reads like any other turn. Presenting failure state would need another source and is deliberately out of scope.

## Deferred

- The chain bounds no content width and keeps one row rhythm at both panel widths; whether the full-width panel wants a content bound or two-line previews is unresolved.
- The chain exposes no "jump to this turn" action in the tab's menu seat (`sidebar.right.tab.menu.item`); the rows are its only entry point.
- The transcript rail keeps its in-script anchor path rather than moving onto the outside-producer seam, so the two surfaces still drive turn navigation through different routes.
