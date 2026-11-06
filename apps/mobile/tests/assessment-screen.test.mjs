import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '../../..')
const screenPath = path.join(root, 'apps/mobile/src/pages/assessment/assessment-screen.ts')
const pagePath = path.join(root, 'apps/mobile/src/pages/assessment/assessment.vue')
const page = fs.readFileSync(pagePath, 'utf8')
const template = page.slice(page.indexOf('<template>'), page.lastIndexOf('</template>'))
const script = page.slice(page.indexOf('<script'), page.indexOf('</script>'))

const transpiled = ts.transpileModule(fs.readFileSync(screenPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: screenPath,
}).outputText
const transpiledPath = path.join(os.tmpdir(), `assessment-screen-${process.pid}.mjs`)
fs.writeFileSync(transpiledPath, transpiled)
const screen = await import(pathToFileURL(transpiledPath).href)

const quiet = {
  leave: false,
  skipped: false,
  hasReport: false,
  hasQuestion: false,
  selected: false,
  unconfirmed: false,
  guide: false,
  checkpoint: false,
}

test('helper import matches the template asset and screen bindings', () => {
  const imported = script.match(/import \{([^}]+)\} from '\.\/assessment-screen'/)
  assert.ok(imported)
  const names = imported[1].split(',').map((item) => item.trim()).filter(Boolean).sort()
  assert.deepEqual(names, ['assessmentAssetsFor', 'assessmentResumeCount', 'assessmentScreen'])
  const assets = screen.assessmentAssetsFor('question')
  const used = [...template.matchAll(/visualAssets\.([A-Za-z0-9_]+)/g)].map((match) => match[1])
  assert.ok(used.length >= 8)
  for (const key of new Set(used)) assert.equal(Object.hasOwn(assets, key), true, key)
  assert.match(template, /data-assessment-screen="visualScreen"/)
  assert.match(template, /visualScreen === 'resume'/)
  assert.match(template, /visualScreen === 'question'/)
  assert.match(script, /assessmentScreen\(\{/)
  assert.match(script, /assessmentAssetsFor\(visualScreen\.value\)/)
  assert.match(script, /assessmentResumeCount\(visualScreen\.value, store\.placement\.acceptedSequence\)/)
})

test('resume, selection and unconfirmed stay distinct page facts', () => {
  assert.equal(screen.assessmentScreen({ ...quiet, checkpoint: true }), 'resume')
  assert.equal(screen.assessmentScreen({ ...quiet, hasQuestion: true, selected: true }), 'selected')
  assert.equal(screen.assessmentScreen({ ...quiet, hasQuestion: true, selected: true, unconfirmed: true }), 'unconfirmed')
  assert.equal(screen.assessmentScreen({ ...quiet, hasQuestion: true, leave: true, selected: true }), 'leave')
  assert.equal(screen.assessmentResumeCount('resume', 2), 2)
  assert.equal(screen.assessmentResumeCount('resume', 0), null)
  assert.equal(screen.assessmentResumeCount('selected', 2), null)
  assert.match(template, /id="assessment-reload"/)
  assert.match(template, /:id="`assessment-option-\$\{option\.key\}`"/)
  assert.doesNotMatch(template, /id="assessment-option-\$\{option\.key\}"/)
  assert.match(template, /aria-pressed="selectedKey === option\.key"/)
  assert.match(template, /errorKey === 'answerUnconfirmed'/)
  assert.match(script, /reconciledWithoutReceipt \? ''/)
  assert.match(script, /responseOutcome === 'FULL'/)
  assert.match(script, /responseOutcome === 'ZERO'/)
})

test('leave cancel and safe destinations stay on the existing navigation gate', () => {
  assert.match(script, /settings: '\/pages\/settings\/settings', home: '\/pages\/home\/home', today: '\/pages\/today\/today'/)
  assert.match(script, /function requestLeave\(destination: Destination\)/)
  assert.match(script, /function cancelLeave\(\)/)
  assert.match(script, /async function confirmLeave\(\)/)
  assert.match(script, /switchTab\(\{ url: '\/pages\/home\/home' \}\)/)
  assert.match(script, /navigateTo\(\{ url: destination === 'settings' \? '\/pages\/settings\/settings' : '\/pages\/today\/today' \}\)/)
  assert.match(template, /id="assessment-leave-cancel"/)
  assert.match(template, /id="assessment-leave-confirm"/)
  assert.match(template, /@click="cancelLeave"/)
  assert.match(template, /@click="confirmLeave"/)
  assert.match(template, /@click="requestLeave\('back'\)"/)
  assert.match(template, /@click="requestLeave\('settings'\)"/)
  assert.match(template, /@click="requestLeave\('home'\)"/)
  assert.match(template, /@click="requestLeave\('today'\)"/)
  assert.match(script, /navigationPermit/)
  assert.match(script, /heldCheckpoint/)
  assert.match(page, /markPlacementEntryReached/)
  assert.match(page, /placementScorePercent\(report\.value\?\.score\)/)
})

test('intro heading, safe dock, and disabled CTA stay in the page styles', () => {
  assert.match(template, /class="assessment-kicker"/)
  assert.match(template, /class="assessment-guide-title" role="heading" aria-level="2">\{\{ mobileT\('assessment\.start'\) \}\}/)
  assert.match(template, /class="assessment-guide-lead">\{\{ mobileT\('assessment\.introduction'\) \}\}/)
  assert.match(template, /class="assessment-description assessment-reason">\{\{ mobileT\('assessment\.answerDescription'\) \}\}/)
  assert.match(template, /class="assessment-description assessment-reason">\{\{ mobileT\('assessment\.resultDescription'\) \}\}/)
  assert.doesNotMatch(template, /assessment-point-title"><image/)
  assert.match(template, /class="assessment-actions assessment-dock"/)
  assert.match(script, /copy\('questionCount', \{ current: number\(question\.value\?\.stepIndex \?\? 0\), total: number\(totalSteps\.value\) \}\)/)
  assert.doesNotMatch(template, /共 4 题|共 10 题|totalItemCount/)
  assert.match(page, /\.assessment-page \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*height: 100dvh;/)
  assert.match(page, /\.assessment-scroll \{[^}]*overflow: auto;/)
  assert.match(page, /\.assessment-dock \{[^}]*padding-bottom: calc\(12px \+ env\(safe-area-inset-bottom\)\);/)
  assert.match(page, /@media \(max-width: 360px\)/)
  assert.match(page, /@media \(max-width: 390px\)/)
  assert.match(page, /@media \(min-width: 768px\)/)
  assert.match(page, /\.assessment-page \.assessment-primary\[disabled\][^{]*\{[^}]*background-color: var\(--yx-surface-soft\);[^}]*background-image: none;[^}]*opacity: 1;/)
  assert.match(page, /high-contrast[\s\S]*\.assessment-primary\[disabled\][^{]*\{[^}]*background-color: var\(--yx-surface-card\);[^}]*background-image: none;/)
  assert.doesNotMatch(page, /opacity:\s*\.5|opacity:\s*0\.55/)
})

test('the page does not add a sample question, receipt, or placement write', () => {
  assert.equal(page.includes('placement/sessions'), false)
  assert.equal(page.includes('fetch('), false)
  assert.equal(page.includes('If it'), false)
  assert.equal(page.includes('tomorrow'), false)
  assert.equal(page.includes('will rain'), false)
  assert.equal(page.includes('正确选项'), false)
  assert.equal(page.includes('已存本机'), false)
  assert.equal(page.includes('可离线答完'), false)
  assert.equal(screen.assessmentOriginalFiles.length, 24)
  assert.match(screen.assessmentAssetsFor('resume').clock, /36bc362e-a43f-40a8-a6c3-ee0ac3a94b4e\.svg$/)
  assert.match(screen.assessmentAssetsFor('selected').check, /7bcd3f3e-5553-4792-86e7-d2ff186fdd54\.svg$/)
})

test('in-scope assessment assets, copy, and contracts stay on the page', () => {
  const locale = fs.readFileSync(path.join(root, 'packages/i18n/src/mobile-experience.ts'), 'utf8')
  const copy = [
    "reload: '重新读取'",
    "reload: 'Read again'",
    "introduction: '共 10 道题，了解你现在的英语起点。'",
    "introduction: 'Answer 10 questions to understand your current English starting point.'",
    "correct: '刚才提交的这题答对了。'",
    "correct: 'Your last answer was correct.'",
    "incorrect: '刚才提交的这题没有答对。'",
    "incorrect: 'Your last answer was incorrect.'",
  ]
  assert.match(locale, /function assessmentCopy\(en: boolean\)/)
  for (const line of copy) assert.equal(locale.includes(line), true, line)
  assert.equal(screen.assessmentOriginalFiles.length, 24)
  assert.equal(screen.assessmentOriginalFiles.every((file) => file.startsWith('/static/figma-assessment/') && file.endsWith('.svg')), true)
  assert.equal(page.includes("from '../../api/"), false)
  assert.equal(page.includes('placement/sessions'), false)
  assert.equal(page.includes('fetch('), false)
})
