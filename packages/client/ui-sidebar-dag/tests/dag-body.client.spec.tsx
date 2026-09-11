// @vitest-environment jsdom
/**
 * The body over a switchable outline and reading position.
 *
 * What is asserted is the reader's contract: one node per started Turn in
 * outline order, the current Turn marked and expanded while the others stay one
 * line, a pick sent to the conversation as that Turn, a chain a keyboard can
 * walk, and a map that follows the current node until the reader scrolls away
 * from it — after which it offers the way back instead. The two empty states
 * are separate lines, as the dictionary says they are.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import css from '../src/client/DagBody.module.css'
import { zh } from '../src/client/locales.ts'
import { mountBody, outlineEntry, reading, SESSION } from './mount.client.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  // jsdom implements no layout method at all; a spec that installed one hands
  // the prototype back the way it found it.
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

/** The chain's node buttons in document order, as Turn numbers. */
function nodes(view: RenderResult): number[] {
  return [...view.container.querySelectorAll('[data-dag-node]')]
    .map(node => Number(node.getAttribute('data-dag-node')))
}

/** One Turn's node button. */
function node(view: RenderResult, turn: number): HTMLButtonElement {
  const found = view.container.querySelector<HTMLButtonElement>(`[data-dag-node="${turn}"]`)
  if (found === null) throw new Error(`the chain draws no node for Turn ${turn}`)
  return found
}

/** One Turn's list row. */
function rowOf(view: RenderResult, turn: number): HTMLElement {
  const found = view.container.querySelector<HTMLElement>(`[data-dag-row="${turn}"]`)
  if (found === null) throw new Error(`the chain draws no row for Turn ${turn}`)
  return found
}

/** The map's own scrollport. */
function chainOf(view: RenderResult): HTMLElement {
  const found = view.container.querySelector<HTMLElement>('[data-dag-chain]')
  if (found === null) throw new Error('the map draws no chain')
  return found
}

/** One element's class names, resolved through the stylesheet module. */
function classesOf(element: Element): string[] {
  return element.getAttribute('class')?.split(' ') ?? []
}

/** Give one element a viewport box: jsdom lays nothing out, so specs state the geometry. */
function box(element: Element, top: number, bottom: number): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top, bottom } as DOMRect)
}

/** Stand in for the layout method jsdom does not implement, and record its calls. */
function installScrollIntoView(): Mock<(options?: ScrollIntoViewOptions) => void> {
  const spy = vi.fn<(options?: ScrollIntoViewOptions) => void>()
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: spy })
  return spy
}

/** The way back to the current node, or null while the map is following. */
function wayBack(view: RenderResult): HTMLElement | null {
  return view.queryByRole('button', { name: zh.backToCurrent })
}

/** Bring the reader to one Turn's row by focusing its node. */
function focusNode(view: RenderResult, turn: number): void {
  const button = node(view, turn)
  act(() => { button.focus() })
}

describe('DagBody chain', () => {
  it('reads the outline as one node per Turn in ascending order, each with its prompt preview', () => {
    const { view } = mountBody()
    expect(nodes(view)).toEqual([1, 2, 3])
    expect(node(view, 1).textContent).toBe('1first prompt')
    expect(node(view, 2).textContent).toBe('2second prompt')
    expect(view.container.querySelector('[data-dag-session]')?.getAttribute('data-dag-session')).toBe(SESSION)
    expect(view.container.querySelector('[data-dag-state]')?.getAttribute('data-dag-state')).toBe('map')
    expect(view.getByText(zh['count.other'].replace('{count}', '3'))).toBeTruthy()
  })

  it('counts one Turn in the singular and many in the plural', () => {
    const single = mountBody({ outline: [outlineEntry(1, 'only prompt', 'only answer')], locale: 'en' })
    expect(single.view.getByText('1 turn')).toBeTruthy()
    expect(single.view.queryByText('1 turns')).toBeNull()
    const many = mountBody({ locale: 'en' })
    expect(many.view.getByText('3 turns')).toBeTruthy()
  })

  it('names a Turn whose prompt carries no text by its number', () => {
    const { view } = mountBody()
    expect(node(view, 3).textContent).toBe(`3${zh['node.untitled']}`)
    // The copy is the dictionary's, and only the prompt-less Turn carries it.
    expect(view.getAllByText(zh['node.untitled'])).toHaveLength(1)
  })

  it('marks the current Turn, and expands its response preview alone', () => {
    const { view } = mountBody({ reading: { activeTurn: 2, busyTurn: null } })
    expect(node(view, 2).getAttribute('aria-current')).toBe('true')
    expect(node(view, 1).hasAttribute('aria-current')).toBe(false)
    expect(node(view, 3).hasAttribute('aria-current')).toBe(false)
    expect(classesOf(node(view, 2))).toContain(css.current)
    expect(classesOf(node(view, 1))).not.toContain(css.current)
    expect(view.getByText('second answer')).toBeTruthy()
    expect(view.queryByText('first answer')).toBeNull()
  })

  it('keeps a generating Turn in its place, and expands it when its response lands', () => {
    const outline = [outlineEntry(1, 'first prompt', 'first answer'), outlineEntry(2, 'second prompt')]
    const { view, projection } = mountBody({ outline, reading: { activeTurn: 2, busyTurn: 2 } })
    expect(nodes(view)).toEqual([1, 2])
    expect(view.queryByText('second answer')).toBeNull()

    act(() => {
      projection.set({
        turnOutline: [
          outlineEntry(1, 'first prompt', 'first answer'),
          outlineEntry(2, 'second prompt', 'second answer'),
        ],
      })
    })
    expect(nodes(view)).toEqual([1, 2])
    expect(view.getByText('second answer')).toBeTruthy()
  })

  it('sends a pick to the conversation as that Turn', () => {
    const { view, openTurn } = mountBody()
    fireEvent.click(node(view, 2))
    expect(openTurn).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('draws the landing state on a Turn a jump is in flight for', () => {
    const { view } = mountBody({ reading: { activeTurn: null, busyTurn: 3 } })
    expect(classesOf(node(view, 3))).toContain(css.busy)
    expect(classesOf(node(view, 1))).not.toContain(css.busy)
    expect(classesOf(node(view, 2))).not.toContain(css.busy)
  })

  it('walks the chain with the arrow, Home and End keys, and keeps one row tabbable', () => {
    const { view } = mountBody({ reading: { activeTurn: 3, busyTurn: null } })
    const tabbable = (): number[] => nodes(view).filter(turn => node(view, turn).tabIndex === 0)
    // The current Turn holds the tab stop until the reader moves the focus.
    expect(tabbable()).toEqual([3])

    focusNode(view, 1)
    expect(tabbable()).toEqual([1])
    fireEvent.keyDown(node(view, 1), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(node(view, 2))
    expect(tabbable()).toEqual([2])
    fireEvent.keyDown(node(view, 2), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(node(view, 1))
    fireEvent.keyDown(node(view, 1), { key: 'End' })
    expect(document.activeElement).toBe(node(view, 3))
    fireEvent.keyDown(node(view, 3), { key: 'Home' })
    expect(document.activeElement).toBe(node(view, 1))

    // The ends are walls, and a key the chain does not navigate on moves nothing.
    fireEvent.keyDown(node(view, 1), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(node(view, 1))
    fireEvent.keyDown(node(view, 3), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(node(view, 1))
    fireEvent.keyDown(node(view, 1), { key: 'a' })
    expect(document.activeElement).toBe(node(view, 1))
  })

  it('follows the current node, and offers the way back once the reader scrolls it away', () => {
    const scrollIntoView = installScrollIntoView()
    const { view } = mountBody({ reading: { activeTurn: 2, busyTurn: null } })
    const chain = chainOf(view)
    const current = rowOf(view, 2)
    box(chain, 0, 300)
    box(current, 120, 150)

    // Following from the start: the map has moved the current row into view.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    expect(wayBack(view)).toBeNull()

    fireEvent.scroll(chain)
    expect(wayBack(view)).toBeNull()

    // The reader scrolls the map past the current node: the map stops moving
    // under them, and says how to get back.
    box(current, -200, -170)
    fireEvent.scroll(chain)
    const back = wayBack(view)
    expect(back).not.toBeNull()

    scrollIntoView.mockClear()
    fireEvent.click(back!)
    expect(scrollIntoView.mock.calls[0]).toEqual([{ block: 'nearest' }])
    expect(wayBack(view)).toBeNull()
  })

  it('follows the current node as the reading position advances', () => {
    const scrollIntoView = installScrollIntoView()
    const mounted = mountBody({ reading: { activeTurn: 1, busyTurn: null } })
    const first = rowOf(mounted.view, 1)
    const next = rowOf(mounted.view, 2)
    expect(scrollIntoView.mock.contexts[0]).toBe(first)

    act(() => { reading(mounted).set({ activeTurn: 2, busyTurn: null }) })
    // The map moved to the row that just became current, and marked it as such.
    expect(scrollIntoView.mock.contexts[1]).toBe(next)
    expect(node(mounted.view, 2).getAttribute('aria-current')).toBe('true')
    expect(node(mounted.view, 1).hasAttribute('aria-current')).toBe(false)
    expect(mounted.view.getByText('second answer')).toBeTruthy()
  })

  it('keeps a tab stop when the outline drops the row the reader was on', () => {
    const { view, projection } = mountBody({ reading: { activeTurn: 2, busyTurn: null } })
    focusNode(view, 3)
    expect(node(view, 3).tabIndex).toBe(0)

    act(() => {
      projection.set({
        turnOutline: [
          outlineEntry(1, 'first prompt', 'first answer'),
          outlineEntry(2, 'second prompt', 'second answer'),
        ],
      })
    })
    expect(nodes(view)).toEqual([1, 2])
    // The focus went with its row; the tab stop falls back to the current Turn.
    expect(nodes(view).filter(turn => node(view, turn).tabIndex === 0)).toEqual([2])
  })

  it('leaves the way back harmless when the current Turn has left the chain', () => {
    const scrollIntoView = installScrollIntoView()
    const mounted = mountBody({ reading: { activeTurn: 2, busyTurn: null } })
    const chain = chainOf(mounted.view)
    box(chain, 0, 300)
    box(rowOf(mounted.view, 2), -200, -170)
    fireEvent.scroll(chain)
    const back = wayBack(mounted.view)
    expect(back).not.toBeNull()

    // History moves under the map: the chain drops the Turn the Chat view still
    // reports as current. No row is current, and the control must not reach for
    // one that is gone.
    act(() => {
      mounted.projection.set({ turnOutline: [outlineEntry(1, 'first prompt', 'first answer')] })
    })
    expect(mounted.view.container.querySelector('[aria-current]')).toBeNull()
    scrollIntoView.mockClear()
    fireEvent.click(back!)
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(wayBack(mounted.view)).toBeNull()
  })

  it('offers the way back while a Turn is current, and not once no Turn is', () => {
    const mounted = mountBody({ reading: { activeTurn: 2, busyTurn: null } })
    const chain = chainOf(mounted.view)
    box(chain, 0, 300)
    box(rowOf(mounted.view, 2), -200, -170)
    fireEvent.scroll(chain)
    // Following is suspended with a Turn current: the way back is offered.
    expect(wayBack(mounted.view)).not.toBeNull()

    // The Chat view unmounts (the reader selected another Conversation view) and
    // the location clears: with no current Turn there is nothing to stop
    // following and nothing to offer.
    act(() => { reading(mounted).set({ activeTurn: null, busyTurn: null }) })
    expect(wayBack(mounted.view)).toBeNull()
  })

  it('follows without motion where the reader asked for none', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' })))
    const scrollIntoView = installScrollIntoView()
    mountBody({ reading: { activeTurn: 1, busyTurn: null } })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
  })

  it('says the deployment has no outline rather than that the Session has no Turns', () => {
    const absent = mountBody({ outline: undefined })
    expect(absent.view.getByText(zh.noProjection)).toBeTruthy()
    expect(absent.view.container.querySelector('[data-dag-state]')?.getAttribute('data-dag-state')).toBe('empty')
    expect(absent.view.queryByText(zh.empty)).toBeNull()
  })

  it('says the Session has no Turns yet when the outline is empty, and draws no chain', () => {
    const none = mountBody({ outline: [] })
    expect(none.view.getByText(zh.empty)).toBeTruthy()
    expect(none.view.queryByText(zh.noProjection)).toBeNull()
    expect(none.view.container.querySelector('[data-dag-chain]')).toBeNull()
  })

  it('draws no current mark without a reading position', () => {
    const unbound = mountBody({ withLocation: false })
    expect(nodes(unbound.view)).toEqual([1, 2, 3])
    expect(unbound.location).toBeUndefined()
    expect(unbound.view.container.querySelector('[aria-current]')).toBeNull()

    const idle = mountBody({ reading: { activeTurn: null, busyTurn: null } })
    expect(nodes(idle.view)).toEqual([1, 2, 3])
    expect(idle.view.container.querySelector('[aria-current]')).toBeNull()
    // With nothing current there is nothing to stop following, and no way back to offer.
    fireEvent.scroll(chainOf(idle.view))
    expect(wayBack(idle.view)).toBeNull()
  })
})
