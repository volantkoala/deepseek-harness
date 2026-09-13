// @vitest-environment jsdom
/**
 * The body's editable tree: a node renamed, a node hung under another, a
 * subtree folded, a node lifted and moved, and the way back to the chain.
 *
 * What is asserted is the reader's contract: an untouched tree draws the plain
 * chain, a renamed node shows its label over the prompt, a hang changes the
 * row depths without losing any Turn, a fold hides a subtree and the count
 * still says how many Turns the Session has, and the reset control returns the
 * tree to the outline order.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { zh } from '../src/client/locales.ts'
import { mountBody, outlineEntry } from './mount.client.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The chain's node buttons in document order, as Turn numbers. */
function nodes(view: RenderResult): number[] {
  return [...view.container.querySelectorAll('[data-dag-node]')]
    .filter(node => node.tagName === 'BUTTON')
    .map(node => Number(node.getAttribute('data-dag-node')))
}

/** One Turn's node button. */
function node(view: RenderResult, turn: number): HTMLButtonElement {
  const found = view.container.querySelector<HTMLButtonElement>(`[data-dag-node="${turn}"]`)
  if (found === null || found.tagName !== 'BUTTON') throw new Error(`the tree draws no node for Turn ${turn}`)
  return found
}

/** One Turn's row: its depth, and the buttons inside it. */
function rowOf(view: RenderResult, turn: number): HTMLElement {
  const found = view.container.querySelector<HTMLElement>(`[data-dag-row="${turn}"]`)
  if (found === null) throw new Error(`the tree draws no row for Turn ${turn}`)
  return found
}

/** One Turn's rendered depth. */
function depthOf(view: RenderResult, turn: number): number {
  return Number(rowOf(view, turn).getAttribute('data-dag-depth'))
}

/** One Turn's fold control, when its subtree can fold. */
function foldOf(view: RenderResult, turn: number): HTMLButtonElement | null {
  return rowOf(view, turn).querySelector<HTMLButtonElement>('button[aria-expanded]')
}

/** The reset-to-chain control in the header, or null while nothing is edited. */
function resetOf(view: RenderResult): HTMLButtonElement | null {
  return view.container.querySelector<HTMLButtonElement>('[data-dag-reset]')
}

/** The banner shown while a node waits to be hung. */
function attachBar(view: RenderResult): HTMLElement | null {
  return view.container.querySelector<HTMLElement>('[data-dag-attaching]')
}

describe('DagBody editable tree', () => {
  it('draws the plain chain before any edit', () => {
    const { view } = mountBody()
    expect(nodes(view)).toEqual([1, 2, 3])
    expect(depthOf(view, 1)).toBe(0)
    expect(depthOf(view, 2)).toBe(0)
    expect(depthOf(view, 3)).toBe(0)
    expect(resetOf(view)).toBeNull()
  })

  it('renames a node through its edit control, showing the label over the prompt', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-edit="2"]')!)
    // The rename field is the node's own input.
    const field = view.container.querySelector<HTMLInputElement>('input')
    expect(field).not.toBeNull()
    fireEvent.change(field!, { target: { value: 'the plan' } })
    fireEvent.keyDown(field!, { key: 'Enter' })
    expect(node(view, 2).textContent).toContain('the plan')
    expect(node(view, 2).textContent).not.toContain('second prompt')
    // A blank rename clears the label back to the prompt.
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-edit="2"]')!)
    fireEvent.change(view.container.querySelector<HTMLInputElement>('input')!, { target: { value: '' } })
    fireEvent.keyDown(view.container.querySelector<HTMLInputElement>('input')!, { key: 'Enter' })
    expect(node(view, 2).textContent).toContain('second prompt')
  })

  it('hangs a node under a target through the attach flow', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    expect(attachBar(view)).not.toBeNull()
    // Clicking the target completes the hang.
    fireEvent.click(node(view, 2))
    expect(attachBar(view)).toBeNull()
    expect(depthOf(view, 3)).toBe(1)
    expect(depthOf(view, 2)).toBe(0)
    expect(nodes(view)).toEqual([1, 2, 3])
    // The child row nests inside its parent's row.
    expect(rowOf(view, 2).contains(rowOf(view, 3))).toBe(true)
    expect(resetOf(view)).not.toBeNull()
  })

  it('refuses to hang a node under itself or its descendant', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="2"]')!)
    fireEvent.click(node(view, 2))
    expect(depthOf(view, 2)).toBe(0)
    expect(attachBar(view)).not.toBeNull()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    fireEvent.click(node(view, 2))
    // Turn 3 now hangs under 2; hanging 2 under 3 is a cycle and must fail.
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="2"]')!)
    fireEvent.click(node(view, 3))
    expect(depthOf(view, 2)).toBe(0)
    expect(depthOf(view, 3)).toBe(1)
    expect(attachBar(view)).not.toBeNull()
  })

  it('folds a subtree away and unfolds it again, the count unchanged', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    fireEvent.click(node(view, 2))
    const fold = foldOf(view, 2)
    expect(fold).not.toBeNull()
    fireEvent.click(fold!)
    expect(nodes(view)).toEqual([1, 2])
    expect(view.getByText(zh['count.other'].replace('{count}', '3'))).toBeTruthy()
    fireEvent.click(foldOf(view, 2)!)
    expect(nodes(view)).toEqual([1, 2, 3])
  })

  it('hangs a node under its previous sibling with the Tab key, and lifts it back out', () => {
    const { view } = mountBody()
    fireEvent.keyDown(node(view, 3), { key: 'Tab' })
    expect(depthOf(view, 3)).toBe(1)
    expect(depthOf(view, 2)).toBe(0)
    fireEvent.keyDown(node(view, 3), { key: 'Tab', shiftKey: true })
    expect(depthOf(view, 3)).toBe(0)
    expect(nodes(view)).toEqual([1, 2, 3])
  })

  it('moves a node among its siblings with the move controls', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-move-up="3"]')!)
    expect(nodes(view)).toEqual([1, 3, 2])
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-move-down="3"]')!)
    expect(nodes(view)).toEqual([1, 2, 3])
  })

  it('promotes a child back to the roots, right after its parent', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    fireEvent.click(node(view, 2))
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-promote="3"]')!)
    expect(depthOf(view, 3)).toBe(0)
    expect(nodes(view)).toEqual([1, 2, 3])
  })

  it('resets an edited tree back to the outline order', () => {
    const { view } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    fireEvent.click(node(view, 2))
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-move-up="2"]')!)
    // The pre-order walk draws Turn 2's child (3) before the following root (1).
    expect(nodes(view)).toEqual([2, 3, 1])
    fireEvent.click(resetOf(view)!)
    expect(nodes(view)).toEqual([1, 2, 3])
    expect(resetOf(view)).toBeNull()
  })

  it('still sends a pick to the conversation, and names an untitled node by its number', () => {
    const { view, openTurn } = mountBody()
    fireEvent.click(node(view, 2))
    expect(openTurn).toHaveBeenCalledExactlyOnceWith(2)
    expect(node(view, 3).textContent).toContain(zh['node.untitled'])
  })

  it('unfolds the way back to the current node when an ancestor hides it', () => {
    const { view } = mountBody({ reading: { activeTurn: 3, busyTurn: null } })
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    fireEvent.click(node(view, 2))
    // The reader scrolls the current row away: following stops, the way back
    // appears, and then the current node hides under a fold.
    const chain = view.container.querySelector<HTMLElement>('[data-dag-chain]')!
    const current = rowOf(view, 3)
    vi.spyOn(chain, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 300 } as DOMRect)
    vi.spyOn(current, 'getBoundingClientRect').mockReturnValue({ top: -200, bottom: -170 } as DOMRect)
    fireEvent.scroll(chain)
    fireEvent.click(foldOf(view, 2)!)
    expect(nodes(view)).toEqual([1, 2])
    // The way back unfolds the ancestors first, then reaches for the row.
    fireEvent.click(view.getByRole('button', { name: zh.backToCurrent }))
    expect(nodes(view)).toEqual([1, 2, 3])
  })

  it('keeps an edited tree across a projection refresh', () => {
    const { view, projection } = mountBody()
    fireEvent.click(view.container.querySelector<HTMLButtonElement>('[data-dag-attach="3"]')!)
    fireEvent.click(node(view, 2))
    expect(depthOf(view, 3)).toBe(1)
    act(() => {
      projection.set({
        turnOutline: [
          outlineEntry(1, 'first prompt', 'first answer'),
          outlineEntry(2, 'second prompt', 'second answer'),
          outlineEntry(3, 'third prompt', 'third answer'),
        ],
      })
    })
    expect(nodes(view)).toEqual([1, 2, 3])
    expect(depthOf(view, 3)).toBe(1)
  })
})
