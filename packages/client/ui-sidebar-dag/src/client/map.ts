/**
 * The chain's pure half: the node list a projection yields, and the one
 * geometry question the follow behaviour asks.
 *
 * Nodes are a projection of the outline, not a second model: nothing is
 * derived, reordered, or bounded here. Previews arrive bounded from the host,
 * and a Turn whose prompt is empty (an image-only prompt) keeps its place in
 * the chain, unnamed but numbered.
 */
import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'

/** One node of the chain. */
export interface TurnNode {
  /** 1-based Turn number, the node's identity and its address in a request. */
  readonly turn: number
  /** Bounded prompt preview; `''` for a Turn whose prompt carries no text. */
  readonly prompt: string
  /** Bounded response preview; `''` until the Turn settles with assistant text. */
  readonly response: string
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
