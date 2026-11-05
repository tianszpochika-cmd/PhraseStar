/** UI-only grammar view transitions. No network, grading, or invented content. */

export type GrammarViewName = 'list' | 'detail' | 'structure' | 'practice'

const CORE = '/static/figma-grammar-core'

/** Original 18 grammar SVGs. Decorative row icons are not mastery claims. */
export const grammarAssets = {
  chevronBack: `${CORE}/92d6090b-0c38-4266-9cf4-628863617060.svg`,
  chevronForward: `${CORE}/742de076-1267-445b-a0a0-8bbefcec6f09.svg`,
  glowList: `${CORE}/7d8ddd9f-8e44-4606-803d-fb095892e35b.svg`,
  glowDetail: `${CORE}/c3f87348-fdf4-4f20-9e16-f6796a5648e0.svg`,
  glowStructure: `${CORE}/324455d9-9454-4818-91d6-1c5e12fc6ef7.svg`,
  glowPractice: `${CORE}/811a170a-2446-4896-9b5a-72a281e74550.svg`,
  glowClosed: `${CORE}/b1d0c25e-0343-4bd3-9d78-7bf60fdc0c40.svg`,
  typeStarted: `${CORE}/a7811406-4544-4606-9707-e7a6f729d8d6.svg`,
  typeMiddle: `${CORE}/dbbfe4d7-c03c-4de2-825b-43ed2ac88219.svg`,
  typeIdle: `${CORE}/32e9bcd4-9689-4d1f-a64f-3414bbae1a20.svg`,
  dotLow: `${CORE}/b1d8a2f7-9470-4aa6-b6d2-2f59690e2810.svg`,
  dotContains: `${CORE}/0932b0a0-5408-41f7-a436-02f03d0560c3.svg`,
  dotUpdates: `${CORE}/9ae0c161-987d-42b3-85b0-e6204ade9f25.svg`,
  grid: `${CORE}/79152baa-61bb-4a6b-a5b6-1357427c181b.svg`,
  hourglass: `${CORE}/d04de7a6-3a0a-4dbc-a059-df4bfc5c0b4f.svg`,
  check: `${CORE}/af456a5e-6712-4bb0-81c8-ff970f5b430c.svg`,
  closedGrid: `${CORE}/d10ee6b7-b9b7-419f-89a3-4b2fd595b5e8.svg`,
  pencil: `${CORE}/b860c048-e632-4a26-801b-1dca9a6eb3dd.svg`,
} as const

const POINT_ICONS = [grammarAssets.typeStarted, grammarAssets.typeMiddle, grammarAssets.typeIdle] as const

export function grammarInitialView(): GrammarViewName {
  return 'list'
}

/** Header back inside the page. List and catalog-only practice keep native navigation. */
export function grammarViewBack(view: GrammarViewName, catalogOnly: boolean): 'navigate' | GrammarViewName {
  if (catalogOnly || view === 'list') return 'navigate'
  if (view === 'practice' || view === 'structure') return 'detail'
  return 'list'
}

export function grammarShowsPractice(view: GrammarViewName): boolean {
  return view === 'practice'
}

export interface GrammarExamplePage {
  text: string
  index: number
  total: number
}

/** Page real examples only. A single example does not grow into a second page. */
export function grammarExamplePage(examples: readonly string[], index: number): GrammarExamplePage | null {
  const usable = examples.filter((entry) => typeof entry === 'string' && entry.trim())
  if (!usable.length) return null
  const total = usable.length
  const normalized = Number.isInteger(index) ? ((index % total) + total) % total : 0
  return { text: usable[normalized], index: normalized, total }
}

/** Prerequisite labels only when a loaded point already has that title. */
export function grammarPrerequisiteTitles(
  ids: readonly number[],
  points: readonly { grammarPointId: number; title: string }[],
): string[] {
  const titles: string[] = []
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) continue
    const title = points.find((point) => point.grammarPointId === id)?.title?.trim()
    if (title) titles.push(title)
  }
  return titles
}

export function grammarPointIcon(index: number): string {
  const safe = Number.isInteger(index) && index >= 0 ? index : 0
  return POINT_ICONS[safe % POINT_ICONS.length]
}

export function grammarGlowAsset(view: GrammarViewName, closed: boolean): string {
  if (closed) return grammarAssets.glowClosed
  if (view === 'detail') return grammarAssets.glowDetail
  if (view === 'structure') return grammarAssets.glowStructure
  if (view === 'practice') return grammarAssets.glowPractice
  return grammarAssets.glowList
}

/** Top page route after an await. Empty input does not count as this page. */
export function grammarRouteMatches(route: string | null | undefined, pagePath = '/pages/b3-grammar/b3-grammar'): boolean {
  if (typeof route !== 'string' || !route.trim()) return false
  const bare = route.trim().split(/[?#]/)[0]
  const path = bare.startsWith('/') ? bare : `/${bare}`
  return path === pagePath || path.endsWith(pagePath)
}
