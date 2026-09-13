/** The editable tree's pure half: hierarchy edits and the render list they make. */
import { describe, expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit'
import { createDagTreeStore, descendantsOf, positionOf } from '../src/client/tree.ts'
import { treeNodes } from '../src/client/map.ts'
import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'

const TAB = 'tab-1' as TabId
const entry = (turn: number, prompt: string, response = ''): TurnOutlineEntry =>
  ({ turn, seq: SessionSeq(turn * 10), prompt, response })
/** Four Turns, so the specs can hang and lift without touching the edges. */
const OUTLINE = [entry(1, 'a'), entry(2, 'b'), entry(3, 'c'), entry(4, 'd')]

/** A fresh tab bucket, the way the framework mints one per session. */
function fresh() {
  const instance = createDagTreeStore().create('s-test')
  instance.actions.start(TAB)
  return instance
}

/** The render order a tree makes of the outline, as Turn numbers. */
function order(instance: ReturnType<typeof fresh>): number[] {
  const tab = instance.getSnapshot().byTab[TAB]!
  return treeNodes(OUTLINE, tab).map(node => node.turn)
}

describe('the editable tree store', () => {
  it('keeps an untouched tree reading exactly like the plain chain', () => {
    const instance = fresh()
    expect(order(instance)).toEqual([1, 2, 3, 4])
    expect(Object.keys(instance.getSnapshot().byTab[TAB]!.children)).toHaveLength(0)
  })

  it('hangs one Turn under another, at the end of its children', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    expect(order(instance)).toEqual([1, 2, 3, 4])
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 3)).toEqual({ parent: 2, at: 0 })
    // A second child lands after the first.
    instance.actions.attach(TAB, 4, 2, [1, 2, 3, 4])
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 4)).toEqual({ parent: 2, at: 1 })
  })

  it('refuses to hang a Turn under itself or one of its descendants', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    instance.actions.attach(TAB, 4, 3, [1, 2, 3, 4])
    instance.actions.attach(TAB, 3, 3, [1, 2, 3, 4])
    instance.actions.attach(TAB, 3, 4, [1, 2, 3, 4])
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 3)).toEqual({ parent: 2, at: 0 })
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 4)).toEqual({ parent: 3, at: 0 })
  })

  it('materialises an unedited root before an edit lands on it', () => {
    const instance = fresh()
    // 4 is unplaced: the edit first fixes the root order the map drew.
    instance.actions.attach(TAB, 4, 2, [1, 2, 3, 4])
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 4)).toEqual({ parent: 2, at: 0 })
  })

  it('lifts a Turn out of its parent, right after the parent', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    instance.actions.attach(TAB, 4, 3, [1, 2, 3, 4])
    expect(order(instance)).toEqual([1, 2, 3, 4])
    instance.actions.promote(TAB, 4, [1, 2, 3, 4])
    // 4 lifts out of 3, becoming 3's sibling under 2.
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 4)).toEqual({ parent: 2, at: 1 })
    expect(order(instance)).toEqual([1, 2, 3, 4])
    instance.actions.promote(TAB, 3, [1, 2, 3, 4])
    // 3 lifts out of 2, becoming 2's sibling at root; 4 stays under 2, so the
    // pre-order walk draws 4 before the lifted 3.
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 3)).toEqual({ parent: null, at: 2 })
    expect(order(instance)).toEqual([1, 2, 4, 3])
  })

  it('leaves a root Turn in place when promoted', () => {
    const instance = fresh()
    instance.actions.promote(TAB, 2, [1, 2, 3, 4])
    expect(positionOf(instance.getSnapshot().byTab[TAB]!, 2)).toBeNull()
    expect(order(instance)).toEqual([1, 2, 3, 4])
  })

  it('moves a Turn among its siblings, and stops at the edges', () => {
    const instance = fresh()
    instance.actions.move(TAB, 3, -1, [1, 2, 3, 4])
    expect(order(instance)).toEqual([1, 3, 2, 4])
    instance.actions.move(TAB, 3, -1, [1, 3, 2, 4])
    expect(order(instance)).toEqual([3, 1, 2, 4])
    instance.actions.move(TAB, 3, -1, [3, 1, 2, 4])
    expect(order(instance)).toEqual([3, 1, 2, 4])
    instance.actions.move(TAB, 3, 1, [3, 1, 2, 4])
    expect(order(instance)).toEqual([1, 3, 2, 4])
  })

  it('folds a subtree out of the render list, and unfolds it again', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    instance.actions.attach(TAB, 4, 3, [1, 2, 3, 4])
    instance.actions.toggle(TAB, 2)
    expect(order(instance)).toEqual([1, 2])
    instance.actions.toggle(TAB, 2)
    expect(order(instance)).toEqual([1, 2, 3, 4])
  })

  it('reads a new Turn as an unedited root, after the explicit roots', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    // A fifth Turn starts after the reader edited the tree.
    const outline = [...OUTLINE, entry(5, 'e')]
    const tab = instance.getSnapshot().byTab[TAB]!
    expect(treeNodes(outline, tab).map(node => node.turn)).toEqual([1, 2, 3, 4, 5])
  })

  it('names a Turn with a label, and clears it back to the prompt', () => {
    const instance = fresh()
    instance.actions.rename(TAB, 2, '  the plan  ')
    expect(instance.getSnapshot().byTab[TAB]!.labels[2]).toBe('the plan')
    instance.actions.rename(TAB, 2, '   ')
    expect(instance.getSnapshot().byTab[TAB]!.labels[2]).toBeUndefined()
  })

  it('reset drops every hierarchy edit, keeping the labels', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    instance.actions.rename(TAB, 3, 'kept')
    instance.actions.reset(TAB)
    expect(order(instance)).toEqual([1, 2, 3, 4])
    expect(instance.getSnapshot().byTab[TAB]!.labels[3]).toBe('kept')
  })

  it('knows a Turn\u2019s descendants', () => {
    const instance = fresh()
    instance.actions.attach(TAB, 3, 2, [1, 2, 3, 4])
    instance.actions.attach(TAB, 4, 3, [1, 2, 3, 4])
    const tree = instance.getSnapshot().byTab[TAB]!
    expect([...descendantsOf(tree, 2)]).toEqual([3, 4])
    expect([...descendantsOf(tree, 4)]).toEqual([])
    expect(positionOf(tree, 1)).toEqual({ parent: null, at: 0 })
    expect(positionOf(tree, 9)).toBeNull()
  })
})
