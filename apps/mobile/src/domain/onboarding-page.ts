/** View mapping for the five confirmed onboarding frames. No eligibility, consent, or save decisions. */

const root = '/static/figma-onboarding-core'

function asset(reference: string, file: string): string {
  return `${root}/${reference}/${file}`
}

const adult = 'onboarding-adult-164-5455'
const consent = 'onboarding-consent-164-5944'
const goals = 'onboarding-goals-164-6595'
const selected = 'onboarding-selected-164-6762'
const summary = 'onboarding-summary-164-7399'

export const onboardingChrome = {
  logo: asset(adult, '135359ff-6586-4498-92ff-3919f4946f60.png'),
  logoGlow: asset(adult, 'ad79d726-9a0a-4286-9449-d7f14699e314.svg'),
  more: asset(adult, '900dd1d4-56ef-46f6-ad78-0ea101edf3f4.svg'),
  blob: asset(adult, '4afbb3bb-ee0d-40e5-b893-b319dd618a2d.svg'),
  blobWide: asset(adult, 'ef3f8ebd-7caa-444a-9ec4-33af5c8bbfb3.svg'),
  blobTall: asset(adult, '501914f0-3efd-44c3-8341-8e24582ed7e7.svg'),
  particles: asset(adult, '1b9cc8ec-9c9a-40b2-a261-3b97fe392f9e.svg'),
  info: asset(adult, 'df708a64-7be6-4bf2-a062-22c6edd738b8.svg'),
  dot: asset(adult, 'eb4ef201-7dc0-4067-9306-edabc006e7d4.svg'),
  file: asset(consent, '8388c731-f53b-4542-8285-fed54ff665c9.svg'),
  history: asset(consent, 'fbec4c37-d6ee-47bb-9e42-c8bfa1275056.svg'),
  chevronDown: asset(consent, 'c20bd241-3e4f-4c60-a42d-9591dce1a697.svg'),
  goalCheck: asset(selected, 'a40f5e4a-e074-4984-864d-fee60649c0bc.svg'),
  schedule: asset(summary, '53a3d13d-85fa-4445-94f6-62ab2e5f94da.svg'),
} as const

const goalArtFiles = {
  FOUNDATION: asset(goals, '85ee9e31-5df0-4784-91cf-0c4def8baa59.svg'),
  COLLEGE_CET: asset(goals, '146a08a0-6016-440f-9a52-26d6c3f53364.svg'),
  POSTGRADUATE_ENGLISH: asset(goals, 'cc17b636-9a0f-4df6-aa14-f22c96829a29.svg'),
  WORKPLACE_DAILY: asset(goals, '97eb67b1-4f52-4bd2-bc83-66fa95d71462.svg'),
} as const

export type OnboardingGoalArtCode = keyof typeof goalArtFiles

export function goalArt(code: string | null): { src: string; width: number; height: number } | null {
  if (code !== 'FOUNDATION' && code !== 'COLLEGE_CET' && code !== 'POSTGRADUATE_ENGLISH' && code !== 'WORKPLACE_DAILY') return null
  return { src: goalArtFiles[code], width: 32, height: 32 }
}

/** Confirmed core frames only. Other b01–b16 variants stay on this chrome with truthful status copy. */
export function onboardingFrameRef(step: string, goalSelected: boolean): string {
  if (step === 'gate') return '164:5455'
  if (step === 'consent') return '164:5944'
  if (step === 'goal') return goalSelected ? '164:6762' : '164:6595'
  if (step === 'assessment') return '164:7399'
  return ''
}
