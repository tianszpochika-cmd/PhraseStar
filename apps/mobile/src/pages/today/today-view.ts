import type { MobileTask } from '../../domain/learner-content'

/** Today route. Login-required is not a page visual: the shared gate redirects. */
export const TODAY_PATH = '/pages/today/today'

const READY = '/static/figma-today-166-11121'
const EMPTY = '/static/figma-today-166-11635'
const OFFLINE = '/static/figma-today-355-5246'
const LOAD_ERROR = '/static/figma-today-355-5315'
const FORBIDDEN = '/static/figma-today-355-5453'

export const TODAY_ASSETS = {
  book: `${READY}/6e0da2fc-7cbc-4062-b0bc-bb67bdd994a5.svg`,
  pencil: `${READY}/0beb39f2-e519-4ae0-89f2-c9cc6a9e1775.svg`,
  done: `${READY}/2d49f875-6146-4701-972c-01b7f2ab183b.svg`,
  check: `${READY}/cd506223-501d-4dc7-8842-dcc6338aae0a.svg`,
  chevR: `${READY}/83db559c-0a12-4f47-95a5-bb6f1d54d4ed.svg`,
  chevL: `${READY}/b4108fd9-b63b-4486-bec7-8d39b000708e.svg`,
  glowReady: `${READY}/24e0ddb7-7f15-4633-88e3-5ac208175aa3.svg`,
  track: `${READY}/eb66e421-46cc-4cba-99b5-055b7facc64b.svg`,
  glowEmpty: `${EMPTY}/b743531d-0bda-45e7-8fd7-74df7e5af9e7.svg`,
  calendar: `${EMPTY}/6497d25f-361a-4dc5-b0db-6a68b7de1f8e.svg`,
  chevEmpty: `${EMPTY}/e39cbc0b-e99f-4c0f-9dd7-edb306f6d569.svg`,
  offlineChev: `${OFFLINE}/95783ea4-506d-4331-844f-73946b70f0d6.svg`,
  offlineGlow: `${OFFLINE}/ab13e961-ef94-4dc8-96eb-a88369d5f50e.svg`,
  offlineMascot: `${OFFLINE}/30fb0de0-e94b-4e24-9146-d82488c588f2.svg`,
  errorChev: `${LOAD_ERROR}/23864862-549b-4c4b-a184-7fcff5690299.svg`,
  errorGlow: `${LOAD_ERROR}/912fb261-3612-4e6f-b5a1-dc9136b1cacd.svg`,
  errorMascot: `${LOAD_ERROR}/c571fe87-3ad4-44c7-adc8-72d2f71a95ff.svg`,
  forbiddenChev: `${FORBIDDEN}/0bdb70d3-3c91-4809-b937-c8ec6361efad.svg`,
  forbiddenGlow: `${FORBIDDEN}/23f7e56a-7c27-4dec-adbd-9687eaa1151d.svg`,
  forbiddenMascot: `${FORBIDDEN}/a48bdbff-8508-4310-aa4f-7ff4dc6aab67.svg`,
} as const

export type TodayVisual =
  | 'loading'
  | 'forbidden'
  | 'offline'
  | 'error'
  | 'ready'
  | 'no-plan'
  | 'completed'
  | 'no-content'
  | 'no-due'
  | 'plan-failed'
  | 'no-tasks'

export interface TodaySnapshot {
  homeStatus: string
  planStatus: string
  taskCount: number
  emptyReason: string | null
}

export interface TodayProgressFacts {
  percent: number
  remaining: number
  target: number
  done: number
}

export interface TodayFrameAssets {
  chev: string
  glow: string
  mascot: string | null
  calendar: string | null
}

/** A blank content pointer does not invent a stem or a launch URL. */
export function canLaunchTask(task: { status: string; contentCode?: string | null }): boolean {
  const code = typeof task.contentCode === 'string' ? task.contentCode.trim() : ''
  return (task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS') && code.length > 0
}

export function launchUrl(task: { id: string; status: string; contentCode?: string | null }): string | null {
  if (!canLaunchTask(task) || typeof task.contentCode !== 'string') return null
  const code = task.contentCode.trim()
  if (!code) return null
  return `/pages/learn/learn?contentCode=${encodeURIComponent(code)}&taskId=${encodeURIComponent(task.id)}`
}

export function observedTopPath(): string | null {
  if (typeof window !== 'undefined' && window.location) {
    const raw = window.location.hash.replace(/^#/, '').trim()
    if (raw) {
      const path = raw.split(/[?#]/, 1)[0] ?? ''
      if (path) return path.startsWith('/') ? path : `/${path}`
    }
  }
  const reader = (globalThis as { getCurrentPages?: () => Array<{ route?: string }> }).getCurrentPages
  if (typeof reader !== 'function') return null
  const pages = reader() ?? []
  const route = pages.length > 0 ? pages[pages.length - 1]?.route : undefined
  if (typeof route !== 'string' || !route.trim()) return null
  const path = route.trim().split(/[?#]/, 1)[0] ?? ''
  return path.startsWith('/') ? path : `/${path}`
}

export function routeStillToday(): boolean {
  const path = observedTopPath()
  return path === null || path === TODAY_PATH
}

export function todayVisual(input: TodaySnapshot): TodayVisual {
  if (input.homeStatus === 'forbidden') return 'forbidden'
  if (input.homeStatus === 'offline') return 'offline'
  if (input.homeStatus === 'error') return 'error'
  if (input.homeStatus === 'idle' || input.homeStatus === 'loading') return 'loading'
  if (input.taskCount > 0) return 'ready'
  if (input.planStatus === 'error') return 'plan-failed'
  if (input.planStatus !== 'ready' && input.planStatus !== 'empty') return 'loading'
  if (input.emptyReason === 'NO_PLAN') return 'no-plan'
  if (input.emptyReason === 'COMPLETED') return 'completed'
  if (input.emptyReason === 'NO_CONTENT') return 'no-content'
  if (input.emptyReason === 'NO_DUE_REVIEW') return 'no-due'
  return 'no-tasks'
}

export function visualDesign(visual: TodayVisual): 'confirmed' | 'pending' {
  if (visual === 'ready' || visual === 'no-plan' || visual === 'offline' || visual === 'forbidden' || visual === 'error' || visual === 'plan-failed') return 'confirmed'
  return 'pending'
}

export function frameAssets(visual: TodayVisual): TodayFrameAssets {
  if (visual === 'offline') {
    return { chev: TODAY_ASSETS.offlineChev, glow: TODAY_ASSETS.offlineGlow, mascot: TODAY_ASSETS.offlineMascot, calendar: null }
  }
  if (visual === 'error' || visual === 'plan-failed') {
    return { chev: TODAY_ASSETS.errorChev, glow: TODAY_ASSETS.errorGlow, mascot: TODAY_ASSETS.errorMascot, calendar: null }
  }
  if (visual === 'forbidden') {
    return { chev: TODAY_ASSETS.forbiddenChev, glow: TODAY_ASSETS.forbiddenGlow, mascot: TODAY_ASSETS.forbiddenMascot, calendar: null }
  }
  if (visual === 'no-plan') {
    return { chev: TODAY_ASSETS.chevEmpty, glow: TODAY_ASSETS.glowEmpty, mascot: null, calendar: TODAY_ASSETS.calendar }
  }
  return { chev: TODAY_ASSETS.chevL, glow: TODAY_ASSETS.glowReady, mascot: null, calendar: null }
}

export function progressFacts(home: { stale?: boolean; targetMinutes?: number; completedMinutes?: number } | null): TodayProgressFacts | null {
  if (!home || home.stale === true) return null
  const target = home.targetMinutes
  const done = home.completedMinutes
  if (typeof target !== 'number' || typeof done !== 'number') return null
  if (!Number.isFinite(target) || !Number.isFinite(done) || target <= 0) return null
  return {
    target,
    done,
    percent: Math.min(100, Math.round((done / target) * 100)),
    remaining: Math.max(0, target - done),
  }
}

export function confirmedDeferredCount(planStatus: string, deferredCount: number | null | undefined): number | null {
  if (planStatus !== 'ready' && planStatus !== 'empty') return null
  if (typeof deferredCount !== 'number' || !Number.isFinite(deferredCount)) return null
  return deferredCount
}

export function taskIcon(status: string): 'done' | 'pencil' | 'book' | null {
  if (status === 'COMPLETED') return 'done'
  if (status === 'IN_PROGRESS') return 'pencil'
  if (status === 'AVAILABLE') return 'book'
  return null
}

export function taskIconSrc(status: string): string | null {
  const icon = taskIcon(status)
  if (icon === 'done') return TODAY_ASSETS.done
  if (icon === 'pencil') return TODAY_ASSETS.pencil
  if (icon === 'book') return TODAY_ASSETS.book
  return null
}

export function taskCopyKey(status: string, minutes: number): string {
  if (status === 'COMPLETED') return minutes > 0 ? 'metaCompleted' : 'statusCompleted'
  if (status === 'IN_PROGRESS') return minutes > 0 ? 'metaActive' : 'statusActive'
  if (status === 'AVAILABLE') return minutes > 0 ? 'metaNew' : 'statusNew'
  if (status === 'LOCKED') return 'statusLocked'
  return 'statusUnavailable'
}

export function emptyMessageKey(visual: TodayVisual): { title: string; body: string; action: string } | null {
  switch (visual) {
    case 'no-plan':
      return { title: 'emptyNoPlanTitle', body: 'emptyNoPlanDescription', action: 'emptyNoPlanAction' }
    case 'completed':
      return { title: 'emptyCompletedTitle', body: 'emptyCompletedDescription', action: 'emptyCompletedAction' }
    case 'no-content':
      return { title: 'emptyNoContentTitle', body: 'emptyNoContentDescription', action: 'emptyNoContentAction' }
    case 'no-due':
      return { title: 'emptyNoDueTitle', body: 'emptyNoDueDescription', action: 'emptyNoDueAction' }
    case 'plan-failed':
      return { title: 'emptyFailedTitle', body: 'emptyFailedDescription', action: 'emptyFailedAction' }
    case 'offline':
      return { title: 'offlineTitle', body: 'offlineBody', action: 'retry' }
    case 'error':
      return { title: 'errorTitle', body: 'errorBody', action: 'retry' }
    case 'forbidden':
      return { title: 'forbiddenTitle', body: 'forbiddenBody', action: 'retry' }
    default:
      return null
  }
}

export function continueTask<T extends MobileTask>(tasks: readonly T[]): T | null {
  return tasks.find((task) => task.status === 'IN_PROGRESS' && canLaunchTask(task))
    ?? tasks.find((task) => canLaunchTask(task))
    ?? null
}
