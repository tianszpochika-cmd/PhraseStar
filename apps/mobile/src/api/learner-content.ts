import { mobileApiClient, MobileApiError } from './client'
import type { B8AdultGateResponse, B8PublishedConsentDocument } from '@englishflow/contracts'
import type { MobileContentCard, MobileContentDetail, MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileLearnerAccount, MobileMotionMode, MobileOnboardingModel, MobilePlacementModel, MobilePlacementQuestion, MobilePlacementReport, MobileTask, MobileThemeMode } from '../domain/learner-content'

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}
function text(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value.trim() : fallback }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function requireStateVersion(value: unknown): number {
  const source = unwrap(value)
  if (isRecord(source) && typeof source.stateVersion === 'number' && Number.isSafeInteger(source.stateVersion) && source.stateVersion >= 0) {
    return source.stateVersion
  }
  throw new Error('学习设置版本暂时无法读取，请重试。')
}
type QueryParams = string | Record<string, string | null | undefined>

function query(path: string, params: QueryParams): string {
  const values = typeof params === 'string' ? { contentLocale: params } : params
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  return `${path}?${search.toString()}`
}

async function requestOptional(path: string): Promise<unknown | null> {
  try { return await mobileApiClient.request<unknown>(path) }
  catch (error) {
    if (error instanceof MobileApiError && error.status === 404) return null
    if (error instanceof MobileApiError && error.status === 403 && isConsentRequired(error.details)) return null
    throw error
  }
}

function isConsentRequired(details: unknown): boolean {
  if (!isRecord(details)) return false
  const source = isRecord(details.error) ? details.error : details
  return source.code === 'CONSENT_REQUIRED'
}

function mapError(error: unknown): MobileApiError {
  if (error instanceof MobileApiError) return error
  return new MobileApiError('学习数据暂时不可用，请稍后重试。', 0, error)
}

function parseGoalOptions(value: unknown): MobileGoalOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): MobileGoalOption[] => {
    if (!isRecord(item)) return []
    const valueText = text(item.value ?? item.code)
    const label = text(item.label, valueText)
    return valueText && label ? [{ value: valueText, label, description: text(item.description) || undefined }] : []
  })
}

function parseQuotas(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === 'number' && [5, 15, 30, 45].includes(item))
}

function mapUiGoalCode(value: string): string | null {
  switch (value) {
    case 'FOUNDATION':
    case 'ZERO_BASIS':
      return 'ZERO_BASIS'
    case 'COLLEGE_CET':
    case 'CET_4_6':
      return 'CET_4_6'
    case 'POSTGRADUATE_ENGLISH':
    case 'POSTGRADUATE':
      return 'POSTGRADUATE'
    case 'WORKPLACE_DAILY':
    case 'WORKPLACE':
      return 'WORKPLACE_DAILY'
    default:
      return null
  }
}

function decisionCode(details: unknown): string | null {
  if (!isRecord(details)) return null
  const source = isRecord(details.error) ? details.error : details
  return typeof source.code === 'string' && source.code.trim() ? source.code.trim() : null
}

function parseOnboarding(profileValue: unknown, targetValue: unknown, preferenceValue: unknown, optionsValue: unknown): MobileOnboardingModel {
  const profile = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const target = isRecord(unwrap(targetValue)) ? unwrap(targetValue) as RecordValue : {}
  const preferences = isRecord(unwrap(preferenceValue)) ? unwrap(preferenceValue) as RecordValue : {}
  const options = isRecord(unwrap(optionsValue)) ? unwrap(optionsValue) as RecordValue : {}
  return {
    goal: mapUiGoalCode(text(target.goalCode ?? target.goal_code ?? profile.targetGoal ?? profile.target_goal)) || null,
    quota: number(target.dailyQuotaMinutes ?? target.daily_quota_minutes, 0) || null,
    goals: parseGoalOptions(options.goals),
    quotas: parseQuotas(options.dailyQuotaMinutes ?? options.quotas),
    birthYear: number(profile.birthYear ?? profile.birth_year, 0) || null,
    ageConfirmed: profile.ageConfirmed === true || profile.age_confirmed === true,
    privacyConsent: profile.privacyConsent === true || profile.privacy_consent === true,
    termsConsent: profile.termsConsent === true || profile.terms_consent === true,
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    completed: text(profile.status).toUpperCase() === 'ACTIVE',
    stateVersion: number(profile.stateVersion ?? profile.state_version, 0),
  }
}

function parseAccount(profileValue: unknown, targetValue: unknown, preferencesValue: unknown): MobileLearnerAccount {
  const source = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const profile = isRecord(source.profile) ? source.profile : source
  const target = unwrap(targetValue)
  const goal = isRecord(target) ? target : isRecord(source.goal) ? source.goal : {}
  const remotePreferences = unwrap(preferencesValue)
  const preferences = isRecord(remotePreferences) ? remotePreferences : isRecord(source.preferences) ? source.preferences : {}
  const themeMode = text(preferences.themeMode ?? preferences.theme_mode ?? profile.themeMode ?? profile.theme_mode, 'SYSTEM')
  const motionMode = text(preferences.motionMode ?? preferences.motion_mode, 'FULL')
  return {
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    timezone: text(preferences.timezone ?? preferences.timezone ?? profile.timezone, 'Asia/Shanghai'),
    themeMode: ['SYSTEM', 'LIGHT', 'DARK'].includes(themeMode) ? themeMode as MobileThemeMode : 'SYSTEM',
    highContrast: preferences.highContrast === true || preferences.high_contrast === true,
    motionMode: ['FULL', 'REDUCED', 'OFF'].includes(motionMode) ? motionMode as MobileMotionMode : 'FULL',
    goal: text(goal.goalCode ?? goal.goal_code) || null,
    quota: number(goal.dailyQuotaMinutes ?? goal.daily_quota_minutes, 0) || null,
    // The preferences aggregate owns this version. The profile version may
    // have changed independently (for example, after an onboarding update).
    stateVersion: requireStateVersion(preferencesValue),
  }
}

function parseTask(value: unknown, index: number): MobileTask | null {
  if (!isRecord(value)) return null
  const id = text(value.taskId ?? value.task_id ?? value.id)
  if (!id) return null
  const statusValue = text(value.status ?? value.task_status)
  const status = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE'].includes(statusValue) ? statusValue as MobileTask['status'] : 'AVAILABLE'
  return {
    id,
    type: text(value.taskType ?? value.task_type ?? value.type, 'LESSON'),
    title: text(value.title, `今日任务 ${index + 1}`),
    description: text(value.description ?? value.summary, '按服务端内容版本继续学习。'),
    minutes: number(value.minutes ?? value.estimatedMinutes, 5),
    status,
    contentCode: text(value.contentCode ?? value.content_code) || undefined,
    contentVersionPin: number(value.contentVersionPin, 0) || undefined,
    unavailableReason: text(value.unavailableReason) || undefined,
  }
}

function parseContent(value: unknown): MobileContentCard[] {
  const source = unwrap(value)
  const record = isRecord(source) ? source : {}
  const items = Array.isArray(record.items) ? record.items : Array.isArray(source) ? source : []
  return items.flatMap((item): MobileContentCard[] => {
    if (!isRecord(item)) return []
    const contentCode = text(item.contentCode ?? item.id)
    if (!contentCode) return []
    const availability = ['PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY'].includes(text(item.availability)) ? text(item.availability) as MobileContentCard['availability'] : 'NOT_READY'
    return [{ contentCode, contentType: text(item.contentType, 'COURSE'), title: text(item.title, contentCode), summary: text(item.summary ?? item.description), contentLocale: text(item.contentLocale, 'en-US'), contentVersionId: number(item.contentVersionId, 0) || null, availability }]
  })
}

function parseContentDetail(value: unknown): MobileContentDetail {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const detail = isRecord(source.content) ? source.content : source
  const contentCode = text(detail.contentCode ?? detail.contentId ?? detail.id)
  const title = text(detail.title)
  if (!contentCode || !title) throw new Error('服务端课程内容格式无效。')
  const items = Array.isArray(detail.items) ? detail.items.flatMap((item, index) => {
    if (!isRecord(item)) return []
    return [{
      itemId: text(item.itemId ?? item.itemCode ?? item.id, `${contentCode}:item:${index + 1}`),
      itemType: text(item.itemType ?? item.type, 'LESSON'),
      text: text(item.text ?? item.displayText ?? item.prompt ?? item.content),
      options: Array.isArray(item.options) ? item.options.flatMap((option) => {
        if (!isRecord(option)) return []
        const key = text(option.key); const optionText = text(option.text)
        return key && optionText ? [{ key, text: optionText }] : []
      }) : [],
    }]
  }) : []
  return {
    contentCode,
    contentVersionId: number(detail.contentVersionId ?? detail.versionId, 0) || null,
    contentType: text(detail.contentType ?? detail.kind, 'COURSE_UNIT'),
    title,
    summary: text(detail.summary ?? detail.description),
    contentLocale: text(detail.contentLocale, 'en-US'),
    items,
  }
}

function identifier(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return text(value)
}

function readItemId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function readSequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function readStateVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('当前环境无法生成作答摘要，这题没有提交。')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function itemAtSequence(items: unknown[], sequence: number): unknown {
  for (const item of items) {
    if (!isRecord(item)) continue
    if (readSequence(item.itemSequence) === sequence || readSequence(item.displayOrder) === sequence) return item
  }
  const index = sequence - 1
  return index >= 0 && index < items.length ? items[index] : null
}

function parsePlacementQuestion(value: unknown, totalSteps: number | null = null, stepHint: number | null = null): MobilePlacementQuestion | null {
  if (!isRecord(value)) return null
  const questionId = text(value.questionId) || identifier(value.itemId)
  const stemText = text(value.stemText) || text(value.stem) || text(value.prompt)
  if (!questionId || !stemText) return null
  const rawOptions = Array.isArray(value.options) ? value.options : []
  const options = rawOptions.flatMap((option): Array<{ key: string; text: string }> => {
    if (!isRecord(option)) return []
    const key = text(option.key) || text(option.optionId) || text(option.optionCode)
    const optionText = text(option.text) || text(option.label)
    return key && optionText ? [{ key, text: optionText }] : []
  })
  if (!options.length) return null
  const rawDimension = text(value.dimension) || text(value.itemType)
  return {
    questionId,
    stemText,
    options,
    dimension: rawDimension === 'GRAMMAR' || rawDimension === 'BASIC_GRAMMAR' ? 'GRAMMAR' : rawDimension === 'LISTENING' ? 'LISTENING' : rawDimension || 'VOCABULARY',
    difficulty: number(value.difficulty, 1),
    stepIndex: stepHint ?? number(value.stepIndex, number(value.displayOrder, 1)),
    totalSteps: totalSteps ?? number(value.totalSteps, 10),
    timeLimitSec: number(value.timeLimitSec, 25),
    itemId: readItemId(value.itemId),
  }
}

function optionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function parsePlacementReport(value: unknown, sessionFallback: string | null = null): MobilePlacementReport | null {
  if (!isRecord(value)) return null
  const summary = isRecord(value.summary) ? value.summary : value
  if (value.resultKind === 'SKIPPED' || summary.resultKind === 'SKIPPED') {
    const reportId = text(value.reportId) || text(summary.reportId)
    const sessionId = text(value.sessionId) || text(summary.sessionId) || sessionFallback || ''
    if (!reportId || !sessionId) return null
    const requested = isRecord(value.requestedStartingLevel) ? value.requestedStartingLevel : isRecord(summary.requestedStartingLevel) ? summary.requestedStartingLevel : null
    return {
      reportId,
      sessionId,
      resultKind: 'SKIPPED',
      cefrLevel: null,
      score: null,
      requestedStartingLevel: requested ? text(requested.level) || null : null,
      mistakes: [],
      fullCount: null,
      zeroCount: null,
      itemCount: null,
    }
  }
  const reportId = text(value.reportId) || text(summary.reportId)
  const sessionId = text(value.sessionId) || text(summary.sessionId) || sessionFallback || ''
  if (!reportId) return null
  const measuredScore = typeof value.score === 'number' ? value.score : typeof value.aggregateScore === 'number' ? value.aggregateScore : typeof summary.score === 'number' ? summary.score : typeof summary.aggregateScore === 'number' ? summary.aggregateScore : null
  const measuredLevel = text(value.cefrLevel) || text(value.referenceLevel) || text(summary.cefrLevel) || text(summary.referenceLevel) || null
  return {
    reportId,
    sessionId,
    resultKind: 'ASSESSED',
    cefrLevel: measuredLevel,
    score: measuredScore,
    requestedStartingLevel: null,
    mistakes: [],
    fullCount: optionalCount(summary.fullCount),
    zeroCount: optionalCount(summary.zeroCount),
    itemCount: optionalCount(summary.itemCount),
  }
}

function emptyPlacement(): MobilePlacementModel {
  return { sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false, stateVersion: null, acceptedSequence: 0, nextSequence: null, reconciledWithoutReceipt: false, responseOutcome: null }
}

function selectPlacementItem(source: RecordValue, items: unknown[], acceptedSequence: number, nextSequence: number | null, totalSteps: number | null): unknown {
  const explicit = source.currentItem ?? source.currentQuestion ?? source.nextItem ?? source.nextQuestion
  if (explicit != null) return explicit
  const total = totalSteps ?? (items.length || 10)
  const sequence = nextSequence ?? (acceptedSequence > 0 ? acceptedSequence + 1 : 1)
  if (sequence < 1 || sequence > total) return null
  if (acceptedSequence > 0 || sequence === 1) return itemAtSequence(items, sequence)
  return null
}

function parsePlacement(value: unknown, reconciledWithoutReceipt = false): MobilePlacementModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const manifest = isRecord(source.manifest) ? source.manifest : null
  const items = Array.isArray(source.items) ? source.items : []
  const totalSteps = typeof manifest?.totalItemCount === 'number' ? manifest.totalItemCount : items.length || null
  const acceptedSequence = readSequence(source.acceptedSequence) ?? 0
  const nextSequence = readSequence(source.nextSequence) ?? (source.acceptedSequence != null ? acceptedSequence + 1 : null)
  const completed = isRecord(source.completedResult) ? source.completedResult : isRecord(source.finalResult) ? source.finalResult : null
  const current = selectPlacementItem(source, items, acceptedSequence, nextSequence, totalSteps)
  const stepHint = nextSequence != null && nextSequence >= 1 && (totalSteps == null || nextSequence <= totalSteps) ? nextSequence : null
  const sessionId = text(source.sessionId) || null
  const reportValue = source.report ?? source.finalReport ?? (completed && completed.resultKind !== 'SKIPPED' ? completed : null)
  const report = parsePlacementReport(reportValue, sessionId) ?? parsePlacementReport(isRecord(source.summary) ? source.summary : null, sessionId)
  const responseOutcome = source.outcome === 'FULL' || source.outcome === 'ZERO' ? source.outcome : null
  return {
    sessionId,
    status: text(source.status, sessionId ? 'IN_PROGRESS' : 'EMPTY'),
    currentQuestion: parsePlacementQuestion(current, totalSteps, stepHint),
    report,
    isCompleted: source.isCompleted === true || text(source.status) === 'COMPLETED' || completed?.resultKind === 'ASSESSED' || Boolean(report && report.resultKind === 'ASSESSED'),
    stateVersion: readStateVersion(source.stateVersion) ?? readStateVersion(source.state_version),
    acceptedSequence,
    nextSequence,
    reconciledWithoutReceipt,
    responseOutcome,
  }
}

function placementConflictAction(
  attempt: { stateVersion: number; itemSequence: number; itemId: number },
  latest: MobilePlacementModel,
  retried: boolean,
): 'adopt' | 'retry' | 'stop' {
  if (latest.acceptedSequence >= attempt.itemSequence) return 'adopt'
  const sequence = latest.nextSequence ?? latest.currentQuestion?.stepIndex ?? null
  const sameItem = latest.currentQuestion?.itemId == null || latest.currentQuestion.itemId === attempt.itemId
  const unchanged = latest.stateVersion === attempt.stateVersion && sequence === attempt.itemSequence && sameItem
  return unchanged && !retried ? 'retry' : 'stop'
}

function parseHome(learnerValue: unknown, contentValue: unknown): MobileHomeModel {
  const source = isRecord(unwrap(learnerValue)) ? unwrap(learnerValue) as RecordValue : {}
  const firstDay = isRecord(source.firstDay) ? source.firstDay : {}
  const dailyStream = isRecord(source.dailyStream) ? source.dailyStream : {}
  const rawTasks = Array.isArray(source.tasks) ? source.tasks : Array.isArray(firstDay.tasks) ? firstDay.tasks : []
  const tasks = rawTasks.flatMap((item, index) => { const task = parseTask(item, index); return task ? [task] : [] })
  const content = parseContent(contentValue)
  const contentStatus = content.length ? 'READY' : text(source.contentStatus) === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'EMPTY'
  return {
    projectionVersion: number(source.projectionVersion, 1),
    contentEpoch: number(source.contentEpoch, 0),
    tasks,
    content,
    contentStatus,
    completedMinutes: number(source.completedMinutes ?? dailyStream.completedMinutes, 0),
    targetMinutes: number(source.targetMinutes ?? dailyStream.targetMinutes, 15),
    stale: source.stale === true || text(source.degradedReason) !== '',
  }
}

function requireSameIdentity(isCurrent?: () => boolean): void {
  if (isCurrent && !isCurrent()) throw new Error('账号已变化，请重新打开页面后操作。')
}

let cachedActiveConsentVersion: string | null = null
let consentRefreshPromise: Promise<string> | null = null

async function fetchActiveConsentVersion(): Promise<string> {
  try {
    const raw = await requestOptional('/iam/principal/me')
    const unwrapped = unwrap(raw)
    if (isRecord(unwrapped)) {
      const consentState = isRecord(unwrapped.consentState) ? unwrapped.consentState : undefined
      if (consentState && typeof consentState.version === 'string' && consentState.version.trim()) {
        return consentState.version.trim()
      }
    }
  } catch {
    // fallback to default
  }
  return 'b30-consent-v1'
}

async function refreshActiveConsentVersion(): Promise<string> {
  if (!consentRefreshPromise) {
    consentRefreshPromise = fetchActiveConsentVersion().then((v) => {
      cachedActiveConsentVersion = v
      consentRefreshPromise = null
      return v
    }).catch((err) => {
      consentRefreshPromise = null
      throw err
    })
  }
  return consentRefreshPromise
}

export interface MobileOnboardingResumeRead {
  adultGate: string
  adultLearningAccess: NonNullable<B8AdultGateResponse['learningAccess']> | 'UNKNOWN'
  sessionRefreshRequired?: boolean
  consent: { readable: boolean; accepted: boolean | null; unsatisfiedPurposes: readonly string[]; publishedDocuments?: readonly B8PublishedConsentDocument[] }
  target: { readable: boolean; saved: boolean; goal: string | null; quota: number | null }
}

const REQUIRED_PUBLICATION = [
  ['TERMS', 'ACCOUNT_TERMS'],
  ['PRIVACY', 'PRIVACY_NOTICE'],
  ['ADULT_LEARNING', 'ADULT_LEARNING_ELIGIBILITY'],
] as const

type RequiredPublicationType = (typeof REQUIRED_PUBLICATION)[number][0]

/** Fresh signing needs an explicit incomplete summary. An absent or unreadable summary stays closed. */
export function explicitIncompleteConsent(consent: Pick<MobileOnboardingResumeRead['consent'], 'readable' | 'accepted' | 'unsatisfiedPurposes'>): boolean {
  if (!consent.readable) return false
  const requiredOpen = consent.unsatisfiedPurposes.some((item) => REQUIRED_PUBLICATION.some((entry) => entry[1] === item))
  if (consent.accepted === true && !requiredOpen) return false
  if (consent.accepted === false) return true
  return requiredOpen
}

const PUBLICATION_VERSION_MAX = 64
const PUBLICATION_POLICY_VERSION_MAX = 128
// IAM ConsentPolicyDescriptor SAFE_REF is one ASCII letter plus 2..191 safe characters (3..192).
const PUBLICATION_POLICY_REF_MAX = 192
const PUBLICATION_BODY_MAX = 65536
const SHA256_LOWER = /^[0-9a-f]{64}$/
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const DECISION_ID = /^[A-Za-z0-9-]{16,110}$/

function plainToken(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || value !== value.trim()) return null
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return null
  }
  return value
}

function plainBody(value: unknown): string | null {
  // maxLength is Unicode scalars. Each scalar is one or two UTF-16 code units, so longer inputs are closed without copying.
  if (typeof value !== 'string' || value.length < 1 || value.length > PUBLICATION_BODY_MAX * 2 || value.includes('\u0000')) return null
  if (value.length <= PUBLICATION_BODY_MAX) return value
  let characters = 0
  for (let index = 0; index < value.length; ) {
    const point = value.codePointAt(index) ?? 0
    index += point > 0xffff ? 2 : 1
    characters += 1
    if (characters > PUBLICATION_BODY_MAX) return null
  }
  return value
}

function plainTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) return null
  return value
}

async function digestMatches(bodyText: string, documentDigest: string): Promise<boolean> {
  if (!SHA256_LOWER.test(documentDigest)) return false
  try {
    return await sha256Hex(bodyText) === documentDigest
  } catch {
    return false
  }
}

/** A complete three-document publication, or null when it cannot be shown or signed. */
async function parsePublishedConsentDocuments(value: unknown): Promise<readonly B8PublishedConsentDocument[] | null> {
  if (!Array.isArray(value) || value.length !== REQUIRED_PUBLICATION.length) return null
  const parsed = new Map<RequiredPublicationType, B8PublishedConsentDocument>()
  for (const raw of value) {
    if (!isRecord(raw)) return null
    const match = REQUIRED_PUBLICATION.find((entry) => entry[0] === raw.type && entry[1] === raw.purpose)
    if (!match || parsed.has(match[0])) return null
    const documentVersion = plainToken(raw.documentVersion, PUBLICATION_VERSION_MAX)
    const documentDigest = typeof raw.documentDigest === 'string' && SHA256_LOWER.test(raw.documentDigest) ? raw.documentDigest : null
    const bodyText = plainBody(raw.bodyText)
    const publishedAt = plainTimestamp(raw.publishedAt)
    const policyVersion = plainToken(raw.policyVersion, PUBLICATION_POLICY_VERSION_MAX)
    const policyRef = plainToken(raw.policyRef, PUBLICATION_POLICY_REF_MAX)
    if (!documentVersion || !documentDigest || bodyText === null || !publishedAt || !policyVersion || !policyRef) return null
    const document = { type: match[0], purpose: match[1], documentVersion, documentDigest, bodyText, publishedAt, policyVersion, policyRef } satisfies B8PublishedConsentDocument
    parsed.set(match[0], document)
  }
  const documents: B8PublishedConsentDocument[] = []
  for (const [type] of REQUIRED_PUBLICATION) {
    const document = parsed.get(type)
    if (!document) return null
    documents.push(document)
  }
  for (const document of documents) {
    if (!await digestMatches(document.bodyText, document.documentDigest)) return null
  }
  return documents
}

function parseAdultGateFact(value: unknown): string {
  if (value === 'PASSED' || value === 'REJECTED' || value === 'REQUIRED') return value
  if (!isRecord(value)) return 'UNKNOWN'
  if (value.status === 'PASSED' || value.status === 'APPROVED') return 'PASSED'
  if (value.status === 'REJECTED') return 'REJECTED'
  if (value.status === 'REQUIRED' || value.status === 'PENDING' || value.status === 'NOT_EVALUATED') return 'REQUIRED'
  return 'UNKNOWN'
}

function parseConsentFact(value: unknown): MobileOnboardingResumeRead['consent'] {
  if (!isRecord(value)) return { readable: false, accepted: null, unsatisfiedPurposes: [] }
  const accepted = typeof value.accepted === 'boolean' ? value.accepted : null
  const purposes = Array.isArray(value.unsatisfiedPurposes)
    ? value.unsatisfiedPurposes.filter((item): item is string => typeof item === 'string')
    : null
  if (accepted === null && purposes === null) return { readable: false, accepted: null, unsatisfiedPurposes: [] }
  return { readable: true, accepted, unsatisfiedPurposes: purposes ?? [] }
}

/** Read publishedConsentDocuments only as its own root field. Never from inside consentState. */
async function readRootPublishedConsentDocuments(record: RecordValue, principal: RecordValue): Promise<readonly B8PublishedConsentDocument[] | null> {
  const roots = record === principal ? [record] : [record, principal]
  for (const root of roots) {
    if (!Object.prototype.hasOwnProperty.call(root, 'publishedConsentDocuments')) continue
    return parsePublishedConsentDocuments(root.publishedConsentDocuments)
  }
  return null
}

async function readIamResumeFacts(options?: { skipAuthRetry?: boolean }): Promise<Pick<MobileOnboardingResumeRead, 'adultGate' | 'adultLearningAccess' | 'consent'>> {
  const raw = await mobileApiClient.request<unknown>('/iam/principal/me', options?.skipAuthRetry ? { skipAuthRetry: true } : undefined)
  const source = unwrap(raw)
  const record = isRecord(source) ? source : {}
  const principal = isRecord(record.principal) ? record.principal : record
  const adultFact = record.adultGate ?? record.adultGateStatus ?? principal.adultGate ?? principal.adultGateStatus
  const adultGate = parseAdultGateFact(adultFact)
  const access = isRecord(adultFact) ? adultFact.learningAccess : undefined
  const adultLearningAccess = access === 'ELIGIBLE' || access === 'RESTRICTED' ? access : 'UNKNOWN'
  const consentSource = isRecord(record.consentState) ? record.consentState : isRecord(principal.consentState) ? principal.consentState : null
  const consent = parseConsentFact(consentSource)
  const publishedDocuments = await readRootPublishedConsentDocuments(record, principal)
  return publishedDocuments ? { adultGate, adultLearningAccess, consent: { ...consent, publishedDocuments } } : { adultGate, adultLearningAccess, consent }
}

async function readTargetFact(): Promise<MobileOnboardingResumeRead['target'] & { consentRequired: boolean }> {
  try {
    const raw = await mobileApiClient.request<unknown>('/learner/targets')
    const source = unwrap(raw)
    const record = isRecord(source) ? source : {}
    const goal = mapUiGoalCode(text(record.goalCode ?? record.goal_code))
    const quota = number(record.dailyQuotaMinutes ?? record.daily_quota_minutes, 0)
    const saved = Boolean(goal && [5, 15, 30, 45].includes(quota))
    return { readable: true, saved, goal: saved ? goal : null, quota: saved ? quota : null, consentRequired: false }
  } catch (error) {
    if (error instanceof MobileApiError && error.status === 404) return { readable: true, saved: false, goal: null, quota: null, consentRequired: false }
    if (error instanceof MobileApiError && error.status === 403 && decisionCode(error.details) === 'CONSENT_REQUIRED') {
      return { readable: true, saved: false, goal: null, quota: null, consentRequired: true }
    }
    return { readable: false, saved: false, goal: null, quota: null, consentRequired: false }
  }
}

async function signConsent(type: string, keySuffix: string, clientEventId: string): Promise<void> {
  // Read the published version first; the b30 constant is only a last-resort fallback.
  const version = cachedActiveConsentVersion ?? await refreshActiveConsentVersion()
  try {
    await mobileApiClient.request('/iam/consents', {
      method: 'PUT',
      data: { type, version, decision: 'ACCEPTED' },
      header: { 'Idempotency-Key': `${clientEventId}-${keySuffix}` },
    })
  } catch (error) {
    if (error instanceof MobileApiError && error.status === 409) {
      let latestVersion = cachedActiveConsentVersion
      if (latestVersion === version || !latestVersion) latestVersion = await refreshActiveConsentVersion()
      if (latestVersion && latestVersion !== version) {
        await mobileApiClient.request('/iam/consents', {
          method: 'PUT',
          data: { type, version: latestVersion, decision: 'ACCEPTED' },
          // A different body needs its own key; reusing the first key is rejected as key_reused.
          header: { 'Idempotency-Key': `${clientEventId}-${keySuffix}-${latestVersion}` },
        })
        return
      }
    }
    throw error
  }
}

async function signRequiredConsents(clientEventId: string, isCurrent?: () => boolean): Promise<void> {
  requireSameIdentity(isCurrent)
  await Promise.all([
    signConsent('PRIVACY', 'privacy', clientEventId),
    signConsent('TERMS', 'terms', clientEventId),
    signConsent('ADULT_LEARNING', 'adult-learning', clientEventId),
  ])
  requireSameIdentity(isCurrent)
  const [{ useSessionStore }, { pinia }] = await Promise.all([import('../stores/session'), import('../stores/pinia')])
  requireSameIdentity(isCurrent)
  const session = useSessionStore(pinia)
  if (!await session.refreshSilently()) throw new Error(session.lastError || '必要同意已提交，但会话还没有更新。请重试。本页还没提交的内容，离开后不会保留。')
  requireSameIdentity(isCurrent)
}

function consentDecisionKey(decisionId: string, type: RequiredPublicationType): string | null {
  if (!DECISION_ID.test(decisionId)) return null
  const suffix = type === 'TERMS' ? 'terms' : type === 'PRIVACY' ? 'privacy' : 'adult'
  const key = `${decisionId}-${suffix}`
  return key.length >= 16 && key.length <= 128 ? key : null
}

function sameViewedPublication(viewed: readonly B8PublishedConsentDocument[], published: readonly B8PublishedConsentDocument[] | undefined): boolean {
  if (!published || published.length !== REQUIRED_PUBLICATION.length || viewed.length !== REQUIRED_PUBLICATION.length) return false
  return REQUIRED_PUBLICATION.every(([type, purpose]) => {
    const left = viewed.find((document) => document.type === type)
    const right = published.find((document) => document.type === type)
    return Boolean(left && right && left.purpose === purpose && right.purpose === purpose
      && left.documentVersion === right.documentVersion
      && left.documentDigest === right.documentDigest
      && left.bodyText === right.bodyText
      && left.publishedAt === right.publishedAt
      && left.policyVersion === right.policyVersion
      && left.policyRef === right.policyRef)
  })
}

const CONSENT_RECORD_PAIRS = [
  ['TERMS', 'ACCOUNT_TERMS'],
  ['PRIVACY', 'PRIVACY_NOTICE'],
  ['ADULT_LEARNING', 'ADULT_LEARNING_ELIGIBILITY'],
  ['PRODUCT_ANALYTICS', 'PRODUCT_ANALYTICS'],
  ['VOICE_RECORDING', 'ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY'],
] as const

const OWNER_PROVENANCE = {
  authority: 'IAM_SERVER_RECORDED_CONSENT',
  documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST',
  policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE',
} as const

interface TrustedConsentGrant {
  type: (typeof CONSENT_RECORD_PAIRS)[number][0]
  purpose: (typeof CONSENT_RECORD_PAIRS)[number][1]
  required: boolean
  state: 'GRANTED' | 'WITHDRAWN'
  document: { version: string; digest: string }
  policyVersion: string
  policyRef: string
  provenance: { authority: string; documentSource: string; policySource: string }
}

export function consentGrantMatchesPublication(record: {
  type: string
  purpose: string
  required: boolean
  state: string
  document: { version: string; digest: string }
  policyVersion: string
  policyRef: string
  provenance: { authority: string; documentSource: string; policySource: string }
}, document: B8PublishedConsentDocument): boolean {
  const pair = REQUIRED_PUBLICATION.find((entry) => entry[0] === document.type && entry[1] === document.purpose)
  if (!pair) return false
  return record.type === document.type
    && record.purpose === document.purpose
    && record.required === true
    && record.state === 'GRANTED'
    && record.document.version === document.documentVersion
    && record.document.digest === document.documentDigest
    && record.policyVersion === document.policyVersion
    && record.policyRef === document.policyRef
    && record.provenance.authority === OWNER_PROVENANCE.authority
    && record.provenance.documentSource === OWNER_PROVENANCE.documentSource
    && record.provenance.policySource === OWNER_PROVENANCE.policySource
}

function ownedText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asTrustedGrant(value: unknown): TrustedConsentGrant | null {
  if (!isRecord(value)) return null
  const pair = CONSENT_RECORD_PAIRS.find((entry) => entry[0] === value.type && entry[1] === value.purpose)
  if (!pair || typeof value.required !== 'boolean' || (value.state !== 'GRANTED' && value.state !== 'WITHDRAWN')) return null
  const document = isRecord(value.document) ? value.document : null
  const provenance = isRecord(value.provenance) ? value.provenance : null
  if (!document || !provenance) return null
  const version = ownedText(document.version)
  const digest = ownedText(document.digest)
  const publishedAt = ownedText(document.publishedAt)
  const recordedAt = ownedText(provenance.recordedAt)
  const policyRef = ownedText(value.policyRef)
  const policyVersion = ownedText(value.policyVersion)
  const decisionRef = ownedText(value.decisionRef)
  if (!version || !digest || !publishedAt || !recordedAt || !policyRef || !policyVersion || !decisionRef) return null
  if (provenance.authority !== OWNER_PROVENANCE.authority || provenance.documentSource !== OWNER_PROVENANCE.documentSource || provenance.policySource !== OWNER_PROVENANCE.policySource) return null
  return {
    type: pair[0],
    purpose: pair[1],
    required: value.required,
    state: value.state,
    document: { version, digest },
    policyVersion,
    policyRef,
    provenance: {
      authority: OWNER_PROVENANCE.authority,
      documentSource: OWNER_PROVENANCE.documentSource,
      policySource: OWNER_PROVENANCE.policySource,
    },
  }
}

function consentListRecord(raw: unknown): RecordValue | null {
  const envelope = isRecord(raw) ? raw : null
  const data = envelope && isRecord(envelope.data) ? envelope.data : envelope
  const meta = envelope && isRecord(envelope.meta) ? envelope.meta : null
  if (!data || !Array.isArray(data.items)) return null
  if (data.hasMore === true || meta?.hasMore === true) return null
  if (typeof data.nextCursor === 'string' && data.nextCursor) return null
  if (typeof meta?.nextCursor === 'string' && meta.nextCursor) return null
  if (typeof data.total === 'number' && data.total > data.items.length) return null
  return data
}

function exactGrants(raw: unknown): readonly TrustedConsentGrant[] | null {
  const data = consentListRecord(raw)
  if (!data || !Array.isArray(data.items)) return null
  const grants: TrustedConsentGrant[] = []
  for (const rawItem of data.items) {
    const grant = asTrustedGrant(rawItem)
    if (!grant) return null
    grants.push(grant)
  }
  return grants
}

function receiptStatus(raw: unknown, document: B8PublishedConsentDocument): 'match' | 'conflict' | 'malformed' {
  const grant = asTrustedGrant(unwrap(raw))
  if (!grant) return 'malformed'
  return consentGrantMatchesPublication(grant, document) ? 'match' : 'conflict'
}

async function readConsentGrants(isCurrent?: () => boolean): Promise<readonly TrustedConsentGrant[] | 'forbidden' | 'malformed'> {
  requireSameIdentity(isCurrent)
  try {
    const raw = await mobileApiClient.request<unknown>('/iam/consents', { skipAuthRetry: true })
    requireSameIdentity(isCurrent)
    return exactGrants(raw) ?? 'malformed'
  } catch (error) {
    if (error instanceof MobileApiError && error.status === 403) return 'forbidden'
    throw error
  }
}

type ViewedConsentResult = 'accepted' | 'stale' | 'refresh-failed' | 'malformed' | 'unreadable' | 'closed'

/**
 * Writes required documents the learner opened, skipping only an exact own grant.
 * 409 or a conflicting receipt returns stale and does not retry.
 * A malformed receipt stops so the caller can reread before an explicit retry.
 * signRequiredConsents stays on its previous path.
 */
async function acceptViewedRequiredConsents(input: { decisionId: string; viewed: readonly B8PublishedConsentDocument[]; isCurrent?: () => boolean }): Promise<ViewedConsentResult> {
  requireSameIdentity(input.isCurrent)
  const viewed = REQUIRED_PUBLICATION.map(([type, purpose]) => input.viewed.find((document) => document.type === type && document.purpose === purpose))
  if (input.viewed.length !== REQUIRED_PUBLICATION.length || viewed.some((document) => !document)) return 'closed'
  const documents = viewed as B8PublishedConsentDocument[]
  const keys = documents.map((document) => consentDecisionKey(input.decisionId, document.type))
  if (keys.some((key) => !key)) return 'closed'
  for (const document of documents) {
    if (!await digestMatches(document.bodyText, document.documentDigest)) return 'closed'
  }
  const latest = await readIamResumeFacts({ skipAuthRetry: true })
  requireSameIdentity(input.isCurrent)
  if (latest.adultGate !== 'PASSED' || latest.adultLearningAccess !== 'ELIGIBLE' || !explicitIncompleteConsent(latest.consent)) return 'closed'
  if (!sameViewedPublication(documents, latest.consent.publishedDocuments)) return 'stale'
  let own: readonly TrustedConsentGrant[] | 'forbidden' | 'malformed'
  try {
    own = await readConsentGrants(input.isCurrent)
  } catch {
    return 'unreadable'
  }
  if (own === 'forbidden' || own === 'malformed') return 'unreadable'
  const grants = own
  const pending = documents.filter((document) => !grants.some((grant) => consentGrantMatchesPublication(grant, document)))
  for (const document of pending) {
    requireSameIdentity(input.isCurrent)
    const key = consentDecisionKey(input.decisionId, document.type)
    if (!key) return 'closed'
    try {
      const recorded = await mobileApiClient.request<unknown>('/iam/consents', {
        method: 'PUT',
        skipAuthRetry: true,
        data: { type: document.type, version: document.documentVersion, decision: 'ACCEPTED', expectedDocumentDigest: document.documentDigest },
        header: { 'Idempotency-Key': key },
      })
      requireSameIdentity(input.isCurrent)
      const status = receiptStatus(recorded, document)
      if (status === 'malformed') return 'malformed'
      if (status === 'conflict') return 'stale'
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 409) return 'stale'
      throw error
    }
  }
  let confirmed: readonly TrustedConsentGrant[] | 'forbidden' | 'malformed'
  try {
    confirmed = await readConsentGrants(input.isCurrent)
  } catch (error) {
    if (error instanceof MobileApiError && error.status === 403) return 'unreadable'
    throw error
  }
  if (confirmed === 'forbidden') return 'unreadable'
  if (confirmed === 'malformed') return 'malformed'
  const verified = confirmed
  const conflicts = documents.some((document) => {
    const sameType = verified.filter((grant) => grant.type === document.type)
    return sameType.length > 0 && sameType.every((grant) => !consentGrantMatchesPublication(grant, document))
  })
  if (conflicts) return 'stale'
  if (documents.some((document) => !verified.some((grant) => consentGrantMatchesPublication(grant, document)))) return 'malformed'
  const [{ useSessionStore }, { pinia }] = await Promise.all([import('../stores/session'), import('../stores/pinia')])
  requireSameIdentity(input.isCurrent)
  const session = useSessionStore(pinia)
  const identity = session.getMobileApiIdentity()
  const refreshed = identity ? await session.refreshSilentlyForIdentity(identity) : false
  if (input.isCurrent && !input.isCurrent()) return 'refresh-failed'
  return refreshed ? 'accepted' : 'refresh-failed'
}

export const mobileLearnerContentApi = {
  async readOnboardingResume(): Promise<MobileOnboardingResumeRead> {
    const iam = await readIamResumeFacts()
    if (iam.adultGate !== 'PASSED' || iam.adultLearningAccess !== 'ELIGIBLE') return { ...iam, target: { readable: true, saved: false, goal: null, quota: null } }
    const target = await readTargetFact()
    if (target.consentRequired) {
      return {
        adultGate: iam.adultGate,
        adultLearningAccess: iam.adultLearningAccess,
        // A protected read may see older JWT claims than the current IAM record.
        // Preserve the owner fact and request one session refresh; do not re-sign.
        consent: iam.consent,
        sessionRefreshRequired: iam.consent.readable && iam.consent.accepted === true,
        target: { readable: false, saved: false, goal: null, quota: null },
      }
    }
    return { adultGate: iam.adultGate, adultLearningAccess: iam.adultLearningAccess, consent: iam.consent, target }
  },

  acceptViewedRequiredConsents,

  async recordRequiredConsents(clientEventId: string, isCurrent?: () => boolean): Promise<void> {
    await signRequiredConsents(clientEventId, isCurrent)
    const iam = await readIamResumeFacts()
    const accepted = iam.consent.readable && iam.consent.accepted === true
      && !iam.consent.unsatisfiedPurposes.some((item) => item === 'ACCOUNT_TERMS' || item === 'PRIVACY_NOTICE' || item === 'ADULT_LEARNING_ELIGIBILITY')
    if (iam.adultGate === 'PASSED' && !accepted) {
      throw new Error('必要同意尚未在服务端生效，请重试。本页还没提交的内容，离开后不会保留。')
    }
  },

  async readOnboarding(): Promise<MobileOnboardingModel> {
    // Preferences are the canonical source for content locale. Resolve them
    // before requesting locale-specific onboarding options so a cached or
    // former account locale cannot leak into this learning read.
    const preferences = await requestOptional('/learner/preferences')
    const preferenceData = unwrap(preferences)
    const contentLocale = isRecord(preferenceData)
      ? text(preferenceData.contentLocale ?? preferenceData.content_locale, 'en-US')
      : 'en-US'
    const [profile, target, options] = await Promise.all([
      requestOptional(query('/learner/profile', contentLocale)),
      requestOptional(query('/learner/targets', contentLocale)),
      requestOptional(query('/onboarding/options', contentLocale)),
    ])
    return parseOnboarding(profile, target, preferences, options)
  },

  async saveOnboarding(input: { goal: string; quota: number; clientEventId: string; birthYear?: number; ageConfirmed?: boolean; privacyConsent?: boolean; termsConsent?: boolean; consentsRecorded?: boolean }, isCurrent?: () => boolean): Promise<MobileOnboardingModel> {
    requireSameIdentity(isCurrent)
    const consentFields = Boolean(input.birthYear && input.ageConfirmed && input.privacyConsent && input.termsConsent)
    if (!input.goal || !input.quota || (!input.consentsRecorded && !consentFields)) {
      throw new Error(input.consentsRecorded ? '请先选择学习目标和每天时长。' : '请先完成成人确认、同意事项和学习目标。')
    }
    const targetLevel = input.goal === 'ZERO_BASIS' ? 'A1' : input.goal === 'CET_4_6' ? 'B1' : 'B2'

    // A target edit cannot accept documents again on the learner's behalf.
    // Check the current IAM fact; the learner PEP still authorizes each write.
    if (input.consentsRecorded) {
      const iam = await readIamResumeFacts()
      requireSameIdentity(isCurrent)
      const satisfied = iam.adultGate === 'PASSED' && iam.adultLearningAccess === 'ELIGIBLE' && iam.consent.readable && iam.consent.accepted === true
        && !iam.consent.unsatisfiedPurposes.some(item => item === 'ACCOUNT_TERMS' || item === 'PRIVACY_NOTICE' || item === 'ADULT_LEARNING_ELIGIBILITY')
      if (!satisfied) throw new Error('必要同意需重新确认，请返回设置读取当前状态。')
    } else {
      await signRequiredConsents(input.clientEventId, isCurrent)
    }

    // Re-read the owner after checking current IAM facts. A previous attempt may have saved
    // only some steps before the network failed; its new retry key must not
    // start again at version zero or invent a daily task from client content.
    const [profile, existingTarget, existingPreferences] = await Promise.all([
      mobileApiClient.request<unknown>('/learner/profile'),
      mobileApiClient.request<unknown>('/learner/targets').catch((error: unknown) => {
        if (error instanceof MobileApiError && error.status === 404) return null
        throw error
      }),
      mobileApiClient.request<unknown>('/learner/preferences'),
    ])
    requireSameIdentity(isCurrent)
    let currentVersion = requireStateVersion(profile)
    const targetData = unwrap(existingTarget)
    const targetMatches = isRecord(targetData)
      && text(targetData.goalCode) === input.goal
      && number(targetData.dailyQuotaMinutes, -1) === input.quota
      && text(targetData.targetLevel) === targetLevel
      && text(targetData.status) === 'ACTIVE'
    if (!targetMatches) {
      const target = await mobileApiClient.request<unknown>('/learner/targets', {
        method: 'PUT',
        data: { expectedStateVersion: currentVersion, goalCode: input.goal, targetLevel, dailyQuotaMinutes: input.quota, status: 'ACTIVE' },
        header: { 'Idempotency-Key': `${input.clientEventId}-target` },
      })
      requireSameIdentity(isCurrent)
      currentVersion = requireStateVersion(target)
    }
    requireSameIdentity(isCurrent)
    const preferences = unwrap(existingPreferences)
    const preferencesMatch = isRecord(preferences)
      && text(preferences.uiLocale) === 'zh-CN'
      && text(preferences.contentLocale) === 'en-US'
      && text(preferences.timezone) === 'Asia/Shanghai'
      && text(preferences.themeMode) === 'SYSTEM'
      && preferences.highContrast === false
      && text(preferences.motionMode) === 'FULL'
    // Target editing owns the target only; existing preferences belong to settings.
    if (!input.consentsRecorded && !preferencesMatch) {
      await mobileApiClient.request('/learner/preferences', {
        method: 'PATCH',
        data: { expectedStateVersion: currentVersion, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
        header: { 'Idempotency-Key': `${input.clientEventId}-preferences` },
      })
      requireSameIdentity(isCurrent)
    }
    const result = await mobileLearnerContentApi.readOnboarding()
    requireSameIdentity(isCurrent)
    return result
  },

  async readAccount(): Promise<MobileLearnerAccount> {
    const [profile, target, preferences] = await Promise.all([
      mobileApiClient.request<unknown>('/learner/profile'),
      requestOptional('/learner/targets'),
      requestOptional('/learner/preferences'),
    ])
    return parseAccount(profile, target, preferences)
  },

  async savePreferences(input: { themeMode?: MobileThemeMode; highContrast?: boolean; motionMode?: MobileMotionMode; contentLocale?: string; clientEventId: string }, isCurrent?: () => boolean): Promise<MobileLearnerAccount> {
    requireSameIdentity(isCurrent)
    const current = await mobileLearnerContentApi.readAccount()
    requireSameIdentity(isCurrent)
    const data: Record<string, unknown> = { expectedStateVersion: current.stateVersion }
    if (input.contentLocale !== undefined) data.contentLocale = input.contentLocale
    if (input.themeMode !== undefined || input.highContrast !== undefined || input.motionMode !== undefined) {
      data.uiLocale = current.uiLocale
      data.contentLocale = input.contentLocale ?? current.contentLocale
      data.timezone = current.timezone
      data.themeMode = input.themeMode ?? current.themeMode
      data.highContrast = input.highContrast ?? current.highContrast
      data.motionMode = input.motionMode ?? current.motionMode
    }
    if (Object.keys(data).length === 1) throw new Error('没有可保存的学习偏好。')
    await mobileApiClient.request('/learner/preferences', { method: 'PATCH', data, header: { 'Idempotency-Key': input.clientEventId } })
    requireSameIdentity(isCurrent)
    const result = await mobileLearnerContentApi.readAccount()
    requireSameIdentity(isCurrent)
    if (input.contentLocale !== undefined && result.contentLocale !== input.contentLocale) {
      throw new Error('学习内容语言尚未由账户确认，请重试。')
    }
    return result
  },

  async readFirstDay(contentLocale = 'en-US'): Promise<MobileFirstDayModel> {
    const response = await mobileApiClient.request<unknown>(query('/learner/first-day', contentLocale))
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return { state: ['NOT_READY', 'READY', 'DEGRADED'].includes(text(source.state)) ? text(source.state) as MobileFirstDayModel['state'] : 'NOT_READY', profileReady: source.profileReady === true, targetReady: source.targetReady === true, placementStatus: text(source.placementStatus, 'NOT_STARTED'), taskCount: number(source.taskCount), contentEpoch: number(source.contentEpoch), projectionVersion: number(source.projectionVersion, 1) }
  },

  async readPlacement(contentLocale = 'en-US', sessionId?: string | null): Promise<MobilePlacementModel> {
    void contentLocale
    if (!sessionId) return emptyPlacement()
    return parsePlacement(await mobileApiClient.request<unknown>(`/assessment/placement/sessions/${encodeURIComponent(sessionId)}`))
  },

  async startPlacement(contentLocale = 'en-US', clientEventId: string): Promise<MobilePlacementModel> {
    void contentLocale
    return parsePlacement(await mobileApiClient.request<unknown>('/assessment/placement/sessions', {
      method: 'POST',
      data: {},
      header: { 'Idempotency-Key': clientEventId },
    }))
  },

  async retestPlacement(contentLocale = 'en-US', sessionId: string, clientEventId: string): Promise<MobilePlacementModel> {
    void contentLocale
    return parsePlacement(await mobileApiClient.request<unknown>(`/assessment/placement/sessions/${encodeURIComponent(sessionId)}/retest`, {
      method: 'POST',
      data: {},
      header: { 'Idempotency-Key': clientEventId },
    }))
  },

  async submitPlacementAnswer(input: { sessionId: string; questionId: string; selectedKey: string; timeSpentSec: number; contentLocale: string; clientEventId: string; stateVersion?: number | null; itemId?: number | null; itemSequence?: number | null }): Promise<MobilePlacementModel> {
    const stateVersion = input.stateVersion
    const itemId = input.itemId
    const itemSequence = input.itemSequence
    if (stateVersion == null || itemId == null || itemSequence == null || !Number.isSafeInteger(stateVersion) || !Number.isSafeInteger(itemId) || !Number.isSafeInteger(itemSequence) || itemId < 1 || itemSequence < 1 || itemSequence > 10) {
      throw new Error('这题还没有服务端检查点，没有提交。')
    }
    const idempotencyKey = input.clientEventId
    const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [input.selectedKey] }
    const responseDigest = await sha256Hex(JSON.stringify([input.sessionId, itemId, itemSequence, candidateResponse]))
    const data = { expectedStateVersion: stateVersion, itemId, itemSequence, candidateResponse, responseDigest, timeSpentSec: input.timeSpentSec }
    const path = `/assessment/placement/sessions/${encodeURIComponent(input.sessionId)}/responses`
    const post = () => mobileApiClient.request<unknown>(path, { method: 'POST', data, header: { 'Idempotency-Key': idempotencyKey } })
    const readBack = () => mobileLearnerContentApi.readPlacement(input.contentLocale, input.sessionId)
    const reconcile = async (retried: boolean): Promise<MobilePlacementModel> => {
      const latest = await readBack()
      if (placementConflictAction({ stateVersion, itemSequence, itemId }, latest, retried) !== 'retry') {
        return { ...latest, reconciledWithoutReceipt: true }
      }
      try {
        return parsePlacement(await post(), false)
      } catch (error) {
        if (!(error instanceof MobileApiError) || error.status !== 409) throw error
        const afterRetry = await readBack()
        return { ...afterRetry, reconciledWithoutReceipt: true }
      }
    }
    try {
      return parsePlacement(await post(), false)
    } catch (error) {
      if (!(error instanceof MobileApiError) || error.status !== 409) throw error
      return reconcile(false)
    }
  },

  async readHome(contentLocale = 'en-US'): Promise<MobileHomeModel> {
    const [learner, content] = await Promise.all([
      mobileApiClient.request<unknown>(query('/learner/home', contentLocale)),
      mobileApiClient.request<unknown>(query('/content/learner/catalog', contentLocale)),
    ])
    return parseHome(learner, content)
  },

  async readContent(contentCode: string): Promise<MobileContentDetail> {
    return parseContentDetail(await mobileApiClient.request<unknown>(`/content/learner/${encodeURIComponent(contentCode)}`))
  },

  async completeTask(taskId: string, clientEventId: string): Promise<MobileHomeModel | null> {
    const response = await mobileApiClient.request<unknown>(`/onboarding/daily-tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', data: { taskId }, header: { 'Idempotency-Key': clientEventId } })
    return response === undefined ? null : parseHome(response, response)
  },
}

export function mobileLearnerContentError(error: unknown): Error {
  const apiError = mapError(error)
  if (apiError.status === 401) return new Error('请先登录后再保存学习目标。')
  if (apiError.status === 403) return new Error('当前会话没有访问该学习投影的权限。')
  if (apiError.status === 404) return new Error('当前内容版本已下线或暂不可用。')
  return apiError
}
