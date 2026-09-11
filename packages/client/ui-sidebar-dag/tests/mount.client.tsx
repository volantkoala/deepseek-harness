/**
 * Mount the body over a switchable outline and a switchable reading position.
 *
 * The component reads a handful of its props; the rest of the standard kit is
 * framework-injected and never touched here, so one documented cast keeps the
 * harness to what is actually exercised.
 */
import { useSyncExternalStore } from 'react'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ChatViewLocation } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'
import { DagBody } from '../src/client/DagBody.tsx'
import type { DagBodyProps, DagInjected } from '../src/client/DagBody.tsx'
import { DAG_ID, DAG_KIND } from '../src/client/definition.tsx'
import { zh } from '../src/client/locales.ts'

export const SESSION = 's-test' as SessionId

/** One Turn as the outline reports it: its number, its `turn/start` seq, and its two previews. */
export function outlineEntry(turn: number, prompt: string, response = ''): TurnOutlineEntry {
  return { turn, seq: SessionSeq(turn * 10), prompt, response }
}

/** The chain a spec starts from unless it asks for another. */
export const OUTLINE: readonly TurnOutlineEntry[] = [
  outlineEntry(1, 'first prompt', 'first answer'),
  outlineEntry(2, 'second prompt', 'second answer'),
  outlineEntry(3, ''),
]

/** What `useProjection` answers in this harness. */
interface ProjectionState {
  readonly turnOutline: readonly TurnOutlineEntry[] | undefined
}

/** Test-local per-key hook over a framework-neutral store, as the renderer binds one. */
function hookOf<T extends object>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useProjectionKey<K extends keyof T & string>(key: K): T[K] {
    return useSyncExternalStore(inst.subscribe, () => inst.getSnapshot()[key])
  }
}

/** What a spec holds after mounting: the rendered view and every hand on the map. */
export interface Mounted {
  readonly view: RenderResult
  /** The conversation verb, as the injected face hands it over. */
  readonly openTurn: Mock<DagInjected['openTurn']>
  /** What `useProjection` answers from now on. */
  readonly projection: SnapshotStore<ProjectionState>
  /** The view's reading position; absent when this mount was given none. */
  readonly location: SnapshotStore<ChatViewLocation> | undefined
}

/** What a mount decides. */
export interface MountOptions {
  /**
   * The outline the projection answers with: omit for a deployment without the
   * key, `undefined` to say the same thing out loud, `[]` for a Session with
   * no Turns.
   */
  readonly outline?: readonly TurnOutlineEntry[] | undefined
  /** False mounts with no reading position at all, as a deployment without the chat plugin. */
  readonly withLocation?: boolean
  /** The reading position at mount; the empty location by default. */
  readonly reading?: ChatViewLocation
}

/**
 * Mount the map's body.
 * @param options - the outline, the reading position, and whether one exists.
 * @returns the view and the two sources the spec drives.
 */
export function mountBody(options: MountOptions = {}): Mounted {
  const projection = createSnapshotStore<ProjectionState>({
    turnOutline: 'outline' in options ? options.outline : OUTLINE,
  })
  const location = options.withLocation === false
    ? undefined
    : createSnapshotStore<ChatViewLocation>(options.reading ?? { activeTurn: null, busyTurn: null })
  const openTurn = vi.fn<DagInjected['openTurn']>()
  const controller = new AbortController()
  const shared = {
    // The pane kit a body is handed: a live tab record carrying the dag type's
    // own identity. Nothing in the body reads the owner's gestures.
    useTabInfo: () => ({
      sidebar: { expanded: true, fullscreen: false },
      panel: { id: 'pane-1' },
      tab: {
        id: 'tab-1', kind: DAG_KIND, contentId: DAG_ID, title: zh['type.label'], visible: true,
        navigation: { address: DAG_ID, params: undefined, revision: 1 },
        signal: controller.signal,
        actions: { openResource: vi.fn(), openTab: vi.fn(), close: vi.fn() },
      },
    }),
    sessionId: SESSION,
    useProjection: hookOf(projection),
    location,
    openTurn,
    t: makeTranslate(zh),
  }
  const view = render(<DagBody {...shared as unknown as DagBodyProps} />)
  return { view, openTurn, projection, location }
}

/**
 * The reading position a mount was given.
 * @param mounted - what {@link mountBody} returned.
 * @returns the store the Chat view publishes through.
 */
export function reading(mounted: Mounted): SnapshotStore<ChatViewLocation> {
  if (mounted.location === undefined) throw new Error('this mount has no reading position')
  return mounted.location
}
