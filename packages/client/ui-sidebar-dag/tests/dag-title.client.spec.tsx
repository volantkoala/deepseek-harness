// @vitest-environment jsdom
/** The chip title: the chain glyph, then the type's label. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DagTitle } from '../src/client/DagTitle.tsx'

afterEach(cleanup)

function props(title: string): PropsRuntime<'sidebar.right.pane.tab.title'> {
  return { useTabInfo: () => ({ tab: { title } }) } as unknown as PropsRuntime<'sidebar.right.pane.tab.title'>
}

describe('DagTitle', () => {
  it('draws the chain glyph before the tab title text, sized to the chip line', () => {
    const { container } = render(<DagTitle {...props('对话地图')} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(container.textContent).toBe('对话地图')
    expect(svg?.nextSibling?.textContent).toBe('对话地图')
  })
})
