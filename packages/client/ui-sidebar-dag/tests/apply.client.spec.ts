/**
 * The plugin's registrations, and their removal when the plugin goes.
 *
 * The registry is real, because "registered" means what it says a type is; the
 * slot, locale, and Session faces are recorders, because what matters here is
 * what was handed to them and that every registration is gone after dispose,
 * which is what makes a reload safe.
 */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SidebarRightTabRegistry } from '@deepseek-ai/dsh-client-ui-sidebar-right/src/client/tab-registry.ts'
import { DAG_ID, DAG_KIND } from '../src/client/definition.tsx'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { en, zh } from '../src/client/locales.ts'

interface Recorded {
  name: string
  key: string
  locale: string
  store: unknown
  inject: unknown
  component: unknown
}

async function boot() {
  const ctx = new Context()
  const tabs = new SidebarRightTabRegistry(ctx)
  const registered: Recorded[] = []
  const slots = {
    inject: vi.fn((_name: string, register: () => () => void) => register()),
    register: vi.fn((options: Omit<Recorded, 'component'>, component: unknown) => {
      const entry: Recorded = { ...options, component }
      registered.push(entry)
      return () => { registered.splice(registered.indexOf(entry), 1) }
    }),
  }
  const dictionaries = new Map<string, unknown>()
  const locale = {
    // Copy is the dictionary's contract; the key stands in for the translation.
    bind: vi.fn(() => (key: string) => key),
    register: vi.fn((ns: string, dicts: unknown) => {
      dictionaries.set(ns, dicts)
      return () => { dictionaries.delete(ns) }
    }),
  }
  ctx.provide('sidebarRightTabs', tabs as never)
  ctx.provide('slots', slots as never)
  ctx.provide('locale', locale as never)
  ctx.provide('sessions', {} as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { tabs, registered, dictionaries, fiber }
}

describe('ui-sidebar-dag apply', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('registers the type and its dictionaries', async () => {
    const { tabs, dictionaries } = await boot()
    const definition = tabs.get(DAG_KIND)
    expect(definition?.id).toBe(DAG_ID)
    expect(definition?.priority).toBe('builtin')
    expect(definition?.title('')).toBe('type.label')
    expect(definition?.guide?.map(entry => [entry.order, entry.title(), entry.description?.()]))
      .toEqual([[20, 'guide.title', 'guide.description']])
    expect(dictionaries.get('sidebarDag')).toEqual({ zh, en })
  })

  it('registers the body under the type id, with its injected face, copy namespace, and tree store', async () => {
    const { registered } = await boot()
    const body = registered.find(entry => entry.name === 'sidebar.right.pane.tab')
    expect(body?.key).toBe(DAG_ID)
    expect(body?.locale).toBe('sidebarDag')
    // The editable tree's store: a store handle the framework mints per session.
    expect(typeof body?.store).toBe('object')
    expect(typeof body?.inject).toBe('function')
    const title = registered.find(entry => entry.name === 'sidebar.right.pane.tab.title')
    expect(title?.key).toBe(DAG_ID)
  })

  it('takes every registration back when the plugin is disposed', async () => {
    const { tabs, registered, dictionaries, fiber } = await boot()
    expect(registered.map(entry => entry.name))
      .toEqual(['sidebar.right.pane.tab', 'sidebar.right.pane.tab.title'])
    await fiber.dispose()
    expect(tabs.get(DAG_KIND)).toBeUndefined()
    expect(registered).toEqual([])
    expect(dictionaries.size).toBe(0)
  })
})
