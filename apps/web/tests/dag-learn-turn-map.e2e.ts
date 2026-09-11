// Web e2e scenario: the DAG-learn turn map in the shipped right Sidebar, over
// the two-turn Session the navigation-panes scenario recorded. The map is a
// page in the right Sidebar, so the browser lane is the interface that sees it:
// this scenario borrows that recording read-only (snapshot.yml's `session.source`)
// and drives the real page — the guide lists both registered types, the dag
// page draws one node per started Turn, and selecting a node moves the reading
// position and the current mark onto that Turn. Both Turns of this recording fit
// the transcript viewport, so that move is read from the `aria-current` polls and
// the golden; observing a scroll would need a transcript that overflows. Zero
// model calls in replay: the map renders the host's turn outline and the
// client's own reading position, so nothing here needs a replay fixture.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import type { Browser, Locator, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest'
import { parseSessionLog } from '@deepseek-ai/dsh-llm-replay'
import { parseSnapshotManifest } from '@deepseek-ai/dsh-session-snapshot'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden, fixtureUserPrompts,
  launchWebScaffold, seedSession, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('../../../snapshots/web/dag-learn-turn-map', import.meta.url))
const MANIFEST = join(SNAPSHOT_DIR, 'snapshot.yml')
const MAP_EXPECTED = join(SNAPSHOT_DIR, 'turn-map.expected.md')
const SELECTED_EXPECTED = join(SNAPSHOT_DIR, 'turn-map-selected.expected.md')
const MODE = webSnapshotMode()
const SEED_ID = 'dag-learn-turn-map-web-e2e'
/** The map's landmark name, from the package's dictionary (`sidebarDag` `type.label`); identical in both shipped locales. */
const MAP_NAME = 'DAG-learn'
/** Prompt characters a node must carry for the scenario to call it that Turn's preview. */
const PROMPT_PREFIX_LENGTH = 24

/**
 * The Session this scenario renders, read from its own manifest so the borrow
 * has one home.
 * @returns the absolute path of the borrowed recording.
 */
async function borrowedSeedPath(): Promise<string> {
  const manifest = parseSnapshotManifest(await readFile(MANIFEST, 'utf8'), MANIFEST)
  if (manifest.session === undefined) {
    throw new Error('dag-learn-turn-map renders a borrowed Session; snapshot.yml must declare session.source')
  }
  return resolve(SNAPSHOT_DIR, manifest.session.source)
}

/**
 * The compacted whitespace a prompt preview preserves.
 * @param text - recorded prompt text.
 * @returns the prompt with runs of whitespace collapsed.
 */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Open the sidebars' collapsed lists far enough to click the seeded session. */
async function openSeededSession(page: Page): Promise<void> {
  // The sidebar tree collapses workspace groups: the group row reveals the
  // session row, which the seed's final answer then proves rendered.
  const groupRow = page.locator('[role="treeitem"]').first()
  await groupRow.waitFor({ timeout: 15_000 })
  await groupRow.click()
  const sessionRow = page.locator('[role="treeitem"]').nth(1)
  await sessionRow.waitFor({ timeout: 10_000 })
  await sessionRow.click()
  await expect.poll(() => page.getByText('FIRST_DONE', { exact: true }).count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1)
}

/**
 * Show the dag page in the right Sidebar the way a reader reaches it: open the
 * panel, then pick the map's capsule out of the guide.
 * @param page - the page under test.
 */
async function openDagPage(page: Page): Promise<void> {
  await page.locator('[data-sidebar-right-expand]').click()
  const column = page.locator('[data-rightbar-col]')
  // Two types contribute guide entries, so a pane with no remembered page
  // seeds the guide rather than either type. This case only needs the guide to
  // be what the pane seeded and its own entry to be there; which entries the
  // guide holds besides them belongs to the composition tier.
  const guide = column.locator('[data-sidebar-right-guide]')
  await guide.waitFor({ timeout: 15_000 })
  const entries = column.locator('[data-sidebar-right-guide-entry]')
  await expect.poll(async () => (await entries.evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-sidebar-right-guide-entry')))).sort(), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(['dag', 'files']))
  await column.locator('[data-sidebar-right-guide-entry="dag"]').click()
  await column.locator('[data-dag-state="map"]').waitFor({ timeout: 15_000 })
}

/**
 * The chain's node buttons, in the order the map draws them.
 * @param page - the page under test.
 * @returns the node buttons of the map's chain.
 */
async function dagNodes(page: Page): Promise<Locator[]> {
  return page.locator('[data-dag-node]').all()
}

/**
 * Whether one Turn's transcript row intersects the conversation's scrollport.
 * @param page - the page under test.
 * @param turn - Turn number whose row is asked about.
 * @returns true while any part of the row is on screen.
 */
async function turnRowOnScreen(page: Page, turn: number): Promise<boolean> {
  return await page.locator(`[data-chat-turn="${turn}"]`).first().evaluate((row) => {
    const scroller = row.closest('[data-conversation-scroll]')
    if (scroller === null) throw new Error('transcript row has no conversation scrollport')
    const view = scroller.getBoundingClientRect()
    const box = row.getBoundingClientRect()
    return box.bottom > view.top && box.top < view.bottom
  })
}

describe.skipIf(MODE === 'record')('web e2e: the DAG-learn turn map', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole> = { warnings: [], pageErrors: [] }
  let slotErrors: string[] = []
  /** The borrowed recording, read once: the manifest's target must not move under the case. */
  let seedText = ''
  /** That recording's prompts, collapsed the way the map's previews preserve them. */
  let seedPrompts: string[] = []

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    seedText = await readFile(await borrowedSeedPath(), 'utf8')
    // The borrow is only honest while the recording still carries the two
    // completed Turns, each with a prompt, that this scenario asserts on.
    expect(parseSessionLog(seedText).filter(event => event.type === 'turn/end')).toHaveLength(2)
    seedPrompts = fixtureUserPrompts(seedText).map(collapse)
    expect(seedPrompts).toHaveLength(2)
    await seedSession(scaffold, seedText, SEED_ID)
    // CI uses Playwright's pinned browser; a developer may point the lane at an
    // installed Chrome when the matching download is unavailable.
    const executablePath = process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH
    browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
  }, 120_000)

  beforeEach(async () => {
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    slotErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /slot entry crashed/i.test(message.text())) {
        slotErrors.push(message.text())
      }
    })
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    // The asynchronous session-list baseline settles before the seeded row is
    // the one the sidebar tree holds.
    await page.getByText('Ungrouped', { exact: true }).waitFor({ timeout: 30_000 })
    await openSeededSession(page)
  }, 120_000)

  afterEach(async () => {
    const failures: unknown[] = []
    try {
      expect({
        pageErrors: tripwire.pageErrors,
        slotErrors,
        warnings: tripwire.warnings,
      }).toEqual({
        pageErrors: [],
        slotErrors: [],
        warnings: [],
      })
    } catch (error) {
      failures.push(error)
    }
    await page?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'dag-learn turn map case cleanup failed')
  })

  afterAll(async () => {
    const failures: unknown[] = []
    await browser?.close().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'dag-learn turn map e2e cleanup failed')
  })

  it('draws the borrowed Session\'s Turns as the map the guide opens', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-dag-learn-turn-map'))
    await openDagPage(page)
    // The page owns the column as a selected tab chip beside its body. The
    // chip's own close control joins its accessible name, so the type's label
    // is matched as the name it starts with.
    const chip = page.getByRole('tab', { name: MAP_NAME })
    expect(await chip.count()).toBe(1)
    expect(await chip.getAttribute('aria-selected')).toBe('true')
    // Its landmark is named from the package's own dictionary.
    const map = page.getByRole('navigation', { name: MAP_NAME, exact: true })
    expect(await map.count()).toBe(1)
    // One node per started Turn, ascending, each carrying that Turn's prompt.
    const nodes = await dagNodes(page)
    expect(await Promise.all(nodes.map(node => node.getAttribute('data-dag-node'))))
      .toEqual(seedPrompts.map((_prompt, index) => String(index + 1)))
    for (const [index, prompt] of seedPrompts.entries()) {
      const node = nodes[index]
      if (node === undefined) throw new Error(`the map drew no node for turn ${String(index + 1)}`)
      expect(await node.innerText(), `node ${String(index + 1)} prompt preview`)
        .toContain(prompt.slice(0, PROMPT_PREFIX_LENGTH))
    }
    const snapshot = await captureStableAria(page, '[data-dag-state="map"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(MAP_EXPECTED, snapshot, MODE)
  }, 90_000)

  it('selects a node to move the transcript to that Turn and mark it current', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-dag-learn-turn-selected'))
    await openDagPage(page)
    const nodes = await dagNodes(page)
    const first = nodes[0]
    const firstPrompt = seedPrompts[0]
    if (first === undefined || firstPrompt === undefined) throw new Error('the map drew no first node')
    // Opening the Session lands the reader on the newest Turn, so the mark this
    // case moves is not already where the click puts it.
    await expect.poll(async () => await page.locator('[data-dag-node][aria-current="true"]').getAttribute('data-dag-node'), {
      timeout: 15_000,
    }).toBe('2')
    expect(await turnRowOnScreen(page, 2)).toBe(true)
    await first.click()
    // The first Turn's row is on screen. Both Turns fit this recording's
    // transcript viewport, so this poll reads the same before and after the
    // click; the mark poll below carries the move.
    await expect.poll(() => turnRowOnScreen(page, 1), { timeout: 15_000 }).toBe(true)
    await expect.poll(async () => await page.locator('[data-dag-node][aria-current="true"]').getAttribute('data-dag-node'), {
      timeout: 15_000,
    }).toBe('1')
    expect(await page.locator('[data-dag-node][aria-current="true"]').innerText())
      .toContain(firstPrompt.slice(0, PROMPT_PREFIX_LENGTH))
    const snapshot = await captureStableAria(page, '[data-dag-state="map"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(SELECTED_EXPECTED, snapshot, MODE)
  }, 90_000)

  it('keeps the borrowed fixture inventory exact', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, [
      'turn-map.expected.md', 'turn-map-selected.expected.md',
    ])
  })
})
