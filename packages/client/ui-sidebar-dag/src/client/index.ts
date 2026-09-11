/**
 * Browser half: register `dag` as a right-Sidebar tab type.
 *
 * Stage one of the public path: the type into `ctx.sidebarRightTabs`, and its
 * dictionaries into `ctx.locale`. That `id` is the key the type's body and its
 * chip title register under in the keyed `sidebar.right.pane.tab` and
 * `sidebar.right.pane.tab.title` seats.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { dagDefinition } from './definition.tsx'
import { en, zh } from './locales.ts'

export type { SidebarDagKey } from './locales.ts'

/** This package's copy namespace. */
const NS = 'sidebarDag'

/** Required browser services: the tab registry, the keyed seats, the Session kit, and copy. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sessions']

/**
 * Client plugin body: register the type and its dictionaries.
 * @param ctx - client root context carrying the registry, the slots, and copy.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sidebarRightTabs.register(dagDefinition(t)), 'ui-sidebar-dag: dag type')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar-dag: dictionaries')
}
