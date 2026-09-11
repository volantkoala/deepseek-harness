/**
 * The map's body: the Session's Turns as one chain of nodes.
 *
 * Every row is a real button, so the chain is a keyboard surface: arrows move
 * the roving focus, Home/End reach the ends, and Enter or Space selects a row
 * through the injected `openTurn`. Only the current row expands its response
 * preview, which is what keeps a long chain scannable.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatViewLocation } from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from './locales.ts'
import { currentNodeVisible, turnNodes } from './map.ts'
import css from './DagBody.module.css'

/** What the map's plugin injects: the Session's turn verb and the Chat view's reading position. */
export interface DagInjected {
  /** Move this Session's conversation to one Turn. */
  openTurn: (turn: number) => void
  /** The Chat view's reading position, when a chat view is loaded. */
  location: ObservableSnapshot<ChatViewLocation> | undefined
}

/** The body's composed props: the tab it draws, its injected face, and its copy. */
export type DagBodyProps =
  & PropsRuntime<'sidebar.right.pane.tab'>
  & DagInjected
  & PropsLocale<'sidebarDag'>

/** Cleanup React is handed while no source publishes a location. */
const NO_UNSUBSCRIBE = (): void => {}

/**
 * Bind one plain location source; an absent source (no chat plugin loaded)
 * reports null forever, which is what draws no current mark.
 * @param source - the view's reading position, or undefined when nothing publishes one.
 * @returns the latest location, or null.
 */
function useViewLocation(source: ObservableSnapshot<ChatViewLocation> | undefined): ChatViewLocation | null {
  return useSyncExternalStore(
    // The wrapper keeps the store's receiver — a bare method reference is what
    // the unbound-method rule rejects — and one identity per source for uSES.
    useCallback((fn: () => void): (() => void) => source?.subscribe(fn) ?? NO_UNSUBSCRIBE, [source]),
    () => source?.getSnapshot() ?? null,
  )
}

/** The turn map: the chain, its current mark, and the control back to it. */
export function DagBody({
  sessionId, useProjection, openTurn, location, t,
}: DagBodyProps): ReactNode {
  // Read the projection once, before any branch: a second call after the empty
  // return would be a conditional hook.
  const outline = useProjection('turnOutline')
  const nodes = turnNodes(outline)
  // The head of the chain, absent while the chain is empty.
  const headTurn = nodes[0]?.turn ?? null
  const view = useViewLocation(location)
  const listRef = useRef<HTMLOListElement>(null)
  const currentRowRef = useRef<HTMLLIElement>(null)
  const [rovingTurn, setRovingTurn] = useState<number | null>(null)
  const [following, setFollowing] = useState(true)

  const currentTurn = view?.activeTurn ?? null
  // The tab stop: the reader's roving focus while the chain still holds that
  // Turn, else the current Turn, else the head — so an outline that drops the
  // row under the focus never leaves the chain without one.
  const hasRovingRow = rovingTurn !== null && nodes.some(({ turn }) => turn === rovingTurn)
  const tabStop = hasRovingRow ? rovingTurn : currentTurn ?? headTurn
  const activeRow = (): HTMLElement | null => currentRowRef.current
  const backToCurrent = (): void => {
    setFollowing(true)
    const row = activeRow()
    if (row !== null && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }

  // Follow the tail while the reader stays with it: once the current row is
  // out of the map's own viewport, the map stops moving under the reader and
  // offers the way back instead.
  useEffect(() => {
    if (!following || nodes.length === 0) return
    const row = activeRow()
    if (row === null) return
    if (typeof row.scrollIntoView !== 'function') return
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [currentTurn, following, nodes.length])

  const onScroll = (): void => {
    const list = listRef.current
    /* v8 ignore next -- the handler is attached to the list this ref holds, in the commit that sets it. */
    if (list === null) return
    const row = activeRow()
    if (row === null) return
    setFollowing(currentNodeVisible(list, row))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const list = listRef.current
    /* v8 ignore next -- a node's key event comes from a node the same chain holds. */
    if (list === null) return
    const rows = [...list.querySelectorAll<HTMLButtonElement>('[data-dag-node]')]
    const at = rows.indexOf(event.currentTarget)
    /* v8 ignore next -- the handler belongs to one of the rows it searched. */
    if (at < 0) return
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    const target = step !== 0
      ? rows[at + step]
      : event.key === 'Home' ? rows[0]
        : event.key === 'End' ? rows[rows.length - 1]
          : undefined
    if (target === undefined) return
    event.preventDefault()
    target.focus()
  }

  if (nodes.length === 0) {
    return (
      <div className={css.root} data-dag-state="empty">
        <p className={css.note}>{outline === undefined ? t('noProjection') : t('empty')}</p>
      </div>
    )
  }
  return (
    <nav className={css.root} aria-label={t('type.label')} data-dag-state="map" data-dag-session={sessionId}>
      <div className={css.header}>
        <span className={css.count}>{t('count', { count: nodes.length })}</span>
        {!following && (
          <button type="button" className={css.back} onClick={backToCurrent}>{t('backToCurrent')}</button>
        )}
      </div>
      <ol className={css.chain} ref={listRef} onScroll={onScroll} data-dag-chain>
        {nodes.map((node) => {
          const isCurrent = node.turn === currentTurn
          const isBusy = node.turn === view?.busyTurn
          return (
            <li
              key={node.turn}
              className={css.item}
              ref={isCurrent ? currentRowRef : undefined}
              data-dag-row={node.turn}
            >
              <button
                type="button"
                data-dag-node={node.turn}
                className={clsx(css.node, isCurrent && css.current, isBusy && css.busy)}
                aria-current={isCurrent || undefined}
                tabIndex={node.turn === tabStop ? 0 : -1}
                onFocus={() => { setRovingTurn(node.turn) }}
                onKeyDown={onKeyDown}
                onClick={() => { openTurn(node.turn) }}
              >
                <span className={css.mark} aria-hidden="true" />
                <span className={css.turn}>{node.turn}</span>
                <span className={css.prompt}>
                  {node.prompt === '' ? t('node.untitled') : node.prompt}
                </span>
                {isCurrent && node.response !== '' && (
                  <span className={css.response}>{node.response}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
