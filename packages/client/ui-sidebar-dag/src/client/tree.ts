/**
 * The editable tree over a Session's Turns: which Turn hangs under which, what
 * each node is called, and which subtrees are folded.
 *
 * The real outline stays the single source of truth — nodes are never added or
 * dropped here. What this store owns is the reader's organisation: for every
 * Turn the tree says where it sits in the hierarchy, what label covers its
 * prompt preview, and which nodes hide their subtree. An untouched store reads
 * exactly like the plain chain.
 *
 * A Turn absent from every child list is an unedited root: the map draws it at
 * root level in outline order, after the explicitly ordered roots. The first
 * edit of such a Turn materialises the current root order through the caller's
 * `rootOrder` argument, so an edit always lands on a placed Turn.
 *
 * The state is a Slot-standard exclusive store (one instance per session),
 * bucketed by tab id because two tabs of this kind in one session edit
 * independently, and persisted under a fixed key so the reader's tree survives
 * a reload. Writers run between `start` and `forget`: the owner's `signal` is
 * what ends a bucket's life.
 */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit'

/** The bucket key that holds the tree's root level. */
export const ROOT = 'root'

/** The parent key one Turn's children are listed under. */
function parentKey(parent: number | null): string {
  return parent === null ? ROOT : String(parent)
}

/** One Turn's own key as a parent. */
function keyOf(turn: number): string {
  return String(turn)
}

/** One tab's tree over the Session's Turns. */
export interface DagTreeTabState {
  /** Ordered child Turn lists by parent key (`ROOT` or a parent Turn's decimal). */
  children: Record<string, number[]>
  /** Reader labels by Turn, covering the prompt preview; a Turn with none keeps its prompt. */
  labels: Record<number, string>
  /** Turns whose subtree is folded. */
  collapsed: number[]
}

/** Every tab's tree, keyed by tab id. */
export interface DagTreeState {
  byTab: Record<TabId, DagTreeTabState>
}

/** One Turn's row in the tree: its parent (null at root) and its index among its siblings. */
export interface TreePosition {
  readonly parent: number | null
  readonly at: number
}

/** Every Turn reachable under `turn`, `turn` itself excluded. */
export function descendantsOf(tree: DagTreeTabState, turn: number): Set<number> {
  const seen = new Set<number>()
  const visit = (node: number): void => {
    for (const child of tree.children[keyOf(node)] ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      visit(child)
    }
  }
  visit(turn)
  return seen
}

/**
 * Where one Turn's row sits, or null for a Turn the tree never placed.
 * @param tree - the tab's tree.
 * @param turn - the Turn to locate.
 * @returns its parent and sibling index, or null when it is an unedited root.
 */
export function positionOf(tree: DagTreeTabState, turn: number): TreePosition | null {
  for (const [key, list] of Object.entries(tree.children)) {
    const at = list.indexOf(turn)
    if (at >= 0) return { parent: key === ROOT ? null : Number(key), at }
  }
  return null
}

/** The tab's bucket, which every writer after `start` relies on. */
function bucket(state: DagTreeState, tabId: TabId): DagTreeTabState {
  const tree = state.byTab[tabId]
  if (tree === undefined) throw new Error(`ui-sidebar-dag: no tree for tab "${tabId}"`)
  return tree
}

/** Lift one Turn out of whichever child list holds it, in place on the draft. */
function detach(draft: DagTreeTabState, turn: number): void {
  for (const [key, list] of Object.entries(draft.children)) {
    const at = list.indexOf(turn)
    if (at < 0) continue
    const next = [...list]
    next.splice(at, 1)
    draft.children = { ...draft.children, [key]: next }
    return
  }
}

/** Place an unedited Turn: materialise the caller's current root order, then find it. */
function placeUntracked(
  draft: DagTreeTabState,
  turn: number,
  rootOrder: readonly number[],
): TreePosition {
  if (draft.children[ROOT] === undefined) {
    draft.children = { ...draft.children, [ROOT]: [...rootOrder] }
  }
  const roots = draft.children[ROOT]
  if (roots === undefined) return { parent: null, at: 0 }
  const at = roots.indexOf(turn)
  if (at >= 0) return { parent: null, at }
  // The outline moved under the tree; an unplaced Turn reads as an unedited root.
  return { parent: null, at: roots.length }
}

/** The tree store's write set; every action names the tab it writes. */
type DagTreeActions = {
  start: (draft: DagTreeState, tabId: TabId) => void
  rename: (draft: DagTreeState, tabId: TabId, turn: number, label: string) => void
  attach: (draft: DagTreeState, tabId: TabId, turn: number, parent: number, rootOrder: readonly number[]) => void
  promote: (draft: DagTreeState, tabId: TabId, turn: number, rootOrder: readonly number[]) => void
  move: (draft: DagTreeState, tabId: TabId, turn: number, step: -1 | 1, rootOrder: readonly number[]) => void
  toggle: (draft: DagTreeState, tabId: TabId, turn: number) => void
  reset: (draft: DagTreeState, tabId: TabId) => void
  forget: (draft: DagTreeState, tabId: TabId) => void
}

/**
 * Declare the editable tree's store.
 *
 * A factory rather than a shared handle: the registration declares it as an
 * exclusive store, so the framework mints one instance per session and
 * persists each under the session-scoped key.
 * @returns the store handle to declare on the registration.
 */
export function createDagTreeStore() {
  return defineStore({
    init: (): DagTreeState => ({ byTab: {} }),
    persist: 'ui-sidebar-dag.tree',
    actions: {
      /**
       * Seed one tab's tree, untouched: every Turn reads as an unedited root.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       */
      start: (d, tabId: TabId) => {
        d.byTab[tabId] = { children: {}, labels: {}, collapsed: [] }
      },
      /**
       * Set one Turn's reader label, covering its prompt preview; a blank
       * label clears it back to the prompt.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       * @param turn - the Turn to name.
       * @param label - the label to store, or blank to clear.
       */
      rename: (d, tabId: TabId, turn: number, label: string) => {
        const tree = bucket(d, tabId)
        const trimmed = label.trim()
        if (trimmed === '') {
          if (tree.labels[turn] === undefined) return
          // Rebuild without the key rather than delete: the dynamic-delete
          // shape is rejected package-wide, and the label map stays small.
          tree.labels = Object.fromEntries(
            Object.entries(tree.labels).filter(([key]) => Number(key) !== turn),
          )
        } else {
          tree.labels = { ...tree.labels, [turn]: trimmed }
        }
      },
      /**
       * Hang one Turn under another, at the end of the parent's children.
       *
       * Refused when the parent is the Turn itself or one of its descendants
       * — the tree must stay a tree, and every Turn keeps exactly one place.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       * @param turn - the Turn to hang.
       * @param parent - the Turn to hang it under.
       * @param rootOrder - the map's current root order, when the Turn is unplaced.
       */
      attach: (d, tabId: TabId, turn: number, parent: number, rootOrder: readonly number[]) => {
        const tree = bucket(d, tabId)
        if (parent === turn || descendantsOf(tree, turn).has(parent)) return
        if (positionOf(tree, turn) === null && tree.children[ROOT] === undefined) {
          tree.children = { ...tree.children, [ROOT]: [...rootOrder] }
        }
        detach(tree, turn)
        const key = parentKey(parent)
        tree.children = { ...tree.children, [key]: [...(tree.children[key] ?? []), turn] }
      },
      /**
       * Lift one Turn out of its parent and drop it right after the parent,
       * as the parent's new sibling. A root Turn — placed or not — stays put.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       * @param turn - the Turn to lift.
       * @param _rootOrder - kept for the action set's uniform shape; an unplaced Turn is already a root.
       */
      promote: (d, tabId: TabId, turn: number, _rootOrder: readonly number[]) => {
        const tree = bucket(d, tabId)
        const at = positionOf(tree, turn)
        // An unplaced Turn already reads as a root; there is nothing to lift.
        if (at === null || at.parent === null) return
        const parent = at.parent
        // Out of the parent's child list.
        const siblings = [...(tree.children[keyOf(parent)] ?? [])]
        siblings.splice(at.at, 1)
        // Into the parent's own sibling list, right after the parent.
        const parentPos = positionOf(tree, parent)
        const grandKey = parentPos === null ? ROOT : parentKey(parentPos.parent)
        const grandSiblings = [...(tree.children[grandKey] ?? [])]
        const parentAt = grandSiblings.indexOf(parent)
        const insertAt = parentAt < 0 ? grandSiblings.length : parentAt + 1
        grandSiblings.splice(insertAt, 0, turn)
        tree.children = { ...tree.children, [keyOf(parent)]: siblings, [grandKey]: grandSiblings }
      },
      /**
       * Move one Turn one place among its siblings; the edges are walls.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       * @param turn - the Turn to move.
       * @param step - -1 moves it up, 1 moves it down.
       * @param rootOrder - the map's current root order, when the Turn is unplaced.
       */
      move: (d, tabId: TabId, turn: number, step: -1 | 1, rootOrder: readonly number[]) => {
        const tree = bucket(d, tabId)
        let at = positionOf(tree, turn)
        if (at === null) {
          placeUntracked(tree, turn, rootOrder)
          at = positionOf(tree, turn)
        }
        if (at === null) return
        const key = parentKey(at.parent)
        const siblings = [...(tree.children[key] ?? [])]
        const target = at.at + step
        if (target < 0 || target >= siblings.length) return
        const displaced = siblings[target]
        if (displaced === undefined) return
        siblings[at.at] = displaced
        siblings[target] = turn
        tree.children = { ...tree.children, [key]: siblings }
      },
      /**
       * Fold a subtree, or unfold it again.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       * @param turn - the Turn whose subtree flips.
       */
      toggle: (d, tabId: TabId, turn: number) => {
        const tree = bucket(d, tabId)
        const at = tree.collapsed.indexOf(turn)
        if (at >= 0) {
          const collapsed = [...tree.collapsed]
          collapsed.splice(at, 1)
          tree.collapsed = collapsed
        } else {
          tree.collapsed = [...tree.collapsed, turn]
        }
      },
      /**
       * Drop every hierarchy edit, keeping labels and folds: the tree reads as
       * the plain outline again, in outline order.
       * @param d - draft state.
       * @param tabId - the tab being drawn.
       */
      reset: (d, tabId: TabId) => {
        bucket(d, tabId).children = {}
      },
      /**
       * Forget one tab's tree, for a tab record that is gone.
       * @param d - draft state.
       * @param tabId - the tab that went away.
       */
      forget: (d, tabId: TabId) => {
        d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId))
      },
    } satisfies DagTreeActions,
  })
}
