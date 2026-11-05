export type WorldParse<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unknown-shape' | 'invalid' }

export type WorldStreakStatus = 'ACTIVE' | 'AT_RISK' | 'BROKEN' | 'FROZEN' | 'UNKNOWN'
export type WorldSeasonStatus = 'ACTIVE' | 'ENDED' | 'UPCOMING' | 'UNKNOWN'
export type WorldQuestPeriod = 'DAILY' | 'WEEKLY' | 'SEASON' | 'UNKNOWN'

export interface WorldSummary {
  subjectRef: string | null
  level: number | null
  xp: number | null
  streakDays: number | null
  currentSeason: string | null
  featureEnabled: boolean | null
  rewardCatalogVersion: string | null
  rewardRuleVersion: string | null
}

export interface WorldStreak {
  currentStreak: number
  status: WorldStreakStatus
  lastValidDate: string | null
  timeZone: string | null
  weekendProtectionEnabled: boolean | null
}

export interface WorldSeason {
  seasonId: string
  title: string | null
  status: WorldSeasonStatus
  points: number | null
  tierCount: number
}

export interface WorldQuest {
  questId: string
  title: string | null
  period: WorldQuestPeriod
  target: number | null
  progress: number | null
  completed: boolean | null
  claimed: boolean | null
  xpReward: number | null
  coinReward: number | null
}

export interface WorldQuests {
  quests: WorldQuest[]
  invalidCount: number
}

export interface WorldIdentity {
  subject: string
  revision: number
}

export type WorldFailureKind = 'unauthorized' | 'forbidden' | 'conflict' | 'offline' | 'server' | 'unknown'

export interface WorldFailure {
  status: number
  code: string | null
  retryable: boolean
  kind: WorldFailureKind
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function unwrap(value: unknown): unknown {
  const record = asRecord(value)
  return record && 'data' in record ? record.data : value
}

function sourceOf(value: unknown): Record<string, unknown> | null {
  const source = asRecord(unwrap(value))
  return source
}

function text(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nonNegativeInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function integer(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null
}

function boolean(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function calendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

function dateText(record: Record<string, unknown>, key: string): string | null {
  const value = text(record, key)
  return value && calendarDate(value) ? value : null
}

function arrayFrom(value: unknown, keys: readonly string[]): unknown[] | null {
  if (Array.isArray(value)) return value
  const source = sourceOf(value)
  if (!source) return null
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key]
  }
  return null
}

export function isEmptyWorldPayload(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const record = asRecord(value)
  return Boolean(record && 'data' in record && record.data === null)
}

export function toWorldSummary(value: unknown): WorldParse<WorldSummary> {
  const source = sourceOf(value)
  if (!source) return { ok: false, reason: 'unknown-shape' }
  const summary: WorldSummary = {
    subjectRef: text(source, 'subjectRef') ?? text(source, 'subject'),
    level: integer(source, 'level'),
    xp: nonNegativeInteger(source, 'serverScore') ?? nonNegativeInteger(source, 'xp'),
    streakDays: nonNegativeInteger(source, 'streakDays'),
    currentSeason: text(source, 'currentSeason'),
    featureEnabled: boolean(source, 'featureEnabled'),
    rewardCatalogVersion: text(source, 'rewardCatalogVersion'),
    rewardRuleVersion: text(source, 'rewardRuleVersion'),
  }
  const hasAny = Object.values(summary).some((item) => item !== null)
  return hasAny ? { ok: true, data: summary } : { ok: false, reason: 'invalid' }
}

function normalizeStreakStatus(value: string | null): WorldStreakStatus {
  switch (value?.toUpperCase()) {
    case 'ACTIVE':
    case 'IN_PROGRESS':
    case 'CONTINUING': return 'ACTIVE'
    case 'AT_RISK': return 'AT_RISK'
    case 'BROKEN': return 'BROKEN'
    case 'FROZEN': return 'FROZEN'
    default: return 'UNKNOWN'
  }
}

export function toWorldStreak(value: unknown): WorldParse<WorldStreak> {
  const source = sourceOf(value)
  if (!source) return { ok: false, reason: 'unknown-shape' }
  const currentStreak = nonNegativeInteger(source, 'currentStreak')
  if (currentStreak === null) return { ok: false, reason: 'invalid' }
  return {
    ok: true,
    data: {
      currentStreak,
      status: normalizeStreakStatus(text(source, 'status')),
      lastValidDate: dateText(source, 'lastValidDate'),
      timeZone: text(source, 'timeZone'),
      weekendProtectionEnabled: boolean(source, 'weekendProtectionEnabled'),
    },
  }
}

function normalizeSeasonStatus(value: string | null): WorldSeasonStatus {
  switch (value?.toUpperCase()) {
    case 'ACTIVE': return 'ACTIVE'
    case 'ENDED':
    case 'COMPLETED': return 'ENDED'
    case 'UPCOMING':
    case 'SCHEDULED': return 'UPCOMING'
    default: return 'UNKNOWN'
  }
}

export function toWorldSeason(value: unknown): WorldParse<WorldSeason> {
  const root = sourceOf(value)
  if (!root) return { ok: false, reason: 'unknown-shape' }
  const source = asRecord(root.season) ?? root
  const seasonId = text(source, 'seasonId')
  const title = text(source, 'title')
  if (!seasonId && !title) return { ok: false, reason: 'invalid' }
  const tiers = Array.isArray(source.tiers) ? source.tiers : []
  return {
    ok: true,
    data: {
      seasonId: seasonId ?? '',
      title,
      status: normalizeSeasonStatus(text(source, 'status')),
      points: nonNegativeInteger(source, 'points'),
      tierCount: tiers.length,
    },
  }
}

function normalizePeriod(value: string | null): WorldQuestPeriod {
  switch (value?.toUpperCase()) {
    case 'DAILY': return 'DAILY'
    case 'WEEKLY': return 'WEEKLY'
    case 'SEASON': return 'SEASON'
    default: return 'UNKNOWN'
  }
}

function toWorldQuest(value: unknown): WorldQuest | null {
  const source = asRecord(value)
  if (!source) return null
  const questId = text(source, 'questId')
  if (!questId) return null
  return {
    questId,
    title: text(source, 'title'),
    period: normalizePeriod(text(source, 'period')),
    target: nonNegativeInteger(source, 'target'),
    progress: nonNegativeInteger(source, 'progress'),
    completed: boolean(source, 'completed'),
    claimed: boolean(source, 'claimed'),
    xpReward: nonNegativeInteger(source, 'xpReward'),
    coinReward: nonNegativeInteger(source, 'coinReward'),
  }
}

export function toWorldQuests(value: unknown): WorldParse<WorldQuests> {
  const raw = arrayFrom(value, ['items', 'quests'])
  if (raw === null) return { ok: false, reason: 'unknown-shape' }
  const quests = raw.map(toWorldQuest).filter((item): item is WorldQuest => item !== null)
  return { ok: true, data: { quests, invalidCount: raw.length - quests.length } }
}

export function streakStatusKey(status: WorldStreakStatus): string {
  switch (status) {
    case 'ACTIVE': return 'streakActive'
    case 'AT_RISK': return 'streakAtRisk'
    case 'BROKEN': return 'streakBroken'
    case 'FROZEN': return 'streakFrozen'
    default: return 'streakUnknown'
  }
}

export function seasonStatusKey(status: WorldSeasonStatus): string {
  switch (status) {
    case 'ACTIVE': return 'seasonActive'
    case 'ENDED': return 'seasonEnded'
    case 'UPCOMING': return 'seasonUpcoming'
    default: return 'seasonUnknown'
  }
}

export function questPeriodKey(period: WorldQuestPeriod): string {
  switch (period) {
    case 'DAILY': return 'questDaily'
    case 'WEEKLY': return 'questWeekly'
    case 'SEASON': return 'questSeason'
    default: return 'questUnknown'
  }
}

export function formatWorldDate(value: string | null, locale: string): string | null {
  if (!value) return null
  const date = calendarDate(value)
  if (!date) return null
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
  } catch {
    return null
  }
}

export function isSameWorldIdentity(expected: WorldIdentity | null, current: WorldIdentity | null): boolean {
  return Boolean(expected && current && expected.subject === current.subject && expected.revision === current.revision)
}

export function isWorldFeatureClosed(summary: WorldSummary | null): boolean {
  return summary?.featureEnabled === false
}

export function toWorldFailure(error: unknown): WorldFailure {
  const record = asRecord(error) ?? {}
  const status = typeof record.status === 'number' && Number.isFinite(record.status) ? record.status : 0
  const details = asRecord(record.details)
  const nested = details ? asRecord(details.error) : null
  const code = (nested ? text(nested, 'code') : null) ?? (details ? text(details, 'code') : null)
  const kind: WorldFailureKind = status === 401
    ? 'unauthorized'
    : status === 403
      ? 'forbidden'
      : status === 409
        ? 'conflict'
        : status === 0
          ? 'offline'
          : status >= 500 ? 'server' : 'unknown'
  const retryable = (nested ? boolean(nested, 'retryable') : null)
    ?? boolean(record, 'retryable')
    ?? (status === 0 || status === 409 || status >= 500)
  return { status, code, retryable, kind }
}
