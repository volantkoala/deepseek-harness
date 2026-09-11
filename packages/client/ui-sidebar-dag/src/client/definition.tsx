/**
 * Stage one of this package's registration: what the `dag` tab type IS.
 *
 * The type is a page that claims no address: it shows a Session's own turns
 * and moves the transcript, and it opens no resource for another viewer.
 */
import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconBranchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import type {} from './locales.ts'

/** The tab kind this package owns. */
export const DAG_KIND = 'dag'

/** This implementation's identity in the tab system, and the key its body registers under. */
export const DAG_ID = '@deepseek-ai/dsh-client-ui-sidebar-dag'

/** The type's chain glyph at the guide capsule's size, as the chip title draws it. */
function ChainGlyph({ size, className }: IconProps) {
  return <IconBranchOutline16 size={size} className={className} />
}

/**
 * The dag type's registry definition.
 * @param t - namespace-bound translate, read fresh on every label call.
 * @returns the definition to register.
 */
export function dagDefinition(t: TranslateNS<'sidebarDag'>): SidebarRightTabDefinition {
  return {
    id: DAG_ID,
    kind: DAG_KIND,
    priority: 'builtin',
    title: () => t('type.label'),
    guide: [{
      order: 20,
      title: () => t('guide.title'),
      description: () => t('guide.description'),
      icon: ChainGlyph,
    }],
  }
}
