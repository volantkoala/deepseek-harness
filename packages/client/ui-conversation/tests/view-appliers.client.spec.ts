/** The request handoff between the service and a mounted Conversation shell. */
import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { ViewRequestAppliers } from '../src/client/view-appliers.ts'

const SESSION = SessionId('s-1')

describe('ViewRequestAppliers', () => {
  it('hands a request to the registered applier', () => {
    const appliers = new ViewRequestAppliers()
    const apply = vi.fn()
    appliers.register(SESSION, apply)
    appliers.applierFor(SESSION)?.({ kind: 'turn', view: 'chat', turn: 2 })
    expect(apply).toHaveBeenCalledWith({ kind: 'turn', view: 'chat', turn: 2 })
  })

  it('forgets the applier when its registration disposes', () => {
    const appliers = new ViewRequestAppliers()
    const dispose = appliers.register(SESSION, vi.fn())
    dispose()
    expect(appliers.applierFor(SESSION)).toBeUndefined()
  })

  it('keeps a later registration when an earlier one disposes', () => {
    const appliers = new ViewRequestAppliers()
    const first = appliers.register(SESSION, vi.fn())
    const second = vi.fn()
    appliers.register(SESSION, second)
    first()
    appliers.applierFor(SESSION)?.({ kind: 'turn', view: 'chat', turn: 1 })
    expect(second).toHaveBeenCalledOnce()
  })

  it('keeps every Session applier independent', () => {
    const appliers = new ViewRequestAppliers()
    const other = vi.fn()
    appliers.register(SessionId('s-2'), other)
    expect(appliers.applierFor(SESSION)).toBeUndefined()
    appliers.applierFor(SessionId('s-2'))?.({ kind: 'turn', view: 'chat', turn: 1 })
    expect(other).toHaveBeenCalledOnce()
  })
})
