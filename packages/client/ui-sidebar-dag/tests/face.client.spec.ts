/** The map's injected face: what a click asks the conversation to do. */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { dagInject } from '../src/client/face.ts'

const SESSION = SessionId('s-1')

function boot(options: { scope?: boolean } = {}) {
  const ctx = new Context()
  const requestView = vi.fn()
  ctx.provide('sessions', {
    scope: () => (options.scope === false ? undefined : { conversation: { requestView } }),
  } as never)
  return { ctx, requestView }
}

describe('dagInject', () => {
  it('addresses the chat view at the clicked turn', () => {
    const { ctx, requestView } = boot()
    dagInject(ctx)(SESSION).openTurn(7)
    expect(requestView).toHaveBeenCalledWith({ kind: 'turn', view: 'chat', turn: 7 })
  })

  it('fails loud when the Session has no scope', () => {
    const { ctx } = boot({ scope: false })
    expect(() => { dagInject(ctx)(SESSION).openTurn(7) }).toThrow(/resolved no scope/)
  })

  it('reads the Chat view location when one is published, and nothing when none is', () => {
    const { ctx } = boot()
    expect(dagInject(ctx)(SESSION).location).toBeUndefined()
    const location = { getSnapshot: () => ({ activeTurn: 2, busyTurn: null }), subscribe: () => () => {} }
    ctx.provide('chatView', { location: () => location } as never)
    expect(dagInject(ctx)(SESSION).location).toBe(location)
  })
})
