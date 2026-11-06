import type { M1016SupportTicket } from '@englishflow/contracts'
import { mobileApiClient } from './client'
import type { ClosureBoard, ClosurePrivacy } from '../domain/it7-closure'

type CategoryCode = M1016SupportTicket['categoryCode']
type TicketState = M1016SupportTicket['state']
type TicketPriority = M1016SupportTicket['priority']
type SlaStatus = M1016SupportTicket['sla']['status']

const CATEGORY_CODES: readonly CategoryCode[] = ['ACCOUNT_SECURITY', 'CONTENT_CORRECTION', 'LEARNING_SYNC', 'MEDIA_DEVICE', 'ENTITLEMENT_ORDER', 'PRIVACY', 'OTHER']
const TICKET_STATES: readonly TicketState[] = ['OPEN', 'ASSIGNED', 'WAITING_USER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED', 'REOPENED']
const TICKET_PRIORITIES: readonly TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
const SLA_STATUSES: readonly SlaStatus[] = ['ON_TRACK', 'AT_RISK', 'BREACHED', 'PAUSED', 'RESOLVED']

/** Public, read-only projection of the generated M1016SupportTicket. */
export interface MobileSupportTicket {
  ticketId: string
  categoryCode: string
  state: string
  priority: string
  stateVersion: number | null
  createdAt: string | null
  queueId: string | null
  assigneeRef: string | null
  slaStatus: string | null
  resolutionCode: string | null
  legacy: boolean
}

export interface MobileSupportList {
  tickets: MobileSupportTicket[]
  board: ClosureBoard | null
  legacy: boolean
  meta: Record<string, unknown>
  nextCursor: string | null
  hasMore: boolean
  pageSize: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Support payload is missing ${field}`)
  return value
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Support payload is missing ${field}`)
  return value
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Support payload is missing ${field}`)
  return value
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new Error(`Support payload has invalid ${field}`)
  return value as T
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new Error(`Support payload has invalid ${field}`)
  return value
}

/** Strict runtime validation of the generated read projection; no default OPEN/TECHNICAL fallback. */
export function parseSupportTicket(value: unknown): MobileSupportTicket {
  const source = requiredRecord(value, 'ticket')
  const ticketId = requiredText(source.ticketId, 'ticketId')
  requiredText(source.tenantId, 'tenantId')
  requiredText(source.requesterSubjectId, 'requesterSubjectId')
  requiredText(source.resourceRef, 'resourceRef')
  requiredText(source.lastAuditId, 'lastAuditId')
  const categoryCode = enumValue(source.categoryCode, CATEGORY_CODES, 'categoryCode')
  const state = enumValue(source.state, TICKET_STATES, 'state')
  const priority = enumValue(source.priority, TICKET_PRIORITIES, 'priority')
  const stateVersion = requiredNumber(source.stateVersion, 'stateVersion')
  const createdAt = requiredText(source.createdAt, 'createdAt')
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('Support payload has invalid createdAt')
  requiredRecord(source.descriptionContentRef, 'descriptionContentRef')
  requiredRecord(source.retention, 'retention')
  const assignment = requiredRecord(source.assignment, 'assignment')
  const queueId = requiredText(assignment.queueId, 'assignment.queueId')
  const assigneeRef = optionalText(assignment.assigneeRef, 'assignment.assigneeRef')
  const sla = requiredRecord(source.sla, 'sla')
  const slaStatus = enumValue(sla.status, SLA_STATUSES, 'sla.status')
  requiredText(sla.dueAt, 'sla.dueAt')
  const resolution = source.resolution === undefined ? null : requiredRecord(source.resolution, 'resolution')
  const resolutionCode = resolution ? requiredText(resolution.resolutionCode, 'resolution.resolutionCode') : null
  if ((state === 'RESOLVED' || state === 'CLOSED') && !resolution) throw new Error('Support payload is missing resolution for a resolved ticket')
  return { ticketId, categoryCode, state, priority, stateVersion, createdAt, queueId, assigneeRef, slaStatus, resolutionCode, legacy: false }
}

/** Explicit compatibility for the old B14 minimal projection; it does not become a formal M1016 ticket. */
export function parseLegacySupportTicket(value: unknown): MobileSupportTicket {
  const source = requiredRecord(value, 'legacy ticket')
  const ticketId = requiredText(source.ticketId, 'legacy ticketId')
  const categoryCode = requiredText(source.categoryCode, 'legacy categoryCode')
  const state = requiredText(source.state, 'legacy state')
  const priority = requiredText(source.priority, 'legacy priority')
  const slaState = optionalText(source.slaState, 'legacy slaState')
  return { ticketId, categoryCode, state, priority, stateVersion: null, createdAt: null, queueId: null, assigneeRef: null, slaStatus: slaState, resolutionCode: null, legacy: true }
}

function parsePrivacy(value: unknown): ClosurePrivacy | undefined {
  if (value === undefined) return undefined
  const source = requiredRecord(value, 'board.privacy')
  const result: ClosurePrivacy = {}
  for (const key of ['deletionCopy', 'audioCopy', 'sessionCopy'] as const) {
    if (source[key] !== undefined) {
      if (typeof source[key] !== 'string') throw new Error(`Support payload has invalid board.privacy.${key}`)
      result[key] = source[key]
    }
  }
  for (const key of ['workerGap', 'allComplete'] as const) {
    if (source[key] !== undefined) {
      if (typeof source[key] !== 'boolean') throw new Error(`Support payload has invalid board.privacy.${key}`)
      result[key] = source[key]
    }
  }
  return result
}

/** Legacy closure-board compatibility boundary used by settings; malformed recognized fields fail. */
export function parseClosureBoard(value: unknown): ClosureBoard | null {
  if (!isRecord(value)) return null
  const recognized = value.ticketCopy !== undefined || value.supportNumber !== undefined || value.auditVisible !== undefined || value.auditSharedWithLearner !== undefined || value.privacy !== undefined
  if (!recognized) return null
  const board: ClosureBoard = {}
  for (const key of ['ticketCopy', 'supportNumber'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string') throw new Error(`Support payload has invalid board.${key}`)
      board[key] = value[key]
    }
  }
  for (const key of ['auditVisible', 'auditSharedWithLearner'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') throw new Error(`Support payload has invalid board.${key}`)
      board[key] = value[key]
    }
  }
  const privacy = parsePrivacy(value.privacy)
  if (privacy) board.privacy = privacy
  return board
}

export interface CursorPageMeta { nextCursor: string | null; hasMore: boolean; pageSize: number }

/** Validates the generated Cursor/PageSize metadata; a hasMore page must have a usable cursor. */
export function parseCursorMeta(value: unknown): CursorPageMeta {
  const meta = requiredRecord(value, 'meta')
  if (typeof meta.hasMore !== 'boolean') throw new Error('Support cursor meta is missing hasMore')
  const pageSize = requiredNumber(meta.pageSize, 'meta.pageSize')
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Support cursor meta has invalid pageSize')
  const nextCursor = meta.nextCursor === undefined || meta.nextCursor === null ? null : requiredText(meta.nextCursor, 'meta.nextCursor')
  if (nextCursor !== null && !/^[A-Za-z0-9._:-]{8,512}$/.test(nextCursor)) throw new Error('Support cursor meta has invalid nextCursor')
  if (meta.hasMore && !nextCursor) throw new Error('Support cursor meta hasMore without nextCursor')
  if (!meta.hasMore && nextCursor !== null) throw new Error('Support cursor meta has nextCursor while hasMore is false')
  return { nextCursor, hasMore: meta.hasMore, pageSize }
}

/** Accepts formal {data: T[], meta} and the explicit legacy {data:{items: LegacyTicket[]}} shape only. */
export function parseSupportListResponse(raw: unknown): MobileSupportList {
  if (!isRecord(raw)) throw new Error('Support list response is not an envelope')
  const data = raw.data
  if (Array.isArray(data)) {
    const meta = parseCursorMeta(raw.meta)
    return { tickets: data.map(parseSupportTicket), board: null, legacy: false, meta: requiredRecord(raw.meta, 'meta'), ...meta }
  }
  if (isRecord(data) && Array.isArray(data.items)) {
    return { tickets: data.items.map(parseLegacySupportTicket), board: parseClosureBoard(data), legacy: true, meta: isRecord(raw.meta) ? raw.meta : {}, nextCursor: null, hasMore: false, pageSize: 20 }
  }
  throw new Error('Support list response has no supported data array')
}

export function parseSupportDetailResponse(raw: unknown): MobileSupportTicket {
  if (!isRecord(raw) || !('data' in raw)) throw new Error('Support detail response is missing data')
  return parseSupportTicket(raw.data)
}

export async function readMobileClosureBoard(): Promise<ClosureBoard | null> {
  const raw = await mobileApiClient.request<unknown>('/support/tickets?projection=it7')
  const source = isRecord(raw) && 'data' in raw ? raw.data : raw
  if (Array.isArray(source)) return null
  return parseClosureBoard(source)
}

export async function loadMobileSupportDesk(cursor?: string, pageSize = 20): Promise<MobileSupportList> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Support pageSize must be between 1 and 100')
  const query = new URLSearchParams({ pageSize: String(pageSize) })
  if (cursor) {
    if (!/^[A-Za-z0-9._:-]{8,512}$/.test(cursor)) throw new Error('Support cursor is invalid')
    query.set('cursor', cursor)
  }
  const raw = await mobileApiClient.request<unknown>(`/support/tickets?${query.toString()}`)
  const list = parseSupportListResponse(raw)
  if (cursor && list.hasMore && list.nextCursor === cursor) throw new Error('Support cursor did not advance')
  return list
}

export async function readMobileSupportTicket(ticketId: string): Promise<MobileSupportTicket> {
  if (!ticketId.trim()) throw new Error('Support ticket id is required')
  const raw = await mobileApiClient.request<unknown>(`/support/tickets/${encodeURIComponent(ticketId)}`)
  return parseSupportDetailResponse(raw)
}

export async function listMobileSupportTickets(): Promise<MobileSupportTicket[]> {
  return (await loadMobileSupportDesk()).tickets
}
