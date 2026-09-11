/**
 * The map's injected face: how a row reaches the conversation, and where the
 * Chat view currently is.
 *
 * `chat` is ui-conversation's default Conversation View id. A client bundle
 * cannot import another plugin's constants, so it is spelled here once; the
 * conversation is reached through its service, and the Chat view's location
 * through the optional `chatView` service.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { DagInjected } from './DagBody.tsx'

/** The Conversation View the map moves: the turn-based transcript. */
const CHAT_VIEW = 'chat'

/**
 * Build the per-Session injected face.
 *
 * The renderer builds one face per entry and Session binding, so `location` is
 * the answer at that build: a `chatView` published later reaches only the faces
 * built after it.
 * @param ctx - the plugin's context.
 * @returns the inject factory the body registration declares.
 */
export function dagInject(ctx: Context): (sessionId: SessionId) => DagInjected {
  return sessionId => ({
    openTurn: (turn) => {
      const scope = ctx.sessions.scope(sessionId)
      // A Session pruned or no longer listed leaves the row it drew with no
      // scope to address.
      if (scope === undefined) {
        throw new Error(`ui-sidebar-dag: session "${sessionId}" resolved no scope`)
      }
      // The scope's fiber reaches only its own ancestors, while the Conversation
      // service is provided by a sibling entry, so the property proxy cannot see
      // it; the strict get reads the service store instead.
      const conversation = scope.get('conversation')
      if (conversation === undefined) {
        throw new Error(`ui-sidebar-dag: session "${sessionId}" resolved no conversation service`)
      }
      conversation.requestView({ kind: 'turn', view: CHAT_VIEW, turn })
    },
    location: ctx.get('chatView')?.location(sessionId),
  })
}
