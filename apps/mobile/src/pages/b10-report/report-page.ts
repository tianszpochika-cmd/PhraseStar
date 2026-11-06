export type ReportAvailability = 'READY' | 'PARTIAL' | 'GENERATING' | 'EMPTY' | 'FAILED' | 'UNKNOWN'

export interface InclusivePeriod { readonly start: Date; readonly end: Date }
export interface ShareReceipt { readonly ref: string; readonly publicPath: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Calendar dates are YYYY-MM-DD facts; reject impossible dates instead of normalizing them. */
export function calendarDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

/** Share query date. Only an exact calendar day is sent; weekly start is already that day. */
export function reportShareDate(value: unknown): string | null {
  if (typeof value !== 'string' || calendarDate(value) === null) return null
  return value
}

export interface ReportSharePeriodFact { readonly periodStart?: unknown; readonly periodEndExclusive?: unknown }

/** Identity of the period on screen. Raw strings stay distinct when they are not calendar days. */
export function reportSharePeriodToken(kind: 'daily' | 'weekly', period: ReportSharePeriodFact | null | undefined): string | null {
  if (!period) return null
  const start = typeof period.periodStart === 'string' ? period.periodStart : ''
  const end = typeof period.periodEndExclusive === 'string' ? period.periodEndExclusive : ''
  return `${kind}|${start}|${end}`
}

const CONFIRMED_REPORT_STATUS = new Set(['ready', 'empty'])

/**
 * A settled ready/empty report can retire a share bound to another period.
 * Loading and a null store report are not a new period.
 */
export function confirmedReportSharePeriodChanged(input: {
  boundToken: string | null
  status: string
  kind: string
  period: ReportSharePeriodFact | null | undefined
}): boolean {
  if (!input.boundToken) return false
  if (input.kind !== 'daily' && input.kind !== 'weekly') return false
  if (!CONFIRMED_REPORT_STATUS.has(input.status)) return false
  return reportSharePeriodToken(input.kind, input.period) !== input.boundToken
}

/** periodEndExclusive is a half-open end; display the last included UTC calendar day. */
export function inclusivePeriod(startValue: unknown, endExclusiveValue: unknown): InclusivePeriod | null {
  const start = calendarDate(startValue)
  const endExclusive = calendarDate(endExclusiveValue)
  if (!start || !endExclusive || endExclusive.getTime() <= start.getTime()) return null
  const end = new Date(endExclusive.getTime() - 86_400_000)
  if (end.getTime() < start.getTime()) return null
  return { start, end }
}

export function availabilityKind(value: unknown): ReportAvailability {
  if (value === 'READY' || value === 'PARTIAL' || value === 'GENERATING' || value === 'EMPTY' || value === 'FAILED') return value
  return 'UNKNOWN'
}

export function maskRef(ref: string): string {
  return ref.length >= 8 ? `${ref.slice(0, 4)}…${ref.slice(-4)}` : '…'
}

/** The share API has no response schema. Accept only a 32hex ref plus a same-origin public path. */
export function shareReceipt(value: unknown): ShareReceipt | null {
  if (!isRecord(value)) return null
  const ref = typeof value.ref === 'string' ? value.ref : ''
  const publicPath = typeof value.publicPath === 'string' ? value.publicPath : ''
  if (!/^[0-9a-f]{32}$/.test(ref)) return null
  if (publicPath !== `/api/v1/public/learning/report-shares/${ref}`) return null
  return { ref, publicPath }
}

/** Build the human H5 route only from an explicitly trusted http(s) origin. */
export function publicSharePageUrl(ref: unknown, origin: unknown): string | null {
  if (typeof ref !== 'string' || !/^[0-9a-f]{32}$/.test(ref)) return null
  if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) return null
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.origin !== origin.replace(/\/$/, '')) return null
    return `${parsed.origin}/#/pages/report-share/report-share?ref=${ref}`
  } catch {
    return null
  }
}
