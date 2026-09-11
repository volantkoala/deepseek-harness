/** The chain's pure half: the node list and the "is the current node visible" question. */
import { describe, expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { currentNodeVisible, turnNodes } from '../src/client/map.ts'

const entry = (turn: number, prompt: string, response = '') => ({
  turn, seq: SessionSeq(turn * 10), prompt, response,
})

describe('turnNodes', () => {
  it('reads every entry in outline order', () => {
    expect(turnNodes([entry(1, 'a'), entry(2, 'b', 'B')])).toEqual([
      { turn: 1, prompt: 'a', response: '' },
      { turn: 2, prompt: 'b', response: 'B' },
    ])
  })

  it('is empty when the projection is absent', () => {
    expect(turnNodes(undefined)).toEqual([])
  })
})

describe('currentNodeVisible', () => {
  const scroller = (top: number, bottom: number) => ({
    getBoundingClientRect: () => ({ top, bottom }) as DOMRect,
  } as HTMLElement)
  const row = (top: number, bottom: number) => ({
    getBoundingClientRect: () => ({ top, bottom }) as DOMRect,
  } as HTMLElement)

  it('is true for a row inside the scroller', () => {
    expect(currentNodeVisible(scroller(0, 300), row(120, 150))).toBe(true)
  })

  it('is false for a row above or below the scroller', () => {
    expect(currentNodeVisible(scroller(0, 300), row(-90, -60))).toBe(false)
    expect(currentNodeVisible(scroller(0, 300), row(320, 350))).toBe(false)
  })
})
