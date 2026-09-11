/** The per-Session location source a Session map reads. */
import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { createChatViewLocations } from '../src/client/chat-view-location.ts'

const SESSION = SessionId('s-1')

describe('chat view locations', () => {
  it('reports an empty location before any Chat view mounts', () => {
    const locations = createChatViewLocations()
    expect(locations.location(SESSION).getSnapshot()).toEqual({ activeTurn: null, busyTurn: null })
  })

  it('keeps one stable source per Session', () => {
    const locations = createChatViewLocations()
    expect(locations.location(SESSION)).toBe(locations.location(SESSION))
    expect(locations.location(SESSION)).not.toBe(locations.location(SessionId('s-2')))
  })

  it('publishes what the mounted view writes', () => {
    const locations = createChatViewLocations()
    const source = locations.location(SESSION)
    const seen: unknown[] = []
    source.subscribe(() => { seen.push(source.getSnapshot()) })
    locations.storeFor(SESSION).set({ activeTurn: 3, busyTurn: null })
    expect(seen).toEqual([{ activeTurn: 3, busyTurn: null }])
  })
})
