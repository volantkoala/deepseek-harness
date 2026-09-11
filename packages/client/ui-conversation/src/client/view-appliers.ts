/**
 * Per-Session appliers for view requests that arrive from outside the
 * Conversation shell.
 *
 * The shell owns the store that holds the live request, so it is the only
 * writer; this registry is how a request reaches it. A Session whose shell is
 * not mounted has no applier, and the caller is told rather than ignored.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConversationViewRequest } from './contract/views.ts'

/** Apply one request inside a mounted Conversation shell. */
export type ViewRequestApplier = (request: ConversationViewRequest) => void

/**
 * Session-keyed handoff from the conversation service to the mounted shell.
 * One applier per Session, last registration winning: a newer shell replaces an
 * older one, and the registration that currently owns the entry clears it on
 * disposal without restoring the older shell, so an older shell that is still
 * mounted has no applier and requests to that Session fail loud.
 */
export class ViewRequestAppliers {
  private readonly bySession = new Map<SessionId, ViewRequestApplier>()

  /**
   * Register the applier for one Session, replacing any earlier one.
   * @param sessionId - Session whose shell is mounting.
   * @param apply - the shell's apply callback.
   * @returns disposer that clears the slot only while this registration owns it.
   */
  register(sessionId: SessionId, apply: ViewRequestApplier): () => void {
    this.bySession.set(sessionId, apply)
    return () => {
      if (this.bySession.get(sessionId) === apply) this.bySession.delete(sessionId)
    }
  }

  /**
   * Read one Session's applier.
   * @param sessionId - Session to ask about.
   * @returns the mounted shell's applier, or undefined when none is mounted.
   */
  applierFor(sessionId: SessionId): ViewRequestApplier | undefined {
    return this.bySession.get(sessionId)
  }
}
