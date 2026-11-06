import {
  onboardingRemainingStepLabels,
  selectOnboardingResumeStep,
  showOnboardingGuide,
  type OnboardingResumeFacts,
  type OnboardingResumeStep,
} from './onboarding-resume'

export const HOME_PAGE_PATH = '/pages/home/home'

/** Private home reads are allowed only while this route is still the top page. */
export function homeStillOnPage(path: string | null | undefined): boolean {
  return path === HOME_PAGE_PATH
}

/**
 * The adult-gate await can finish after the learner has already left.
 * A live entry and an allowed gate are not enough once the hash is no longer Home.
 */
export function homePrivateReadAllowed(path: string | null | undefined, entryLive: boolean, accessAllowed: boolean): boolean {
  return entryLive && accessAllowed && homeStillOnPage(path)
}

export function homeGuideVisible(
  facts: OnboardingResumeFacts | null | undefined,
  placementDone: boolean,
  serverPlacementUnknown = false,
): boolean {
  if (!facts) return false
  return showOnboardingGuide(facts, placementDone, { serverPlacementUnknown })
}

export function homeGuideStep(facts: OnboardingResumeFacts | null | undefined): OnboardingResumeStep | null {
  if (!facts) return null
  const step = selectOnboardingResumeStep(facts)
  return step === 'rejected' ? null : step
}

/** Setup steps return to onboarding. A saved goal that still needs placement opens assessment. */
export function homeGuidePath(step: OnboardingResumeStep | null): '/pages/onboarding/onboarding' | '/pages/assessment/assessment' | null {
  if (!step || step === 'rejected') return null
  return step === 'assessment' ? '/pages/assessment/assessment' : '/pages/onboarding/onboarding'
}

export function homeGuideRemainingLabels(facts: OnboardingResumeFacts, placementDone: boolean): readonly string[] {
  return onboardingRemainingStepLabels(facts, placementDone)
}

export interface HomeTaskRef {
  id?: string | null
  status?: string | null
  contentCode?: string | null
}

/** A task opens learning only with a real id and content code. Locked, completed, and blank refs do not. */
export function homeTaskHref(task: HomeTaskRef | null | undefined): string | null {
  const id = task?.id?.trim() ?? ''
  const code = task?.contentCode?.trim() ?? ''
  if (!id || !code) return null
  if (task?.status !== 'AVAILABLE' && task?.status !== 'IN_PROGRESS') return null
  return `/pages/learn/learn?contentCode=${encodeURIComponent(code)}&taskId=${encodeURIComponent(id)}`
}

export function homeContentHref(contentCode: string | null | undefined): string | null {
  const code = contentCode?.trim() ?? ''
  if (!code) return null
  return `/pages/learn/learn?contentCode=${encodeURIComponent(code)}`
}

/**
 * Percent comes only from server minutes and a positive target.
 * Stale, empty, or zero-target reads do not become 0%. There is no streak input.
 */
export function homeProgressPercent(input: {
  completedMinutes: number
  targetMinutes: number
  stale: boolean
  taskCount: number
}): number | null {
  if (input.stale || input.taskCount <= 0 || !(input.targetMinutes > 0) || !Number.isFinite(input.completedMinutes)) return null
  return Math.min(100, (input.completedMinutes / input.targetMinutes) * 100)
}

/** Breakpoints shared with the home page CSS: compact ≤359, phone <768, tablet <1024, wide otherwise. */
export function homeLayoutSpan(width: number): 'compact' | 'phone' | 'tablet' | 'wide' {
  if (width <= 359) return 'compact'
  if (width < 768) return 'phone'
  if (width < 1024) return 'tablet'
  return 'wide'
}
