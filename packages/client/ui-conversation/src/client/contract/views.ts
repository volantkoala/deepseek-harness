/** Conversation view and session-local presentation state. */

/**
 * One conversation view tab, projected from a 'conversation.view' slot
 * entry's registration options (label falls back to the entry id).
 */
export interface ViewTab { id: string; label: string }

/**
 * One-shot request addressed to a Conversation View, in one of two arms: a
 * View's own opaque focus identity (Trajectory's inspector identity, for
 * example), or a Turn of the Session by number, which is the vocabulary the
 * turn outline and the transcript rail already share.
 */
export type ConversationViewRequest =
  | {
    readonly kind: 'focus'
    /** Target `conversation.view` entry id. */
    readonly view: string
    /** Target-owned opaque focus identity. */
    readonly focus: string
  }
  | {
    readonly kind: 'turn'
    /** Target `conversation.view` entry id. */
    readonly view: string
    /** 1-based Turn number to reveal. */
    readonly turn: number
  }

/** Per-session state owned by the target-neutral Conversation shell. */
export interface ConversationStoreState {
  /** Composer draft (persisted; survives session switches and reloads). */
  draft: string
  /** Preferred `conversation.view` entry id; null resolves to Chat when registered. */
  view: string | null
  /** One-shot View request consumed and acknowledged by the addressed View. */
  viewRequest: ConversationViewRequest | null
}
