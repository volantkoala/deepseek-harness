// @vitest-environment jsdom
/**
 * The map and its jump through the assembled web client.
 *
 * The unit suites drive the body and its injected face against fakes; this one
 * boots the whole browser roster, opens one Session whose host projection
 * carries recorded Turns, shows the dag page in the real right Sidebar, and
 * asserts what the reader gets: a chain drawn from the Session's own turn
 * outline, and a node click the conversation accepts — including the click that
 * returns it from another registered view to Chat.
 *
 * The transcript's reading position is out of reach here: jsdom reports zero
 * scroll geometry, so ChatView's follower reads the transcript as pinned to the
 * bottom and re-publishes the newest Turn over a landed one. Which Turn a click
 * lands on is pinned against real layout by `apps/web/tests/dag-learn-turn-map.e2e.ts`.
 *
 * Only the Host is mocked: the Session list, the reads a selected Session
 * makes, and the follow stream carrying the log and its projection baseline.
 */
import { describe, expect, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { ok, openStream, type RemoteMock } from '@deepseek-ai/dsh-remote-mock'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { createClientTest, type TestClient, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import type { SessionFollowFrame, SessionWireEvent } from '@deepseek-ai/dsh-api-session-controller/types'
import {
  SESSION_FORMAT_VERSION, SessionSeq, type SessionEventMap, type SessionEventType, type SessionId,
  type SurfaceEventType,
} from '@deepseek-ai/dsh-session/types'
import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'
import { DAG_KIND } from '../src/client/definition.tsx'
import { en } from '../src/client/locales.ts'

const it = createClientTest({ roster: webApp }, { mount: true })
/** The whole roster's first boot pays the cold module transform of every plugin package. */
const COLD_BOOT_TIMEOUT_MS = 60_000
const SID = 'dag-map-1' as SessionId
/** How long an assembled-client assertion waits for its React and stream work. */
const SETTLE_TIMEOUT_MS = 10_000
/** The Conversation views this spec switches between, by the ids their packages register. */
const CHAT_VIEW = 'chat'
const TRAJECTORY_VIEW = 'trajectory'
/** The Session's recorded Turns, as the log carries them. */
const TURNS = [
  { prompt: 'first prompt', response: 'first answer' },
  { prompt: 'second prompt', response: 'second answer' },
  { prompt: 'third prompt', response: 'third answer' },
] as const
/** Events one recorded Turn occupies; every Turn starts on this boundary. */
const EVENTS_PER_TURN = 6

/**
 * One logged event before its sequence is stamped: the payload is the event
 * map's own, and a message-producing event carries its append operation, so a
 * field the host always records cannot be left out unnoticed. The mapped union
 * keeps each type paired with its own payload.
 */
type LoggedEvent = {
  [K in SessionEventType]: {
    readonly type: K
    readonly data: SessionEventMap[K]
  } & (K extends SurfaceEventType ? { readonly surfaceOp: 'append' } : { readonly surfaceOp?: never })
}[SessionEventType]

/**
 * One recorded plain Turn: its boundary, prompt, one step, and its response.
 * @param turn - Turn number, ascending from one.
 * @param prompt - the Turn's human prompt text.
 * @param response - the Turn's final assistant text.
 * @returns the wire events in seq order.
 */
function turnEvents(turn: number, prompt: string, response: string): SessionWireEvent[] {
  const base = (turn - 1) * EVENTS_PER_TURN
  // The event map types every payload; the journal widens it to its own JSON
  // envelope, which is the boundary this fixture crosses.
  const at = (offset: number, event: LoggedEvent): SessionWireEvent =>
    ({ ...event, seq: base + offset, time: base + offset }) as SessionWireEvent
  return [
    at(0, { type: 'turn/start', data: { turn } }),
    at(1, {
      type: 'user/message',
      surfaceOp: 'append',
      data: createUserMessage({
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      }),
    }),
    at(2, { type: 'step/start', data: { turn, step: 0 } }),
    at(3, {
      type: 'assistant/message',
      surfaceOp: 'append',
      data: {
        turn,
        step: 0,
        // The durable compact stream the host records beside the message.
        stream: [
          { type: 'chunk', time: base + 3, chunk: { type: 'block-start', index: 0, blockType: 'text' } },
          { type: 'text-chunks', time0: base + 3, index: 0, dt: [], texts: [response] },
          {
            type: 'chunk',
            time: base + 3,
            chunk: { type: 'block-end', index: 0, block: { type: 'text', text: response } },
          },
          { type: 'chunk', time: base + 3, chunk: { type: 'finish', reason: { kind: 'stop' } } },
        ],
        message: createAssistantMessage({
          content: [{ type: 'text', text: response }],
          source: { provider: 'fixture', model: 'fixture-1' },
        }),
      },
    }),
    at(4, { type: 'step/end', data: { turn, step: 0 } }),
    at(5, { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } }),
  ]
}

const records = TURNS.flatMap((turn, index) => turnEvents(index + 1, turn.prompt, turn.response))
const tailSeq = TURNS.length * EVENTS_PER_TURN - 1

/** What the Host answers a Session's follow with: the whole log and its projection baseline. */
const SNAPSHOT: SessionFollowFrame = {
  type: 'snapshot',
  header: { version: SESSION_FORMAT_VERSION, id: SID, createdAt: 0, isSeeded: false },
  cursor: tailSeq,
  records: records.map(event => ({ type: 'event', event })),
  hasMore: false,
  projections: {
    asOfSeq: tailSeq,
    values: {
      turnOutline: TURNS.map((turn, index) => ({
        turn: index + 1,
        seq: SessionSeq(index * EVENTS_PER_TURN),
        prompt: turn.prompt,
        response: turn.response,
      })),
    },
  },
  assistantStream: { revision: 0 },
}

/**
 * Wait for assembled-client work to land: React inside act, then the expectation.
 * @param c - the booted client whose trees the expectation observes.
 * @param settled - the expectation that must hold once the work lands.
 */
async function until(c: TestClient, settled: () => void): Promise<void> {
  await vi.waitFor(async () => {
    await c.flush()
    settled()
  }, { timeout: SETTLE_TIMEOUT_MS })
}

/**
 * The Session the roster opened, as the object layer holds it.
 * @param c - the booted client.
 * @returns the Session face.
 */
function sessionOf(c: TestClient) {
  const binding = c.ctx.sessions.binding(SID)
  if (binding === undefined) throw new Error(`the assembled client holds no Session "${SID}"`)
  return binding.session
}

/**
 * The Session's own turn outline: the host projection value the map draws from.
 * @param c - the booted client.
 * @returns the outline entries in ascending Turn order.
 */
function outlineOf(c: TestClient): readonly TurnOutlineEntry[] {
  const value = sessionOf(c).projections.faceOf('turnOutline').getSnapshot()
  if (!Array.isArray(value)) throw new Error('the assembled Session carries no turn outline')
  return value as readonly TurnOutlineEntry[]
}

/**
 * The map's landmark, found by the name its dictionary gives the type.
 * @returns the map's `nav` element.
 */
function mapOf(): HTMLElement {
  return screen.getByRole('navigation', { name: en['type.label'] })
}

/**
 * The chain's node buttons, in the order the map draws them.
 * @returns the node buttons of the map's list.
 */
function nodesOf(): HTMLElement[] {
  return within(within(mapOf()).getByRole('list')).getAllByRole('button')
}

/**
 * The transcript's rendered rows.
 * @returns the Chat view's flow rows.
 */
function rowsOf(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-chat-turn]')]
}

/**
 * The tab label the assembled client resolves for one registered Conversation view.
 * @param c - the booted client.
 * @param id - the view id its plugin registers.
 * @returns the label the view's own dictionary resolves.
 */
function viewLabel(c: TestClient, id: string): string {
  const entry = c.ctx.slots.entries('conversation.view').find(candidate => candidate.options.id === id)
  if (entry === undefined) throw new Error(`the assembled client registers no Conversation view "${id}"`)
  const label = resolveSlotLabel(entry.options.label)
  if (label === undefined) throw new Error(`Conversation view "${id}" resolved no label`)
  return label
}

/**
 * Select one Conversation view by its tab, the way the reader switches views.
 * @param label - the view tab's label.
 */
function selectView(label: string): void {
  const tab = screen.getByRole('tab', { name: label })
  fireEvent.click(tab)
  expect(tab.getAttribute('aria-selected')).toBe('true')
}

/**
 * Boot the roster, open the recorded Session, wait for its transcript, and show
 * the dag page in the right Sidebar.
 * @param mock - the assembled client's Host double.
 * @param start - the fixture's boot.
 * @returns the booted client.
 */
async function bench(mock: RemoteMock, start: () => Promise<TestClient>): Promise<TestClient> {
  mock.load({
    unary: {
      'session/list': ok({
        items: [{ sessionId: SID, updatedAt: 1, running: false, blank: false }],
      }),
      // What the Session shell reads once it is selected: no child agents, no
      // commands, no skills.
      'subagents/list': ok({ entries: [], parentAvailable: true }),
      'commands/list': ok([]),
      'skills/list': ok({ skills: [] }),
    },
    stream: { 'session/follow': openStream([SNAPSHOT]) },
  })
  const c = await start()
  c.ctx.sessions.open(SID)
  await until(c, () => { expect(rowsOf().length).toBeGreaterThan(0) })
  c.ctx.sidebarRight.openTab(DAG_KIND)
  await until(c, () => { expect(nodesOf()).toHaveLength(TURNS.length) })
  return c
}

describe('the DAG-learn map through the assembled client', () => {
  it('draws every started Turn of the Session as one chain node', async ({ mock, start }) => {
    const c = await bench(mock, start)
    const outline = outlineOf(c)
    const nodes = nodesOf()
    // The tab strip carries the type's registered title, selected beside the body.
    expect(screen.getByRole('tab', { name: en['type.label'] }).getAttribute('aria-selected')).toBe('true')
    // One node per started Turn, ascending, each showing the outline's own prompt.
    expect(nodes.map(node => node.getAttribute('data-dag-node')))
      .toEqual(outline.map(entry => String(entry.turn)))
    for (const [index, entry] of outline.entries()) {
      expect(nodes[index]?.textContent).toContain(entry.prompt)
    }
  }, COLD_BOOT_TIMEOUT_MS)

  it('returns the conversation to Chat when a node is clicked from another view', async ({ mock, start }) => {
    const c = await bench(mock, start)
    selectView(viewLabel(c, TRAJECTORY_VIEW))
    // A node click asks the conversation for Chat at that Turn. Which Turn it
    // lands on is answered by real layout, not here: jsdom reports zero scroll
    // geometry, so ChatView's follower re-publishes the newest Turn and the
    // landed one is only transient. `apps/web/tests/dag-learn-turn-map.e2e.ts`
    // case 2 pins the landed Turn with its transcript row on screen.
    fireEvent.click(nodesOf()[1]!)
    await until(c, () => {
      expect(screen.getByRole('tab', { name: viewLabel(c, CHAT_VIEW) }).getAttribute('aria-selected')).toBe('true')
    })
    await until(c, () => { expect(rowsOf().length).toBeGreaterThan(0) })
  }, COLD_BOOT_TIMEOUT_MS)
})
