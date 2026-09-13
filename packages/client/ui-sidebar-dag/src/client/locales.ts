/**
 * `sidebarDag` namespace dictionaries: the type's name, its guide entry, the
 * two empty states, the control that returns the reader to the current node,
 * and every control of the editable tree.
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
  'guide.description': '把每个回合画成节点，点一下就跳过去，还能重排成树',
  'count.one': '{count} 个回合',
  'count.other': '{count} 个回合',
  empty: '这个会话还没有回合。',
  noProjection: '这个部署没有提供轮次投影，地图无法绘制。',
  backToCurrent: '回到当前',
  'node.untitled': '（无文字提示）',
  'edit.label': '编辑标签',
  'edit.placeholder': '节点标签',
  'attach.to': '挂载到…',
  'attach.hint': '点击目标节点，把它挂到其下；点自身或后代无效',
  'attach.cancel': '取消',
  promote: '提升',
  'move.up': '上移',
  'move.down': '下移',
  collapse: '折叠',
  expand: '展开',
  'reset.tree': '恢复线性',
} satisfies Record<string, string>

/** DAG-learn dictionary key union. */
export type SidebarDagKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  'type.label': 'DAG-learn',
  'guide.title': 'Turn map',
  'guide.description': 'Every turn as a node; click one to jump, rearrange them into a tree',
  'count.one': '{count} turn',
  'count.other': '{count} turns',
  empty: 'This session has no turns yet.',
  noProjection: 'This deployment provides no turn outline, so the map cannot be drawn.',
  backToCurrent: 'Back to current',
  'node.untitled': '(no text prompt)',
  'edit.label': 'Edit label',
  'edit.placeholder': 'Node label',
  'attach.to': 'Attach to…',
  'attach.hint': 'Click the target node to attach under it; itself and its descendants are not valid targets',
  'attach.cancel': 'Cancel',
  promote: 'Promote',
  'move.up': 'Move up',
  'move.down': 'Move down',
  collapse: 'Collapse',
  expand: 'Expand',
  'reset.tree': 'Reset to chain',
} satisfies Record<SidebarDagKey, string>
