/**
 * Where the mounted Chat view is reading, published for Session surfaces
 * outside the transcript (the right Sidebar's turn map is the first).
 *
 * This is view state, not transcript data: it changes with the reader's
 * scroll position and with a jump in flight, never with the event log. A
 * Session whose Chat view is not mounted reports an empty location, so a
 * consumer never highlights a position nothing is showing.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One Session's reading position inside the Chat transcript. */
export interface ChatViewLocation {
  /** Turn at the reading line; `null` while no Chat view is mounted. */
  readonly activeTurn: number | null
  /** Turn a jump is currently landing on; `null` when none is in flight. */
  readonly busyTurn: number | null
}

/** The client service the browser Context exposes as `ctx.chatView`. */
export interface IChatView {
  /**
   * Read one Session's location source.
   * @param sessionId - Session to ask about.
   * @returns the stable source for that Session.
   */
  location(sessionId: SessionId): ObservableSnapshot<ChatViewLocation>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Per-Session Chat view reading position, for surfaces outside the transcript. */
    chatView: import('./chat-view-location.ts').IChatView
  }
}

/** The empty location a Session reports while no Chat view is mounted, and the one the view publishes as it unmounts. */
export const EMPTY_LOCATION: ChatViewLocation = { activeTurn: null, busyTurn: null }

/** Location registry plus the per-Session stores the Chat view writes. */
export interface ChatViewLocations extends IChatView {
  /**
   * The writable store for one Session, minted on first ask.
   * @param sessionId - Session whose view is writing.
   * @returns the store the view publishes through.
   */
  storeFor(sessionId: SessionId): SnapshotStore<ChatViewLocation>
}

/**
 * Create the location registry.
 * @returns the registry to provide as `ctx.chatView`.
 */
export function createChatViewLocations(): ChatViewLocations {
  const stores = new Map<SessionId, SnapshotStore<ChatViewLocation>>()
  const storeFor = (sessionId: SessionId): SnapshotStore<ChatViewLocation> => {
    let store = stores.get(sessionId)
    if (store === undefined) {
      store = createSnapshotStore<ChatViewLocation>(EMPTY_LOCATION)
      stores.set(sessionId, store)
    }
    return store
  }
  return { storeFor, location: sessionId => storeFor(sessionId) }
}
