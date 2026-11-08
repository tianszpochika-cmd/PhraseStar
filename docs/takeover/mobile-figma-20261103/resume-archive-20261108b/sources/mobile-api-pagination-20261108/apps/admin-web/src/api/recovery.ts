import { adminClient } from './client'
import { createClientId } from '../platform/client-id'

/** P1R decision 1A: recovery console reads/writes (M6-009). */

export interface RecoveryView {
  recoveryId: string
  effectDetail?: string | null
  status: string | null
  requestedBy: string | null
  approvedBy: string | null
  subjectType: string | null
  subjectId: string | null
  action: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  return 'data' in value ? value.data : value
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function viewOf(value: unknown): RecoveryView | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const recoveryId = text(source.recoveryId)
  if (!recoveryId) return null
  return {
    recoveryId,
    status: typeof source.status === 'string' ? source.status : null,
    requestedBy: typeof source.requestedBy === 'string' ? source.requestedBy : null,
    approvedBy: typeof source.approvedBy === 'string' ? source.approvedBy : null,
    subjectType: typeof source.subjectType === 'string' ? source.subjectType : null,
    subjectId: typeof source.subjectId === 'string' ? source.subjectId : null,
    action: typeof source.action === 'string' ? source.action : null,
    effectDetail: typeof source.effectDetail === 'string' ? source.effectDetail : null,
  }
}

function key(suffix: string): Record<string, string> {
  return { 'Idempotency-Key': createClientId(`recovery-${suffix}`) }
}

export async function requestRecovery(input: {
  subjectType: string
  subjectId: string
  action: string
  reason: string
}): Promise<RecoveryView | null> {
  const raw = await adminClient.request('/admin/recovery/recoveries', {
    method: 'POST',
    body: input,
    headers: key('request'),
  })
  return viewOf(raw)
}

export async function approveRecovery(recoveryId: string): Promise<RecoveryView | null> {
  const raw = await adminClient.request(
    `/admin/recovery/recoveries/${encodeURIComponent(recoveryId)}/approve`,
    { method: 'POST', body: {}, headers: key('approve') },
  )
  return viewOf(raw)
}

export async function rejectRecovery(recoveryId: string, reason: string): Promise<RecoveryView | null> {
  const raw = await adminClient.request(
    `/admin/recovery/recoveries/${encodeURIComponent(recoveryId)}/reject`,
    { method: 'POST', body: { reason }, headers: key('reject') },
  )
  return viewOf(raw)
}

export async function executeRecovery(recoveryId: string): Promise<RecoveryView | null> {
  const raw = await adminClient.request(
    `/admin/recovery/recoveries/${encodeURIComponent(recoveryId)}/execute`,
    { method: 'POST', body: {}, headers: key('execute') },
  )
  return viewOf(raw)
}

export interface UnfinishedSagaPage {
  sagaIds: string[]
  hasMore: boolean
  nextCursor: string | null
  pageSize: number
}

export async function listUnfinishedSagas(input?: {
  cursor?: string
  pageSize?: number
}): Promise<UnfinishedSagaPage> {
  const params = new URLSearchParams()
  if (input?.cursor) params.set('cursor', input.cursor)
  if (input?.pageSize != null) params.set('pageSize', String(input.pageSize))
  const query = params.toString()
  const raw = await adminClient.request(
    `/admin/recovery/sagas/unfinished${query ? `?${query}` : ''}`,
  )
  const data = unwrap(raw)
  const sagaIds = Array.isArray(data) ? data.filter((value): value is string => typeof value === 'string') : []
  const meta = isRecord(raw) && isRecord(raw.meta) ? raw.meta : {}
  const nextCursor = typeof meta.nextCursor === 'string' && meta.nextCursor.trim() ? meta.nextCursor : null
  return {
    sagaIds,
    hasMore: meta.hasMore === true,
    nextCursor,
    pageSize: typeof meta.pageSize === 'number' ? meta.pageSize : sagaIds.length,
  }
}

/** Fail-closed walk budget. Hitting it with hasMore still true is an error, not a 5000-row prefix. */
export const UNFINISHED_SAGA_PAGE_BUDGET = 10_000

export async function listAllUnfinishedSagaIds(): Promise<string[]> {
  const sagaIds: string[] = []
  const seenIds = new Set<string>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  for (let page = 0; page < UNFINISHED_SAGA_PAGE_BUDGET; page += 1) {
    const result = await listUnfinishedSagas({ cursor, pageSize: 100 })
    if (result.hasMore && result.sagaIds.length === 0) {
      throw new Error('unfinished saga walk made no progress')
    }
    for (const id of result.sagaIds) {
      if (seenIds.has(id)) {
        throw new Error('unfinished saga walk duplicated an id')
      }
      seenIds.add(id)
      sagaIds.push(id)
    }
    if (!result.hasMore) {
      return sagaIds
    }
    if (!result.nextCursor) {
      throw new Error('unfinished saga walk has more without a cursor')
    }
    if (result.nextCursor === cursor || seenCursors.has(result.nextCursor)) {
      throw new Error('unfinished saga walk repeated a cursor')
    }
    seenCursors.add(result.nextCursor)
    cursor = result.nextCursor
  }
  throw new Error('unfinished saga walk exceeded the page budget')
}
