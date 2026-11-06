/**
 * Page-local assessment screen map.
 * Visual chrome only. It does not read, score, or invent a question, receipt, or endpoint.
 * Feedback timing stays on the page: FULL or ZERO from the saved response, and never a 409 reconcile.
 */

const ROOT = '/static/figma-assessment'

export type AssessmentVisualScreen =
  | 'intro'
  | 'question'
  | 'resume'
  | 'selected'
  | 'unconfirmed'
  | 'leave'
  | 'report'
  | 'skipped'
  | 'pending'

export interface AssessmentScreenInput {
  leave: boolean
  skipped: boolean
  hasReport: boolean
  hasQuestion: boolean
  selected: boolean
  unconfirmed: boolean
  guide: boolean
  checkpoint: boolean
}

export interface AssessmentAssetSet {
  back: string
  sparkles: string
  list: string
  chart: string
  dot: string
  dotAlt: string
  target: string
  questionDot: string
  clock: string
  resumeDot: string
  check: string
  error: string
}

const intro = `${ROOT}/assessment-intro-166-1209`
const question = `${ROOT}/assessment-question-166-1467`
const resume = `${ROOT}/assessment-resume-166-1396`
const selected = `${ROOT}/assessment-selected-166-1552`
const unconfirmed = `${ROOT}/assessment-unconfirmed-166-1918`
const leave = `${ROOT}/assessment-leave-confirm-166-2015`

/** Original SVGs from the six confirmed manifests. No downloaded stand-ins. */
export const assessmentAssets: AssessmentAssetSet = {
  back: `${intro}/52901c17-34ea-47c1-b109-54e14742ea9e.svg`,
  sparkles: `${intro}/b098807e-5be4-4b41-9a91-66379428779c.svg`,
  list: `${intro}/d0d46b64-a591-46dd-bb15-45eedf264ec6.svg`,
  chart: `${intro}/18481c47-9996-4fe1-ae50-73836a126525.svg`,
  dot: `${intro}/2b75b54a-e8dd-4feb-bc70-b84b72e85c31.svg`,
  dotAlt: `${intro}/cbc79026-a716-4db6-9c9a-b53aaacbc11a.svg`,
  target: `${question}/34eb6ed2-103c-441b-9848-7d83efaab491.svg`,
  questionDot: `${question}/1f94acf0-3dc4-4219-9ad2-3f7380ac7226.svg`,
  clock: `${resume}/36bc362e-a43f-40a8-a6c3-ee0ac3a94b4e.svg`,
  resumeDot: `${resume}/b0f626c7-cec2-4cd4-b292-0a816b9d9a39.svg`,
  check: `${selected}/7bcd3f3e-5553-4792-86e7-d2ff186fdd54.svg`,
  error: `${unconfirmed}/867b8b2e-e064-4dbb-9dac-17d4fd5763da.svg`,
}

const screenBack: Record<AssessmentVisualScreen, string> = {
  intro: assessmentAssets.back,
  question: `${question}/6b5230f9-e317-4205-9d2b-f0ddc8ffa558.svg`,
  resume: `${resume}/0ab34b69-91a5-4fe4-a5c6-046975a626ce.svg`,
  selected: `${selected}/01f823d0-40c2-4544-8e80-42ff9c882aa2.svg`,
  unconfirmed: `${unconfirmed}/866c3734-840b-460e-9712-bf7c50c4d7e3.svg`,
  leave: `${leave}/00bb7507-9029-4994-806d-ae1d9a8a06b0.svg`,
  report: assessmentAssets.back,
  skipped: assessmentAssets.back,
  pending: assessmentAssets.back,
}

const screenTarget: Record<AssessmentVisualScreen, string> = {
  intro: assessmentAssets.target,
  question: assessmentAssets.target,
  resume: assessmentAssets.target,
  selected: `${selected}/2bfcf823-1ccf-4c9a-9d5d-f633d19dee30.svg`,
  unconfirmed: `${unconfirmed}/c951a4b3-b6ea-4f0e-b2dd-856312eea009.svg`,
  leave: `${leave}/73fef0e9-b3db-4702-9895-2279bae79079.svg`,
  report: assessmentAssets.target,
  skipped: assessmentAssets.target,
  pending: assessmentAssets.target,
}

/** Every original file from the six manifests, including tip dots that have no truthful extra row. */
export const assessmentOriginalFiles = [
  `${intro}/52901c17-34ea-47c1-b109-54e14742ea9e.svg`,
  `${intro}/b098807e-5be4-4b41-9a91-66379428779c.svg`,
  `${intro}/d0d46b64-a591-46dd-bb15-45eedf264ec6.svg`,
  `${intro}/18481c47-9996-4fe1-ae50-73836a126525.svg`,
  `${intro}/2b75b54a-e8dd-4feb-bc70-b84b72e85c31.svg`,
  `${intro}/cbc79026-a716-4db6-9c9a-b53aaacbc11a.svg`,
  `${question}/6b5230f9-e317-4205-9d2b-f0ddc8ffa558.svg`,
  `${question}/34eb6ed2-103c-441b-9848-7d83efaab491.svg`,
  `${question}/1f94acf0-3dc4-4219-9ad2-3f7380ac7226.svg`,
  `${resume}/0ab34b69-91a5-4fe4-a5c6-046975a626ce.svg`,
  `${resume}/36bc362e-a43f-40a8-a6c3-ee0ac3a94b4e.svg`,
  `${resume}/b0f626c7-cec2-4cd4-b292-0a816b9d9a39.svg`,
  `${resume}/fb7cbf9c-dd4f-40ab-bdb5-82934a39457d.svg`,
  `${resume}/ae2ba92f-48eb-4e20-a98d-b608b3bde457.svg`,
  `${selected}/7bcd3f3e-5553-4792-86e7-d2ff186fdd54.svg`,
  `${selected}/01f823d0-40c2-4544-8e80-42ff9c882aa2.svg`,
  `${selected}/2bfcf823-1ccf-4c9a-9d5d-f633d19dee30.svg`,
  `${unconfirmed}/a037ec97-817c-4150-88b4-9c1528717ef0.svg`,
  `${unconfirmed}/866c3734-840b-460e-9712-bf7c50c4d7e3.svg`,
  `${unconfirmed}/c951a4b3-b6ea-4f0e-b2dd-856312eea009.svg`,
  `${unconfirmed}/867b8b2e-e064-4dbb-9dac-17d4fd5763da.svg`,
  `${leave}/3aeed369-542d-41dc-b152-b6d8adce119a.svg`,
  `${leave}/00bb7507-9029-4994-806d-ae1d9a8a06b0.svg`,
  `${leave}/73fef0e9-b3db-4702-9895-2279bae79079.svg`,
] as const

const screenCheck: Record<AssessmentVisualScreen, string> = {
  intro: assessmentAssets.check,
  question: assessmentAssets.check,
  resume: assessmentAssets.check,
  selected: assessmentAssets.check,
  unconfirmed: `${unconfirmed}/a037ec97-817c-4150-88b4-9c1528717ef0.svg`,
  leave: `${leave}/3aeed369-542d-41dc-b152-b6d8adce119a.svg`,
  report: assessmentAssets.check,
  skipped: assessmentAssets.check,
  pending: assessmentAssets.check,
}

/** Which confirmed frame the current page facts should resemble. */
export function assessmentScreen(input: AssessmentScreenInput): AssessmentVisualScreen {
  if (input.leave && input.hasQuestion) return 'leave'
  if (input.skipped) return 'skipped'
  if (input.hasReport) return 'report'
  if (input.hasQuestion && input.unconfirmed) return 'unconfirmed'
  if (input.hasQuestion && input.selected) return 'selected'
  if (input.hasQuestion) return 'question'
  if (input.guide) return 'intro'
  if (input.checkpoint) return 'resume'
  return 'pending'
}

export function assessmentAssetsFor(screen: AssessmentVisualScreen): AssessmentAssetSet {
  return {
    ...assessmentAssets,
    back: screenBack[screen],
    target: screenTarget[screen],
    check: screenCheck[screen],
  }
}

/** Server accepted count on a held checkpoint. No total is invented when the question is absent. */
export function assessmentResumeCount(screen: AssessmentVisualScreen, acceptedSequence: number): number | null {
  if (screen !== 'resume') return null
  if (!Number.isFinite(acceptedSequence) || acceptedSequence <= 0) return null
  return Math.floor(acceptedSequence)
}
