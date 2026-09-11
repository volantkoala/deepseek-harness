/**
 * Browser half: register `dag` as a right-Sidebar tab type.
 *
 * The public two-stage path: the type into `ctx.sidebarRightTabs` and its
 * dictionaries into `ctx.locale`, then the type's `id` as the key its body and
 * its chip title register under in the keyed `sidebar.right.pane.tab` and
 * `sidebar.right.pane.tab.title` seats. The body is handed the injected face
 * that moves the Session's conversation.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { DagBody } from './DagBody.tsx'
import { DagTitle } from './DagTitle.tsx'
import { DAG_ID, dagDefinition } from './definition.tsx'
import { dagInject } from './face.ts'
import { en, zh } from './locales.ts'

export type { SidebarDagKey } from './locales.ts'

/** This package's copy namespace. */
const NS = 'sidebarDag'

/** Required browser services: the tab registry, the keyed seats, the Session kit, and copy. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sessions']

/**
 * Client plugin body: register the type, its dictionaries, its body, and its chip title.
 * @param ctx - client root context carrying the registry, the slots, and copy.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sidebarRightTabs.register(dagDefinition(t)), 'ui-sidebar-dag: dag type')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar-dag: dictionaries')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: DAG_ID, locale: NS, inject: dagInject(ctx) },
    DagBody,
  )), 'ui-sidebar-dag: dag tab body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: DAG_ID },
    DagTitle,
  )), 'ui-sidebar-dag: dag tab title')
}
