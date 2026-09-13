/**
 * The chain's pure half: the node list a projection yields, the tree the
 * reader's edits make of it, and the geometry question the follow behaviour
 * asks.
 *
 * Nodes are a projection of the outline, not a second model: nothing is
 * derived, reordered, or bounded here beyond the reader's hierarchy, which the
 * editable tree contributes. Previews arrive bounded from the host, and a Turn
 * whose prompt is empty (an image-only prompt) keeps its place in the tree,
 * unnamed but numbered.
 */
import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'
import type { DagTreeTabState } from './tree.ts'

/** One node of the chain. */
export interface TurnNode {
  /** 1-based Turn number, the node's identity and its address in a request. */
  readonly turn: number
  /** Bounded prompt preview; `''` for a Turn whose prompt carries no text. */
  readonly prompt: string
  /** Bounded response preview; `''` until the Turn settles with assistant text. */
  readonly response: string
}

/** One node of the reader's tree: the chain facts plus where it sits and how it reads. */
export interface RenderTurnNode extends TurnNode {
  /** The Turn it hangs under, or null at the root level. */
  readonly parent: number | null
  /** Levels from the root; the root level is 0. */
  readonly depth: number
  /** Whether it has children in the tree, folded or not. */
  readonly hasChildren: boolean
  /** Whether its subtree is folded right now. */
  readonly folded: boolean
  /** The reader's label covering the prompt preview, when one is set. */
  readonly label: string | undefined
}

/**
 * Read the outline as chain nodes.
 * @param entries - the `turnOutline` projection value, or undefined when the deployment has none.
 * @returns every Turn in outline order; a stable empty array when there is no outline.
 */
export function turnNodes(entries: readonly TurnOutlineEntry[] | undefined): readonly TurnNode[] {
  if (entries === undefined) return []
  return entries.map(entry => ({ turn: entry.turn, prompt: entry.prompt, response: entry.response }))
}

/**
 * Read the outline through the reader's tree: every Turn exactly once, in the
 * tree's order, with folded subtrees left out.
 *
 * Roots are the tree's explicit root list, then every Turn the tree never
 * placed, in outline order — so an untouched tree reads exactly like the plain
 * outline, and a Turn born after the reader last edited joins the roots at the
 * end. A child list naming a Turn the outline does not know is skipped: the
 * outline stays the single source of truth.
 * @param entries - the `turnOutline` projection value, or undefined when the deployment has none.
 * @param tree - the reader's tree for this tab, or undefined before it is seeded.
 * @returns the render order, depth first; a stable empty array when there is no outline.
 */
export function treeNodes(
  entries: readonly TurnOutlineEntry[] | undefined,
  tree: DagTreeTabState | undefined,
): readonly RenderTurnNode[] {
  if (entries === undefined) return []
  const byTurn = new Map(entries.map(entry => [entry.turn, entry]))
  const placed = new Set<number>()
  const out: RenderTurnNode[] = []
  // A folded subtree belongs to its parent: its Turns are placed but not drawn,
  // so the root pass never picks them up as unedited roots.
  const markPlaced = (turn: number): void => {
    if (placed.has(turn)) return
    placed.add(turn)
    for (const child of tree?.children[String(turn)] ?? []) markPlaced(child)
  }
  const visit = (turn: number, parent: number | null, depth: number): void => {
    if (placed.has(turn)) return
    placed.add(turn)
    const entry = byTurn.get(turn)
    if (entry === undefined) return
    const kids = tree?.children[String(turn)] ?? []
    const folded = tree?.collapsed.includes(turn) ?? false
    out.push({
      turn: entry.turn,
      prompt: entry.prompt,
      response: entry.response,
      parent,
      depth,
      hasChildren: kids.length > 0,
      folded,
      label: tree?.labels[entry.turn],
    })
    if (folded) {
      for (const child of kids) markPlaced(child)
    } else {
      for (const child of kids) visit(child, turn, depth + 1)
    }
  }
  for (const turn of tree?.children['root'] ?? []) visit(turn, null, 0)
  for (const entry of entries) visit(entry.turn, null, 0)
  return out
}

/**
 * The Turns between one Turn and the root, nearest first, for the way-back
 * control to unfold before it scrolls.
 * @param tree - the reader's tree for this tab.
 * @param turn - the Turn to reach.
 * @returns its ancestors from the parent up to the root; empty for a root Turn.
 */
export function ancestorsOf(tree: DagTreeTabState | undefined, turn: number): readonly number[] {
  if (tree === undefined) return []
  const out: number[] = []
  const seen = new Set<number>()
  let parent = null
  for (const [key, list] of Object.entries(tree.children)) {
    if (list.includes(turn)) {
      parent = key === 'root' ? null : Number(key)
      break
    }
  }
  while (parent !== null && !seen.has(parent)) {
    seen.add(parent)
    out.unshift(parent)
    let next: number | null = null
    for (const [key, list] of Object.entries(tree.children)) {
      if (list.includes(parent)) {
        next = key === 'root' ? null : Number(key)
        break
      }
    }
    parent = next
  }
  return out
}

/**
 * Whether the current node is inside the map's own scrollport.
 * @param scroller - the scrolling element.
 * @param row - the current node's row.
 * @returns true when any part of the row is visible.
 */
export function currentNodeVisible(scroller: HTMLElement, row: HTMLElement): boolean {
  const box = scroller.getBoundingClientRect()
  const mark = row.getBoundingClientRect()
  return mark.bottom > box.top && mark.top < box.bottom
}
