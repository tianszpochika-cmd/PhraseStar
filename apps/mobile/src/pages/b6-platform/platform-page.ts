/**
 * Pure, page-local adapter for the mobile B6 payload.
 *
 * The current API returns code-layer evidence ({source,status,items}); a
 * future contract may return matrix/budget/checklist shapes. This module
 * normalizes both without inventing device support, budgets or checks.
 */
export type PlatformDeviceCode =
  | 'IOS_ANDROID'
  | 'TABLET_MINI'
  | 'IOS'
  | 'ANDROID'
  | 'IPAD'
  | 'H5'
  | 'WEB'
  | 'WECHAT_MINI_PROGRAM'
  | 'WINDOWS_PWA'
  | 'UNKNOWN'

export type PlatformRowStatus = 'verified' | 'unverified' | 'unavailable' | 'unknown'

export interface PlatformDeviceRow {
  code: PlatformDeviceCode
  status: PlatformRowStatus
  detail: 'evidence' | 'target' | 'unavailable'
}

export interface PlatformDeviceSupport {
  kind: 'matrix' | 'evidence' | 'unknown'
  rows: PlatformDeviceRow[]
}

export interface PlatformAccessibility {
  kind: 'checks' | 'evidence' | 'unknown'
  count: number
}

export interface PlatformBudget {
  kind: 'profiles' | 'evidence' | 'unknown'
  levelCount: number
}

const TARGET_CODES = new Set<PlatformDeviceCode>([
  'IOS', 'ANDROID', 'IPAD', 'H5', 'WEB', 'WECHAT_MINI_PROGRAM', 'WINDOWS_PWA',
])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): Record<string, unknown> | null {
  if (!record(value)) return null
  if (record(value.data)) return value.data
  return value
}

function targetCode(value: unknown): PlatformDeviceCode {
  return typeof value === 'string' && TARGET_CODES.has(value as PlatformDeviceCode)
    ? value as PlatformDeviceCode
    : 'UNKNOWN'
}

function buildStatus(value: unknown): PlatformRowStatus {
  if (value === 'PASSED') return 'verified'
  if (value === 'FAILED') return 'unavailable'
  if (typeof value === 'string' && value.trim()) return 'unverified'
  return 'unknown'
}

/** Evidence rows are the two honest support groups from the u17 composition; never claim a passed device. */
function evidenceDeviceRows(): PlatformDeviceRow[] {
  return [
    { code: 'IOS_ANDROID', status: 'unverified', detail: 'evidence' },
    { code: 'TABLET_MINI', status: 'unverified', detail: 'evidence' },
  ]
}

export function mapDeviceSupport(value: unknown): PlatformDeviceSupport {
  const data = unwrap(value)
  if (!data) return { kind: 'unknown', rows: [] }
  if (Array.isArray(data.targets)) {
    const rows = data.targets
      .filter(record)
      .map((target): PlatformDeviceRow => ({
        code: targetCode(target.platformCode),
        status: buildStatus(target.buildStatus),
        detail: 'target',
      }))
    return { kind: 'matrix', rows }
  }
  if (data.source === 'code-layer-evidence') {
    if (data.status === 'FAILED') return { kind: 'unknown', rows: [] }
    return { kind: 'evidence', rows: evidenceDeviceRows() }
  }
  return { kind: 'unknown', rows: [] }
}

export function mapAccessibility(value: unknown): PlatformAccessibility {
  const data = unwrap(value)
  if (!data) return { kind: 'unknown', count: 0 }
  if (Array.isArray(data.checks)) return { kind: 'checks', count: data.checks.filter(record).length }
  if (data.source === 'code-layer-evidence') {
    if (data.status === 'FAILED') return { kind: 'unknown', count: 0 }
    return { kind: 'evidence', count: Array.isArray(data.items) ? data.items.length : 0 }
  }
  return { kind: 'unknown', count: 0 }
}

export function mapPerformanceBudget(value: unknown): PlatformBudget {
  const data = unwrap(value)
  if (!data) return { kind: 'unknown', levelCount: 0 }
  if (Array.isArray(data.levels)) return { kind: 'profiles', levelCount: data.levels.filter(record).length }
  if (data.source === 'code-layer-evidence') {
    if (data.status === 'FAILED') return { kind: 'unknown', levelCount: 0 }
    return { kind: 'evidence', levelCount: 0 }
  }
  return { kind: 'unknown', levelCount: 0 }
}
