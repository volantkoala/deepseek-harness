/**
 * The map's body: the Session's Turns as the reader's tree.
 *
 * Every row is a real button, so the tree is a keyboard surface: arrows move
 * the roving focus, Home/End reach the ends, Tab hangs a node under its
 * previous sibling and Shift+Tab lifts it back out, F2 renames a node, and
 * Enter or Space selects a row through the injected `openTurn`. Only the
 * current row expands its response preview, which is what keeps a long tree
 * scannable.
 *
 * The reader edits the tree through the tab's store: a row can be renamed (a
 * label covering its prompt preview), hung under another node, lifted back to
 * root, moved among its siblings, and folded with its subtree. The outline
 * stays the single source of truth — nodes are never added or dropped, and an
 * untouched tree reads exactly like the plain chain.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatViewLocation } from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from './locales.ts'
import { ancestorsOf, currentNodeVisible, treeNodes } from './map.ts'
import type { RenderTurnNode } from './map.ts'
import { descendantsOf } from './tree.ts'
import type { createDagTreeStore } from './tree.ts'
import css from './DagBody.module.css'

/** What the map's plugin injects: the Session's turn verb and the Chat view's reading position. */
export interface DagInjected {
  /** Move this Session's conversation to one Turn. */
  openTurn: (turn: number) => void
  /** The Chat view's reading position, when a chat view is loaded. */
  location: ObservableSnapshot<ChatViewLocation> | undefined
}

/** The body's composed props: the tab it draws, its store, its injected face, and its copy. */
export type DagBodyProps =
  & PropsRuntime<'sidebar.right.pane.tab'>
  & PropsStore<ReturnType<typeof createDagTreeStore>>
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

/** The turn map: the reader's tree, its current mark, and the control back to it. */
export function DagBody({
  sessionId, useProjection, openTurn, location, useStore, actions, useTabInfo, t,
}: DagBodyProps): ReactNode {
  // Read the projection once, before any branch: a second call after the empty
  // return would be a conditional hook.
  const outline = useProjection('turnOutline')
  const { tab } = useTabInfo()
  const { signal } = tab
  // The tab's tree, seeded by the framework on the first body that draws it.
  const tree = useStore(store => store.byTab[tab.id])
  useEffect(() => {
    if (tree !== undefined || signal.aborted) return
    actions.start(tab.id)
  }, [tree, tab.id, signal, actions.start])

  const nodes = treeNodes(outline, tree)
  // The head of the chain, absent while the chain is empty.
  const headTurn = nodes[0]?.turn ?? null
  const view = useViewLocation(location)
  const listRef = useRef<HTMLOListElement>(null)
  const currentRowRef = useRef<HTMLLIElement>(null)
  const [rovingTurn, setRovingTurn] = useState<number | null>(null)
  const [following, setFollowing] = useState(true)
  const [editingTurn, setEditingTurn] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [attachingTurn, setAttachingTurn] = useState<number | null>(null)

  const currentTurn = view?.activeTurn ?? null
  // The tab stop: the reader's roving focus while the tree still holds that
  // Turn, else the current Turn, else the head — so an outline that drops the
  // row under the focus never leaves the tree without one.
  const hasRovingRow = rovingTurn !== null && nodes.some(({ turn }) => turn === rovingTurn)
  const tabStop = hasRovingRow ? rovingTurn : currentTurn ?? headTurn
  const activeRow = (): HTMLElement | null => currentRowRef.current
  /** The root level's current order, which an edit of an unplaced Turn materialises. */
  const rootOrder = nodes.filter(node => node.depth === 0).map(node => node.turn)

  const backToCurrent = (): void => {
    // A folded ancestor hides the current row: unfold the way first.
    if (currentTurn !== null && tree !== undefined) {
      for (const ancestor of ancestorsOf(tree, currentTurn)) {
        if (tree.collapsed.includes(ancestor)) actions.toggle(tab.id, ancestor)
      }
    }
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

  const startEditing = (node: RenderTurnNode): void => {
    setEditingTurn(node.turn)
    setEditingDraft(node.label ?? '')
  }
  const commitEditing = (): void => {
    if (editingTurn !== null) actions.rename(tab.id, editingTurn, editingDraft)
    setEditingTurn(null)
  }
  const cancelEditing = (): void => {
    setEditingTurn(null)
  }

  const onNodeKeyDown = (event: React.KeyboardEvent<HTMLElement>, node: RenderTurnNode): void => {
    const list = listRef.current
    /* v8 ignore next -- a node's key event comes from a node the same chain holds. */
    if (list === null) return
    const rows = [...list.querySelectorAll<HTMLElement>('[data-dag-node]')]
    const at = rows.indexOf(event.currentTarget)
    /* v8 ignore next -- the handler belongs to one of the rows it searched. */
    if (at < 0) return
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        actions.promote(tab.id, node.turn, rootOrder)
      } else {
        // Hang the node under its previous sibling, the outline-writer's move.
        const atNode = nodes.indexOf(node)
        for (let i = atNode - 1; i >= 0; i--) {
          const previous = nodes[i]
          if (previous !== undefined && previous.parent === node.parent) {
            actions.attach(tab.id, node.turn, previous.turn, rootOrder)
            break
          }
        }
      }
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      startEditing(node)
      return
    }
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

  const onNodeClick = (node: RenderTurnNode): void => {
    if (attachingTurn !== null) {
      // A node cannot hang under itself or one of its descendants; the mode
      // stays on so the reader can pick a valid target instead.
      const valid = node.turn !== attachingTurn
        && tree !== undefined
        && !descendantsOf(tree, attachingTurn).has(node.turn)
      if (valid) {
        actions.attach(tab.id, attachingTurn, node.turn, rootOrder)
        setAttachingTurn(null)
      }
      return
    }
    openTurn(node.turn)
  }

  if (outline === undefined || outline.length === 0) {
    return (
      <div className={css.root} data-dag-state="empty">
        <p className={css.note}>{outline === undefined ? t('noProjection') : t('empty')}</p>
      </div>
    )
  }
  const edited = tree !== undefined && Object.keys(tree.children).length > 0
  const renderLevel = (parent: number | null): ReactNode => {
    const children = nodes.filter(node => node.parent === parent)
    if (children.length === 0) return null
    return (
      <ul className={css.level}>
        {children.map(node => renderRow(node))}
      </ul>
    )
  }
  const renderRow = (node: RenderTurnNode): ReactNode => {
    const isCurrent = node.turn === currentTurn
    const isBusy = node.turn === view?.busyTurn
    const isEditing = editingTurn === node.turn
    const isAttaching = attachingTurn === node.turn
    const cannotAttach = attachingTurn !== null
      && (node.turn === attachingTurn || (tree !== undefined && descendantsOf(tree, attachingTurn).has(node.turn)))
    const label = node.label ?? (node.prompt === '' ? t('node.untitled') : node.prompt)
    return (
      <li
        key={node.turn}
        className={css.item}
        ref={isCurrent ? currentRowRef : undefined}
        data-dag-row={node.turn}
        data-dag-depth={node.depth}
        data-dag-attach-target={cannotAttach ? 'no' : undefined}
      >
        <div className={css.row}>
          {node.hasChildren ? (
            <button
              type="button"
              className={clsx(css.fold, node.folded && css.folded)}
              tabIndex={-1}
              aria-expanded={!node.folded}
              aria-label={node.folded ? t('expand') : t('collapse')}
              onClick={() => { actions.toggle(tab.id, node.turn) }}
            >
              <span className={css.foldGlyph} aria-hidden="true" />
            </button>
          ) : (
            <span className={css.foldGutter} aria-hidden="true" />
          )}
          {isEditing ? (
            <div className={css.node} data-dag-node={node.turn}>
              <input
                className={css.edit}
                value={editingDraft}
                autoFocus
                aria-label={t('edit.placeholder')}
                placeholder={node.prompt}
                onChange={(event) => { setEditingDraft(event.target.value) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitEditing()
                  if (event.key === 'Escape') cancelEditing()
                }}
                onBlur={commitEditing}
              />
            </div>
          ) : (
            <button
              type="button"
              data-dag-node={node.turn}
              className={clsx(
                css.node,
                isCurrent && css.current,
                isBusy && css.busy,
                isAttaching && css.attaching,
                cannotAttach && css.cannotAttach,
              )}
              aria-current={isCurrent || undefined}
              tabIndex={node.turn === tabStop ? 0 : -1}
              onFocus={() => { setRovingTurn(node.turn) }}
              onKeyDown={(event) => { onNodeKeyDown(event, node) }}
              onClick={() => { onNodeClick(node) }}
              onDoubleClick={() => { startEditing(node) }}
            >
              <span className={css.mark} aria-hidden="true" />
              <span className={css.turn}>{node.turn}</span>
              <span className={css.prompt}>{label}</span>
              {isCurrent && node.response !== '' && (
                <span className={css.response}>{node.response}</span>
              )}
            </button>
          )}
          <div className={css.ops}>
            <button
              type="button"
              className={css.op}
              data-dag-edit={node.turn}
              tabIndex={-1}
              title={t('edit.label')}
              aria-label={t('edit.label')}
              onClick={() => { startEditing(node) }}
            >
              <span className={css.opGlyph} data-glyph="edit" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={css.op}
              data-dag-attach={node.turn}
              tabIndex={-1}
              title={t('attach.to')}
              aria-label={t('attach.to')}
              onClick={() => { setAttachingTurn(attachingTurn === node.turn ? null : node.turn) }}
            >
              <span className={css.opGlyph} data-glyph="attach" aria-hidden="true" />
            </button>
            {node.parent !== null && (
              <button
                type="button"
                className={css.op}
                data-dag-promote={node.turn}
                tabIndex={-1}
                title={t('promote')}
                aria-label={t('promote')}
                onClick={() => { actions.promote(tab.id, node.turn, rootOrder) }}
              >
                <span className={css.opGlyph} data-glyph="promote" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className={css.op}
              data-dag-move-up={node.turn}
              tabIndex={-1}
              title={t('move.up')}
              aria-label={t('move.up')}
              onClick={() => { actions.move(tab.id, node.turn, -1, rootOrder) }}
            >
              <span className={css.opGlyph} data-glyph="up" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={css.op}
              data-dag-move-down={node.turn}
              tabIndex={-1}
              title={t('move.down')}
              aria-label={t('move.down')}
              onClick={() => { actions.move(tab.id, node.turn, 1, rootOrder) }}
            >
              <span className={css.opGlyph} data-glyph="down" aria-hidden="true" />
            </button>
          </div>
        </div>
        {!node.folded && renderLevel(node.turn)}
      </li>
    )
  }
  return (
    <nav className={css.root} aria-label={t('type.label')} data-dag-state="map" data-dag-session={sessionId}>
      <div className={css.header}>
        <span className={css.count}>
          {t(outline.length === 1 ? 'count.one' : 'count.other', { count: outline.length })}
        </span>
        <div className={css.headerTools}>
          {edited && (
            <button
              type="button"
              className={css.back}
              data-dag-reset
              title={t('reset.tree')}
              onClick={() => { actions.reset(tab.id) }}
            >
              {t('reset.tree')}
            </button>
          )}
          {!following && currentTurn !== null && (
            <button type="button" className={css.back} onClick={backToCurrent}>{t('backToCurrent')}</button>
          )}
        </div>
      </div>
      {attachingTurn !== null && (
        <div className={css.attachBar} role="status" data-dag-attaching={attachingTurn}>
          <span>{t('attach.hint')}</span>
          <button type="button" className={css.back} onClick={() => { setAttachingTurn(null) }}>{t('attach.cancel')}</button>
        </div>
      )}
      <ul className={css.chain} ref={listRef} onScroll={onScroll} data-dag-chain>
        {renderLevel(null)}
      </ul>
    </nav>
  )
}
