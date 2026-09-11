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
 * @param ctx - the plugin's context, read at each ask so a late service is seen.
 * @returns the inject factory the body registration declares.
 */
export function dagInject(ctx: Context): (sessionId: SessionId) => DagInjected {
  return sessionId => ({
    openTurn: (turn) => {
      const scope = ctx.sessions.scope(sessionId)
      // A row is only drawn for a Session the sidebar is showing, so a scope
      // that resolves nothing is a wiring fault rather than a race to ignore.
      if (scope === undefined) {
        throw new Error(`ui-sidebar-dag: session "${sessionId}" resolved no scope`)
      }
      scope.conversation.requestView({ kind: 'turn', view: CHAT_VIEW, turn })
    },
    location: ctx.get('chatView')?.location(sessionId),
  })
}
