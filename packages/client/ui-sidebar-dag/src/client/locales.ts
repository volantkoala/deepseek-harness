/**
 * `sidebarDag` namespace dictionaries: the type's name, its guide entry, the
 * two empty states, and the control that returns the reader to the current node.
 *
 * A missing projection and an empty Session are separate lines on purpose: a
 * deployment without the turn outline must not read as a Session with no Turns.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DAG-learn type name, guide entry, empty states, and controls. */
    sidebarDag: SidebarDagKey
  }
}

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  'type.label': 'DAG-learn',
  'guide.title': '对话地图',
  'guide.description': '把每个回合画成节点，点一下就跳过去',
  'count.one': '{count} 个回合',
  'count.other': '{count} 个回合',
  empty: '这个会话还没有回合。',
  noProjection: '这个部署没有提供轮次投影，地图无法绘制。',
  backToCurrent: '回到当前',
  'node.untitled': '（无文字提示）',
} satisfies Record<string, string>

/** DAG-learn dictionary key union. */
export type SidebarDagKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  'type.label': 'DAG-learn',
  'guide.title': 'Turn map',
  'guide.description': 'Every turn as a node; click one to jump to it',
  'count.one': '{count} turn',
  'count.other': '{count} turns',
  empty: 'This session has no turns yet.',
  noProjection: 'This deployment provides no turn outline, so the map cannot be drawn.',
  backToCurrent: 'Back to current',
  'node.untitled': '(no text prompt)',
} satisfies Record<SidebarDagKey, string>
